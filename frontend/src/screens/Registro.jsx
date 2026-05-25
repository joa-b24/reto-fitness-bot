import { useState, useMemo } from 'react'
import { mutate } from 'swr'
import { Card, CardHeader } from '../components/ui/Card'
import { Icon } from '../components/ui/Icon'
import { SliderInput } from '../components/ui/SliderInput'
import { FieldRow } from '../components/ui/FieldRow'
import { Chip } from '../components/ui/Chip'
import { api } from '../lib/api'
import { LANES } from '../lib/constants'
import styles from './Registro.module.css'

const TODAY = new Date().toISOString().split('T')[0]

// ─── Initial state ────────────────────────────────────────
const INIT = {
  // Físico
  peso:             '',
  cintura:          '',
  pasos:            0,
  workout:          '',
  workoutDuration:  45,
  workoutRPE:       7,
  // Nutrición
  meals:    { desayuno: false, snack1: false, almuerzo: false, snack2: false, cena: false },
  agua:             1.5,
  calorias:         '',
  proteina:         100,
  cleanEating:      7,
  // Hábitos
  habits: { duolingo: false, lectura: false, celular: false, dientes: false, ducha: false },
  readingMin:       20,
  // Descanso
  sleepHours:       7.5,
  sleepQuality:     7,
  napMin:           0,
  mood:             0,
}

// ─── Live points estimate ─────────────────────────────────
function estimatePoints(data) {
  let p = 0
  if (data.peso)                              p += 10
  if (data.pasos >= 8000)                     p += 20
  else if (data.pasos > 0)                    p += Math.round((data.pasos / 8000) * 20)
  if (data.workout && data.workout !== 'descanso') p += 30
  p += Object.values(data.meals).filter(Boolean).length * 5
  p += Math.min(20, Math.round(data.agua * 8))
  if (Object.values(data.habits).filter(Boolean).length)
    p += Object.values(data.habits).filter(Boolean).length * 8
  if (data.sleepHours >= 7.5)                p += 25
  else if (data.sleepHours > 0)              p += Math.round((data.sleepHours / 7.5) * 25)
  return p
}

// ─── Build API entries ────────────────────────────────────
function buildEntries(data) {
  const e = []
  if (data.peso)                         e.push({ habito: 'peso',     valor: data.peso })
  if (data.cintura)                      e.push({ habito: 'cintura',  valor: data.cintura })
  if (data.pasos > 0)                    e.push({ habito: 'pasos',    valor: data.pasos })
  if (data.workout && data.workout !== 'descanso')
                                         e.push({ habito: 'ejercicio',valor: data.workoutDuration })
  if (data.agua > 0)                     e.push({ habito: 'agua',     valor: data.agua })
  if (data.calorias)                     e.push({ habito: 'calorias', valor: data.calorias })
  if (data.habits.duolingo)              e.push({ habito: 'duolingo', valor: 1 })
  if (data.readingMin > 0 && data.habits.lectura)
                                         e.push({ habito: 'lectura',  valor: data.readingMin })
  if (data.habits.celular)               e.push({ habito: 'celular',  valor: 1 })
  if (data.habits.dientes)               e.push({ habito: 'dientes',  valor: 1 })
  if (data.habits.ducha)                 e.push({ habito: 'ducha',    valor: 1 })
  if (data.sleepHours > 0)              e.push({ habito: 'sueño',    valor: data.sleepHours })
  return e
}

// ─── Lane forms ───────────────────────────────────────────
const WORKOUT_OPTS = [
  { v: 'fuerza',    l: 'Fuerza',    i: 'dumbbell' },
  { v: 'cardio',    l: 'Cardio',    i: 'activity' },
  { v: 'hiit',      l: 'HIIT',      i: 'zap' },
  { v: 'campo',     l: 'Campo',     i: 'flag' },
  { v: 'movilidad', l: 'Movilidad', i: 'waves' },
  { v: 'descanso',  l: 'Descanso',  i: 'moon' },
]

const MEALS = [
  { k: 'desayuno', l: 'Desayuno',     t: '7:00 AM' },
  { k: 'snack1',   l: 'Snack mañana', t: '10:30 AM' },
  { k: 'almuerzo', l: 'Almuerzo',     t: '1:30 PM' },
  { k: 'snack2',   l: 'Pre-entreno',  t: '4:30 PM' },
  { k: 'cena',     l: 'Cena',         t: '8:00 PM' },
]

const HABITS_CARDS = [
  { k: 'duolingo', l: 'Duolingo',      sub: '1 lección diaria',           i: 'headphones' },
  { k: 'lectura',  l: 'Lectura',       sub: '20+ min',                    i: 'book-open' },
  { k: 'celular',  l: 'Cel < 2h',      sub: 'Tiempo de pantalla limitado',i: 'phone-off' },
  { k: 'dientes',  l: 'Dientes',       sub: 'Mañana y noche',             i: 'star' },
  { k: 'ducha',    l: 'Ducha',         sub: 'Ducha diaria',               i: 'shower' },
]

const MOODS = [
  { v: 1, l: 'Muy mal', e: '😣' },
  { v: 2, l: 'Mal',     e: '😕' },
  { v: 3, l: 'OK',      e: '😐' },
  { v: 4, l: 'Bien',    e: '🙂' },
  { v: 5, l: 'Genial',  e: '🔥' },
]

function NumInput({ value, onChange, placeholder, step = 'any', unit }) {
  return (
    <div className={styles.numWrap}>
      <input
        type="number"
        className={`${styles.numInput} mono`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        min="0"
      />
      {unit && <span className={styles.numUnit}>{unit}</span>}
    </div>
  )
}

function FisicoForm({ data, update }) {
  return (
    <>
      <Card>
        <CardHeader title="Mediciones" subtitle="Lectura en ayunas" />
        <div className="grid-2" style={{ gap: 16 }}>
          <FieldRow label="Peso" hint="kg · en ayunas">
            <NumInput value={data.peso} onChange={(v) => update('peso', v)} placeholder="65.0" step="0.1" unit="kg" />
          </FieldRow>
          <FieldRow label="Cintura" hint="cm · opcional">
            <NumInput value={data.cintura} onChange={(v) => update('cintura', v)} placeholder="80" unit="cm" />
          </FieldRow>
        </div>
      </Card>

      <Card>
        <CardHeader title="Actividad" subtitle="Movimiento del día" />
        <div className={styles.formStack}>
          <FieldRow label="Pasos del día" hint="objetivo 10,000">
            <SliderInput value={data.pasos} min={0} max={20000} step={100} onChange={(v) => update('pasos', v)} suffix=" pasos" color="var(--lane-fisico)" />
          </FieldRow>

          <FieldRow label="Tipo de entrenamiento">
            <div className={styles.chipRow}>
              {WORKOUT_OPTS.map((o) => (
                <Chip key={o.v} active={data.workout === o.v} color="var(--lane-fisico)" onClick={() => update('workout', data.workout === o.v ? '' : o.v)}>
                  <Icon name={o.i} size={12} /> {o.l}
                </Chip>
              ))}
            </div>
          </FieldRow>

          {data.workout && data.workout !== 'descanso' && (
            <div className="grid-2" style={{ gap: 16 }}>
              <FieldRow label="Duración" hint="minutos">
                <SliderInput value={data.workoutDuration} min={10} max={120} step={5} onChange={(v) => update('workoutDuration', v)} suffix=" min" color="var(--lane-fisico)" />
              </FieldRow>
              <FieldRow label="Intensidad RPE" hint="1 – 10">
                <SliderInput value={data.workoutRPE} min={1} max={10} step={1} onChange={(v) => update('workoutRPE', v)} suffix="/10" color="var(--lane-fisico)" />
              </FieldRow>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Fotos de progreso" subtitle="Opcional · cada 4 semanas" />
        <div className="grid-3" style={{ gap: 12 }}>
          {['Frontal', 'Lateral', 'Posterior'].map((label) => (
            <div key={label} className={styles.photoPlaceholder}>
              <Icon name="camera" size={20} color="var(--text-3)" />
              <span className={`${styles.photoLabel} mono`}>{label}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

function NutricionForm({ data, update }) {
  const mealsDone = Object.values(data.meals).filter(Boolean).length
  return (
    <>
      <Card>
        <CardHeader title="Comidas del día" subtitle={`${mealsDone}/5 registradas`} />
        <div className={styles.mealList}>
          {MEALS.map((meal) => {
            const done = data.meals[meal.k]
            return (
              <button
                key={meal.k}
                type="button"
                className={`${styles.mealRow} ${done ? styles.mealDone : ''}`}
                style={done ? { borderColor: 'var(--lane-nutricion)' } : {}}
                onClick={() => update('meals', { ...data.meals, [meal.k]: !done })}
              >
                <div className={`${styles.mealCheck} ${done ? styles.mealCheckDone : ''}`}>
                  {done && <Icon name="check-circle" size={14} color="var(--accent-ink)" strokeWidth={2.5} />}
                </div>
                <div className={styles.mealInfo}>
                  <span className={styles.mealName}>{meal.l}</span>
                  <span className={`${styles.mealTime} mono`}>{meal.t}</span>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Hidratación y macros" />
        <div className={styles.formStack}>
          <FieldRow label="Agua" hint="objetivo 2 L">
            <SliderInput value={data.agua} min={0} max={5} step={0.1} onChange={(v) => update('agua', v)} suffix=" L" color="var(--lane-nutricion)" />
          </FieldRow>
          <FieldRow label="Calorías" hint="kcal totales">
            <NumInput value={data.calorias} onChange={(v) => update('calorias', v)} placeholder="1800" unit="kcal" />
          </FieldRow>
          <FieldRow label="Proteína" hint="objetivo 150 g">
            <SliderInput value={data.proteina} min={0} max={300} step={5} onChange={(v) => update('proteina', v)} suffix=" g" color="var(--lane-nutricion)" />
          </FieldRow>
          <FieldRow label="Alimentación limpia" hint="0 = mal · 10 = perfecto">
            <SliderInput value={data.cleanEating} min={0} max={10} step={1} onChange={(v) => update('cleanEating', v)} suffix="/10" color="var(--lane-nutricion)" />
          </FieldRow>
        </div>
      </Card>
    </>
  )
}

function HabitosForm({ data, update }) {
  return (
    <>
      <Card>
        <CardHeader title="Hábitos diarios" subtitle="Tu sistema operativo personal" />
        <div className="grid-2" style={{ gap: 12 }}>
          {HABITS_CARDS.map((h) => {
            const done = data.habits[h.k]
            return (
              <button
                key={h.k}
                type="button"
                className={`${styles.habitCard} ${done ? styles.habitCardDone : ''}`}
                style={done ? { borderColor: 'var(--lane-habitos)', background: 'color-mix(in srgb, var(--lane-habitos) 10%, var(--surface-2))' } : {}}
                onClick={() => update('habits', { ...data.habits, [h.k]: !done })}
              >
                <div className={styles.habitTop}>
                  <div className={`${styles.habitIcon} ${done ? styles.habitIconDone : ''}`}>
                    <Icon name={h.i} size={18} color={done ? 'var(--bg)' : 'var(--text-2)'} />
                  </div>
                  {done && (
                    <div className={styles.habitCheck}>
                      <Icon name="check-circle" size={12} color="var(--bg)" strokeWidth={2.5} />
                    </div>
                  )}
                </div>
                <div>
                  <p className={styles.habitLabel}>{h.l}</p>
                  <p className={styles.habitSub}>{h.sub}</p>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {(data.habits.lectura) && (
        <Card>
          <CardHeader title="Detalle" />
          <FieldRow label="Minutos de lectura">
            <SliderInput value={data.readingMin} min={0} max={120} step={5} onChange={(v) => update('readingMin', v)} suffix=" min" color="var(--lane-habitos)" />
          </FieldRow>
        </Card>
      )}
    </>
  )
}

function DescansoForm({ data, update }) {
  return (
    <>
      <Card>
        <CardHeader title="Sueño" subtitle="Cuéntame de anoche" />
        <div className={styles.formStack}>
          <FieldRow label="Horas de sueño" hint="objetivo 8 h">
            <SliderInput value={data.sleepHours} min={3} max={12} step={0.1} onChange={(v) => update('sleepHours', v)} suffix=" h" color="var(--lane-descanso)" />
          </FieldRow>
          <FieldRow label="Calidad del sueño" hint="1 = fatal · 10 = perfecto">
            <SliderInput value={data.sleepQuality} min={1} max={10} step={1} onChange={(v) => update('sleepQuality', v)} suffix="/10" color="var(--lane-descanso)" />
          </FieldRow>
          <FieldRow label="Siesta" hint="opcional">
            <SliderInput value={data.napMin} min={0} max={120} step={5} onChange={(v) => update('napMin', v)} suffix=" min" color="var(--lane-descanso)" />
          </FieldRow>
        </div>
      </Card>

      <Card>
        <CardHeader title="Estado general" subtitle="Cómo te sientes hoy" />
        <FieldRow label="Mood del día">
          <div className={styles.moodGrid}>
            {MOODS.map((m) => (
              <button
                key={m.v}
                type="button"
                className={`${styles.moodBtn} ${data.mood === m.v ? styles.moodBtnActive : ''}`}
                style={data.mood === m.v ? { borderColor: 'var(--lane-descanso)', background: 'color-mix(in srgb, var(--lane-descanso) 12%, var(--surface-2))' } : {}}
                onClick={() => update('mood', data.mood === m.v ? 0 : m.v)}
              >
                <span className={styles.moodEmoji}>{m.e}</span>
                <span className={styles.moodLabel}>{m.l}</span>
              </button>
            ))}
          </div>
        </FieldRow>
      </Card>
    </>
  )
}

// ─── Summary item (sidebar) ───────────────────────────────
function SummaryItem({ icon, color, label, value, done }) {
  return (
    <div className={styles.summaryItem}>
      <div
        className={styles.summaryIcon}
        style={done
          ? { background: `color-mix(in srgb, ${color} 16%, transparent)`, color, border: 'none' }
          : {}
        }
      >
        <Icon name={icon} size={14} color={done ? color : 'var(--text-3)'} />
      </div>
      <span className={`${styles.summaryLabel} ${done ? styles.summaryLabelDone : ''}`}>{label}</span>
      <span className={`${styles.summaryVal} mono`}>{value}</span>
    </div>
  )
}

// ─── Coach tips per lane ──────────────────────────────────
const TIPS = {
  fisico:    'Registra el peso siempre en ayunas, después de ir al baño. Es la lectura más consistente.',
  nutricion: 'Prepara tus comidas el domingo y tendrás el control toda la semana.',
  habitos:   'Los hábitos se construyen en cadena: haz uno primero y los demás llegan solos.',
  descanso:  'Un cuarto fresco y oscuro puede mejorar tu calidad de sueño hasta un 20%.',
}

// ─── Main screen ─────────────────────────────────────────
export function Registro({ user }) {
  const [activeLane, setActiveLane] = useState('fisico')
  const [fecha, setFecha]           = useState(TODAY)
  const [data, setData]             = useState(INIT)
  const [status, setStatus]         = useState(null)  // null | 'loading' | 'ok' | 'error'
  const [msg, setMsg]               = useState('')

  const update = (key, val) => setData((d) => ({ ...d, [key]: val }))

  const points  = useMemo(() => estimatePoints(data), [data])
  const entries = useMemo(() => buildEntries(data), [data])

  async function handleSave() {
    if (!entries.length) return
    setStatus('loading')
    setMsg('')
    try {
      const res = await api.post('/api/registro', { user, fecha, entries })
      setMsg(res.message || '✅ Guardado correctamente.')
      setStatus('ok')
      setData(INIT)
      mutate(`/api/kpi?user=${encodeURIComponent(user)}`)
      mutate((key) => typeof key === 'string' && key.startsWith('/api/latest'))
    } catch {
      setMsg('Error al guardar. Intenta de nuevo.')
      setStatus('error')
    }
  }

  const activeLaneObj = LANES.find((l) => l.id === activeLane)
  const mealsDone     = Object.values(data.meals).filter(Boolean).length
  const habitsDone    = Object.values(data.habits).filter(Boolean).length

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.dateWrap}>
          <label className={styles.dateLabel}>Fecha</label>
          <input
            type="date"
            className={`${styles.dateInput} mono`}
            value={fecha}
            max={TODAY}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div className={styles.pointsWrap}>
          <div className={styles.pointsNum}>
            <span className={`${styles.pointsVal} mono`}>+{points}</span>
            <span className={styles.pointsLabel}>pts estimados</span>
          </div>
          <button
            type="button"
            className={`${styles.saveBtn} ${status === 'ok' ? styles.saveBtnOk : ''}`}
            onClick={handleSave}
            disabled={status === 'loading' || !entries.length}
          >
            <Icon name={status === 'ok' ? 'check-circle' : 'check-circle'} size={15} />
            {status === 'loading' ? 'Guardando…' : status === 'ok' ? 'Guardado' : 'Guardar registro'}
          </button>
        </div>
      </div>

      {/* ── Lane tabs ── */}
      <div className={styles.laneTabs}>
        {LANES.map((lane) => (
          <button
            key={lane.id}
            type="button"
            className={`${styles.laneTab} ${activeLane === lane.id ? styles.laneTabActive : ''}`}
            style={activeLane === lane.id ? { borderColor: lane.color, color: lane.color } : {}}
            onClick={() => setActiveLane(lane.id)}
          >
            <Icon name={lane.icon} size={15} color={activeLane === lane.id ? lane.color : 'var(--text-3)'} />
            {lane.label}
          </button>
        ))}
      </div>

      {/* ── Body: form + sidebar ── */}
      <div className={styles.body}>
        {/* Form */}
        <div className={styles.formCol}>
          {activeLane === 'fisico'    && <FisicoForm    data={data} update={update} />}
          {activeLane === 'nutricion' && <NutricionForm data={data} update={update} />}
          {activeLane === 'habitos'   && <HabitosForm   data={data} update={update} />}
          {activeLane === 'descanso'  && <DescansoForm  data={data} update={update} />}
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <Card>
            <CardHeader title="Hoy en breve" subtitle="Tu registro en vivo" />
            <div className={styles.summaryList}>
              <SummaryItem icon="scale"      color="var(--lane-fisico)"    label="Peso"          value={data.peso    ? `${data.peso} kg` : '—'}      done={!!data.peso} />
              <SummaryItem icon="footprints" color="var(--lane-fisico)"    label="Pasos"         value={data.pasos   ? data.pasos.toLocaleString() : '0'} done={data.pasos > 0} />
              <SummaryItem icon="dumbbell"   color="var(--lane-fisico)"    label="Entrenamiento" value={data.workout || '—'}                           done={!!data.workout} />
              <div className={styles.summaryDivider} />
              <SummaryItem icon="utensils"   color="var(--lane-nutricion)" label="Comidas"       value={`${mealsDone}/5`}                             done={mealsDone > 0} />
              <SummaryItem icon="droplet"    color="var(--lane-nutricion)" label="Agua"          value={`${data.agua} L`}                             done={data.agua > 0} />
              <div className={styles.summaryDivider} />
              <SummaryItem icon="brain"      color="var(--lane-habitos)"   label="Hábitos"       value={`${habitsDone}/5`}                            done={habitsDone > 0} />
              <div className={styles.summaryDivider} />
              <SummaryItem icon="moon"       color="var(--lane-descanso)"  label="Sueño"         value={`${data.sleepHours} h`}                       done={data.sleepHours > 0} />
            </div>

            {msg && (
              <div className={`${styles.toast} ${status === 'ok' ? styles.toastOk : styles.toastErr}`}>
                {msg}
              </div>
            )}
          </Card>

          <Card>
            <div className={styles.coachTip}>
              <div className={styles.coachIcon}>
                <Icon name="zap" size={14} color="var(--accent)" />
              </div>
              <p className={styles.coachText}>{TIPS[activeLane]}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
