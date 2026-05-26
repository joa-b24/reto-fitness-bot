import { useState, useMemo } from 'react'
import { mutate } from 'swr'
import { Card, CardHeader } from '../components/ui/Card'
import { Icon } from '../components/ui/Icon'
import { SliderInput } from '../components/ui/SliderInput'
import { FieldRow } from '../components/ui/FieldRow'
import { Chip } from '../components/ui/Chip'
import { PhotoUpload } from '../components/ui/PhotoUpload'
import { api } from '../lib/api'
import { LANES, TODAY as CONST_TODAY, currentWeekNumber } from '../lib/constants'
import USER_PROFILES from '../config/userProfiles.json'
import HABITS_CONFIG from '../config/habitsConfig.json'
import styles from './Registro.module.css'

const TODAY = new Date().toISOString().split('T')[0]

// ─── Build initial habits state from config ───────────────
const INIT_HABITS = Object.fromEntries(
  HABITS_CONFIG.map((h) => [h.key, h.numeric ? 0 : false])
)

// ─── Initial state ────────────────────────────────────────
const INIT = {
  // Físico
  peso:             '',
  cintura:          '',
  pasos:            0,
  workout:          [],   // array of types, e.g. ['fuerza', 'cardio']
  workoutDuration:  45,
  workoutRPE:       7,
  // Nutrición (meal keys are stable across users; times/labels come from profile)
  meals:    { desayuno: false, snack1: false, almuerzo: false, snack2: false, cena: false },
  agua:             1.5,
  calorias:         '',
  proteina:         100,
  cleanEating:      7,
  // Hábitos (numeric: 0 = not done, >0 = done with value)
  habits:   INIT_HABITS,
  // Descanso
  sleepHours:       7.5,
  sleepQuality:     7,
  napMin:           0,
  mood:             0,
}

// ─── Live points estimate ─────────────────────────────────
function estimatePoints(data) {
  let p = 0
  if (data.peso)                                                p += 10
  if (data.pasos >= 8000)                                       p += 20
  else if (data.pasos > 0)                                      p += Math.round((data.pasos / 8000) * 20)
  if ((data.workout || []).some((t) => t !== 'descanso'))       p += 30
  p += Object.values(data.meals).filter(Boolean).length * 5
  p += Math.min(20, Math.round(data.agua * 8))
  const habitsDoneCount = Object.values(data.habits).filter(Boolean).length
  p += habitsDoneCount * 8
  if (data.sleepHours >= 7.5)                                   p += 25
  else if (data.sleepHours > 0)                                 p += Math.round((data.sleepHours / 7.5) * 25)
  return p
}

// ─── Build API entries ────────────────────────────────────
function buildEntries(data) {
  const e = []

  // ── Físico ──
  if (data.peso)    e.push({ habito: 'peso',    valor: data.peso })
  if (data.cintura) e.push({ habito: 'cintura', valor: data.cintura })
  if (data.pasos > 0) e.push({ habito: 'pasos', valor: data.pasos })

  const workoutTypes = (data.workout || []).filter((t) => t !== 'descanso')
  if (workoutTypes.length > 0) {
    e.push({ habito: 'ejercicio',      valor: data.workoutDuration })
    e.push({ habito: 'tipo_ejercicio', valor: workoutTypes.join(',') })
    e.push({ habito: 'rpe',            valor: data.workoutRPE })
  }

  // ── Nutrición ──
  if (data.agua > 0)    e.push({ habito: 'agua',     valor: data.agua })
  if (data.calorias)    e.push({ habito: 'calorias',  valor: data.calorias })
  if (data.proteina > 0) e.push({ habito: 'proteina', valor: data.proteina })
  const mealsDone = Object.values(data.meals).filter(Boolean).length
  if (mealsDone > 0)    e.push({ habito: 'comidas',  valor: mealsDone })
  if (data.cleanEating > 0) e.push({ habito: 'alimentacion', valor: data.cleanEating })

  // ── Hábitos ──
  for (const h of HABITS_CONFIG) {
    const val = data.habits[h.key]
    if (h.numeric) {
      if (val > 0) e.push({ habito: h.key, valor: val })
    } else {
      if (val)     e.push({ habito: h.key, valor: 1 })
    }
  }

  // ── Descanso ──
  if (data.sleepHours > 0) {
    e.push({ habito: 'sueño',         valor: data.sleepHours })
    e.push({ habito: 'calidad_sueño', valor: data.sleepQuality })
  }
  if (data.napMin > 0) e.push({ habito: 'siesta', valor: data.napMin })
  if (data.mood > 0)   e.push({ habito: 'mood',   valor: data.mood })

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

function FisicoForm({ data, update, user, fecha }) {
  const [savedPhotos, setSavedPhotos] = useState({})
  const [savingPhoto, setSavingPhoto] = useState(null)

  async function handlePhotoUpload(label, url) {
    setSavingPhoto(label)
    try {
      await fetch('/api/fotos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user, fecha,
          semana: currentWeekNumber(),
          url,
          nota: label,
          tipo: 'progreso',
        }),
      })
      setSavedPhotos(p => ({ ...p, [label]: url }))
    } finally {
      setSavingPhoto(null)
    }
  }

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

          <FieldRow label="Tipo de entrenamiento" hint="selección múltiple">
            <div className={styles.chipRow}>
              {WORKOUT_OPTS.map((o) => {
                const curr    = data.workout || []
                const isActive = curr.includes(o.v)
                return (
                  <Chip
                    key={o.v}
                    active={isActive}
                    color="var(--lane-fisico)"
                    onClick={() => {
                      if (o.v === 'descanso') {
                        update('workout', isActive ? [] : ['descanso'])
                      } else {
                        const without = curr.filter((t) => t !== 'descanso' && t !== o.v)
                        update('workout', isActive ? without : [...without, o.v])
                      }
                    }}
                  >
                    <Icon name={o.i} size={12} /> {o.l}
                  </Chip>
                )
              })}
            </div>
          </FieldRow>

          {(data.workout || []).some((t) => t !== 'descanso') && (
            <div className="grid-2" style={{ gap: 16 }}>
              <FieldRow label="Duración total" hint="minutos">
                <SliderInput value={data.workoutDuration} min={10} max={180} step={5} onChange={(v) => update('workoutDuration', v)} suffix=" min" color="var(--lane-fisico)" />
              </FieldRow>
              <FieldRow label="Intensidad RPE" hint="1 – 10">
                <SliderInput value={data.workoutRPE} min={1} max={10} step={1} onChange={(v) => update('workoutRPE', v)} suffix="/10" color="var(--lane-fisico)" />
              </FieldRow>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Fotos de progreso" subtitle="Opcional · se guardan en tu galería" />
        <div className="grid-3" style={{ gap: 12 }}>
          {['Frontal', 'Lateral', 'Posterior'].map((label) => (
            <div key={label} className={styles.photoSlot}>
              {savedPhotos[label] ? (
                <div className={styles.photoSaved}>
                  <img src={savedPhotos[label]} alt={label} className={styles.photoThumb} />
                  <span className={styles.photoSavedLabel}>
                    <Icon name="check" size={10} color="var(--ok)" /> {label}
                  </span>
                </div>
              ) : (
                <PhotoUpload
                  compact
                  label={savingPhoto === label ? 'Subiendo…' : label}
                  folder="fitquest/progreso"
                  onUploaded={(url) => handlePhotoUpload(label, url)}
                />
              )}
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

function NutricionForm({ data, update, meals, macroTargets }) {
  const mealsDone = Object.values(data.meals).filter(Boolean).length
  const targets   = macroTargets || { agua: 2, calorias: 1800, proteina: 150 }

  return (
    <>
      <Card>
        <CardHeader title="Comidas del día" subtitle={`${mealsDone}/${meals.length} registradas`} />
        <div className={styles.mealList}>
          {meals.map((meal) => {
            const done = data.meals[meal.key]
            return (
              <button
                key={meal.key}
                type="button"
                className={`${styles.mealRow} ${done ? styles.mealDone : ''}`}
                style={done ? { borderColor: 'var(--lane-nutricion)' } : {}}
                onClick={() => update('meals', { ...data.meals, [meal.key]: !done })}
              >
                <div className={`${styles.mealCheck} ${done ? styles.mealCheckDone : ''}`}>
                  {done && <Icon name="check-circle" size={14} color="var(--accent-ink)" strokeWidth={2.5} />}
                </div>
                <div className={styles.mealInfo}>
                  <span className={styles.mealName}>{meal.label}</span>
                  <span className={`${styles.mealTime} mono`}>{meal.time}</span>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Hidratación y macros" />
        <div className={styles.formStack}>
          <FieldRow label="Agua" hint={`objetivo ${targets.agua} L`}>
            <SliderInput value={data.agua} min={0} max={5} step={0.1} onChange={(v) => update('agua', v)} suffix=" L" color="var(--lane-nutricion)" />
          </FieldRow>
          <FieldRow label="Calorías" hint="kcal totales">
            <NumInput value={data.calorias} onChange={(v) => update('calorias', v)} placeholder={String(targets.calorias)} unit="kcal" />
          </FieldRow>
          <FieldRow label="Proteína" hint={`objetivo ${targets.proteina} g`}>
            <SliderInput value={data.proteina} min={0} max={Math.max(300, targets.proteina + 50)} step={5} onChange={(v) => update('proteina', v)} suffix=" g" color="var(--lane-nutricion)" />
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
  const numericActive = HABITS_CONFIG.filter((h) => h.numeric && data.habits[h.key] > 0)

  return (
    <>
      <Card>
        <CardHeader title="Hábitos diarios" subtitle="Tu sistema operativo personal" />
        <div className="grid-2" style={{ gap: 12 }}>
          {HABITS_CONFIG.map((h) => {
            const val  = data.habits[h.key]
            const done = h.numeric ? val > 0 : val === true
            return (
              <button
                key={h.key}
                type="button"
                className={`${styles.habitCard} ${done ? styles.habitCardDone : ''}`}
                style={done ? { borderColor: 'var(--lane-habitos)', background: 'color-mix(in srgb, var(--lane-habitos) 10%, var(--surface-2))' } : {}}
                onClick={() => {
                  if (h.numeric) {
                    update('habits', { ...data.habits, [h.key]: done ? 0 : h.min })
                  } else {
                    update('habits', { ...data.habits, [h.key]: !done })
                  }
                }}
              >
                <div className={styles.habitTop}>
                  <div className={`${styles.habitIcon} ${done ? styles.habitIconDone : ''}`}>
                    <Icon name={h.icon} size={18} color={done ? 'var(--bg)' : 'var(--text-2)'} />
                  </div>
                  {done && (
                    <div className={styles.habitCheck}>
                      <Icon name="check-circle" size={12} color="var(--bg)" strokeWidth={2.5} />
                    </div>
                  )}
                </div>
                <div>
                  <p className={styles.habitLabel}>{h.label}</p>
                  <p className={styles.habitSub}>
                    {h.numeric && done ? `${val} ${h.unit}` : h.sub}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {numericActive.length > 0 && (
        <Card>
          <CardHeader title="Detalle" subtitle="Ajusta el valor exacto" />
          <div className={styles.formStack}>
            {numericActive.map((h) => (
              <FieldRow key={h.key} label={h.label} hint={`en ${h.unit}`}>
                <SliderInput
                  value={data.habits[h.key]}
                  min={h.min}
                  max={h.max}
                  step={h.step}
                  onChange={(v) => update('habits', { ...data.habits, [h.key]: v })}
                  suffix={` ${h.unit}`}
                  color="var(--lane-habitos)"
                />
              </FieldRow>
            ))}
          </div>
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
// Hardcoded coach tips — edit here to change the messages shown in the sidebar
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

  // Per-user config (meals + macro targets)
  const userProfile   = USER_PROFILES[user] || Object.values(USER_PROFILES)[0]
  const userMeals     = userProfile.meals
  const macroTargets  = userProfile.macroTargets

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
          {activeLane === 'fisico'    && <FisicoForm    data={data} update={update} user={user} fecha={fecha} />}
          {activeLane === 'nutricion' && <NutricionForm data={data} update={update} meals={userMeals} macroTargets={macroTargets} />}
          {activeLane === 'habitos'   && <HabitosForm   data={data} update={update} />}
          {activeLane === 'descanso'  && <DescansoForm  data={data} update={update} />}
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <Card>
            <CardHeader title="Hoy en breve" subtitle="Tu registro en vivo" />
            <div className={styles.summaryList}>
              <SummaryItem icon="scale"      color="var(--lane-fisico)"    label="Peso"          value={data.peso    ? `${data.peso} kg` : '—'}       done={!!data.peso} />
              <SummaryItem icon="footprints" color="var(--lane-fisico)"    label="Pasos"         value={data.pasos   ? data.pasos.toLocaleString() : '0'} done={data.pasos > 0} />
              <SummaryItem icon="dumbbell"   color="var(--lane-fisico)"    label="Entrenamiento" value={(data.workout || []).join('+') || '—'}          done={(data.workout || []).length > 0} />
              <div className={styles.summaryDivider} />
              <SummaryItem icon="utensils"   color="var(--lane-nutricion)" label="Comidas"       value={`${mealsDone}/${userMeals.length}`}             done={mealsDone > 0} />
              <SummaryItem icon="droplet"    color="var(--lane-nutricion)" label="Agua"          value={`${data.agua} L`}                              done={data.agua > 0} />
              <div className={styles.summaryDivider} />
              <SummaryItem icon="brain"      color="var(--lane-habitos)"   label="Hábitos"       value={`${habitsDone}/${HABITS_CONFIG.length}`}        done={habitsDone > 0} />
              <div className={styles.summaryDivider} />
              <SummaryItem icon="moon"       color="var(--lane-descanso)"  label="Sueño"         value={`${data.sleepHours} h`}                        done={data.sleepHours > 0} />
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
