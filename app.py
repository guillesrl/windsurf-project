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
NOCODB_API_URL = "https://app.nocodb.com/api/v2/tables/mm5d1hlr7jmcgq4/records"

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
        # Extract token if the full URL is provided in the .env file
        token = NOCODB_API_KEY
        if NOCODB_API_KEY.startswith('http'):
            # A basic attempt to find a token in the URL, this might need adjustment
            # Assuming the token is passed as a header or param, which isn't standard in a URL itself.
            # For NocoDB, the token is a separate value. Let's assume the user has to fix it,
            # but add a print statement to guide them.
            print("Warning: NOCODB_API_KEY appears to be a URL. It should be a secret token.")

        headers = {
            'xc-token': token,
            'Content-Type': 'application/json'
        }
        response = requests.get(NOCODB_API_URL, headers=headers)
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
