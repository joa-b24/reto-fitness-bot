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
        return ["No hay registros aún para evaluar logros."]

    total_puntos = sum(r["Puntos"] for r in user_data if isinstance(r["Puntos"], (int, float)))
    total_retos = len([r for r in user_data if "Reto" in str(r["Hábito"])])
    total_habitos = len([r for r in user_data if r.get("Cumplido") == 1])

    # Buscar logros ya registrados en la hoja Datos para evitar duplicados
    obtenido_keys = set()
    for r in user_data:
        hab = r.get("Hábito") or ''
        if isinstance(hab, str) and hab.startswith('Logro: '):
            obtenido_keys.add(hab.replace('Logro: ', '').strip())

    desbloqueados = []

    for logro in logros:
        tipo = logro.get("Tipo", "").lower()
        nombre = logro["Nombre"]
        desc = logro.get("Descripción", "")
        puntos_logro = float(logro.get("Puntos", 0)) if logro.get("Puntos") else 0

        conceder = False
        if tipo == "puntos" and total_puntos >= float(logro["Valor"]):
            conceder = True
        elif tipo == "retos" and total_retos >= float(logro["Valor"]):
            conceder = True
        elif tipo == "habitos" and total_habitos >= float(logro["Valor"]):
            conceder = True

        if conceder and nombre not in obtenido_keys:
            # Registrar en Datos para marcar como obtenido y evitar duplicados futuros
            try:
                fecha = datetime.now().strftime("%Y-%m-%d")
                sheet_datos.append_row([usuario, fecha, f"Logro: {nombre}", 1, 1, puntos_logro])
            except Exception:
                # no bloquear si falla la escritura; igual devolvemos el mensaje
                pass

            desbloqueados.append(f"{usuario} desbloqueó el logro: {nombre} — {desc}")

    return desbloqueados if desbloqueados else ["No hay nuevos logros esta vez."]