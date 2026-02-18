from flask import Flask, render_template, jsonify, request
import time
import logging
from threading import Thread
from functools import wraps
from sheets import get_sheet
from config import SHEET_DATOS, SHEET_LEADERBOARD, SHEET_LEADERBOARD_TOTAL

logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', template_folder='templates')

# Simple in-memory cache to reduce calls to Google Sheets
_cache = {}

def cached(key, ttl=60):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            now = time.time()
            entry = _cache.get(key)
            if entry and now - entry['ts'] < ttl:
                return entry['value']
            value = fn(*args, **kwargs)
            _cache[key] = {'ts': now, 'value': value}
            return value
        return wrapper
    return decorator


@app.route('/')
def home():
    return render_template('dashboard.html')


@app.route('/ping')
def ping():
    return {"status": "ok", "message": "pong"}, 200


@app.route('/api/clear-cache')
def clear_cache():
    """Limpia el caché para forzar recarga de datos."""
    global _cache
    _cache = {}
    logger.info("Cache limpiado")
    return {"status": "ok", "message": "Cache limpiado"}, 200


@app.route('/api/users')
@cached('users', ttl=60)
def api_users():
    sheet = get_sheet('Metas')
    metas = sheet.get_all_records()
    users = sorted({m['Usuario'] for m in metas if m.get('Usuario')})
    return jsonify(users)

@app.route('/api/latest')
@cached('latest', ttl=10)
def api_latest():
    limit = int(request.args.get('limit', 50))
    sheet = get_sheet(SHEET_DATOS)
    data = sheet.get_all_records()
    # Assume sheet append order is chronological; return most recent
    recent = data[-limit:][::-1]
    return jsonify(recent)

@app.route('/api/ranking')
@cached('ranking', ttl=30)
def api_ranking():
    tipo = request.args.get('type', 'semanal')
    top = int(request.args.get('top', 10))
    sheet_name = SHEET_LEADERBOARD if tipo == 'semanal' else SHEET_LEADERBOARD_TOTAL
    sheet = get_sheet(sheet_name)
    rows = sheet.get_all_values()
    if len(rows) <= 1:
        return jsonify([])
    result = []
    for row in rows[1:top+1]:
        usuario = row[0] if len(row) > 0 else ''
        puntos = int(row[1]) if len(row) > 1 and row[1].isdigit() else 0
        result.append({'usuario': usuario, 'puntos': puntos})
    return jsonify(result)


@app.route('/api/points')
def api_points():
    # Returns aggregated points per user per day
    users_param = request.args.get('user', '')
    start = request.args.get('start')
    end = request.args.get('end')

    sheet = get_sheet(SHEET_DATOS)
    data = sheet.get_all_records()

    def in_range(fecha_str):
        if not fecha_str:
            return True
        if start and fecha_str < start:
            return False
        if end and fecha_str > end:
            return False
        return True

    users = [u.strip() for u in users_param.split(',')] if users_param else None

    agg = {}
    for r in data:
        usuario = r.get('Usuario')
        fecha = str(r.get('Fecha'))
        hab = r.get('Hábito') or r.get('Habito') or ''
        try:
            puntos = float(r.get('Puntos') or 0)
        except Exception:
            puntos = 0

        if users and usuario not in users:
            continue
        if not in_range(fecha):
            continue

        key = (usuario, hab, fecha)
        agg[key] = agg.get(key, 0) + puntos

    # Build nested series per user -> habit -> list
    series = {}
    for (usuario, hab, fecha), pts in agg.items():
        series.setdefault(usuario, {}).setdefault(hab, []).append({'date': fecha, 'puntos': pts})

    return jsonify({'series': series})


@app.route('/api/habits')
@cached('habits', ttl=300)
def api_habits():
    # Return unique habits from Metas sheet
    try:
        sheet = get_sheet('Metas')
        metas = sheet.get_all_records()
        habits = sorted({m['Hábito'] for m in metas if m.get('Hábito')})
    except Exception:
        # Fallback: extract from Datos
        sheet = get_sheet(SHEET_DATOS)
        data = sheet.get_all_records()
        habits = sorted({r.get('Hábito') or r.get('Habito') for r in data if (r.get('Hábito') or r.get('Habito'))})
    return jsonify(habits)


@app.route('/api/retos')
@cached('retos', ttl=60)
def api_retos():
    """Retorna retos activos (fecha_fin >= hoy), ordenados por caducidad próxima, sin bingo."""
    from datetime import datetime
    try:
        sheet = get_sheet('RetosHistóricos')
        rows = sheet.get_all_records()
        logger.info(f'api_retos: Leyendo {len(rows)} filas de RetosHistóricos')
        
        today = datetime.now().strftime('%Y-%m-%d')
        retos = []
        
        for idx, r in enumerate(rows):
            tipo = r.get('Tipo', '')
            # Omitir bingo
            if tipo and 'bingo' in tipo.lower():
                continue
            
            # Buscar fecha de fin en múltiples variantes de columna
            fecha_fin_raw = r.get('FechaFin') or r.get('Fecha Fin') or r.get('fecha_fin') or r.get('Fecha_Fin') or ''
            fecha_fin = str(fecha_fin_raw).strip() if fecha_fin_raw else ''
            
            # Validar formato de fecha y que sea válida
            if not fecha_fin or len(fecha_fin) < 10:
                logger.debug(f'  Fila {idx}: fecha_fin vacía o corta: "{fecha_fin}"')
                continue
            
            try:
                fecha_fin_date = datetime.strptime(fecha_fin[:10], '%Y-%m-%d')
                # Solo retos con fecha_fin >= hoy
                if fecha_fin_date.strftime('%Y-%m-%d') < today:
                    logger.debug(f'  Fila {idx}: fecha_fin {fecha_fin[:10]} < {today} (inactivo)')
                    continue
                dias_restantes = (fecha_fin_date - datetime.now()).days
                logger.debug(f'  Fila {idx}: {tipo} - {dias_restantes} días restantes')
            except ValueError as ve:
                # Formato inválido, saltar
                logger.debug(f'  Fila {idx}: fecha inválida "{fecha_fin}": {ve}')
                continue
            
            retos.append({
                'id': r.get('ID') or r.get('id') or '',
                'tipo': tipo,
                'descripcion': r.get('Reto') or r.get('Descripcion') or r.get('Descripción') or '',
                'fecha_fin': fecha_fin[:10],
                'puntos': r.get('Puntos') or 0,
                'dias_restantes': dias_restantes
            })
        
        # Ordenar por días restantes (más urgentes primero)
        retos.sort(key=lambda x: x.get('dias_restantes', 999))
        logger.info(f'api_retos: Retornando {len(retos)} retos activos')
        return jsonify(retos)
    except Exception as e:
        logger.error(f'api_retos: {e}', exc_info=True)
        return jsonify([])


@app.route('/api/heatmap')
def api_heatmap():
    """Retorna datos de cumplimiento para heatmap por usuario."""
    usuario = request.args.get('user', '')
    start = request.args.get('start', '')
    end = request.args.get('end', '')
    
    sheet = get_sheet(SHEET_DATOS)
    data = sheet.get_all_records()
    
    result = {}
    for r in data:
        u = r.get('Usuario', '')
        if usuario and u != usuario:
            continue
        
        fecha = str(r.get('Fecha', ''))
        if start and fecha < start:
            continue
        if end and fecha > end:
            continue
        
        hab = r.get('Hábito') or r.get('Habito') or ''
        cumplido = r.get('Cumplido', 0)
        
        if hab not in result:
            result[hab] = {}
        result[hab][fecha] = cumplido
    
    return jsonify(result)


def keep_alive():
    t = Thread(target=lambda: app.run(host="0.0.0.0", port=8080))
    t.start()


