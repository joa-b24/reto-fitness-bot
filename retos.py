import random
import io
import textwrap
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
from sheets import get_sheet
from config import SHEET_RETOS, SHEET_HISTORICO, SHEET_DATOS

# ------------------------------
# Función auxiliar
# ------------------------------
def registrar_en_historico(tipo, reto, fecha_fin, clave_bingo="-"):
    """Registra un reto lanzado en la hoja RetosHistóricos."""
    sheet_hist = get_sheet(SHEET_HISTORICO)
    nuevo = [
        f"RH{random.randint(100,999)}",
        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        tipo.capitalize(),
        reto["ID"],
        reto["Descripción"],
        clave_bingo,
        fecha_fin,
        reto["Puntos"]
    ]
    sheet_hist.append_row(nuevo)


# ------------------------------
# Reto semanal
# ------------------------------
def publicar_reto_semanal():
    sheet_retos = get_sheet(SHEET_RETOS)
    data = sheet_retos.get_all_records(expected_headers=["ID", "Nombre", "Tipo", "Descripción", "Puntos"])
    retos = [r for r in data if r["Tipo"].lower() == "semanal"]
    seleccionados = random.sample(retos, 3)

    fecha_fin = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")

    for reto in seleccionados:

        registrar_en_historico("Semanal", reto, fecha_fin)

    msg = "**Retos semanales disponibles**:\n\n"
    for i, r in enumerate(seleccionados, 1):
        msg += f"{i}. ({r['ID']}) {r['Descripción']} — {r['Puntos']} pts\n"
    msg += "\nEscribe: `Reto semanal completado, [ID]` cuando termines alguno."
    return msg


# ------------------------------
# Mini-retos
# ------------------------------
def publicar_mini_reto():
    sheet_retos = get_sheet(SHEET_RETOS)
    data = sheet_retos.get_all_records(expected_headers=["ID", "Nombre", "Tipo", "Descripción", "Puntos"])
    retos = [r for r in data if r["Tipo"].lower() == "mini"]
    reto = random.choice(retos)
    fecha_fin = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")

    registrar_en_historico("Mini", reto, fecha_fin)

    msg = (
        f"Mini-reto ({reto['ID']})\n"
        f"{reto['Descripción']}\n"
        f"Vale {reto['Puntos']} pts\n\n"
        f"Para reclamar: `Mini-reto completado, {reto['ID']}`"
    )
    return msg


# ------------------------------
# Bingo
# ------------------------------
def publicar_bingo():
    sheet_retos = get_sheet(SHEET_RETOS)
    data = sheet_retos.get_all_records(expected_headers=["ID", "Nombre", "Tipo", "Descripción", "Puntos"])
    retos_bingo = [r for r in data if r["Tipo"].lower() == "mini"]

    seleccionados = random.sample(retos_bingo, 16)
    grid = [seleccionados[i*4:(i+1)*4] for i in range(4)]

    clave = f"BNG{random.randint(1000,9999)}"
    fecha_fin = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")

    # Registrar primer reto del bingo (como referencia)
    registrar_en_historico("Bingo", seleccionados[0], fecha_fin, clave)

    # Generar imagen 4x4
    def wrap_text(text, width=15):
        return "\n".join(textwrap.wrap(text, width=width))
    # Dibujar tabla con estilo más limpio
    from matplotlib import patches

    fig, ax = plt.subplots(figsize=(8, 8))
    ax.set_xlim(0, 4)
    ax.set_ylim(0, 4)
    ax.axis('off')

    # Paleta suave
    bg1 = "#ddddfd"
    bg2 = "#85a4d7"
    title_color = '#0b3d91'

    for i in range(4):
        for j in range(4):
            x = j
            y = 3 - i
            rect_color = bg1 if (i + j) % 2 == 0 else bg2
            box = patches.FancyBboxPatch((x + 0.02, y + 0.02), 0.96, 0.96,
                                         boxstyle='round,pad=0.02', linewidth=1, edgecolor='#333', facecolor=rect_color)
            ax.add_patch(box)
            texto = wrap_text(seleccionados[i * 4 + j]["Nombre"], width=14)
            ax.text(j + 0.5, y + 0.5, texto, ha='center', va='center', fontsize=10, color='#111')

    # Título
    ax.text(2, 4.05, 'BINGO FITNESS', ha='center', va='bottom', fontsize=18, color=title_color, weight='bold')

    buffer = io.BytesIO()
    plt.tight_layout()
    plt.savefig(buffer, format='png', bbox_inches='tight', dpi=200, facecolor='white')
    plt.close(fig)
    buffer.seek(0)

    lista_textos = "\n".join([f"- {r['Nombre']}: {r['Descripción']}" for r in seleccionados])
    msg = (
        f"Bingo — clave: {clave}\n\n"
        f"Completa línea, columna o diagonal y escribe `BINGO {clave}` para reclamar {20} pts.\n\n"
        f"Retos incluidos:\n{lista_textos}"
    )
    return msg, buffer


# ------------------------------
# Validación de retos completados
# ------------------------------
def validar_reto(usuario, mensaje):
    """
    Valida si el reto semanal/mini o bingo existe y está activo.
    Si sí, registra los puntos en Datos.
    """
    sheet_retos = get_sheet(SHEET_RETOS)
    sheet_hist = get_sheet(SHEET_HISTORICO)
    sheet_datos = get_sheet(SHEET_DATOS)

    data_retos = {r["ID"]: r for r in sheet_retos.get_all_records(expected_headers=["ID", "Nombre", "Tipo", "Descripción", "Puntos"])}
    data_hist = sorted(sheet_hist.get_all_records(), key=lambda r: datetime.strptime(r["Fecha fin válida"], "%Y-%m-%d %H:%M:%S"), reverse=True) 
    

    fecha_actual = datetime.now()

    mensaje = mensaje.lower()

    if "reto semanal completado" in mensaje:
        tipo = "Semanal"
    elif "mini-reto completado" in mensaje:
        tipo = "Mini"
    elif "bingo" in mensaje:
        tipo = "Bingo"
    else:
        return "❌ Formato no reconocido."

    # Extraer ID o clave
    try:
        if tipo == "Bingo":
            clave = mensaje.split(" ")[1].strip().upper()
        else:
            reto_id = mensaje.split(",")[1].strip().upper()
    except:
        return "❌ Usa el formato correcto. Ejemplo: `Reto semanal completado, R001` o `BINGO BNG1234`."

    # Buscar reto en históricos
    if tipo == "Bingo":
        encontrado = next((r for r in data_hist if r["Clave bingo"] == clave and r["Tipo de reto"] == "Bingo"), None)
        if not encontrado:
            return "❌ Bingo no encontrado o expirado."
        puntos = 20
    else:
        encontrado = next((r for r in data_hist if r["ID reto"] == reto_id and r["Tipo de reto"] == tipo), None)
        if not encontrado:
            return "❌ ID de reto no encontrado o expirado."
        fecha_fin = datetime.strptime(encontrado["Fecha fin válida"], "%Y-%m-%d %H:%M:%S")
        if fecha_actual > fecha_fin:
            return "⌛ Este reto ya expiró."
        puntos = encontrado["Puntos asignables"]

    # Registrar puntos
    fecha = fecha_actual.strftime("%Y-%m-%d")
    nombre_reto = f"{tipo} ({encontrado['ID reto'] if tipo!='Bingo' else clave})"
    sheet_datos.append_row([usuario, fecha, nombre_reto, 1, 1, puntos])

    return f"✅ {usuario} completó {nombre_reto} (+{puntos} pts)"

