# tasks.py
import random
import datetime
import pytz
import logging
import discord
from discord.ext import tasks
from sheets import get_sheet
from estadisticas import resumen_semanal
from retos import publicar_mini_reto, publicar_reto_semanal, verificar_retos_auto
from retos import publicar_bingo
from leaderboard import fin_semana
from estadisticas import mensaje_estadistica
from logros import revisar_logros

logger = logging.getLogger(__name__)

# === CONFIGURACIÓN GENERAL ===
TIMEZONE = pytz.timezone("America/Mexico_City")
TARGET_USERS = ["joa_b29", "d1aniss", "anisss"]

# === HORARIOS FIJOS ===
HORA_COMPLETAR = 7
HORA_RETO_DIARIO = 5
HORA_RETO_SEMANAL = 5
HORA_RESUMEN = 23
HORA_RECORDATORIO = 23


# --- RECORDATORIO DIARIO ---
@tasks.loop(minutes=1)
async def recordatorio_diario(bot):
    now = datetime.datetime.now(TIMEZONE)
    if now.hour == HORA_RECORDATORIO and now.minute == 0:
        canal = discord.utils.get(bot.get_all_channels(), name="registro-diario")
        if canal:
            await canal.send(random.choice([
                "⏰ Hora de registrar. ¿Ya cerraste el día?",
                "🌙 Buenas noches! No se duerman sin registrar sus hábitos.",
                "📝 ¿Hábitos del día ya registrados? El bot espera...",
                "🔔 Recordatorio nocturno: los hábitos no se registran solos.",
                "✅ Checkpoint nocturno. ¿Cómo fue el día?",
                "👀 Oye... ¿ya registraste? El bot sabe cuando no lo haces.",
            ]))
        logger.info(f"Recordatorio diario enviado a las {now.strftime('%Y-%m-%d %H:%M')}")


# --- COMPLETAR REGISTROS FALTANTES (día anterior) ---
@tasks.loop(minutes=1)
async def completar_registros(bot):
    now = datetime.datetime.now(TIMEZONE)
    if now.hour == HORA_COMPLETAR and now.minute == 0:
        fecha_objetivo = (now - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        canal = discord.utils.get(bot.get_all_channels(), name="sistema-bot")
        sheet = get_sheet("Datos")
        # cargar solo registros recientes (los últimos) para optimizar
        data = sheet.get_all_records()

        # Cargar la hoja de Metas como fuente de hábitos válidos
        sheet_metas = get_sheet("Metas")
        metas = sheet_metas.get_all_records()


        # Hábitos definidos en metas (únicos y válidos)
        habitos = list({
            r["Hábito"]
            for r in metas
            if r["Hábito"] and r["Hábito"] not in ["Peso", "Cintura", "Reto", "BINGO"]
        })
        
        faltantes = 0
        for u in TARGET_USERS:
            for h in habitos:
                registros = [r for r in data if r["Usuario"] == u and r["Hábito"] == h and str(r["Fecha"]) == fecha_objetivo]
                if not registros:
                    # No auto-completar con 0 — los días sin registro se ignoran
                    faltantes += 1

        msg = f"🗓️ Hábitos sin registrar para {fecha_objetivo}: {faltantes} (no se autocompletan)."
        logger.info(msg)
        if canal:
            await canal.send(msg)


# --- PUBLICAR MINI-RETO DIARIO---
@tasks.loop(minutes=1)
async def publicar_reto_diario(bot):
    await bot.wait_until_ready()
    now = datetime.datetime.now(TIMEZONE)
    if now.hour == HORA_RETO_DIARIO and now.minute == 0:
        canal = discord.utils.get(bot.get_all_channels(), name="retos")
        if canal:
            msg = publicar_mini_reto()
            await canal.send(msg)
        logger.info("Mini-reto publicado automáticamente")


# --- PUBLICAR RETO SEMANAL---
@tasks.loop(minutes=1)
async def publicar_reto_semanal_auto(bot):
    await bot.wait_until_ready()
    now = datetime.datetime.now(TIMEZONE)
    if now.weekday() == 0 and now.hour == HORA_RETO_SEMANAL and now.minute == 0:
        canal = discord.utils.get(bot.get_all_channels(), name="retos")
        if canal:
            msg = publicar_reto_semanal()
            await canal.send(msg)
        logger.info("Reto semanal publicado automáticamente")


# --- ENVIAR RESUMEN SEMANAL---
@tasks.loop(minutes=1)
async def enviar_resumen_semanal(bot):
    await bot.wait_until_ready()
    now = datetime.datetime.now(TIMEZONE)
    if now.weekday() == 6 and now.hour == HORA_RESUMEN and now.minute == 59:
        canal = discord.utils.get(bot.get_all_channels(), name="estadisticas")
        if canal:
            for usuario in TARGET_USERS:
                msg = resumen_semanal(usuario)
                await canal.send(msg)
        logger.info("Resúmenes semanales enviados")


# --- PUBLICAR BINGO SEMANAL (miércoles) ---
@tasks.loop(minutes=1)
async def publicar_bingo_auto(bot):
    await bot.wait_until_ready()
    now = datetime.datetime.now(TIMEZONE)
    if now.weekday() == 2 and now.hour == HORA_RETO_SEMANAL and now.minute == 0:
        canal = discord.utils.get(bot.get_all_channels(), name="retos")
        if canal:
            msg, buffer = publicar_bingo()
            await canal.send(msg, file=discord.File(fp=buffer, filename="bingo.png"))
        logger.info("Bingo publicado automáticamente")


# --- FIN DE SEMANA AUTOMÁTICO (lunes) ---
@tasks.loop(minutes=1)
async def fin_semana_auto(bot):
    await bot.wait_until_ready()
    now = datetime.datetime.now(TIMEZONE)
    if now.weekday() == 0 and now.hour == HORA_RETO_SEMANAL + 1 and now.minute == 0:
        canal = discord.utils.get(bot.get_all_channels(), name="retos")
        if canal:
            msg = fin_semana()
            await canal.send(msg)
        logger.info("Fin de semana automatizado ejecutado")


# --- ESTADÍSTICA DIARIA ALEATORIA ---
@tasks.loop(minutes=1)
async def estadistica_diaria(bot):
    await bot.wait_until_ready()
    now = datetime.datetime.now(TIMEZONE)
    if now.hour == HORA_RECORDATORIO and now.minute == 30:
        canal = discord.utils.get(bot.get_all_channels(), name="estadisticas")
        if canal:
            # enviar una estadística aleatoria para cada usuario objetivo
            for usuario in TARGET_USERS:
                msg = mensaje_estadistica(usuario)
                await canal.send(msg)
        logger.info("Estadística diaria enviada")


# --- AUTO-COMPLETADO DE RETOS SEMANALES (diario, 23:45) ---
@tasks.loop(minutes=1)
async def revisar_retos_semanales_auto(bot):
    await bot.wait_until_ready()
    now = datetime.datetime.now(TIMEZONE)
    if now.hour == 23 and now.minute == 45:
        canal = discord.utils.get(bot.get_all_channels(), name="retos")
        for usuario in TARGET_USERS:
            try:
                msgs = verificar_retos_auto(usuario)
                if canal and msgs:
                    for m in msgs:
                        await canal.send(m)
            except Exception as e:
                logger.error(f"Error verificando retos de {usuario}: {e}", exc_info=True)
        logger.info("Revisión automática de retos semanales completada.")


# --- REVISAR LOGROS SEMANAL ---
@tasks.loop(minutes=1)
async def revisar_logros_auto(bot):
    await bot.wait_until_ready()
    now = datetime.datetime.now(TIMEZONE)
    if now.weekday() == 6 and now.hour == HORA_RESUMEN and now.minute == 0:
        canal = discord.utils.get(bot.get_all_channels(), name="estadisticas")
        if canal:
            for usuario in TARGET_USERS:
                msgs = revisar_logros(usuario)
                for m in msgs:
                    await canal.send(m)
        print("🏅 Revisión automática de logros completada.")