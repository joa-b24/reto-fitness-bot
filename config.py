
import sys
import logging
# --- Configurar logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('bot.log', mode='a', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# --- Carga de variables de entorno y compatibilidad local/Render ---
import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Debug: mostrar valor de la variable y existencia del archivo
cred_path_dbg = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
logger.info(f"GOOGLE_APPLICATION_CREDENTIALS={cred_path_dbg}")
if cred_path_dbg:
    logger.info(f"Archivo existe: {os.path.isfile(cred_path_dbg)}")
else:
    logger.warning("GOOGLE_APPLICATION_CREDENTIALS no está definida")

# Discord
TOKEN = os.getenv("TOKEN")

# Google Sheets
SHEET_NAME = os.getenv("SHEET_NAME", "Reto Fitness")

# Manejo de credenciales Google: Render (JSON en variable) o local (ruta a archivo)
import json
import gspread
from google.oauth2.service_account import Credentials

GOOGLE_CREDENTIALS_JSON = os.getenv("GOOGLE_CREDENTIALS")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

if GOOGLE_CREDENTIALS_JSON:
    creds_json = json.loads(GOOGLE_CREDENTIALS_JSON)
    creds = Credentials.from_service_account_info(creds_json, scopes=[
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive"
    ])
    logger.info("Credenciales Google cargadas desde variable GOOGLE_CREDENTIALS")
elif GOOGLE_APPLICATION_CREDENTIALS:
    creds = Credentials.from_service_account_file(GOOGLE_APPLICATION_CREDENTIALS, scopes=[
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive"
    ])
    logger.info(f"Credenciales Google cargadas desde archivo: {GOOGLE_APPLICATION_CREDENTIALS}")
else:
    logger.error("No se encontraron credenciales de Google")
    raise RuntimeError("No se encontraron credenciales de Google. Define GOOGLE_CREDENTIALS_JSON o GOOGLE_APPLICATION_CREDENTIALS.")

client = gspread.authorize(creds)
logger.info("Cliente gspread inicializado exitosamente")

# Pestañas
SHEET_DATOS = "Datos"
SHEET_LEADERBOARD = "Leaderboard"
SHEET_LEADERBOARD_TOTAL = "LeaderboardTotal"
SHEET_CASTIGOS = "Castigos"
SHEET_RECOMPENSAS = "Recompensas"
SHEET_RETOS = "Retos"
SHEET_HISTORICO = "RetosHistóricos"


