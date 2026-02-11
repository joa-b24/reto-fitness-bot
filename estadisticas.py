import random
from datetime import datetime, timedelta
from sheets import get_sheet
from config import SHEET_DATOS

def mensaje_estadistica(usuario): # WTF IS THIS SHIT
    sheet = get_sheet("Estadísticas")
    data = sheet.get_all_records()

    if not data:
        return "No hay estadísticas registradas todavía."

    stat = random.choice(data)
    plantilla = stat["Plantilla"]

    # Ejemplo de datos mock que podrías sustituir con reales
    return plantilla.format(
        usuario=usuario,
        habito=random.choice(["Agua", "Ejercicio", "Sueño"]),
        porcentaje=random.randint(60, 100),
        incremento=random.randint(1, 10),
        usuario1="joa_b29",
        usuario2="d1aniss",
        puntos1=random.randint(20, 60),
        puntos2=random.randint(10, 50),
        dias=random.randint(3, 10),
        puntos=random.randint(20, 80),
        efectividad=random.randint(70, 100)
    )


def resumen_semanal(usuario):
    sheet = get_sheet(SHEET_DATOS)
    data = sheet.get_all_records()

    data_usuario = [r for r in data if r["Usuario"] == usuario and r["Cumplido"] in [0, 1]]

    if not data_usuario:
        return f"No hay datos registrados aún para {usuario}."

    # Filtrar últimos 7 días
    hoy = datetime.now()
    ultimos = []
    for r in data_usuario:
        try:
            fecha = datetime.strptime(str(r["Fecha"]), "%Y-%m-%d")
            if hoy - fecha <= timedelta(days=7):
                ultimos.append(r)
        except:
            continue

        if not ultimos:
            return f"{usuario}, no hay datos de los últimos 7 días."

    puntos_totales = sum(r["Puntos"] for r in ultimos if isinstance(r["Puntos"], (int, float)))
    por_habito = {}
    for r in ultimos:
        hab = r["Hábito"]
        por_habito.setdefault(hab, {"cumplidos": 0, "total": 0})
        por_habito[hab]["total"] += 1
        if r["Cumplido"] == 1:
            por_habito[hab]["cumplidos"] += 1

    efectividades = {h: (v["cumplidos"] / v["total"] * 100) for h, v in por_habito.items()}
    mejor = max(efectividades, key=efectividades.get)
    peor = min(efectividades, key=efectividades.get)

    msg = (
            f"Resumen semanal de {usuario}\n"
            f"Total de puntos: {puntos_totales}\n"
            f"Mejor hábito: {mejor} ({efectividades[mejor]:.1f}% cumplimiento)\n"
            f"Hábito a mejorar: {peor} ({efectividades[peor]:.1f}%)\n"
        )
    return msg

