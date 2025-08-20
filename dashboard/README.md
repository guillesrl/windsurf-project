# Dashboard de Restaurante

Panel de control para gestión de restaurante que muestra pedidos, reservas y menú.

## Requisitos

- Python 3.7+
- Cuenta de Google Cloud Platform
- Cuenta de NocoDB

## Configuración

1. Clona el repositorio
2. Crea un entorno virtual:
   ```bash
   python -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   ```
3. Instala dependencias:
   ```bash
   pip install -r requirements.txt
   ```
4. Configura las credenciales de Google Cloud:
   - Ve a [Google Cloud Console](https://console.cloud.google.com/)
   - Crea un nuevo proyecto
   - Habilita las APIs de Google Sheets y Google Calendar
   - Crea una cuenta de servicio y descarga el archivo JSON
   - Renombra el archivo a `credentials.json` y colócalo en la carpeta del proyecto

5. Configura las variables de entorno:
   - Copia `.env.example` a `.env`
   - Añade tu token de NocoDB

## Uso

1. Inicia el servidor:
   ```bash
   python app.py
   ```
2. Abre tu navegador en `http://localhost:5000`

## Características

- **Pedidos**: Muestra los últimos pedidos de Google Sheets
- **Reservas**: Calendario interactivo con las reservas de Google Calendar
- **Menú**: Muestra el menú del día desde NocoDB

## Estructura del Proyecto

- `app.py`: Aplicación principal de Flask
- `templates/`: Plantillas HTML
- `static/`: Archivos estáticos (CSS, JS, imágenes)
- `requirements.txt`: Dependencias de Python
- `.env`: Variables de entorno (no incluido en el repositorio)
