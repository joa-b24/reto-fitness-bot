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

    def get_valor(r):
        return r.get('Valor (L)') or r.get('Valor')

    peso_entries  = [(r.get('Fecha'), get_valor(r)) for r in rows if get_hab(r) == 'peso']
    pasos_entries = [(r.get('Fecha'), get_valor(r)) for r in rows if get_hab(r) == 'pasos']
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

            entries = [(r.get('Fecha', ''), r.get('Valor (L)') or r.get('Valor') or 0)
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
    Returns the logros catalog from the 'Logros' sheet.
    Supports both old schema (Título/Descripción) and new schema (ID/Nombre/Tipo/Criterio).
    """
    cache_key = 'logros'
    cached_val = _cache.get(cache_key)
    if cached_val and time.time() - cached_val['ts'] < 300:
        return cached_val['value']
    try:
        sheet = get_sheet('Logros')
        rows  = sheet.get_all_records()
        result = []
        for r in rows:
            result.append({
                'id':          r.get('ID') or '',
                'titulo':      r.get('Nombre') or r.get('Título') or r.get('Titulo') or '',
                'descripcion': r.get('Descripción') or r.get('Descripcion') or '',
                'icono':       r.get('Ícono') or r.get('Icono') or 'award',
                'color':       r.get('Color') or '',
                'categoria':   r.get('Categoría') or r.get('Categoria') or '',
                'tipo':        r.get('Tipo') or '',
                'criterio':    r.get('Criterio') or '',
                'valor_req':   r.get('Valor requerido') or 0,
                'puntos':      r.get('Puntos extra') or r.get('Puntos') or '',
            })
        resp = jsonify(result)
        _cache[cache_key] = {'ts': time.time(), 'value': resp}
        return resp
    except Exception as e:
        logger.warning(f'api_logros: {e}')
        return jsonify([])


# ── Logro detection helpers ────────────────────────────────────────────────

def _get_hab(r):
    return (r.get('Hábito') or r.get('Habito') or '').lower().strip()

def _get_cumplido(r):
    c = r.get('Cumplido', 0)
    try:
        return int(float(str(c))) == 1
    except Exception:
        return False

def _get_fecha(r):
    return str(r.get('Fecha', ''))[:10]

def _get_valor_num(r):
    v = r.get('Valor (L)') or r.get('Valor') or 0
    try:
        return float(v)
    except Exception:
        return 0.0

def _max_racha(rows, habito):
    """Max consecutive-day streak where habit was cumplido (habito='cualquiera' = any habit)."""
    from datetime import datetime, timedelta
    if habito == 'cualquiera':
        # Streak across ALL habits: count each date where at least one hab was cumplido
        cumplido_dates = sorted({
            _get_fecha(r) for r in rows if _get_cumplido(r) and len(_get_fecha(r)) == 10
        })
    else:
        cumplido_dates = sorted({
            _get_fecha(r) for r in rows
            if _get_hab(r) == habito and _get_cumplido(r) and len(_get_fecha(r)) == 10
        })

    if not cumplido_dates:
        return 0

    max_streak = current = 1
    for i in range(1, len(cumplido_dates)):
        d_prev = datetime.strptime(cumplido_dates[i - 1], '%Y-%m-%d')
        d_curr = datetime.strptime(cumplido_dates[i], '%Y-%m-%d')
        if (d_curr - d_prev).days == 1:
            current += 1
            max_streak = max(max_streak, current)
        else:
            current = 1
    return max_streak


def check_logros(usuario, datos_rows, logros_catalog):
    """
    Evaluate logros catalog against user data.
    Returns list of logro IDs that the user has earned (regardless of prior state).
    """
    from datetime import datetime
    user_rows = [r for r in datos_rows if r.get('Usuario') == usuario]

    # date → {hab: cumplido_bool}
    date_habs = {}
    for r in user_rows:
        fecha = _get_fecha(r)
        hab   = _get_hab(r)
        if not fecha or not hab:
            continue
        date_habs.setdefault(fecha, {})[hab] = _get_cumplido(r)

    all_habs = sorted({_get_hab(r) for r in user_rows if _get_hab(r)})
    MIN_COVERAGE = max(1, int(len(all_habs) * 0.8))  # at least 80 % of habits logged that day

    earned_ids = []

    for logro in logros_catalog:
        lid       = str(logro.get('id') or logro.get('ID') or '').strip()
        tipo      = (logro.get('tipo') or logro.get('Tipo') or '').lower().strip()
        criterio  = (logro.get('criterio') or logro.get('Criterio') or '').lower().strip()
        try:
            valor_req = float(logro.get('valor_req') or logro.get('valor_requerido') or
                              logro.get('Valor requerido') or 0)
        except Exception:
            valor_req = 0

        if not lid or not tipo:
            continue

        met = False

        # ── Racha ────────────────────────────────────────────────────────
        if tipo == 'racha':
            met = _max_racha(user_rows, criterio) >= valor_req

        # ── Día completo ─────────────────────────────────────────────────
        elif tipo in ('día completo', 'dia completo'):
            for fecha, habs in date_habs.items():
                if len(habs) < MIN_COVERAGE:
                    continue
                if all(habs.get(h, False) for h in all_habs if h in habs):
                    met = True
                    break

        # ── Semana completa (7 consecutive days all habits cumplido) ─────
        elif tipo == 'semana completa':
            dates = sorted(date_habs.keys())
            i = 0
            while i < len(dates) and not met:
                window = [dates[i]]
                j = i + 1
                while j < len(dates):
                    try:
                        d_prev = datetime.strptime(window[-1], '%Y-%m-%d')
                        d_curr = datetime.strptime(dates[j], '%Y-%m-%d')
                    except ValueError:
                        break
                    if (d_curr - d_prev).days != 1:
                        break
                    window.append(dates[j])
                    j += 1
                if len(window) >= int(valor_req):
                    # Verify all days in the window have all habits cumplido
                    if all(
                        len(date_habs[d]) >= MIN_COVERAGE and
                        all(date_habs[d].get(h, False) for h in all_habs if h in date_habs[d])
                        for d in window[:int(valor_req)]
                    ):
                        met = True
                i += 1

        # ── Suma semanal ─────────────────────────────────────────────────
        elif tipo == 'suma semanal':
            week_sums = {}
            for r in user_rows:
                if criterio != 'todos' and _get_hab(r) != criterio:
                    continue
                fecha = _get_fecha(r)
                try:
                    iso_week = datetime.strptime(fecha, '%Y-%m-%d').strftime('%Y-W%W')
                except Exception:
                    continue
                week_sums[iso_week] = week_sums.get(iso_week, 0.0) + _get_valor_num(r)
            met = any(s >= valor_req for s in week_sums.values())

        # ── Acumulado ────────────────────────────────────────────────────
        elif tipo == 'acumulado':
            total = sum(
                _get_valor_num(r) for r in user_rows
                if criterio == 'todos' or _get_hab(r) == criterio
            )
            met = total >= valor_req

        # ── Valor diario ─────────────────────────────────────────────────
        elif tipo == 'valor diario':
            for r in user_rows:
                if criterio != 'todos' and _get_hab(r) != criterio:
                    continue
                if _get_valor_num(r) >= valor_req:
                    met = True
                    break

        # ── Porcentaje semanal ───────────────────────────────────────────
        elif tipo == 'porcentaje semanal':
            week_days = {}
            for fecha in date_habs:
                try:
                    iso_week = datetime.strptime(fecha, '%Y-%m-%d').strftime('%Y-W%W')
                except Exception:
                    continue
                week_days.setdefault(iso_week, []).append(fecha)
            for week, days in week_days.items():
                possible = len(days) * len(all_habs)
                if not possible:
                    continue
                cumplidos = sum(
                    1 for d in days for h in all_habs
                    if date_habs.get(d, {}).get(h, False)
                )
                if cumplidos / possible * 100 >= valor_req:
                    met = True
                    break

        if met:
            earned_ids.append(lid)

    return earned_ids


def _run_check_logros_bg(usuario):
    """Run logro check in a background thread and write new completions to LogrosUsuario."""
    from datetime import datetime
    try:
        sheet_datos = get_sheet(SHEET_DATOS)
        datos = sheet_datos.get_all_records()

        sheet_logros = get_sheet('Logros')
        catalog_rows = sheet_logros.get_all_records()
        catalog = [{
            'id':        r.get('ID') or '',
            'tipo':      r.get('Tipo') or '',
            'criterio':  r.get('Criterio') or '',
            'valor_req': r.get('Valor requerido') or 0,
        } for r in catalog_rows]

        sheet_lu = get_sheet('LogrosUsuario')
        try:
            lu_rows    = sheet_lu.get_all_records()
            earned_ids = {row.get('LogroID') for row in lu_rows if row.get('Usuario') == usuario}
        except Exception:
            earned_ids = set()

        all_earned = check_logros(usuario, datos, catalog)
        new_earned = [lid for lid in all_earned if lid not in earned_ids]

        today = datetime.now().strftime('%Y-%m-%d')
        for lid in new_earned:
            sheet_lu.append_row([usuario, lid, today])
            logger.info(f'logros: {usuario} earned {lid}')

        # Invalidate per-user logros cache
        _cache.pop(f'logros_usuario:{usuario}', None)
    except Exception as e:
        logger.error(f'_run_check_logros_bg: {e}', exc_info=True)


@app.route('/api/check-logros', methods=['POST'])
def api_check_logros():
    """Manually trigger logro detection for a user."""
    usuario = (request.args.get('user') or (request.get_json(silent=True) or {}).get('user', '')).strip()
    if not usuario:
        return jsonify({'error': 'user param required'}), 400
    t = Thread(target=_run_check_logros_bg, args=(usuario,), daemon=True)
    t.start()
    return jsonify({'status': 'checking', 'user': usuario})


@app.route('/api/logros-usuario')
def api_logros_usuario():
    """Returns full logros catalog with completion status for a user."""
    usuario = request.args.get('user', '').strip()
    if not usuario:
        return jsonify({'error': 'user param required'}), 400

    cache_key = f'logros_usuario:{usuario}'
    cached_val = _cache.get(cache_key)
    if cached_val and time.time() - cached_val['ts'] < 120:
        return cached_val['value']

    try:
        sheet_logros = get_sheet('Logros')
        catalog = sheet_logros.get_all_records()

        sheet_lu = get_sheet('LogrosUsuario')
        try:
            lu_rows = sheet_lu.get_all_records()
            user_completions = {
                row.get('LogroID'): row.get('Fecha', '')
                for row in lu_rows if row.get('Usuario') == usuario
            }
        except Exception:
            user_completions = {}

        result = []
        for r in catalog:
            lid = str(r.get('ID') or '').strip()
            result.append({
                'id':               lid,
                'titulo':           r.get('Nombre') or r.get('Título') or r.get('Titulo') or '',
                'descripcion':      r.get('Descripción') or r.get('Descripcion') or '',
                'categoria':        r.get('Categoría') or r.get('Categoria') or '',
                'tipo':             r.get('Tipo') or '',
                'criterio':         r.get('Criterio') or '',
                'valor_req':        r.get('Valor requerido') or 0,
                'puntos':           r.get('Puntos extra') or r.get('Puntos') or 0,
                'icono':            r.get('Ícono') or r.get('Icono') or 'award',
                'color':            r.get('Color') or '',
                'completado':       lid in user_completions,
                'fecha_completado': user_completions.get(lid, ''),
            })

        resp = jsonify(result)
        _cache[cache_key] = {'ts': time.time(), 'value': resp}
        return resp
    except Exception as e:
        logger.warning(f'api_logros_usuario: {e}')
        return jsonify([])


@app.route('/api/historia')
def api_historia():
    """
    Returns full time series for a habit and user.
    Query: user, habito (e.g. 'peso', 'pasos')
    Returns: [{fecha, valor}] sorted by date
    """
    usuario = request.args.get('user', '').strip()
    habito  = request.args.get('habito', '').strip().lower()
    if not usuario or not habito:
        return jsonify({'error': 'user and habito params required'}), 400

    cache_key = f'historia:{usuario}:{habito}'
    cached_val = _cache.get(cache_key)
    if cached_val and time.time() - cached_val['ts'] < 120:
        return cached_val['value']

    try:
        sheet = get_sheet(SHEET_DATOS)
        data  = sheet.get_all_records()
        rows  = [r for r in data if r.get('Usuario') == usuario]

        entries = []
        for r in rows:
            hab = (r.get('Hábito') or r.get('Habito') or '').lower()
            if hab != habito:
                continue
            val = r.get('Valor (L)') or r.get('Valor')
            try:
                val = float(val) if val not in (None, '') else None
            except (ValueError, TypeError):
                val = None
            if val is not None:
                entries.append({'fecha': str(r.get('Fecha', '')), 'valor': val})

        entries.sort(key=lambda x: x['fecha'])
        resp = jsonify(entries)
        _cache[cache_key] = {'ts': time.time(), 'value': resp}
        return resp
    except Exception as e:
        logger.warning(f'api_historia: {e}')
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

    # Invalidate caches that depend on this user's data
    for key in list(_cache.keys()):
        if usuario in key:
            _cache.pop(key, None)

    # Check logros asynchronously so we don't delay the response
    t = Thread(target=_run_check_logros_bg, args=(usuario,), daemon=True)
    t.start()

    return jsonify({'message': message, 'results': results})


def keep_alive():
    t = Thread(target=lambda: app.run(host="0.0.0.0", port=8080))
    t.start()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)


