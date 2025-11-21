from sheets import get_sheet
from config import SHEET_DATOS
from datetime import datetime, timedelta
import pytz

# Timezones
tz_mexico = pytz.timezone("America/Mexico_City")
tz_zurich = pytz.timezone("Europe/Zurich")

def obtener_fecha(usuario):
    ahora = datetime.now(tz_zurich)

    if usuario == "d1aniss" and ahora.hour < 7:
        ahora = ahora - timedelta(hours=7)
        ahora = ahora.astimezone(tz_mexico)

    return ahora.strftime("%Y-%m-%d")


def registrar_habitos(message, usuario):
    """
    Registra hábitos basándose en las metas y antimetas personalizadas
    guardadas en la hoja 'Metas'.
    Retorna las respuestas para Discord.
    """
    sheet_datos = get_sheet(SHEET_DATOS)
    sheet_metas = get_sheet("Metas")

    fecha = obtener_fecha(usuario)
    respuestas = []

    # Obtener metas del usuario
    metas = sheet_metas.get_all_records()
    metas_usuario = [m for m in metas if m["Usuario"] == usuario]

    if not metas_usuario:
        return [f"⚠️ No se encontraron metas registradas para {usuario}."]

    # Procesar cada línea del mensaje
    lineas = message.content.lower().splitlines()

    # Eliminar texto entre paréntesis
    import re

    for linea in lineas:
        linea = re.sub(r"\(.*?\)", "", linea).strip()

        for meta in metas_usuario:
            habito = meta["Hábito"].lower()

            if linea.startswith(habito + ":"):
                # ======== EXTRAER VALOR ========
                try:
                    raw_val = linea.split(":")[1].strip()
                    raw_val = raw_val.replace(meta["Unidad"].lower(), "")
                    valor = float(raw_val.strip())
                except:
                    try:
                        valor = float(linea.split(":")[1].strip())
                    except:
                        respuestas.append(f"⚠️ No pude leer el valor de {habito}.")
                        continue

                # ======== LEER META ========
                tipo = meta["Tipo"]                 # "+" o "-"
                meta_valor = float(meta["Meta"])
                puntos_base = float(meta["Puntos"])

                # ======== LEER ANTIMETA ========
                antimeta = meta["Antimeta"]
                penalizacion = meta["Puntos"]

                if antimeta == "" or antimeta is None:
                    antimeta = None
                else:
                    antimeta = float(antimeta)

                if penalizacion == "" or penalizacion is None:
                    penalizacion = puntos_base
                else:
                    penalizacion = float(penalizacion)

                # ======== EVALUACIÓN META ========
                if tipo == "+":
                    cumple_meta = valor >= meta_valor
                    rompe_antimeta = (antimeta is not None and valor < antimeta)
                else:  # tipo "-"
                    cumple_meta = valor <= meta_valor
                    rompe_antimeta = (antimeta is not None and valor > antimeta)

                # ======== ASIGNACIÓN DE PUNTOS ========
                if cumple_meta:
                    puntos = puntos_base
                    estado = f"✅ (+{int(puntos)} pts)"
                elif rompe_antimeta:
                    puntos = -abs(penalizacion)
                    estado = f"💀 Pasaste el límite, tu penalización: ({int(puntos)} pts)"
                else:
                    puntos = 0
                    estado = "❌"

                # ======== REGISTRAR ========
                sheet_datos.append_row([
                    usuario,
                    fecha,
                    habito.capitalize(),
                    valor,
                    1 if cumple_meta else 0,
                    puntos
                ])

                # ======== EMOJIS ========
                iconos = {
                    "agua": "💧", "pasos": "👟", "ejercicio": "💪",
                    "calorias": "🔥", "sueño": "😴", "duolingo": "🦉",
                    "lectura": "📖", "celular": "📱", "dientes": "😁",
                    "ducha": "🚿"
                }
                icono = iconos.get(habito, "📌")

                respuestas.append(
                    f"{icono} {usuario} registró {valor} {meta['Unidad']} "
                    f"en {habito.capitalize()} — {estado}"
                )

    return respuestas

def registrar_mediciones(message, usuario):
    """
    Registra mediciones corporales (peso, cintura) sin puntos ni completado.
    Solo guarda el valor para seguimiento.
    """
    sheet_datos = get_sheet(SHEET_DATOS)
    fecha = obtener_fecha(usuario)
    respuestas = []
    
    lineas = message.content.lower().splitlines()
    
    mediciones_config = {
        "peso": {"unidad": "kg", "icono": "⚖️"},
        "cintura": {"unidad": "cm", "icono": "📏"}
    }
    
    for linea in lineas:
        for medicion, config in mediciones_config.items():
            if linea.startswith(medicion + ":"):
                try:
                    valor = float(linea.split(":")[1].replace(config["unidad"], "").strip())
                except:
                    valor = float(linea.split(":")[1].strip())
                
                sheet_datos.append_row([usuario, fecha, medicion.capitalize(), valor, "", ""])
                
                respuestas.append(
                    f"{config['icono']} {usuario} registró {valor} {config['unidad']} en {medicion.capitalize()}"
                )
    
    return respuestas

