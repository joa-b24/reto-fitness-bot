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
    if not retos:
        return "❌ No hay retos semanales definidos en la hoja Retos."
    seleccionados = random.sample(retos, min(3, len(retos)))

    fecha_fin = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")

    for reto in seleccionados:
        registrar_en_historico("Semanal", reto, fecha_fin)

    encabezado = random.choice([
        "⚔️ **¡Retos de la semana activados!** Elige tus batallas 👇\n\n",
        "🚨 **SEMANA NUEVA, RETOS NUEVOS** 🚨\n¿Cuál te atreves? 👇\n\n",
        "💎 **Esta semana tiene recompensa.** Aquí tus retos 👇\n\n",
        "🔥 **Se abren los retos semanales.** A ver quién puede con todo 👇\n\n",
    ])
    pie = random.choice([
        "\nEscribe `Reto semanal completado, [ID]` cuando lo termines. ¡Suerte! 💥",
        "\nCompleta uno (o todos 😈) con: `Reto semanal completado, [ID]`",
        "\nReporta tu victoria con: `Reto semanal completado, [ID]` 💪",
    ])
    msg = encabezado
    for r in seleccionados:
        emoji = r.get("Emoji") or "🎯"
        msg += f"{emoji} **{r['ID']}** — {r['Descripción']} · _{r['Puntos']} pts_\n"
    msg += pie
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

    return random.choice([
        f"🏅 {usuario} completó **{nombre_reto}**!! +{puntos} pts directo al marcador 🔥",
        f"💥 RETO CAÍDO! {usuario} terminó {nombre_reto} — +{puntos} pts. Imparable.",
        f"👏 {usuario} lo hizo! **{nombre_reto}** completado. +{puntos} puntos bien ganados.",
        f"🎉 +{puntos} pts para {usuario}! {nombre_reto} en el bolsillo. Eso es todo.",
        f"⚡ {usuario} cerró {nombre_reto} — +{puntos} pts. La semana ya valió.",
    ])


# ──────────────────────────────────────────────
# Auto-completado de retos semanales
# ──────────────────────────────────────────────

def _meta(habito, metas_usuario):
    for m in metas_usuario:
        if m.get("Hábito", "").lower() == habito.lower():
            try:
                return float(m["Meta"])
            except (ValueError, TypeError):
                return None
    return None


def _vals(habito, datos_semana):
    return [
        float(r["Valor"]) for r in datos_semana
        if r.get("Hábito", "").lower() == habito.lower()
        and r.get("Valor") not in ("", None)
    ]


def _dias_cumplido(habito, datos_semana):
    return len({
        r["Fecha"] for r in datos_semana
        if r.get("Hábito", "").lower() == habito.lower()
        and r.get("Cumplido") == 1
    })


def evaluar_reto_semanal_criterio(reto_id, datos_semana, metas_usuario):
    """Devuelve True si el usuario cumplió las condiciones del reto semanal."""
    rid = reto_id.upper()

    if rid == "RS01":
        # agua cumplida 7 días (racha completa)
        return _dias_cumplido("agua", datos_semana) >= 7

    elif rid == "RS02":
        # pasos: suma semanal >= meta_diaria * 10
        m = _meta("pasos", metas_usuario)
        if m is None:
            return False
        return sum(_vals("pasos", datos_semana)) >= m * 10

    elif rid == "RS03":
        # ejercicio: suma semanal >= meta_diaria * 7 * 1.5
        m = _meta("ejercicio", metas_usuario)
        if m is None:
            return False
        return sum(_vals("ejercicio", datos_semana)) >= m * 7 * 1.5

    elif rid == "RS04":
        # sueño >= 8h al menos 6 noches
        return len([v for v in _vals("sueño", datos_semana) if v >= 8]) >= 6

    elif rid == "RS05":
        # calorías cumplidas al menos 5 días
        return _dias_cumplido("calorias", datos_semana) >= 5

    elif rid == "RS06":
        # celular: promedio semanal <= 2.5h
        v = _vals("celular", datos_semana)
        if not v:
            return False
        return (sum(v) / len(v)) <= 2.5

    elif rid == "RS07":
        # duolingo: suma >= 500 XP
        return sum(_vals("duolingo", datos_semana)) >= 500

    elif rid == "RS08":
        # lectura: suma >= 5h (300 min)
        return sum(_vals("lectura", datos_semana)) >= 300

    elif rid == "RS09":
        # semana perfecta: los 7 días con TODOS los hábitos cumplidos
        habitos_base = {
            m["Hábito"].lower() for m in metas_usuario
            if m.get("Hábito") and m["Hábito"] not in ["Peso", "Cintura"]
        }
        fechas = {r["Fecha"] for r in datos_semana}
        perfectos = 0
        for fecha in fechas:
            dia = [r for r in datos_semana if r["Fecha"] == fecha]
            cumplidos_dia = {r["Hábito"].lower() for r in dia if r.get("Cumplido") == 1}
            if habitos_base and habitos_base.issubset(cumplidos_dia):
                perfectos += 1
        return perfectos >= 7

    elif rid == "RS10":
        # pasos + agua + ejercicio cumplidos el mismo día, al menos 3 días
        fechas = {r["Fecha"] for r in datos_semana}
        combo = 0
        for fecha in fechas:
            dia = [r for r in datos_semana if r["Fecha"] == fecha]
            cumplidos_dia = {r["Hábito"].lower() for r in dia if r.get("Cumplido") == 1}
            if {"pasos", "agua", "ejercicio"}.issubset(cumplidos_dia):
                combo += 1
        return combo >= 3

    elif rid == "RS11":
        # ejercicio: al menos un día con valor >= meta * 2
        m = _meta("ejercicio", metas_usuario)
        if m is None:
            return False
        return any(v >= m * 2 for v in _vals("ejercicio", datos_semana))

    elif rid == "RS15":
        # registrar todos los hábitos cada día durante 7 días
        habitos_base = {
            m["Hábito"].lower() for m in metas_usuario
            if m.get("Hábito") and m["Hábito"] not in ["Peso", "Cintura"]
        }
        fechas = {r["Fecha"] for r in datos_semana}
        if len(fechas) < 7:
            return False
        for fecha in fechas:
            dia = {r["Hábito"].lower() for r in datos_semana if r["Fecha"] == fecha}
            if not habitos_base.issubset(dia):
                return False
        return True

    return False


def verificar_retos_auto(usuario):
    """
    Verifica si el usuario cumplió automáticamente algún reto semanal activo.
    Registra los completados en Datos y devuelve lista de mensajes de felicitaciones.
    """
    sheet_hist  = get_sheet(SHEET_HISTORICO)
    sheet_datos = get_sheet(SHEET_DATOS)
    sheet_metas = get_sheet("Metas")

    now      = datetime.now()
    today    = now.strftime("%Y-%m-%d")

    # Retos semanales activos
    hist_rows = sheet_hist.get_all_records()
    activos = []
    for r in hist_rows:
        tipo = (r.get("Tipo de reto") or "").strip().lower()
        if "semanal" not in tipo:
            continue
        try:
            fecha_fin = datetime.strptime(str(r.get("Fecha fin válida", "")).strip(), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
        if now <= fecha_fin:
            activos.append(r)

    if not activos:
        return []

    # Retos ya completados por el usuario (para deduplicar)
    datos      = sheet_datos.get_all_records()
    user_datos = [r for r in datos if r.get("Usuario") == usuario]
    completados = {
        str(r.get("Hábito", "")).replace("Semanal (", "").rstrip(")").upper()
        for r in user_datos
        if str(r.get("Hábito", "")).startswith("Semanal (")
    }

    # Datos de la semana (desde el lunes)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).strftime("%Y-%m-%d")
    datos_semana = [
        r for r in user_datos
        if week_start <= str(r.get("Fecha", ""))[:10] <= today
    ]

    metas_usuario = [m for m in sheet_metas.get_all_records() if m.get("Usuario") == usuario]

    msgs = []
    for reto_hist in activos:
        reto_id = str(reto_hist.get("ID reto") or "").strip().upper()
        if not reto_id or reto_id in completados:
            continue

        try:
            cumplido = evaluar_reto_semanal_criterio(reto_id, datos_semana, metas_usuario)
        except Exception:
            continue

        if cumplido:
            puntos      = reto_hist.get("Puntos asignables") or 0
            nombre_reto = f"Semanal ({reto_id})"
            sheet_datos.append_row([usuario, today, nombre_reto, 1, 1, puntos])
            completados.add(reto_id)

            msgs.append(random.choice([
                f"🤖 Reto detectado! {usuario} cumplió automáticamente **{nombre_reto}** esta semana. +{puntos} pts 🎯",
                f"🔍 El bot no miente — {usuario} completó **{nombre_reto}** sin ni reportarlo. +{puntos} pts 💪",
                f"✅ Auto-validado: {usuario} ya cumplió **{nombre_reto}**. +{puntos} pts. El sistema te vio 👀",
            ]))

    return msgs

