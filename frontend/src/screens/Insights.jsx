import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { fetcher } from '../lib/api'
import { Card, CardHeader } from '../components/ui/Card'
import { Icon } from '../components/ui/Icon'
import { Chip } from '../components/ui/Chip'
import { LANES, HABIT_LANE, currentWeekNumber, CHALLENGE_START } from '../lib/constants'
import styles from './Insights.module.css'

// ── Tooltip custom ─────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className={styles.tooltipVal}>
          {p.name}: <strong>{p.value}{unit}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Historia (line chart) ──────────────────────────────────────────────────
function HistoriaChart({ user, habito, color, unit, label }) {
  const { data, isLoading } = useSWR(
    `/api/historia?user=${encodeURIComponent(user)}&habito=${habito}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const series = useMemo(() => {
    if (!Array.isArray(data)) return []
    return data.map((d) => ({
      fecha: d.fecha.slice(5), // MM-DD
      valor: d.valor,
    }))
  }, [data])

  if (isLoading) return <div className={styles.chartPlaceholder}>Cargando…</div>
  if (!series.length) return <div className={styles.chartPlaceholder}>Sin datos de {label}</div>

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id={`grad-${habito}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip unit={unit} />} />
        <Area
          type="monotone"
          dataKey="valor"
          name={label}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${habito})`}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Comparativa hábitos (bar chart) ───────────────────────────────────────
function ComparativaChart({ points, user }) {
  const data = useMemo(() => {
    const userSeries = points?.series?.[user] || {}
    const totals = {}
    for (const [hab, entries] of Object.entries(userSeries)) {
      const sum = (entries || []).reduce((s, e) => s + (e.puntos || 0), 0)
      if (sum !== 0) totals[hab] = sum
    }
    return Object.entries(totals)
      .map(([hab, pts]) => ({ hab: hab.charAt(0).toUpperCase() + hab.slice(1), pts: Math.round(pts) }))
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 12)
  }, [points, user])

  if (!data.length) return <div className={styles.chartPlaceholder}>Sin datos de puntos</div>

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 40, left: -20 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="hab" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} angle={-40} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip unit=" pts" />} />
        <Bar dataKey="pts" name="Puntos" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => {
            const lane = HABIT_LANE[entry.hab.toLowerCase()] || 'fisico'
            const laneObj = LANES.find((l) => l.id === lane)
            return <Cell key={i} fill={laneObj?.color || 'var(--accent)'} fillOpacity={0.85} />
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Distribución por carril (donut) ───────────────────────────────────────
function DistribucionChart({ points, user }) {
  const data = useMemo(() => {
    const userSeries = points?.series?.[user] || {}
    const lane = {}
    for (const [hab, entries] of Object.entries(userSeries)) {
      const laneId = HABIT_LANE[hab.toLowerCase()]
      if (!laneId) continue
      const sum = (entries || []).reduce((s, e) => s + (e.puntos || 0), 0)
      if (sum > 0) lane[laneId] = (lane[laneId] || 0) + sum
    }
    return LANES
      .map((l) => ({ name: l.label, value: Math.round(lane[l.id] || 0), color: l.color }))
      .filter((d) => d.value > 0)
  }, [points, user])

  if (!data.length) return <div className={styles.chartPlaceholder}>Sin datos por carril</div>

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className={styles.donutWrap}>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.9} />
            ))}
          </Pie>
          <Tooltip formatter={(val) => [`${val} pts`, '']} />
        </PieChart>
      </ResponsiveContainer>
      <div className={styles.donutLegend}>
        {data.map((d) => (
          <div key={d.name} className={styles.donutItem}>
            <span className={styles.donutDot} style={{ background: d.color }} />
            <span className={styles.donutName}>{d.name}</span>
            <span className={styles.donutPct}>{Math.round(d.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Heatmap de hábitos ─────────────────────────────────────────────────────
function HeatmapSection({ user }) {
  const start = CHALLENGE_START
  const end   = new Date().toISOString().split('T')[0]

  const { data, isLoading } = useSWR(
    user ? `/api/heatmap?user=${encodeURIComponent(user)}&start=${start}&end=${end}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const { weeks, habits } = useMemo(() => {
    if (!data || typeof data !== 'object') return { weeks: [], habits: [] }

    const allHabits = Object.keys(data).filter(Boolean).sort()
    const startDate = new Date(start)
    const endDate   = new Date(end)

    // Build array of weeks (Mon-Sun)
    const weeks = []
    const cur = new Date(startDate)
    // Rewind to Monday
    const dow = cur.getDay()
    cur.setDate(cur.getDate() - (dow === 0 ? 6 : dow - 1))

    while (cur <= endDate) {
      const week = []
      for (let i = 0; i < 7; i++) {
        week.push(cur.toISOString().split('T')[0])
        cur.setDate(cur.getDate() + 1)
      }
      weeks.push(week)
    }

    return { weeks, habits: allHabits.slice(0, 8) }
  }, [data, start, end])

  if (isLoading) return <div className={styles.chartPlaceholder}>Cargando heatmap…</div>
  if (!habits.length) return <div className={styles.chartPlaceholder}>Sin datos de hábitos</div>

  const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  return (
    <div className={styles.heatmapWrap}>
      <div className={styles.heatmapGrid} style={{ gridTemplateColumns: `80px repeat(${weeks.length}, 1fr)` }}>
        {/* Header row */}
        <div />
        {weeks.map((w, i) => (
          <div key={i} className={styles.heatmapWeekLabel}>S{i + 1}</div>
        ))}

        {/* Habit rows */}
        {habits.map((hab) => (
          <>
            <div key={hab + '-label'} className={styles.heatmapHabLabel}>
              {hab.charAt(0).toUpperCase() + hab.slice(1)}
            </div>
            {weeks.map((week, wi) => {
              const cumplidos = week.filter((d) => data[hab]?.[d] == 1).length
              const total     = week.filter((d) => d <= end && d >= start).length
              const pct       = total ? cumplidos / total : 0
              return (
                <div
                  key={wi}
                  className={styles.heatmapCell}
                  style={{
                    background: pct > 0
                      ? `rgba(${hexToRgb('var(--accent)')}, ${0.15 + pct * 0.75})`
                      : 'var(--surface-2)',
                    opacity: total === 0 ? 0.3 : 1,
                  }}
                  title={`${hab} S${wi+1}: ${cumplidos}/${total} días`}
                />
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}

// accent is a CSS var so we hardcode the default for blending
function hexToRgb() { return '212,255,58' }

// ── Generar reporte ────────────────────────────────────────────────────────
function ReporteBtn({ user, points, kpi }) {
  function handlePrint() {
    window.print()
  }

  function handleExport() {
    const userSeries = points?.series?.[user] || {}
    const lineas = [
      `# Reporte FitQuest — ${user}`,
      `Fecha: ${new Date().toLocaleDateString('es-MX')}`,
      `Peso actual: ${kpi?.peso ?? '—'} kg`,
      `Pasos recientes: ${kpi?.pasos?.toLocaleString() ?? '—'}`,
      `Puntos totales: ${kpi?.puntos_total ?? 0}`,
      '',
      '## Puntos por hábito',
    ]
    for (const [hab, entries] of Object.entries(userSeries)) {
      const sum = (entries || []).reduce((s, e) => s + (e.puntos || 0), 0)
      if (sum) lineas.push(`  ${hab}: ${Math.round(sum)} pts`)
    }
    const blob = new Blob([lineas.join('\n')], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `fitquest-reporte-${user}-${new Date().toISOString().slice(0,10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.reporteBtns}>
      <button type="button" className={styles.reporteBtn} onClick={handleExport}>
        <Icon name="download" size={15} color="var(--text-2)" />
        Exportar resumen
      </button>
      <button type="button" className={`${styles.reporteBtn} ${styles.reporteBtnPrimary}`} onClick={handlePrint}>
        <Icon name="printer" size={15} color="var(--accent-ink)" />
        Imprimir reporte
      </button>
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────
const PERIODOS = [
  { id: 'semana',  label: '7 días'  },
  { id: 'mes',     label: '30 días' },
  { id: 'todo',    label: 'Todo'    },
]

export function Insights({ user }) {
  const [periodo, setPeriodo] = useState('mes')

  const end   = new Date().toISOString().split('T')[0]
  const start = periodo === 'semana'
    ? new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    : periodo === 'mes'
      ? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
      : CHALLENGE_START

  const { data: points } = useSWR(
    user ? `/api/points?user=${encodeURIComponent(user)}&start=${start}&end=${end}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )
  const { data: kpi } = useSWR(
    user ? `/api/kpi?user=${encodeURIComponent(user)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  return (
    <div className={styles.page}>
      {/* Period filter */}
      <div className={styles.filters}>
        {PERIODOS.map((p) => (
          <Chip key={p.id} active={periodo === p.id} color="var(--accent)" onClick={() => setPeriodo(p.id)}>
            {p.label}
          </Chip>
        ))}
      </div>

      {/* Historia de peso y pasos */}
      <div className="grid-2">
        <Card>
          <CardHeader title="Peso" subtitle="kg · evolución" />
          <HistoriaChart user={user} habito="peso" color="var(--lane-fisico)" unit=" kg" label="Peso" />
        </Card>
        <Card>
          <CardHeader title="Pasos" subtitle="pasos diarios" />
          <HistoriaChart user={user} habito="pasos" color="var(--lane-nutricion)" unit="" label="Pasos" />
        </Card>
      </div>

      {/* Comparativa y distribución */}
      <div className="grid-2">
        <Card>
          <CardHeader title="Puntos por hábito" subtitle={`últimos ${periodo === 'semana' ? '7' : periodo === 'mes' ? '30' : 'todos los'} días`} />
          <ComparativaChart points={points} user={user} />
        </Card>
        <Card>
          <CardHeader title="Distribución por carril" subtitle="% de puntos" />
          <DistribucionChart points={points} user={user} />
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader title="Heatmap de hábitos" subtitle="cumplimiento semanal desde inicio del reto" />
        <HeatmapSection user={user} />
      </Card>

      {/* Reporte */}
      <Card>
        <CardHeader title="Reporte" subtitle="exportar o imprimir" />
        <ReporteBtn user={user} points={points} kpi={kpi} />
      </Card>
    </div>
  )
}
