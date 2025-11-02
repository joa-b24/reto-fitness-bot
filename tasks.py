# tasks.py
import datetime
import pytz
import discord
from discord.ext import tasks
from sheets import get_sheet
from estadisticas import resumen_semanal
from retos import publicar_mini_reto, publicar_reto_semanal

# === CONFIGURACIÓN GENERAL ===
TIMEZONE = pytz.timezone("America/Mexico_City")
TARGET_USERS = ["joa_b29", "d1aniss"]

# === HORARIOS FIJOS ===
HORA_COMPLETAR = 1
HORA_RETO_DIARIO = 0
HORA_RETO_SEMANAL = 0
HORA_RESUMEN = 18
HORA_RECORDATORIO = 16


# --- RECORDATORIO DIARIO ---
@tasks.loop(minutes=1)
async def recordatorio_diario(bot):
    now = datetime.datetime.now(TIMEZONE)
    if now.hour == HORA_RECORDATORIO and now.minute == 0:
        canal = discord.utils.get(bot.get_all_channels(), name="registro-diario")
        if canal:
            await canal.send("🕘 ¡Hora de registrar tus hábitos del día! 💪💧😴")
        print(f"[{now.strftime('%Y-%m-%d %H:%M')}] Recordatorio diario enviado.")


# --- COMPLETAR REGISTROS FALTANTES (día anterior) ---
@tasks.loop(minutes=1)
async def completar_registros(bot):
    now = datetime.datetime.now(TIMEZONE)
    if now.hour == HORA_COMPLETAR and now.minute ==0:
        fecha_objetivo = (now - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        canal = discord.utils.get(bot.get_all_channels(), name="sistema-bot")
        sheet = get_sheet("Datos")
        data = sheet.get_all_records()

        # Cargar la hoja de Metas como fuente de hábitos válidos
        sheet_metas = get_sheet("Metas")
        metas = sheet_metas.get_all_records()

        # Usuarios registrados
        usuarios = list({r["Usuario"] for r in metas})

        # Hábitos definidos en metas (únicos y válidos)
        habitos = list({
            r["Hábito"]
            for r in metas
            if r["Hábito"] and r["Hábito"] not in ["Peso", "Cintura", "Reto", "BINGO"]
        })
        
        faltantes = 0
        for u in usuarios:
            for h in habitos:
                registros = [r for r in data if r["Usuario"] == u and r["Hábito"] == h and str(r["Fecha"]) == fecha_objetivo]
                if not registros:
                    sheet.append_row([u, fecha_objetivo, h, 0, 0, 0])
                    faltantes += 1

        msg = f"🗓️ Registros completados para {fecha_objetivo}: {faltantes} filas añadidas."
        print(msg)
        if canal:
            await canal.send(msg)


# --- PUBLICAR MINI-RETO DIARIO (7am Zurich) ---
@tasks.loop(minutes=1)
async def publicar_reto_diario(bot):
    await bot.wait_until_ready()
    now = datetime.datetime.now(TIMEZONE)
    if now.hour == HORA_RETO_DIARIO and now.minute == 0:
        canal = discord.utils.get(bot.get_all_channels(), name="retos")
        if canal:
            msg = publicar_mini_reto()
            await canal.send(msg)
        print("📆 Mini-reto publicado automáticamente.")


# --- PUBLICAR RETO SEMANAL (lunes 7am Zurich) ---
@tasks.loop(minutes=1)
async def publicar_reto_semanal_auto(bot):
    await bot.wait_until_ready()
    now = datetime.datetime.now(TIMEZONE)
    if now.weekday() == 0 and now.hour == HORA_RETO_SEMANAL and now.minute == 0:
        canal = discord.utils.get(bot.get_all_channels(), name="retos")
        if canal:
            msg = publicar_reto_semanal()
            await canal.send(msg)
        print("📅 Reto semanal publicado automáticamente.")


# --- ENVIAR RESUMEN SEMANAL (lunes 1 am Zurich) ---
@tasks.loop(minutes=1)
async def enviar_resumen_semanal(bot):
    await bot.wait_until_ready()
    now = datetime.datetime.now(TIMEZONE)
    if now.weekday() == 6 and now.hour == HORA_RESUMEN and now.minute == 0:
        canal = discord.utils.get(bot.get_all_channels(), name="estadisticas")
        if canal:
            for usuario in TARGET_USERS:
                msg = resumen_semanal(usuario)
                await canal.send(msg)
        print("📊 Resúmenes semanales enviados.")