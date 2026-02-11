from sheets import get_sheet
from config import SHEET_DATOS
from datetime import datetime, timedelta
import pytz

# Timezones
tz_mexico = pytz.timezone("America/Mexico_City")
tz_zurich = pytz.timezone("Europe/Zurich")

def obtener_fecha(usuario):
    ahora = datetime.now(tz_mexico)

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

    resumen_contador = {"total": 0, "cumplidos": 0}
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

                # ======== LEER PENALIZACIÓN POR UNIDAD (compatibilidad) ========
                penalty_unit_raw = meta.get("PenaltyUnit", "")
                penalty_per_unit_raw = meta.get("PenaltyPerUnit", "")
                try:
                    penalty_unit = float(penalty_unit_raw) if penalty_unit_raw not in ("", None) else None
                except Exception:
                    penalty_unit = None
                try:
                    penalty_per_unit = float(penalty_per_unit_raw) if penalty_per_unit_raw not in ("", None) else None
                except Exception:
                    penalty_per_unit = None

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
                puntos = 0
                estado = "0 pts"

                if cumple_meta:
                    puntos = puntos_base
                    estado = f"+{int(puntos)} pts"
                else:
                    # Si se definió penalización por unidad, calcularla (compatibilidad)
                    if penalty_unit and penalty_per_unit:
                        if tipo == "+":
                            deficit = max(0.0, meta_valor - valor)
                            units = int(deficit // penalty_unit)
                        else:
                            # tipo == '-'
                            excess = max(0.0, valor - meta_valor)
                            units = int(excess // penalty_unit)

                        if units > 0:
                            puntos = -abs(units * penalty_per_unit)
                            estado = f"{int(puntos)} pts (penalización {units}×{penalty_per_unit})"
                        else:
                            # no units penalized, fallback to antimeta boolean logic
                            if rompe_antimeta:
                                puntos = -abs(penalizacion)
                                estado = f"-{int(abs(puntos))} pts (penalización)"
                    else:
                        # Fallback: comportamiento antiguo con antimeta
                        if rompe_antimeta:
                            puntos = -abs(penalizacion)
                            estado = f"-{int(abs(puntos))} pts (penalización)"

                # ======== REGISTRAR ========
                sheet_datos.append_row([
                    usuario,
                    fecha,
                    habito.capitalize(),
                    valor,
                    1 if cumple_meta else 0,
                    puntos
                ])

                resumen_contador["total"] += 1
                if puntos > 0:
                    resumen_contador["cumplidos"] += 1

                #respuestas.append(f"{habito.capitalize()}: {valor} {meta['Unidad']} {estado}")

    # Si se registraron varios hábitos, añadir resumen coloquial
    total = resumen_contador.get("total", 0)
    cumplidos = resumen_contador.get("cumplidos", 0)
    if total > 5:
        if cumplidos <= 0.4:
            resumen = f"Hmm, mejor nada... {total} hábitos registrados, y solo {cumplidos} cumplidos 😑"
        elif cumplidos / total <= 0.7:
            resumen = f"Uf, se puede mejor: {total} registros, y {cumplidos} cumplidos. Ánimo que tú puedes bb 💪"
        elif cumplidos / total < 1.0:
            resumen = f"Bien!!{cumplidos}/{total} hábitos cumplidos. Felicitaciones al chef... Sigue así 👍"
        else:
            resumen = f"Perfectttt!!! {total}/{total} hábitos cumplidos, una crack!! 🔥"
        respuestas.insert(0, resumen)

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

