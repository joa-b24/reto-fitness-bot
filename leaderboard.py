from sheets import get_sheet
from config import SHEET_LEADERBOARD, SHEET_LEADERBOARD_TOTAL, SHEET_CASTIGOS, SHEET_RECOMPENSAS
import random

def get_ranking(tipo="semanal"):
    sheet = get_sheet(SHEET_LEADERBOARD if tipo=="semanal" else SHEET_LEADERBOARD_TOTAL)
    data = sheet.get_all_values()
    if len(data) <= 1:
        return "📊 No hay datos aún."
    titulo = "Ranking semanal" if tipo=="semanal" else "Ranking general"
    msg = titulo + "\n"
    for i, row in enumerate(data[1:], start=1):
        usuario, puntos = row
        msg += f"{i}. **{usuario}** — {puntos} pts\n"
    return msg

def fin_semana():
    sheet = get_sheet(SHEET_LEADERBOARD)
    data = sheet.get_all_values()
    if len(data) <= 1:
        return "📊 No hay datos en el ranking semanal todavía."
    ganadora = data[1][0]
    perdedora = data[-1][0]

    sheet_castigos = get_sheet(SHEET_CASTIGOS)
    sheet_recompensas = get_sheet(SHEET_RECOMPENSAS)

    recompensa = random.choice(sheet_recompensas.get_all_values()[1:])
    castigo = random.choice(sheet_castigos.get_all_values()[1:])

    msg = (
        f"Semana finalizada\n\n"
        f"Ganadora: {ganadora}\n"
        f"Recompensa: {recompensa[1]} → {recompensa[-1]}\n\n"
        f"Última: {perdedora}\n"
        f"Castigo: {castigo[1]} → {castigo[-1]}"
    )
    return msg