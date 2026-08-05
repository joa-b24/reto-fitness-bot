import random
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
                print(f"PenaltyUnit raw: '{penalty_unit_raw}'")
                penalty_per_unit_raw = meta.get("PenaltyPerUnit", "")
                print(f"PenaltyPerUnit raw: '{penalty_per_unit_raw}'")
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

                print(f"Evaluando {habito}: valor={valor}, meta={meta_valor} ({tipo}), cumple_meta={cumple_meta}, antimeta={antimeta}, rompe_antimeta={rompe_antimeta}, penalty_unit={penalty_unit}, penalty_per_unit={penalty_per_unit}")

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
                            print(f"Deficit: {deficit}")
                            units = int(deficit // penalty_unit)
                        else:
                            # tipo == '-'
                            excess = max(0.0, valor - meta_valor)
                            print(f"Excess: {excess}")
                            units = int(excess // penalty_unit)
                        print(f"Units penalized: {units if 'units' in locals() else 'N/A'}")

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
                print(f"Puntos asignados: {puntos}")
                if puntos < 0:
                    respuestas.append(random.choice([
                        f"⚠️ {habito.capitalize()} no cumplido {estado}. Esta sí nos duele.",
                        f"❌ {habito.capitalize()}: {estado}. La próxima lo cerramos.",
                        f"😬 {habito.capitalize()} fuera de meta {estado} — ojo con eso.",
                    ]))
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
    if total > 6:
        ratio = cumplidos / total if total else 0
        if cumplidos <= 0:
            resumen = random.choice([
                f"😬 Oye... {cumplidos}/{total} hábitos. Algo es algo, pero podemos hacer más.",
                f"💀 {cumplidos} de {total}. Eso no lo estamos contando.",
                f"😶 {cumplidos}/{total}... silencio incómodo ...",
            ])
        elif ratio <= 0.7:
            resumen = random.choice([
                f"📈 {cumplidos}/{total} hábitos, vamos bien pero hay margen. Tú puedes más, bb.",
                f"🙌 No está mal — {cumplidos} de {total}. Mañana la remontamos.",
                f"⚡ {cumplidos}/{total}. Cerquita. Mañana empujamos más fuerte.",
            ])
        elif ratio < 1.0:
            resumen = random.choice([
                f"🔥 {cumplidos}/{total} hábitos! Casi perfecta, sigue así!",
                f"💪 {cumplidos} de {total} — crack behavior. Solo te faltó un poquito.",
                f"✨ {cumplidos}/{total}! Eso es constancia y se nota.",
            ])
        else:
            resumen = random.choice([
                f"🏆 PERFECTA! {total}/{total} hábitos. Hoy fuiste imparable.",
                f"👑 {total}/{total}!!! Una reina del régimen. No hay más que decir.",
                f"🔥💪 Todo cumplido!! {total} de {total}. Este día se archiva como referencia.",
                f"🤩 {total}/{total} hábitos. Eso se llama disciplina, no motivación. CRACK.",
            ])
        respuestas.insert(0, resumen)
    else:
        respuestas.insert(0, f"👍 {total} hábitos registrados")
    print(f"Respuestas generadas: {respuestas}")
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

