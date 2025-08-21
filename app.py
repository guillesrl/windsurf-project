from flask import Flask, render_template, jsonify, request
import os
from datetime import datetime, timedelta
import json
import requests
from google.oauth2 import service_account
from googleapiclient.discovery import build
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configuration
GOOGLE_SHEETS_CREDENTIALS = os.getenv('GOOGLE_SHEETS_CREDENTIALS')
GOOGLE_CALENDAR_ID = os.getenv('GOOGLE_CALENDAR_ID')
NOCODB_API_KEY = os.getenv('NOCODB_API_KEY')
NOCODB_BASE_URL = "https://app.nocodb.com"  # Cambia esto por tu URL base de NocoDB si es diferente
NOCODB_TABLE_ID = "mm5d1hlr7jmcgq4"  # ID de tu tabla en NocoDB
NOCODB_API_URL = f"{NOCODB_BASE_URL.rstrip('/')}/api/v2/tables/{NOCODB_TABLE_ID}"  # Sin /records al final

# Verificar variables de entorno requeridas
if not NOCODB_API_KEY:
    print("ADVERTENCIA: NOCODB_API_KEY no está configurada. La funcionalidad del menú no estará disponible.")
    print("Por favor, cree un archivo .env en la raíz del proyecto con la siguiente configuración:")
    print("NOCODB_API_KEY=su_clave_api_aquí")

# Initialize Google Sheets
def init_google_sheets():
    try:
        creds_dict = json.loads(GOOGLE_SHEETS_CREDENTIALS)
        scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
        creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        client = gspread.authorize(creds)
        return client
    except Exception as e:
        print(f"Error initializing Google Sheets: {e}")
        return None

# Initialize Google Calendar
def init_google_calendar():
    try:
        creds_dict = json.loads(GOOGLE_SHEETS_CREDENTIALS)  # Reusing same credentials
        credentials = service_account.Credentials.from_service_account_info(
            creds_dict,
            scopes=['https://www.googleapis.com/auth/calendar.readonly']
        )
        service = build('calendar', 'v3', credentials=credentials)
        return service
    except Exception as e:
        print(f"Error initializing Google Calendar: {e}")
        return None

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/orders')
def get_orders():
    try:
        client = init_google_sheets()
        if not client:
            return jsonify({"error": "Failed to initialize Google Sheets"}), 500
            
        sheet = client.open_by_key("1EHbcN_L1US3zvnNxZwHyxMISndB8YYry_nhE5nJ3Xy8").sheet1
        records = sheet.get_all_records()
        return jsonify(records)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/reservations')
def get_reservations():
    try:
        print("\n=== DEBUG: Starting get_reservations() ===")
        
        # Verify environment variables
        if not GOOGLE_SHEETS_CREDENTIALS:
            error_msg = "GOOGLE_SHEETS_CREDENTIALS environment variable is not set"
            print(f"ERROR: {error_msg}")
            return jsonify({"error": error_msg}), 500
            
        if not GOOGLE_CALENDAR_ID:
            error_msg = "GOOGLE_CALENDAR_ID environment variable is not set"
            print(f"ERROR: {error_msg}")
            return jsonify({"error": error_msg}), 500
        
        # Parse date parameters
        date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        print(f"DEBUG: Using date: {date_str}")
        
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError as e:
            error_msg = f"Invalid date format. Use YYYY-MM-DD. Error: {str(e)}"
            print(f"ERROR: {error_msg}")
            return jsonify({"error": error_msg}), 400
            
        # Format dates in ISO 8601 format with timezone
        time_min = date.replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + 'Z'
        time_max = (date.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat() + 'Z'
        
        print("DEBUG: Initializing Google Calendar service...")
        service = init_google_calendar()
        if not service:
            error_msg = "Failed to initialize Google Calendar service"
            print(f"ERROR: {error_msg}")
            return jsonify({"error": error_msg}), 500
            
        print(f"DEBUG: Fetching events from calendar: {GOOGLE_CALENDAR_ID}")
        print(f"DEBUG: Time range: {time_min} to {time_max}")
        
        try:
            events_result = service.events().list(
                calendarId=GOOGLE_CALENDAR_ID,
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            print(f"DEBUG: Found {len(events)} events")
            if events:
                print(f"DEBUG: First event: {events[0].get('summary', 'No summary')}")
                
            return jsonify(events)
            
        except Exception as api_error:
            error_msg = f"Google Calendar API error: {str(api_error)}"
            print(f"ERROR: {error_msg}")
            return jsonify({"error": error_msg}), 500
            
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        print(f"ERROR: {error_msg}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": error_msg}), 500

@app.route('/api/menu')
def get_menu():
    try:
        # Obtener parámetros de paginación
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 25, type=int)
        offset = (page - 1) * limit
        
        # Configurar parámetros de la solicitud según la API v2 de NocoDB
        params = {
            'offset': offset,
            'limit': limit,
            'sort': 'Id',  # Ordenar por ID para consistencia en la paginación
            'where': '',   # Filtro vacío para obtener todos los registros
        }
        
        # Configurar headers con el token de autenticación
        headers = {
            'xc-token': NOCODB_API_KEY,
            'accept': 'application/json',
            'xc-db-alias': 'db'  # Alias de la base de datos en NocoDB
        }
        
        # Construir la URL correcta para la API v2 de NocoDB
        api_url = f"{NOCODB_BASE_URL.rstrip('/')}/api/v2/tables/{NOCODB_TABLE_ID}/records"
        
        print(f"DEBUG: Realizando petición a: {api_url}")
        print(f"DEBUG: Headers: {headers}")
        print(f"DEBUG: Parámetros: {params}")
        
        # Realizar la petición a la API de NocoDB
        response = requests.get(
            api_url,
            headers=headers,
            params=params,
            timeout=30  # Timeout de 30 segundos
        )
        
        # Verificar si la petición fue exitosa
        response.raise_for_status()
        
        # Procesar la respuesta
        data = response.json()
        print(f"DEBUG: Respuesta de la API: {json.dumps(data, indent=2)[:1000]}...")  # Limitar el tamaño del log
        
        # Verificar el formato de la respuesta y extraer la lista de ítems
        if isinstance(data, dict):
            print(f"DEBUG: La respuesta es un diccionario con claves: {list(data.keys())}")
            if 'list' in data:
                items = data['list']
                print(f"DEBUG: Se encontraron {len(items)} ítems en la propiedad 'list'")
                total = data.get('pageInfo', {}).get('totalRows', len(items))
                print(f"DEBUG: Total de filas según pageInfo: {total}")
            elif 'rows' in data:
                items = data['rows']
                print(f"DEBUG: Se encontraron {len(items)} ítems en la propiedad 'rows'")
                total = data.get('pageInfo', {}).get('totalRows', len(items))
            else:
                print(f"WARNING: No se encontraron ítems en la respuesta. Datos recibidos: {data}")
                items = []
                total = 0
        elif isinstance(data, list):
            print(f"DEBUG: La respuesta es una lista con {len(data)} elementos")
            items = data
            total = len(items)
        else:
            print(f"WARNING: Formato de respuesta inesperado: {type(data)}")
            items = []
            total = 0
            
        print(f"DEBUG: Total de ítems a devolver: {len(items)}")
        
        # Retornar la respuesta en un formato consistente
        return jsonify({
            'items': items,
            'pageInfo': {
                'totalRows': total,
                'page': page,
                'pageSize': limit,
                'isFirstPage': page == 1,
                'isLastPage': offset + len(items) >= total if total > 0 else True,
                'totalPages': (total + limit - 1) // limit if total > 0 else 1
            }
        })
        
    except requests.exceptions.RequestException as e:
        # Obtener más detalles del error
        error_details = {
            "error": "Error al conectar con la API de NocoDB",
            "message": str(e),
            "type": type(e).__name__
        }
        
        # Si hay respuesta, incluir detalles de la respuesta HTTP
        if hasattr(e, 'response') and e.response is not None:
            error_details.update({
                "status_code": e.response.status_code,
                "response_text": e.response.text[:1000]  # Limitar el tamaño para no hacer el log demasiado grande
            })
        
        app.logger.error(f"Error en la API de NocoDB: {json.dumps(error_details, indent=2)}")
        
        # Devolver un mensaje de error útil
        return jsonify({
            "error": "Error al obtener el menú",
            "details": "No se pudo conectar con el servidor de datos",
            "debug": error_details if app.debug else None
        }), 500
        
    except Exception as e:
        # Manejar otros errores inesperados
        import traceback
        error_trace = traceback.format_exc()
        app.logger.error(f"Error inesperado en /api/menu: {str(e)}\n{error_trace}")
        
        return jsonify({
            "error": "Error interno del servidor",
            "message": str(e),
            "trace": error_trace if app.debug else None
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
