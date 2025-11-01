import gspread
from oauth2client.service_account import ServiceAccountCredentials
from config import GOOGLE_CREDENTIALS, SHEET_NAME, materialize_service_account

def get_client():

    materialize_service_account()
    scope = ["https://spreadsheets.google.com/feeds","https://www.googleapis.com/auth/drive"]
    creds = ServiceAccountCredentials.from_json_keyfile_name(GOOGLE_CREDENTIALS, scope)
    return gspread.authorize(creds)

def get_sheet(sheet_name):
    client = get_client()
    return client.open(SHEET_NAME).worksheet(sheet_name)

