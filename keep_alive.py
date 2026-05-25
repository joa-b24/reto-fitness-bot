from flask import Flask, render_template, jsonify, request, send_from_directory
import os
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

def cache_get(key, ttl, fn):
    """Cache helper for dynamic keys (e.g. per-user endpoints)."""
    now = time.time()
    entry = _cache.get(key)
    if entry and now - entry['ts'] < ttl:
        return entry['value']
    value = fn()
    _cache[key] = {'ts': now, 'value': value}
    return value


REACT_BUILD = os.path.join(os.path.dirname(__file__), 'static', 'dist')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """Serve React SPA from static/dist/; fall back to index.html for client-side routing."""
    if path and os.path.exists(os.path.join(REACT_BUILD, path)):
        return send_from_directory(REACT_BUILD, path)
    if os.path.exists(os.path.join(REACT_BUILD, 'index.html')):
        resp = send_from_directory(REACT_BUILD, 'index.html')
        resp.headers['Cache-Control'] = 'no-store'
        return resp
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

    cache_key = f'points:{users_param}:{start}:{end}'
    cached_val = _cache.get(cache_key)
    if cached_val and time.time() - cached_val['ts'] < 120:
        return cached_val['value']

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

    result = jsonify({'series': series})
    _cache[cache_key] = {'ts': time.time(), 'value': result}
    return result


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
            fecha_fin_raw = r.get('Fecha fin válida')
            # Limpiar el carácter ' al inicio de la fecha, si existe
            fecha_fin = fecha_fin_raw.lstrip("'")
            
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
                'id':            r.get('ID') or r.get('id') or '',
                'tipo':          tipo,
                'descripcion':   r.get('Reto') or r.get('Descripcion') or r.get('Descripción') or '',
                'fecha_fin':     fecha_fin[:10],
                'puntos':        r.get('Puntos') or 0,
                'dias_restantes':dias_restantes,
                'icono':         r.get('Ícono') or r.get('Icono') or r.get('Emoji') or 'target',
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

    cache_key = f'heatmap:{usuario}:{start}:{end}'
    cached_val = _cache.get(cache_key)
    if cached_val and time.time() - cached_val['ts'] < 120:
        return cached_val['value']

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

    resp = jsonify(result)
    _cache[cache_key] = {'ts': time.time(), 'value': resp}
    return resp


@app.route('/api/kpi')
def api_kpi():
    """
    Returns key metrics for a user: last peso, last pasos, all-time total points.
    Query params: user (required)
    """
    usuario = request.args.get('user', '').strip()
    if not usuario:
        return jsonify({'error': 'user param required'}), 400

    cache_key = f'kpi:{usuario}'
    cached_val = _cache.get(cache_key)
    if cached_val and time.time() - cached_val['ts'] < 120:
        return cached_val['value']

    sheet = get_sheet(SHEET_DATOS)
    data  = sheet.get_all_records()
    rows  = [r for r in data if r.get('Usuario') == usuario]

    if rows:
        sample_habits = [r.get('Hábito') or r.get('Habito') for r in rows[:10]]
        logger.info(f'api_kpi: {usuario} → {len(rows)} filas, hábitos muestra: {sample_habits}')

    def get_hab(r):
        return (r.get('Hábito') or r.get('Habito') or '').lower()

    peso_entries  = [(r.get('Fecha'), r.get('Valor')) for r in rows if get_hab(r) == 'peso']
    pasos_entries = [(r.get('Fecha'), r.get('Valor')) for r in rows if get_hab(r) == 'pasos']
    logger.info(f'api_kpi: peso_entries={peso_entries}, pasos_entries={pasos_entries}')

    last_peso  = sorted(peso_entries,  key=lambda x: x[0])[-1][1] if peso_entries  else None
    last_pasos = sorted(pasos_entries, key=lambda x: x[0])[-1][1] if pasos_entries else None

    peso_hist = []
    for _, v in sorted(peso_entries, key=lambda x: x[0])[-14:]:
        try:
            if v not in ('', None): peso_hist.append(float(v))
        except (ValueError, TypeError):
            pass

    total_points = 0
    for r in rows:
        try:
            p = r.get('Puntos')
            if p not in ('', None): total_points += float(p)
        except (ValueError, TypeError):
            pass

    resp = jsonify({
        'usuario':       usuario,
        'peso':          float(last_peso)  if last_peso  not in (None, '') else None,
        'peso_historia': peso_hist,
        'pasos':         int(float(last_pasos)) if last_pasos not in (None, '') else None,
        'puntos_total':  round(total_points),
    })
    _cache[cache_key] = {'ts': time.time(), 'value': resp}
    return resp


@app.route('/api/checkpoints')
@cached('checkpoints', ttl=300)
def api_checkpoints():
    """
    Returns challenge timeline checkpoints from the 'Checkpoints' sheet.
    Expected columns: Semana, Fecha, Título, Corto, Ícono, (Estado optional)
    Falls back to empty list if sheet doesn't exist yet.
    """
    try:
        sheet = get_sheet('Checkpoints')
        rows  = sheet.get_all_records()
        result = []
        for r in rows:
            result.append({
                'semana': int(r.get('Semana') or 0),
                'fecha':  str(r.get('Fecha') or ''),
                'titulo': r.get('Título') or r.get('Titulo') or '',
                'corto':  r.get('Corto') or '',
                'icono':  r.get('Ícono') or r.get('Icono') or r.get('Emoji') or 'flag',
            })
        return jsonify(result)
    except Exception as e:
        logger.warning(f'api_checkpoints: sheet not found or error — {e}')
        return jsonify([])


@app.route('/api/vision')
def api_vision():
    """
    Returns vision board tiles for a user from the 'Visión' sheet.
    Expected columns: Usuario, Tipo, Titulo, Texto, Autor, Color, URL
    """
    usuario = request.args.get('user', '').strip()
    cache_key = f'vision:{usuario}'
    cached_val = _cache.get(cache_key)
    if cached_val and time.time() - cached_val['ts'] < 300:
        return cached_val['value']
    try:
        sheet = get_sheet('Visión')
        rows  = sheet.get_all_records()
        result = []
        for r in rows:
            u = r.get('Usuario', '')
            if usuario and u != usuario:
                continue
            result.append({
                'tipo':   (r.get('Tipo') or 'meta').lower(),
                'titulo': r.get('Título') or r.get('Titulo') or '',
                'texto':  r.get('Texto') or '',
                'autor':  r.get('Autor') or '',
                'color':  r.get('Color') or '',
                'url':    r.get('URL') or '',
            })
        resp = jsonify(result)
        _cache[cache_key] = {'ts': time.time(), 'value': resp}
        return resp
    except Exception as e:
        logger.warning(f'api_vision: {e}')
        return jsonify([])


@app.route('/api/plan')
@cached('plan', ttl=300)
def api_plan():
    """
    Returns training plan phases from the 'Plan' sheet.
    Expected columns: Fase, TituloFase, Semana, Dia, Titulo, Tipo, Duracion, Tags, Descripcion
    """
    try:
        sheet = get_sheet('Plan')
        rows  = sheet.get_all_records()
        result = []
        for r in rows:
            result.append({
                'Fase':       r.get('Fase') or '',
                'TituloFase': r.get('TituloFase') or r.get('Titulo Fase') or '',
                'Semana':     r.get('Semana') or '',
                'Dia':        r.get('Dia') or r.get('Día') or '',
                'Titulo':     r.get('Titulo') or r.get('Título') or '',
                'Tipo':       r.get('Tipo') or '',
                'Duracion':   r.get('Duracion') or r.get('Duración') or '',
                'Tags':       r.get('Tags') or '',
                'Descripcion':r.get('Descripcion') or r.get('Descripción') or '',
            })
        return jsonify(result)
    except Exception as e:
        logger.warning(f'api_plan: {e}')
        return jsonify([])


@app.route('/api/metas')
def api_metas():
    """
    Returns goal configuration for a user from the 'Metas' sheet,
    enriched with approximate progress percentage from Datos.
    """
    usuario = request.args.get('user', '').strip()
    if not usuario:
        return jsonify({'error': 'user param required'}), 400

    cache_key = f'metas:{usuario}'
    cached_val = _cache.get(cache_key)
    if cached_val and time.time() - cached_val['ts'] < 300:
        return cached_val['value']

    try:
        sheet_metas = get_sheet('Metas')
        metas = [m for m in sheet_metas.get_all_records() if m.get('Usuario') == usuario]

        sheet_datos = get_sheet(SHEET_DATOS)
        datos = sheet_datos.get_all_records()
        user_datos = [r for r in datos if r.get('Usuario') == usuario]

        result = []
        for m in metas:
            hab = (m.get('Hábito') or '').lower()
            meta_val = float(m.get('Meta') or 0)
            tipo = m.get('Tipo', '+')

            entries = [(r.get('Fecha', ''), r.get('Valor', 0))
                       for r in user_datos
                       if (r.get('Hábito') or r.get('Habito') or '').lower() == hab]
            entries.sort(key=lambda x: x[0])
            last_val = float(entries[-1][1]) if entries else 0

            if meta_val:
                if tipo == '+':
                    progreso = min(100, round(last_val / meta_val * 100))
                else:
                    progreso = min(100, round((1 - max(0, last_val - meta_val) / meta_val) * 100)) if last_val <= meta_val * 2 else 0
            else:
                progreso = 0

            result.append({
                'habito':   hab,
                'meta':     meta_val,
                'unidad':   m.get('Unidad') or '',
                'puntos':   float(m.get('Puntos') or 0),
                'carril':   m.get('Carril') or m.get('Lane') or '',
                'progreso': progreso,
                'ultimo':   last_val,
            })
        resp = jsonify(result)
        _cache[cache_key] = {'ts': time.time(), 'value': resp}
        return resp
    except Exception as e:
        logger.warning(f'api_metas: {e}')
        return jsonify([])


@app.route('/api/logros')
def api_logros():
    """
    Returns achievements for a user from the 'Logros' sheet.
    Expected columns: Usuario, Título, Descripción, Ícono, Fecha, Color
    """
    usuario = request.args.get('user', '').strip()
    cache_key = f'logros:{usuario}'
    cached_val = _cache.get(cache_key)
    if cached_val and time.time() - cached_val['ts'] < 300:
        return cached_val['value']
    try:
        sheet = get_sheet('Logros')
        rows  = sheet.get_all_records()
        result = []
        for r in rows:
            u = r.get('Usuario', '')
            if usuario and u != usuario:
                continue
            result.append({
                'titulo':      r.get('Título') or r.get('Titulo') or '',
                'descripcion': r.get('Descripción') or r.get('Descripcion') or '',
                'icono':       r.get('Ícono') or r.get('Icono') or 'award',
                'fecha':       str(r.get('Fecha') or ''),
                'color':       r.get('Color') or '',
            })
        resp = jsonify(result)
        _cache[cache_key] = {'ts': time.time(), 'value': resp}
        return resp
    except Exception as e:
        logger.warning(f'api_logros: {e}')
        return jsonify([])


@app.route('/api/registro', methods=['POST'])
def api_registro():
    """
    Registra hábitos desde el dashboard web.
    Body: {user, fecha, entries: [{habito, valor}]}
    Reutiliza la misma lógica de puntos que el bot de Discord.
    """
    import re
    body = request.get_json(silent=True) or {}
    usuario = body.get('user', '').strip()
    fecha   = body.get('fecha', '').strip()
    entries = body.get('entries', [])

    if not usuario or not fecha or not entries:
        return jsonify({'error': 'Faltan campos: user, fecha, entries'}), 400

    sheet_datos = get_sheet(SHEET_DATOS)
    sheet_metas = get_sheet('Metas')
    metas = sheet_metas.get_all_records()
    metas_usuario = [m for m in metas if m.get('Usuario') == usuario]

    if not metas_usuario:
        return jsonify({'error': f'No se encontraron metas para {usuario}'}), 404

    results = []
    for entry in entries:
        habito_raw = str(entry.get('habito', '')).strip().lower()
        try:
            valor = float(str(entry.get('valor', 0)).strip())
        except (ValueError, TypeError):
            continue

        # Find matching meta (case-insensitive)
        meta = next((m for m in metas_usuario if m.get('Hábito', '').lower() == habito_raw), None)

        if meta is None:
            # No meta configured — just log the measurement without points (peso, cintura, etc.)
            sheet_datos.append_row([usuario, fecha, habito_raw.capitalize(), valor, '', ''])
            results.append({'habito': habito_raw, 'valor': valor, 'cumplido': None, 'puntos': 0})
            continue

        tipo         = meta.get('Tipo', '+')
        meta_valor   = float(meta.get('Meta', 0) or 0)
        puntos_base  = float(meta.get('Puntos', 0) or 0)
        antimeta_raw = meta.get('Antimeta', '')
        penaliz_raw  = meta.get('Puntos', puntos_base)

        try:
            antimeta = float(antimeta_raw) if antimeta_raw not in ('', None) else None
        except (ValueError, TypeError):
            antimeta = None
        try:
            penalizacion = float(penaliz_raw) if penaliz_raw not in ('', None) else puntos_base
        except (ValueError, TypeError):
            penalizacion = puntos_base

        try:
            penalty_unit     = float(meta.get('PenaltyUnit', '') or '')
        except (ValueError, TypeError):
            penalty_unit = None
        try:
            penalty_per_unit = float(meta.get('PenaltyPerUnit', '') or '')
        except (ValueError, TypeError):
            penalty_per_unit = None

        if tipo == '+':
            cumple_meta   = valor >= meta_valor
            rompe_antimeta = antimeta is not None and valor < antimeta
        else:
            cumple_meta   = valor <= meta_valor
            rompe_antimeta = antimeta is not None and valor > antimeta

        puntos = 0
        if cumple_meta:
            puntos = puntos_base
        else:
            if penalty_unit and penalty_per_unit:
                deficit = max(0.0, meta_valor - valor) if tipo == '+' else max(0.0, valor - meta_valor)
                units   = int(deficit // penalty_unit)
                if units > 0:
                    puntos = -abs(units * penalty_per_unit)
                elif rompe_antimeta:
                    puntos = -abs(penalizacion)
            elif rompe_antimeta:
                puntos = -abs(penalizacion)

        # Toggle habits: valor=1 means completed
        if habito_raw in ('duolingo', 'celular', 'dientes', 'ducha') and valor == 1:
            cumple_meta = True
            puntos = puntos_base

        sheet_datos.append_row([usuario, fecha, habito_raw.capitalize(), valor, 1 if cumple_meta else 0, puntos])
        results.append({'habito': habito_raw, 'valor': valor, 'cumplido': cumple_meta, 'puntos': puntos})
        logger.info(f'api_registro: {usuario} {fecha} {habito_raw}={valor} → {puntos}pts')

    cumplidos = sum(1 for r in results if r.get('cumplido'))
    total     = len(results)
    message   = f'✅ {cumplidos}/{total} hábitos cumplidos registrados para {usuario} ({fecha})'
    return jsonify({'message': message, 'results': results})


def keep_alive():
    t = Thread(target=lambda: app.run(host="0.0.0.0", port=8080))
    t.start()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)


