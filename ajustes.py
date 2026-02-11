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

        historico = [r for r in data_usuario if r["Hábito"].lower() == habito.lower()]

        if not historico:
            continue

        # Calcular efectividad general
        try:
            cumplidos = [int(r.get("Cumplido", 0)) for r in historico]
            efectividad = sum(cumplidos) / len(cumplidos) * 100
        except Exception:
            efectividad = 0

        # ===== Racha =====
        if tipo_ajuste == "racha":
            try:
                dias_req = int(cond_ajuste)
            except Exception:
                dias_req = 3

            recientes_racha = [r for r in data_usuario if r["Hábito"].lower() == habito.lower()][-dias_req:]
            if len(recientes_racha) == dias_req and all(int(r.get("Cumplido", 0)) == 1 for r in recientes_racha):
                sugerencias.append(f"{usuario}, llevas {dias_req} días seguidos cumpliendo {habito}. ¿Quieres subir la meta ({meta_val})? Usa: `!subirmeta {habito.lower()}`")

        # ===== Efectividad =====
        elif tipo_ajuste == "efectividad":
            try:
                umbral = float(cond_ajuste)
            except Exception:
                umbral = 80.0

            if efectividad >= umbral:
                sugerencias.append(f"{usuario}, tu efectividad en {habito} fue {efectividad:.1f}%. ¿Subimos tu meta ({meta_val})? Usa: `!subirmeta {habito.lower()}`")

        # ===== Valor =====
        elif tipo_ajuste == "valor":
            try:
                factor = float(cond_ajuste)
            except Exception:
                factor = 1.05

            valores = []
            for h in historico:
                try:
                    v = float(h.get("Valor", 0))
                    valores.append(v)
                except Exception:
                    continue

            if valores:
                promedio = sum(valores) / len(valores)
                if promedio >= meta_val * factor:
                    sugerencias.append(f"{usuario}, tu promedio en {habito} es {promedio:.1f} (meta {meta_val}). ¿Subimos la meta? Usa: `!subirmeta {habito.lower()}`")

    return sugerencias


def subir_meta(usuario, habito):
    sheet_datos = get_sheet(SHEET_DATOS)
    sheet_metas = get_sheet("Metas")
    metas = sheet_metas.get_all_records()

    fila = None
    for i, meta in enumerate(metas, start=2):
        if meta["Usuario"] == usuario and meta["Hábito"].lower() == habito.lower():
            fila = i
            tipo = str(meta.get("Tipo ajuste", "")).lower()
            cond_raw = meta.get("Condición ajuste", "")
            try:
                cond = float(cond_raw)
            except Exception:
                cond = None
            meta_val = float(meta.get("Meta", 0))

            # Solo aplicar cambios para tipos conocidos
            if tipo in ("racha", "porcentaje", "efectividad"):
                nueva_meta = meta_val * 1.1
            elif tipo == "valor" and cond:
                nueva_meta = meta_val * cond
            else:
                return "❌ Este hábito no tiene un tipo de ajuste automático o falta la condición."

            sheet_metas.update_cell(fila, 4, round(nueva_meta, 2))  # Columna 'Meta'
            
            # Bono
            fecha = datetime.now().strftime("%Y-%m-%d")
            sheet_datos.append_row([usuario, fecha, f"Bono Ajuste Meta ({habito})", 1, 1, 10])
            return f"✅ Meta de {habito} actualizada a {round(nueva_meta, 2)}. ¡+10 pts por subir el reto!"
    
    return "❌ No se encontró ese hábito o usuario."
