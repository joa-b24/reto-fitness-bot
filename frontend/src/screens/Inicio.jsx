import { useMemo, useState } from 'react'
import { Card, CardHeader } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Ring } from '../components/ui/Ring'
import { Sparkline } from '../components/ui/Sparkline'
import { LaneDot } from '../components/ui/LaneDot'
import { Avatar } from '../components/ui/Avatar'
import { AlertRow } from '../components/ui/AlertRow'
import { Icon } from '../components/ui/Icon'
import { useRanking, usePoints, useLatest, useRetos, useKpi, useCheckpoints } from '../hooks/useApi'
import { LANES, HABIT_LANE, MEASUREMENT_HABITS, USERS, DAY_LABELS, getWeekRange, TODAY, CHALLENGE_START, CHALLENGE_END, TOTAL_WEEKS, currentWeekNumber } from '../lib/constants'
import styles from './Inicio.module.css'

const { start: WEEK_START, end: WEEK_END } = getWeekRange()

// ─── Timeline ─────────────────────────────────────────────────────────────────
function ChallengeTimeline({ checkpoints }) {
  const week = currentWeekNumber()
  const pct  = Math.min(100, (week / TOTAL_WEEKS) * 100)

  const fmt = (iso) =>
    new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

  return (
    <Card>
      <div className={styles.tlHeader}>
        <div>
          <p className={styles.tlMeta}>Reto Pretemporada · {TOTAL_WEEKS} semanas</p>
          <div className={styles.tlDates}>
            <span className={`${styles.tlDate} display`}>{fmt(CHALLENGE_START)}</span>
            <Icon name="arrow-right" size={13} color="var(--text-3)" />
            <span className={`${styles.tlDate} display`}>{fmt(CHALLENGE_END)}</span>
          </div>
        </div>
        <div className={styles.tlPct}>
          <span className={`${styles.tlPctNum} mono`}>{Math.round(pct)}<span className={styles.tlPctSign}>%</span></span>
          <span className={styles.tlPctLabel}>completado</span>
        </div>
      </div>

      <div className={styles.tlTrackWrap}>
        {/* Track */}
        <div className={styles.tlTrack} />
        {/* Fill */}
        <div className={styles.tlFill} style={{ width: `${pct}%` }} />
        {/* Current week bubble */}
        <div className={styles.tlCurrent} style={{ left: `${pct}%` }}>
          <div className={styles.tlTooltip}>
            HOY · {week === 0 ? 'PRE' : `S${week}`}
            <div className={styles.tlTooltipArrow} />
          </div>
        </div>

        {/* Checkpoint markers */}
        {checkpoints.map((cp, i) => {
          const cpPct = (cp.semana / TOTAL_WEEKS) * 100
          const done  = cp.semana <= week
          return (
            <div key={i} className={styles.tlCp} style={{ left: `${cpPct}%` }}>
              <div className={`${styles.tlCpDot} ${done ? styles.tlCpDone : ''}`}>
                <Icon name={cp.icono} size={11} color={done ? 'var(--accent)' : 'var(--text-3)'} />
              </div>
              <div className={styles.tlCpLabel}>
                <p className={`${styles.tlCpTitle} ${done ? styles.tlCpTitleDone : ''}`}>{cp.corto}</p>
                <p className={`${styles.tlCpDate} mono`}>{cp.fecha} · S{cp.semana}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function KpiCards({ kpi, streak, weekPoints, weekDelta }) {
  return (
    <div className="grid-4">
      {/* Peso */}
      <Card>
        <div className={styles.kpiTop}>
          <span className={styles.kpiLabel}>Peso actual</span>
          <Icon name="scale" size={15} color="var(--lane-fisico)" />
        </div>
        <div className={styles.kpiVal}>
          <span className={`${styles.kpiNum} mono`}>{kpi?.peso ?? '—'}</span>
          <span className={styles.kpiUnit}>kg</span>
        </div>
        <div className={styles.kpiBottom}>
          <Sparkline
            data={kpi?.peso_historia?.map((v) => -v) ?? []}
            width={90} height={24}
            color="var(--lane-fisico)"
          />
          <span className={styles.kpiSub}>tendencia</span>
        </div>
      </Card>

      {/* Puntos semana */}
      <Card>
        <div className={styles.kpiTop}>
          <span className={styles.kpiLabel}>Puntos semana</span>
          <Icon name="zap" size={15} color="var(--accent)" />
        </div>
        <div className={styles.kpiVal}>
          <span className={`${styles.kpiNum} mono`}>{weekPoints.toLocaleString()}</span>
          {weekDelta !== 0 && (
            <span className={weekDelta > 0 ? styles.kpiUp : styles.kpiDown}>
              <Icon name={weekDelta > 0 ? 'trending-up' : 'trending-down'} size={13} />
              {Math.abs(weekDelta)}
            </span>
          )}
        </div>
        <div className={styles.kpiBottom}>
          {LANES.map((l) => <LaneDot key={l.id} lane={l.id} size={8} />)}
          <span className={styles.kpiSub}>por carril</span>
        </div>
      </Card>

      {/* Racha */}
      <Card>
        <div className={styles.kpiTop}>
          <span className={styles.kpiLabel}>Racha hábitos</span>
          <Icon name="flame" size={15} color="var(--lane-habitos)" />
        </div>
        <div className={styles.kpiVal}>
          <span className={`${styles.kpiNum} mono`}>{streak}</span>
          <span className={styles.kpiUnit}>días</span>
        </div>
        <div className={styles.streakBars}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className={styles.streakBar}
              style={{
                background: i < streak ? 'var(--lane-habitos)' : 'var(--surface-3)',
                opacity:    i < streak ? 0.4 + (i / Math.max(streak, 1)) * 0.6 : 1,
              }}
            />
          ))}
        </div>
      </Card>

      {/* Pasos */}
      <Card>
        <div className={styles.kpiTop}>
          <span className={styles.kpiLabel}>Pasos hoy</span>
          <Icon name="footprints" size={15} color="var(--lane-fisico)" />
        </div>
        <div className={styles.kpiVal}>
          <span className={`${styles.kpiNum} mono`}>{kpi?.pasos?.toLocaleString() ?? '—'}</span>
        </div>
        <div className={styles.kpiBottom} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <ProgressBar value={kpi?.pasos ?? 0} max={10000} color="var(--lane-fisico)" />
          <span className={styles.kpiSub}>
            {kpi?.pasos ? `${Math.round((kpi.pasos / 10000) * 100)}% · faltan ${Math.max(0, 10000 - kpi.pasos).toLocaleString()}` : 'sin registro hoy'}
          </span>
        </div>
      </Card>
    </div>
  )
}

// ─── Week Glance ──────────────────────────────────────────────────────────────
function WeekGlance({ latest, user }) {
  const days = useMemo(() => {
    const userRows = (Array.isArray(latest) ? latest : []).filter((r) => r.Usuario === user)
    const today = TODAY

    return DAY_LABELS.map((label, i) => {
      const d = new Date(WEEK_START)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      const dayRows = userRows.filter((r) => String(r.Fecha) === dateStr)

      const lanesDone = {}
      for (const r of dayRows) {
        const hab = (r.Hábito || r.Habito || '').toLowerCase()
        if (MEASUREMENT_HABITS.has(hab)) continue
        const lane = HABIT_LANE[hab]
        if (lane) lanesDone[lane] = true
      }

      return {
        label,
        date: d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
        dateStr,
        today: dateStr === today,
        future: dateStr > today,
        lanes: lanesDone,
      }
    })
  }, [latest, user])

  return (
    <Card>
      <CardHeader title="Semana en un vistazo" subtitle={`${WEEK_START} – ${WEEK_END}`} />
      <div className={styles.weekGrid}>
        {days.map((day, i) => {
          const total = Object.keys(day.lanes).length
          return (
            <div
              key={i}
              className={`${styles.weekDay} ${day.today ? styles.weekDayToday : ''} ${day.future ? styles.weekDayFuture : ''}`}
            >
              {day.today && <span className={`${styles.weekHoy} mono`}>HOY</span>}
              <span className={`${styles.weekDayLabel} display`}>{day.label}</span>
              <span className={`${styles.weekDayDate} mono`}>{day.date}</span>
              <div className={styles.weekLanes}>
                {LANES.map((lane) => (
                  <div
                    key={lane.id}
                    className={styles.weekLaneBar}
                    style={{
                      background: day.lanes[lane.id] ? lane.color : 'var(--surface-3)',
                      opacity: day.future ? 0.25 : 1,
                    }}
                  />
                ))}
              </div>
              <span className={`${styles.weekCount} mono`}>{day.future ? '·' : `${total}/4`}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Lane Summary ─────────────────────────────────────────────────────────────
function LaneSummary({ lanePoints }) {
  return (
    <Card>
      <CardHeader title="Resumen de carriles" subtitle="Tu desempeño semanal" />
      <div className={styles.laneList}>
        {LANES.map((lane) => {
          const pts  = lanePoints[lane.id] || 0
          const goal = 100
          return (
            <div key={lane.id} className={styles.laneRow}>
              <Ring value={pts} max={goal} color={lane.color} size={48} label={pts} />
              <div className={styles.laneInfo}>
                <div className={styles.laneInfoTop}>
                  <div className={styles.laneName}>
                    <Icon name={lane.icon} size={14} color={lane.color} />
                    <span>{lane.label}</span>
                    <span className={styles.laneEn}>{lane.en}</span>
                  </div>
                  <span className={`${styles.laneTarget} mono`}>{lane.weeklyTarget}</span>
                </div>
                <ProgressBar value={pts} max={goal} color={lane.color} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
function Leaderboard({ ranking, user }) {
  const [scope, setScope] = useState('all')
  const list = Array.isArray(ranking) ? ranking : []

  const shown = useMemo(() => {
    if (scope === 'top5') return list.slice(0, 5)
    if (scope === 'around') {
      const idx = list.findIndex((r) => r.usuario === user)
      return idx >= 0 ? list.slice(Math.max(0, idx - 2), idx + 3) : list.slice(0, 5)
    }
    return list
  }, [list, scope, user])

  return (
    <Card>
      <CardHeader
        title="Leaderboard"
        subtitle="Ranking semanal"
        action={
          <div className={styles.lbTabs}>
            {['all', 'top5', 'around'].map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.lbTab} ${scope === s ? styles.lbTabActive : ''}`}
                onClick={() => setScope(s)}
              >
                {s === 'all' ? 'Todos' : s === 'top5' ? 'Top 5' : 'Cerca de mí'}
              </button>
            ))}
          </div>
        }
      />
      {shown.length === 0 ? (
        <p className="text-3" style={{ textAlign: 'center', padding: '24px 0' }}>Sin datos</p>
      ) : (
        <div className={styles.lbList}>
          {shown.map((entry, i) => {
            const globalRank = list.indexOf(entry) + 1
            const isMe       = entry.usuario === user
            const otherUser  = USERS.find((u) => u.id !== user)
            const userObj    = USERS.find((u) => u.id === entry.usuario)
            const podium     = globalRank <= 3

            return (
              <div key={entry.usuario} className={`${styles.lbRow} ${isMe ? styles.lbRowMe : ''}`}>
                <span className={`${styles.lbRank} mono ${podium ? styles.lbRankPodium : ''}`}>
                  {globalRank}
                </span>
                <Avatar
                  initials={userObj?.initials ?? entry.usuario.slice(0, 2).toUpperCase()}
                  size={32}
                  accent={isMe ? 'var(--accent)' : undefined}
                />
                <div className={styles.lbName}>
                  <span>
                    {userObj?.label ?? entry.usuario}
                    {isMe && <span className={styles.lbMe}>· TÚ</span>}
                  </span>
                  <div className={styles.lbLaneBars}>
                    {LANES.map((l) => (
                      <div key={l.id} className={styles.lbLaneBar} style={{ background: l.color }} />
                    ))}
                  </div>
                </div>
                <div className={styles.lbPts}>
                  <span className={`${styles.lbPtsNum} mono`}>{Number(entry.puntos).toLocaleString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
function buildAlerts(latest, kpi, streak, user) {
  const alerts = []
  const rows   = (Array.isArray(latest) ? latest : []).filter((r) => r.Usuario === user)

  // Steps alert
  const stepRows = rows
    .filter((r) => (r.Hábito || '').toLowerCase() === 'pasos')
    .sort((a, b) => String(b.Fecha).localeCompare(String(a.Fecha)))
    .slice(0, 3)
  const lowSteps = stepRows.filter((r) => Number(r.Valor) < 8000).length
  if (lowSteps >= 2) {
    alerts.push({
      id: 'steps', severity: 'warn', icon: 'footprints',
      title: '¡Hey! Te faltan pasos',
      body:  `Llevas ${lowSteps} días con menos de 8,000 pasos. Una caminata después de cenar y lo cierras.`,
      action: 'Ir a Registro',
    })
  }

  // Water alert
  const waterRows = rows
    .filter((r) => (r.Hábito || '').toLowerCase() === 'agua')
    .sort((a, b) => String(b.Fecha).localeCompare(String(a.Fecha)))
  if (waterRows.length > 0 && Number(waterRows[0].Valor) < 2) {
    alerts.push({
      id: 'water', severity: 'info', icon: 'droplet',
      title: 'Hidratación baja',
      body:  `Registraste ${waterRows[0].Valor}L ayer. El objetivo es ≥ 2L diarios.`,
      action: 'Registrar agua',
    })
  }

  // Streak celebration
  if (streak >= 7) {
    alerts.push({
      id: 'streak', severity: 'ok', icon: 'flame',
      title: `¡Racha de ${streak} días!`,
      body:  'Tus hábitos van sólidos. Sigue así.',
      action: 'Ver logros',
    })
  }

  return alerts
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export function Inicio({ user }) {
  const { data: ranking }      = useRanking('semanal', 10)
  const { data: latest }       = useLatest(200, user)
  const { data: points }       = usePoints(user, WEEK_START, TODAY)
  const { data: retos }        = useRetos()
  const { data: kpi }          = useKpi(user)
  const { data: checkpoints }  = useCheckpoints(user)

  const [dismissedAlerts, setDismissedAlerts] = useState([])

  // Weekly points per lane
  const { lanePoints, weeklyTotal } = useMemo(() => {
    const lane = {}
    let total  = 0
    const userSeries = points?.series?.[user] || {}
    for (const [habito, entries] of Object.entries(userSeries)) {
      const laneId = HABIT_LANE[habito.toLowerCase()] || null
      if (!laneId) continue
      const sum = (entries || []).reduce((s, e) => s + (e.puntos || 0), 0)
      lane[laneId] = (lane[laneId] || 0) + sum
      total += sum
    }
    return { lanePoints: lane, weeklyTotal: Math.round(total) }
  }, [points, user])

  // Streak
  const streak = useMemo(() => {
    if (!Array.isArray(latest)) return 0
    const userEntries = latest.filter((r) => r.Usuario === user)
    const days = [...new Set(userEntries.map((r) => String(r.Fecha)))].sort().reverse()
    let count = 0
    let cur   = new Date()
    for (const d of days) {
      const diff = Math.round((cur - new Date(d)) / 86_400_000)
      if (diff > 1) break
      count++
      cur = new Date(d)
    }
    return count
  }, [latest, user])

  const alerts       = useMemo(() => buildAlerts(latest, kpi, streak, user), [latest, kpi, streak, user])
  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.includes(a.id))
  const retosList    = Array.isArray(retos) ? retos : []
  const cpList       = Array.isArray(checkpoints) ? checkpoints : []

  return (
    <div className={styles.page}>
      {/* 1. Timeline */}
      <ChallengeTimeline checkpoints={cpList} />

      {/* 2. KPI Cards */}
      <KpiCards kpi={kpi} streak={streak} weekPoints={weeklyTotal} weekDelta={0} />

      {/* 3. Alerts */}
      {visibleAlerts.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Alertas del coach</p>
          <div className={styles.alertsList}>
            {visibleAlerts.map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                onDismiss={(id) => setDismissedAlerts((prev) => [...prev, id])}
              />
            ))}
          </div>
        </div>
      )}

      {/* 4. Lane summary + Leaderboard */}
      <div className={styles.mid}>
        <LaneSummary lanePoints={lanePoints} />
        <Leaderboard ranking={ranking} user={user} />
      </div>

      {/* 5. Week glance */}
      <WeekGlance latest={latest} user={user} />

      {/* 6. Active retos */}
      {retosList.length > 0 && (
        <Card>
          <CardHeader title="Retos activos" subtitle={`${retosList.length} en curso`} />
          <div className={styles.retosList}>
            {retosList.map((r, i) => (
              <div key={r.id || i} className={styles.retoRow}>
                <div className={styles.retoIcon}>
                  <Icon name={r.icono || 'target'} size={18} color="var(--accent)" />
                </div>
                <div className={styles.retoInfo}>
                  <p className={styles.retoName}>{r.nombre || r.id}</p>
                  <p className={styles.retoDesc}>{r.descripcion}</p>
                </div>
                <div className={styles.retoBadge}>
                  <span className={`${styles.retoPts} mono`}>{r.puntos} pts</span>
                  {r.dias_restantes != null && (
                    <span className={`${styles.retoDays} mono`}>{r.dias_restantes}d</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
