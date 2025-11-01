import os
import json
from pathlib import Path

# Discord
TOKEN = os.getenv("DISCORD_TOKEN")

# Google Sheets
SHEET_NAME = os.getenv("SHEET_NAME", "Reto Fitness")

# Ruta “virtual” del JSON (lo crearemos en runtime)
GOOGLE_CREDENTIALS = "service_account.json"

# Pestañas
SHEET_DATOS = "Datos"
SHEET_LEADERBOARD = "Leaderboard"
SHEET_LEADERBOARD_TOTAL = "LeaderboardTotal"
SHEET_CASTIGOS = "Castigos"
SHEET_RECOMPENSAS = "Recompensas"
SHEET_RETOS = "Retos"
SHEET_HISTORICO = "RetosHistóricos"

def materialize_service_account():
    """Escribe el JSON de credenciales desde la variable de entorno a un archivo en runtime."""
    creds_text = os.getenv("GOOGLE_CREDENTIALS_JSON", "").strip()
    if not creds_text:
        raise RuntimeError("Falta la variable GOOGLE_CREDENTIALS_JSON en Secrets.")
    data = json.loads(creds_text)
    Path(GOOGLE_CREDENTIALS).write_text(json.dumps(data), encoding="utf-8")