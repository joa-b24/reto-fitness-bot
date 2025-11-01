from sheets import get_sheet
from config import SHEET_DATOS
from datetime import datetime

def sugerir_ajustes(usuario):
    sheet_datos = get_sheet(SHEET_DATOS)
    sheet_metas = get_sheet("Metas")
    
    registros = sheet_datos.get_all_records()
    metas = sheet_metas.get_all_records()

    metas_usuario = [m for m in metas if m["Usuario"] == usuario]
    data_usuario = [r for r in registros if r["Usuario"] == usuario]

    sugerencias = []

    for meta in metas_usuario:
        habito = meta["Hábito"]
        tipo_ajuste = meta.get("Tipo ajuste", "").lower()
        cond_ajuste = meta.get("Condición ajuste", "")
        meta_val = float(meta["Meta"])

        # Calcular cumplimiento semanal
        recientes = [r for r in data_usuario if r["Hábito"].lower() == habito.lower()][-7:]
        if not recientes:
            continue
        efectividad = sum([r["Cumplido"] for r in recientes]) / len(recientes) * 100

        if tipo_ajuste == "racha" and efectividad == 100:
            sugerencias.append(f"💡 {usuario}, llevas {len(recientes)} días seguidos cumpliendo {habito}. "
                               f"¿Quieres subir tu meta actual de {meta_val}? Usa: `!subirmeta {habito.lower()}`")
        elif tipo_ajuste == "porcentaje" and efectividad >= float(cond_ajuste):
            sugerencias.append(f"💡 {usuario}, tu efectividad en {habito} fue {efectividad:.1f}%. "
                               f"¿Subimos tu meta de {meta_val}? Usa: `!subirmeta {habito.lower()}`")
        elif tipo_ajuste == "valor" and efectividad >= 80:
            sugerencias.append(f"💡 {usuario}, has mantenido {habito} muy bien. "
                               f"Considera aumentar tu meta un {cond_ajuste}x con `!subirmeta {habito.lower()}`")

    return sugerencias


def subir_meta(usuario, habito):
    sheet_datos = get_sheet(SHEET_DATOS)
    sheet_metas = get_sheet("Metas")
    metas = sheet_metas.get_all_records()

    fila = None
    for i, meta in enumerate(metas, start=2):
        if meta["Usuario"] == usuario and meta["Hábito"].lower() == habito.lower():
            fila = i
            tipo = meta["Tipo ajuste"].lower()
            cond = float(meta["Condición ajuste"])
            meta_val = float(meta["Meta"])
            if tipo == "racha" or tipo == "porcentaje":
                nueva_meta = meta_val * 1.1
            elif tipo == "valor":
                nueva_meta = meta_val * cond
            else:
                nueva_meta = meta_val
            sheet_metas.update_cell(fila, 4, round(nueva_meta, 2))  # Columna 'Meta'
            
            # Bono
            fecha = datetime.now().strftime("%Y-%m-%d")
            sheet_datos.append_row([usuario, fecha, f"Bono Ajuste Meta ({habito})", 1, 1, 10])
            return f"✅ Meta de {habito} actualizada a {round(nueva_meta, 2)}. ¡+10 pts por subir el reto!"
    
    return "❌ No se encontró ese hábito o usuario."
