from sheets import get_sheet
from datetime import datetime
import random
from config import SHEET_DATOS

def revisar_logros(usuario):
    """
    Revisa si el usuario desbloqueó nuevos logros según las reglas en la hoja 'Logros'.
    Retorna lista de mensajes con los logros obtenidos.
    """
    sheet_datos = get_sheet(SHEET_DATOS)
    sheet_logros = get_sheet("Logros")
    data = sheet_datos.get_all_records()
    logros = sheet_logros.get_all_records()

    user_data = [r for r in data if r["Usuario"] == usuario]

    if not user_data:
        return ["📊 No hay registros aún para evaluar logros."]

    total_puntos = sum(r["Puntos"] for r in user_data if isinstance(r["Puntos"], (int, float)))
    total_retos = len([r for r in user_data if "Reto" in str(r["Hábito"])])
    total_habitos = len([r for r in user_data if r["Cumplido"] == 1])

    desbloqueados = []

    for logro in logros:
        tipo = logro.get("Tipo", "").lower()
        nombre = logro["Nombre"]
        desc = logro["Descripción"]
        emoji = logro.get("Emoji", "🏅")

        if tipo == "puntos" and total_puntos >= float(logro["Valor"]):
            desbloqueados.append(f"{emoji} {usuario} desbloqueó el logro **{nombre}** — {desc}")
        elif tipo == "retos" and total_retos >= float(logro["Valor"]):
            desbloqueados.append(f"{emoji} {usuario} completó suficientes retos: **{nombre}** — {desc}")
        elif tipo == "habitos" and total_habitos >= float(logro["Valor"]):
            desbloqueados.append(f"{emoji} {usuario} mantiene hábitos constantes: **{nombre}** — {desc}")

    return desbloqueados if desbloqueados else ["🤔 No hay nuevos logros esta vez."]