from sheets import get_sheet
from config import SHEET_DATOS
from datetime import datetime

def registrar_habitos(message, usuario):
    """
    Registra hábitos basándose en las metas personalizadas guardadas en la hoja 'Metas'.
    Retorna las respuestas para enviar a Discord.
    """
    sheet_datos = get_sheet(SHEET_DATOS)
    sheet_metas = get_sheet("Metas")

    fecha = datetime.now().strftime("%Y-%m-%d")
    respuestas = []

    # obtener todas las metas y filtrar por usuario
    metas = sheet_metas.get_all_records()
    metas_usuario = [m for m in metas if m["Usuario"] == usuario]

    if not metas_usuario:
        return [f"⚠️ No se encontraron metas registradas para {usuario}."]

    # Procesar cada línea del mensaje
    lineas = message.content.lower().splitlines()

    for linea in lineas:
        for meta in metas_usuario:
            habito = meta["Hábito"].lower()
            if linea.startswith(habito + ":"):
                # Extraer valor
                try:
                    valor = float(linea.split(":")[1].replace(meta["Unidad"].lower(), "").strip())
                except:
                    valor = float(linea.split(":")[1].strip())

                # Evaluar cumplimiento
                tipo = meta["Tipo"]
                meta_valor = float(meta["Meta"])
                puntos_base = float(meta["Puntos"])

                if tipo == "+":
                    cumplido = 1 if valor >= meta_valor else 0
                elif tipo == "-":
                    cumplido = 1 if valor <= meta_valor else 0
                else:
                    cumplido = 0  # por si hay error en la hoja

                puntos = puntos_base * cumplido

                # Registrar en hoja de Datos
                sheet_datos.append_row([usuario, fecha, habito.capitalize(), valor, cumplido, puntos])

                # Emoji/icono personalizado por hábito
                iconos = {
                    "agua": "💧", "pasos": "👟", "ejercicio": "💪", "calorías": "🔥",
                    "sueño": "😴", "duolingo": "🦉", "lectura": "📖", "celular": "📱",
                    "dientes": "😁", "ducha": "🚿"
                }
                icono = iconos.get(habito, "✅")

                respuestas.append(
                    f"{icono} {usuario} registró {valor} {meta['Unidad']} en {habito.capitalize()} "
                    f"{'✅ (+{} pts)'.format(int(puntos)) if cumplido else '❌'}"
                )

    return respuestas

def registrar_mediciones(message, usuario):
    """
    Registra mediciones corporales (peso, cintura) sin puntos ni completado.
    Solo guarda el valor para seguimiento.
    """
    sheet_datos = get_sheet(SHEET_DATOS)
    fecha = datetime.now().strftime("%Y-%m-%d")
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