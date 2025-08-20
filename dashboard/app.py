from flask import Flask, render_template, jsonify, request
import gspread
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import requests

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Google Sheets Setup
SHEET_ID = '1EHbcN_L1US3zvnNxZwHyxMISndB8YYry_nhE5nJ3Xy8'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/calendar.readonly']

# NocoDB Config
NOCODB_URL = 'https://app.nocodb.com/api/v1/db/data/w0fcqz7q/p5d5wnzpxfdsoix/mm5d1hlr7jmcgq4'
NOCODB_TOKEN = os.getenv('NOCODB_TOKEN')

# Initialize Google credentials
def get_google_creds():
    creds = service_account.Credentials.from_service_account_file(
        'credentials.json', scopes=SCOPES)
    return creds

# Get orders from Google Sheets
def get_orders():
    try:
        creds = get_google_creds()
        client = gspread.authorize(creds)
        sheet = client.open_by_key(SHEET_ID).sheet1
        return sheet.get_all_records()
    except Exception as e:
        print(f"Error accessing Google Sheets: {e}")
        return []

# Get calendar events
def get_calendar_events(date=None):
    try:
        if date is None:
            date = datetime.now()
        
        creds = get_google_creds()
        service = build('calendar', 'v3', credentials=creds)
        
        time_min = date.replace(hour=0, minute=0, second=0).isoformat() + 'Z'
        time_max = (date + timedelta(days=1)).replace(hour=0, minute=0, second=0).isoformat() + 'Z'
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        return events_result.get('items', [])
    except Exception as e:
        print(f"Error accessing Google Calendar: {e}")
        return []

# Get menu from NocoDB
def get_menu():
    try:
        headers = {
            'xc-token': NOCODB_TOKEN,
            'Content-Type': 'application/json'
        }
        response = requests.get(NOCODB_URL, headers=headers)
        response.raise_for_status()
        return response.json().get('list', [])
    except Exception as e:
        print(f"Error accessing NocoDB: {e}")
        return []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/orders')
def api_orders():
    return jsonify(get_orders())

@app.route('/api/events')
def api_events():
    date_str = request.args.get('date')
    date = datetime.strptime(date_str, '%Y-%m-%d') if date_str else None
    return jsonify(get_calendar_events(date))

@app.route('/api/menu')
def api_menu():
    return jsonify(get_menu())

if __name__ == '__main__':
    app.run(debug=True)
