import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { fetcher } from '../lib/api'
import { Card, CardHeader } from '../components/ui/Card'
import { Icon } from '../components/ui/Icon'
import { Chip } from '../components/ui/Chip'
import { ProgressBar } from '../components/ui/ProgressBar'
import { currentWeekNumber, currentDayNumber } from '../lib/constants'
import styles from './Plan.module.css'

const SECTION_TABS = [
  { id: 'entrenamiento', label: 'Entrenamiento', icon: 'dumbbell' },
  { id: 'nutricion',     label: 'Nutrición',     icon: 'utensils'  },
]

const WORKOUT_COLORS = {
  fuerza:    'var(--lane-fisico)',
  cardio:    'var(--lane-nutricion)',
  hiit:      'var(--danger)',
  campo:     'var(--ok)',
  movilidad: 'var(--lane-habitos)',
  descanso:  'var(--text-3)',
}

const DAY_FULL = { L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo' }

export function Plan({ user }) {
  const [section, setSection]   = useState('entrenamiento')
  const [activePhase, setPhase] = useState(null)
  const [expandedDay, setExpandedDay] = useState(null)

  const url = user ? `/api/plan?user=${encodeURIComponent(user)}` : '/api/plan'
  const { data, isLoading } = useSWR(url, fetcher, { revalidateOnFocus: false })

  const phases = useMemo(() => {
    if (!Array.isArray(data)) return []
    const map = {}
    for (const row of data) {
      const f = Number(row.Fase) || 1
      if (!map[f]) map[f] = { fase: f, titulo: row.TituloFase || `Fase ${f}`, semanas: [], rows: [] }
      map[f].rows.push(row)
      const s = Number(row.Semana)
      if (s && !map[f].semanas.includes(s)) map[f].semanas.push(s)
    }
    return Object.values(map).sort((a, b) => a.fase - b.fase)
  }, [data])

  const CURRENT_WEEK = currentWeekNumber()

  const currentPhase = activePhase != null
    ? phases.find((p) => p.fase === activePhase)
    : phases.find((p) => p.semanas.includes(CURRENT_WEEK)) || phases[0] || null

  const schedule = useMemo(() => {
    if (!currentPhase) return []
    const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    return days.map((d) => {
      const matchDay    = (r) => r.Dia === d || r.Día === d
      const weekRow     = currentPhase.rows.find((r) => matchDay(r) && Number(r.Semana) === CURRENT_WEEK)
      const reusableRow = currentPhase.rows.find((r) => matchDay(r) && !Number(r.Semana))
      const row = weekRow || reusableRow || null
      return { dia: d, row, reusable: !weekRow && !!reusableRow }
    })
  }, [currentPhase, CURRENT_WEEK])

  const phaseProgress = useMemo(() => {
    if (!currentPhase || !currentPhase.semanas.length) return null
    const minW          = Math.min(...currentPhase.semanas)
    const maxW          = Math.max(...currentPhase.semanas)
    const totalPhaseDays = (maxW - minW + 1) * 7
    const phaseStartDay  = (minW - 1) * 7 + 1
    const day            = currentDayNumber()
    const daysIntoPhase  = Math.max(0, Math.min(day - phaseStartDay + 1, totalPhaseDays))
    return { minW, maxW, totalPhaseDays, daysIntoPhase }
  }, [currentPhase])

  if (isLoading) return <div className={styles.empty}>Cargando plan…</div>

  if (!phases.length) return (
    <div className={styles.empty}>
      <Icon name="calendar" size={32} color="var(--text-3)" />
      <p>No hay plan configurado aún.</p>
      <p className={styles.emptyHint}>
        Crea la pestaña <strong>Plan</strong> en tu Google Sheet con columnas:<br />
        <code>Fase, TituloFase, Semana, Dia, Titulo, Tipo, Duracion, Tags, Descripcion</code>
      </p>
    </div>
  )

  return (
    <div className={styles.page}>
      {/* Section toggle */}
      <div className={styles.sectionToggle}>
        {SECTION_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.sectionBtn} ${section === t.id ? styles.sectionBtnActive : ''}`}
            onClick={() => setSection(t.id)}
          >
            <Icon name={t.icon} size={14} color={section === t.id ? 'var(--accent)' : 'var(--text-3)'} />
            {t.label}
          </button>
        ))}
      </div>

      {section === 'entrenamiento' && (
        <>
          {/* Phase pills */}
          <div className={styles.phases}>
            {phases.map((p) => {
              const maxSemana  = Math.max(...p.semanas)
              const done       = maxSemana < CURRENT_WEEK
              const active     = p.semanas.includes(CURRENT_WEEK)
              const isSelected = currentPhase?.fase === p.fase
              return (
                <button
                  key={p.fase}
                  type="button"
                  className={`${styles.phasePill} ${isSelected ? styles.phasePillActive : ''} ${done ? styles.phasePillDone : ''}`}
                  onClick={() => setPhase(p.fase)}
                >
                  <Icon
                    name={done ? 'check-circle' : active ? 'circle-dot' : 'lock'}
                    size={13}
                    color={done ? 'var(--ok)' : active ? 'var(--accent)' : 'var(--text-3)'}
                  />
                  <span>Fase {p.fase}</span>
                  {active && <span className={styles.phaseActiveTag}>ACTIVA</span>}
                </button>
              )
            })}
          </div>

          {/* Phase overview */}
          {currentPhase && (
            <Card>
              <CardHeader
                title={currentPhase.titulo}
                subtitle={phaseProgress
                  ? `Semanas ${phaseProgress.minW}–${phaseProgress.maxW}`
                  : 'Sesiones recurrentes'}
              />
              {phaseProgress && (
                <ProgressBar
                  value={phaseProgress.daysIntoPhase}
                  max={phaseProgress.totalPhaseDays}
                  color="var(--accent)"
                  label={`Día ${phaseProgress.daysIntoPhase} de ${phaseProgress.totalPhaseDays}`}
                  showPercent
                />
              )}
            </Card>
          )}

          {/* Weekly schedule */}
          {currentPhase && (
            <Card>
              <CardHeader title="Semana actual" subtitle="Programa de la semana" />
              <div className={styles.scheduleList}>
                {schedule.map(({ dia, row, reusable }) => (
                  <div key={dia} className={styles.scheduleItem}>
                    <div className={`${styles.scheduleRow} ${!row ? styles.scheduleRowEmpty : ''}`}>
                      <div className={styles.scheduleDay}>
                        <span className={`${styles.scheduleDayLabel} display`}>{dia}</span>
                        <span className={styles.scheduleDayFull}>{DAY_FULL[dia]}</span>
                      </div>
                      {row ? (
                        <>
                          <div className={styles.scheduleInfo}>
                            <p className={styles.scheduleTitle}>{row.Titulo || row.Título || '—'}</p>
                            <div className={styles.scheduleTags}>
                              {reusable && (
                                <span className={styles.scheduleTagReusable}>recurrente</span>
                              )}
                              {(row.Tags || '').split(',').filter(Boolean).map((tag, i) => (
                                <span key={i} className={styles.scheduleTag}>{tag.trim()}</span>
                              ))}
                            </div>
                          </div>
                          <div className={styles.scheduleRight}>
                            <span
                              className={styles.scheduleTipo}
                              style={{ color: WORKOUT_COLORS[row.Tipo?.toLowerCase()] || 'var(--text-3)' }}
                            >
                              {row.Tipo || '—'}
                            </span>
                            {row.Duracion && (
                              <span className={`${styles.scheduleDur} mono`}>
                                {String(row.Duracion).replace(/\s*min\s*$/i, '')} min
                              </span>
                            )}
                          </div>
                          {row.Descripcion && (
                            <button
                              type="button"
                              className={styles.scheduleDetailBtn}
                              onClick={() => setExpandedDay(expandedDay === dia ? null : dia)}
                              title="Ver detalle del entrenamiento"
                            >
                              <Icon
                                name={expandedDay === dia ? 'chevron-down' : 'chevron-right'}
                                size={13}
                                color="var(--text-3)"
                              />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className={styles.scheduleEmpty}>Sin programar</span>
                      )}
                    </div>
                    {row?.Descripcion && expandedDay === dia && (
                      <div className={styles.scheduleDesc}>
                        {row.Descripcion}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {section === 'nutricion' && (
        <Card>
          <CardHeader title="Guía de nutrición" subtitle="Por configurar" />
          <div className={styles.empty} style={{ padding: '32px 0' }}>
            <Icon name="utensils" size={28} color="var(--text-3)" />
            <p>Agrega columnas de macros a la pestaña Plan o crea una pestaña <strong>Nutricion</strong>.</p>
          </div>
        </Card>
      )}
    </div>
  )
}
