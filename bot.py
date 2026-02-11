import discord
from habitos import registrar_habitos, registrar_mediciones
from retos import publicar_reto_semanal, publicar_mini_reto, publicar_bingo, validar_reto
from leaderboard import get_ranking, fin_semana
from ajustes import sugerir_ajustes, subir_meta
from estadisticas import mensaje_estadistica, resumen_semanal
from logros import revisar_logros
from config import TOKEN
from keep_alive import keep_alive
from tasks import (
    recordatorio_diario,
    completar_registros,
    publicar_reto_diario,
    publicar_reto_semanal_auto,
    enviar_resumen_semanal,
    publicar_bingo_auto,
    fin_semana_auto,
    estadistica_diaria,
    revisar_logros_auto
)

intents = discord.Intents.default()
intents.message_content = True
bot = discord.Client(intents=intents)


@bot.event
async def on_ready():
    print(f"Bot conectado como {bot.user}")
    # 🔹 Inicia las tareas automáticas
    loops = [
        recordatorio_diario,
        completar_registros,
        publicar_reto_diario,
        publicar_reto_semanal_auto,
        enviar_resumen_semanal,
        publicar_bingo_auto,
        fin_semana_auto,
        estadistica_diaria,
        revisar_logros_auto
    ]
    for loop in loops:
        if not loop.is_running():
            loop.start(bot)

    print("🔁 Tareas automáticas en ejecución.")

@bot.event
async def on_message(message):
    if message.author == bot.user:
        return

    usuario = message.author.name
    content = message.content.lower()

    # registro de mediciones (peso, cintura - sin puntos)
    if any(m in content for m in ["peso:", "cintura:"]):
        respuestas = registrar_mediciones(message, usuario)
        if respuestas:
            await message.channel.send("\n".join(respuestas))
        return

    # registro de hábitos
    if any(h in content for h in [
            "agua:", "pasos:", "ejercicio:", "calorias:", "sueño:",
            "duolingo:", "lectura:", "celular:", "dientes:", "ducha:"
    ]):
        respuestas = registrar_habitos(message, usuario)
        if respuestas:
            await message.channel.send("\n".join(respuestas))
        return

    if content.startswith("!ranking"):
        msg = get_ranking("semanal")
        await message.channel.send(msg)
        return

    if content.startswith("!total_ranking"): 
        msg = get_ranking("total")
        await message.channel.send(msg)
        return

    if content.startswith("!finsemana"): # AUN NO AUTOMATIZADO
        msg = fin_semana()
        await message.channel.send(msg)
        return

    if content.startswith("!reto_semanal"):
        msg = publicar_reto_semanal()
        await message.channel.send(msg)
        return

    # --- Mini reto (YA AUTOMATIZADO)
    if content.startswith("!mini_reto"):
        msg = publicar_mini_reto()
        await message.channel.send(msg)
        return

    # --- Bingo (AUN NO AUTOMATIZADO)
    if content.startswith("!bingo"):
        msg, buffer = publicar_bingo()
        await message.channel.send(msg,
                                   file=discord.File(fp=buffer,
                                                     filename="bingo.png"))
        return

    # --- Validar reto o bingo
    if "reto semanal completado" in content or "mini-reto completado" in content or content.startswith(
            "bingo"):
        msg = validar_reto(usuario, message.content)
        await message.channel.send(msg)
        return

    if message.content.lower().startswith("!sugerencias"):
        sugerencias = sugerir_ajustes(message.author.name)
        if sugerencias:
            await message.channel.send("\n".join(sugerencias))
        else:
            await message.channel.send("No hay sugerencias por ahora.")
        return

    # subir meta
    if message.content.lower().startswith("!subirmeta"):
        try:
            habito = message.content.split(" ")[1].strip().lower()
            msg = subir_meta(message.author.name, habito)
            await message.channel.send(msg)
        except:
            await message.channel.send("Usa el formato: !subirmeta [habito]")
        return

    # --- Estadísticas aleatorias (AUN NO AUTOMATIZADO)
    if content.startswith("!stats"):
        msg = mensaje_estadistica(usuario)
        await message.channel.send(msg)
        return

    # --- Resumen semanal
    if content.startswith("!resumen"):
        msg = resumen_semanal(usuario)
        await message.channel.send(msg)
        return

    if content.startswith("!logros"): # AUN NO AUTOMATIZADO
        msgs = revisar_logros(usuario)
        await message.channel.send("\n".join(msgs))
        return


if __name__ == "__main__":
    keep_alive()  # Inicia el server web
    bot.run(TOKEN)
