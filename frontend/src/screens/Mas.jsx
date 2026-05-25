import { useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '../lib/api'
import { Card, CardHeader } from '../components/ui/Card'
import { Icon } from '../components/ui/Icon'
import { Chip } from '../components/ui/Chip'
import { ProgressBar } from '../components/ui/ProgressBar'
import { currentWeekNumber } from '../lib/constants'
import styles from './Mas.module.css'

const TABS = [
  { id: 'retos',       label: 'Retos',       icon: 'target'     },
  { id: 'logros',      label: 'Logros',      icon: 'award'      },
  { id: 'metas',       label: 'Metas',       icon: 'flag'       },
  { id: 'checkpoints', label: 'Timeline',    icon: 'milestone'  },
]

// ── Retos tab ──────────────────────────────────────────────────────────────
function RetosTab() {
  const { data, isLoading } = useSWR('/api/retos', fetcher, { refreshInterval: 60_000 })
  const retos = Array.isArray(data) ? data : []

  if (isLoading) return <div className={styles.empty}>Cargando…</div>

  if (!retos.length) return (
    <div className={styles.empty}>
      <Icon name="target" size={32} color="var(--text-3)" />
      <p>No hay retos activos en este momento.</p>
    </div>
  )

  return (
    <div className={styles.list}>
      {retos.map((r, i) => (
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
    </div>
  )
}

// ── Logros tab ─────────────────────────────────────────────────────────────
function LogrosTab({ user }) {
  const { data, isLoading } = useSWR(
    user ? `/api/logros?user=${encodeURIComponent(user)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )
  const logros = Array.isArray(data) ? data : []

  if (isLoading) return <div className={styles.empty}>Cargando…</div>

  if (!logros.length) return (
    <div className={styles.empty}>
      <Icon name="award" size={32} color="var(--text-3)" />
      <p>Aún no hay logros desbloqueados.</p>
      <p className={styles.emptyHint}>
        Crea la pestaña <strong>Logros</strong> con columnas:<br />
        <code>Usuario, Título, Descripción, Ícono, Fecha, Color</code>
      </p>
    </div>
  )

  return (
    <div className={styles.logrosGrid}>
      {logros.map((l, i) => (
        <div key={i} className={styles.logroCard} style={{ borderColor: l.color || 'var(--border)' }}>
          <div className={styles.logroIconWrap} style={{ background: l.color ? `${l.color}18` : 'var(--surface-3)' }}>
            <Icon name={l.icono || 'award'} size={22} color={l.color || 'var(--accent)'} />
          </div>
          <p className={styles.logroTitle}>{l.titulo}</p>
          {l.descripcion && <p className={styles.logroDesc}>{l.descripcion}</p>}
          {l.fecha && <p className={styles.logroDate}>{l.fecha}</p>}
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
        const lane = (m.carril || '').toLowerCase()
        const color = LANE_COLORS[lane] || 'var(--accent)'
        return (
          <div key={i} className={styles.metaRow}>
            <div className={styles.metaDot} style={{ background: color }} />
            <div className={styles.metaBody}>
              <div className={styles.metaTop}>
                <span className={styles.metaHabito}>{m.habito}</span>
                <span className={styles.metaTarget}>Meta: {m.meta} {m.unidad}</span>
              </div>
              <ProgressBar
                value={m.progreso ?? 0}
                max={100}
                color={color}
              />
            </div>
            <span className={styles.metaPts}>{m.puntos} pts</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Checkpoints tab ────────────────────────────────────────────────────────
function CheckpointsTab() {
  const { data, isLoading } = useSWR('/api/checkpoints', fetcher, { revalidateOnFocus: false })
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
export function Mas({ user }) {
  const [tab, setTab] = useState('retos')

  const CONTENT = {
    retos:       <RetosTab />,
    logros:      <LogrosTab user={user} />,
    metas:       <MetasTab user={user} />,
    checkpoints: <CheckpointsTab />,
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
