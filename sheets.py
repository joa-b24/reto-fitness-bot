from config import client, SHEET_NAME

def get_sheet(sheet_name):
    return client.open(SHEET_NAME).worksheet(sheet_name)


