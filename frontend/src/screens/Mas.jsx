import { useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { fetcher } from '../lib/api'
import { Card, CardHeader } from '../components/ui/Card'
import { Icon } from '../components/ui/Icon'
import { Chip } from '../components/ui/Chip'
import { ProgressBar } from '../components/ui/ProgressBar'
import { currentWeekNumber } from '../lib/constants'
import styles from './Mas.module.css'

const TABS = [
  { id: 'retos',       label: 'Retos activos', icon: 'target'    },
  { id: 'logros',      label: 'Logros',        icon: 'award'     },
  { id: 'fotos',       label: 'Fotos',         icon: 'camera'    },
  { id: 'metas',       label: 'Metas',         icon: 'flag'      },
  { id: 'checkpoints', label: 'Timeline',      icon: 'milestone' },
]

// ── Retos tab ──────────────────────────────────────────────────────────────
function RetosTab({ user }) {
  const url = user ? `/api/retos?user=${encodeURIComponent(user)}` : '/api/retos'
  const { data, isLoading } = useSWR(url, fetcher, { refreshInterval: 60_000 })
  const retos = Array.isArray(data) ? data : []

  if (isLoading) return <div className={styles.empty}>Cargando…</div>

  if (!retos.length) return (
    <div className={styles.empty}>
      <Icon name="target" size={32} color="var(--text-3)" />
      <p>No hay retos activos en este momento.</p>
    </div>
  )

  const pendientes  = retos.filter((r) => !r.completado)
  const completados = retos.filter((r) => r.completado)

  return (
    <div className={styles.list}>
      {pendientes.map((r, i) => (
        <div key={r.id || i} className={styles.retoCard}>
          <div className={styles.retoIcon}>
            <Icon name={r.icono || 'target'} size={20} color="var(--accent)" />
          </div>
          <div className={styles.retoBody}>
            <div className={styles.retoHeader}>
              <span className={styles.retoTipo}>{r.tipo}</span>
              <span className={`${styles.retoDias} ${r.dias_restantes <= 3 ? styles.retoDiasUrgent : ''}`}>
                {r.dias_restantes === 0 ? 'Hoy' : `${r.dias_restantes}d`}
              </span>
            </div>
            <p className={styles.retoDesc}>{r.descripcion}</p>
            <div className={styles.retoMeta}>
              <Icon name="zap" size={11} color="var(--accent)" />
              <span className={styles.retoPts}>{r.puntos} pts</span>
            </div>
          </div>
        </div>
      ))}

      {completados.length > 0 && (
        <>
          <p className={styles.retosGroupLabel}>
            <Icon name="check-circle" size={12} color="var(--ok)" /> Completados ({completados.length})
          </p>
          {completados.map((r, i) => (
            <div key={r.id || i} className={`${styles.retoCard} ${styles.retoCardDone}`}>
              <div className={styles.retoIconDone}>
                <Icon name="check-circle" size={20} color="var(--ok)" />
              </div>
              <div className={styles.retoBody}>
                <div className={styles.retoHeader}>
                  <span className={styles.retoTipo}>{r.tipo}</span>
                  <span className={styles.retoDone}>✓ Completado</span>
                </div>
                <p className={styles.retoDesc}>{r.descripcion}</p>
                <div className={styles.retoMeta}>
                  <Icon name="zap" size={11} color="var(--ok)" />
                  <span className={styles.retoPts} style={{ color: 'var(--ok)' }}>{r.puntos} pts</span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ── Logros tab ─────────────────────────────────────────────────────────────
function LogrosTab({ user }) {
  const url = user ? `/api/logros-usuario?user=${encodeURIComponent(user)}` : null
  const { data, isLoading, mutate } = useSWR(url, fetcher, { revalidateOnFocus: false })
  const logros = Array.isArray(data) ? data : []
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    if (!user || syncing) return
    setSyncing(true)
    try {
      await fetch(`/api/check-logros?user=${encodeURIComponent(user)}`, { method: 'POST' })
      // Give the background thread ~3s to write, then revalidate
      await new Promise(r => setTimeout(r, 3000))
      await mutate()
    } finally {
      setSyncing(false)
    }
  }

  if (isLoading) return <div className={styles.empty}>Cargando…</div>

  if (!logros.length) return (
    <div className={styles.empty}>
      <Icon name="award" size={32} color="var(--text-3)" />
      <p>No hay logros en el catálogo.</p>
      <p className={styles.emptyHint}>
        Añade logros a la pestaña <strong>Logros</strong> con columnas:<br />
        <code>ID, Nombre, Categoría, Tipo, Criterio, Valor requerido, Puntos extra</code>
      </p>
    </div>
  )

  const earned  = logros.filter(l => l.completado)
  const pending = logros.filter(l => !l.completado)

  return (
    <div className={styles.logrosSections}>
      <div className={styles.logrosTopBar}>
        <span className={styles.logrosGroupLabel} style={{ margin: 0 }}>
          {earned.length}/{logros.length} obtenidos
        </span>
        <button
          type="button"
          className={styles.syncBtn}
          onClick={handleSync}
          disabled={syncing}
        >
          <Icon name="zap" size={12} color="var(--accent)" />
          {syncing ? 'Verificando…' : 'Sincronizar'}
        </button>
      </div>

      {earned.length > 0 && (
        <>
          <p className={styles.logrosGroupLabel}>
            <Icon name="award" size={12} color="var(--ok)" /> Obtenidos ({earned.length})
          </p>
          <div className={styles.logrosGrid}>
            {earned.map((l, i) => (
              <LogroCard key={l.id || i} logro={l} earned />
            ))}
          </div>
        </>
      )}
      {pending.length > 0 && (
        <>
          <p className={styles.logrosGroupLabel} style={{ marginTop: earned.length ? '20px' : 0 }}>
            <Icon name="lock" size={12} color="var(--text-3)" /> Por obtener ({pending.length})
          </p>
          <div className={styles.logrosGrid}>
            {pending.map((l, i) => (
              <LogroCard key={l.id || i} logro={l} earned={false} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function LogroCard({ logro: l, earned }) {
  const color = earned ? (l.color || 'var(--ok)') : 'var(--text-3)'
  const border = earned ? (l.color || 'var(--ok)') : 'var(--border)'
  const bg     = earned ? (l.color ? `${l.color}18` : 'rgba(0,200,100,.08)') : 'var(--surface-3)'
  return (
    <div className={`${styles.logroCard} ${earned ? styles.logroEarned : styles.logroPending}`}
         style={{ borderColor: border, opacity: earned ? 1 : 0.5 }}>
      <div className={styles.logroIconWrap} style={{ background: bg }}>
        <Icon name={l.icono || 'award'} size={22} color={color} />
      </div>
      <p className={styles.logroTitle}>{l.titulo}</p>
      {l.descripcion && <p className={styles.logroDesc}>{l.descripcion}</p>}
      {l.categoria && <p className={styles.logroDate}>{l.categoria}</p>}
      {earned && l.fecha_completado && (
        <p className={styles.logroDate} style={{ color: 'var(--ok)' }}>✓ {l.fecha_completado}</p>
      )}
      {!earned && l.valor_req > 0 && (
        <p className={styles.logroDate}>{l.tipo} · {l.criterio} × {l.valor_req}</p>
      )}
      {l.puntos > 0 && (
        <p className={styles.logroDate} style={{ color: earned ? 'var(--accent)' : 'var(--text-3)' }}>
          +{l.puntos} pts
        </p>
      )}
    </div>
  )
}

// ── Fotos tab ──────────────────────────────────────────────────────────────
function FotosTab({ user }) {
  const url = user ? `/api/fotos?user=${encodeURIComponent(user)}&tipo=progreso` : null
  const { data, isLoading } = useSWR(url, fetcher, { revalidateOnFocus: false })
  const fotos = Array.isArray(data) ? data : []

  if (isLoading) return <div className={styles.empty}>Cargando…</div>

  if (fotos.length === 0) return (
    <div className={styles.empty}>
      <Icon name="camera" size={28} color="var(--text-3)" />
      <p>Sin fotos de progreso aún.</p>
      <p className={styles.emptyHint}>Sube fotos desde la pestaña <strong>Registro</strong>, sección Físico.</p>
    </div>
  )

  return (
    <div className={styles.fotosGrid}>
      {fotos.map((f, i) => (
        <div key={i} className={styles.fotoCard}>
          <img src={f.url} alt={f.nota || f.fecha} className={styles.fotoImg} loading="lazy" />
          <div className={styles.fotoMeta}>
            <span className={styles.fotoSem}>Sem. {f.semana}</span>
            <span className={styles.fotoFecha}>{f.fecha}</span>
          </div>
          {f.nota && <p className={styles.fotaNota}>{f.nota}</p>}
        </div>
      ))}
    </div>
  )
}

// ── Metas tab ──────────────────────────────────────────────────────────────
function MetasTab({ user }) {
  const { data, isLoading } = useSWR(
    user ? `/api/metas?user=${encodeURIComponent(user)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )
  const metas = Array.isArray(data) ? data : []

  if (isLoading) return <div className={styles.empty}>Cargando…</div>

  if (!metas.length) return (
    <div className={styles.empty}>
      <Icon name="flag" size={32} color="var(--text-3)" />
      <p>No hay metas configuradas.</p>
      <p className={styles.emptyHint}>
        Las metas se leen de la pestaña <strong>Metas</strong> en Google Sheets.
      </p>
    </div>
  )

  const LANE_COLORS = {
    fisico:    'var(--lane-fisico)',
    nutricion: 'var(--lane-nutricion)',
    habitos:   'var(--lane-habitos)',
    descanso:  'var(--lane-descanso)',
  }

  return (
    <div className={styles.list}>
      {metas.map((m, i) => {
        const lane  = (m.carril || '').toLowerCase()
        const color = LANE_COLORS[lane] || 'var(--accent)'
        const pct   = m.progreso ?? 0
        const val   = m.promedio ?? m.ultimo ?? 0
        return (
          <div key={i} className={styles.metaRow}>
            <div className={styles.metaDot} style={{ background: color }} />
            <div className={styles.metaBody}>
              <div className={styles.metaTop}>
                <span className={styles.metaHabito}>{m.habito}</span>
                <span className={styles.metaTarget}>Meta: {m.meta} {m.unidad}</span>
              </div>
              <ProgressBar value={pct} max={100} color={color} />
              <div className={styles.metaVals}>
                <span className={styles.metaVal} style={{ color }}>
                  {val} {m.unidad}
                </span>
                <span className={styles.metaValLabel}>promedio · {pct}%</span>
              </div>
            </div>
            <span className={styles.metaPts}>{m.puntos} pts</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Checkpoints tab ────────────────────────────────────────────────────────
function CheckpointsTab({ user }) {
  const url = user ? `/api/checkpoints?user=${encodeURIComponent(user)}` : '/api/checkpoints'
  const { data, isLoading } = useSWR(url, fetcher, { revalidateOnFocus: false })
  const checkpoints = Array.isArray(data) ? data : []

  if (isLoading) return <div className={styles.empty}>Cargando…</div>

  if (!checkpoints.length) return (
    <div className={styles.empty}>
      <Icon name="milestone" size={32} color="var(--text-3)" />
      <p>No hay checkpoints configurados.</p>
      <p className={styles.emptyHint}>
        Crea la pestaña <strong>Checkpoints</strong> con columnas:<br />
        <code>Semana, Fecha, Título, Corto, Ícono</code>
      </p>
    </div>
  )

  const CURRENT_WEEK = currentWeekNumber()

  return (
    <div className={styles.timeline}>
      {checkpoints.map((cp, i) => {
        const done = cp.semana < CURRENT_WEEK
        const active = cp.semana === CURRENT_WEEK
        return (
          <div key={i} className={`${styles.timelineItem} ${done ? styles.timelineDone : ''} ${active ? styles.timelineActive : ''}`}>
            <div className={styles.timelineLeft}>
              <div className={styles.timelineNode}>
                <Icon
                  name={done ? 'check' : cp.icono || 'flag'}
                  size={13}
                  color={done ? 'var(--ok)' : active ? 'var(--accent)' : 'var(--text-3)'}
                />
              </div>
              {i < checkpoints.length - 1 && <div className={`${styles.timelineLine} ${done ? styles.timelineLineDone : ''}`} />}
            </div>
            <div className={styles.timelineContent}>
              <div className={styles.timelineMeta}>
                <span className={styles.timelineWeek}>Sem. {cp.semana}</span>
                {cp.fecha && <span className={styles.timelineDate}>{cp.fecha}</span>}
                {active && <span className={styles.timelineTag}>AHORA</span>}
              </div>
              <p className={styles.timelineTitle}>{cp.titulo}</p>
              {cp.corto && <p className={styles.timelineCorto}>{cp.corto}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────
export function Mas({ user, defaultTab = 'retos' }) {
  const [tab, setTab] = useState(defaultTab)

  const CONTENT = {
    retos:       <RetosTab user={user} />,
    logros:      <LogrosTab user={user} />,
    fotos:       <FotosTab user={user} />,
    metas:       <MetasTab user={user} />,
    checkpoints: <CheckpointsTab user={user} />,
  }

  return (
    <div className={styles.page}>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <Chip
            key={t.id}
            active={tab === t.id}
            color="var(--accent)"
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} size={12} color={tab === t.id ? 'var(--accent)' : 'var(--text-3)'} />
            {t.label}
          </Chip>
        ))}
      </div>

      <Card>{CONTENT[tab]}</Card>
    </div>
  )
}
