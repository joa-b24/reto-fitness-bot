export const USERS = [
  { id: 'joa_b29',  label: 'Joa',   initials: 'JB' },
  { id: 'd1aniss',  label: 'Diana', initials: 'DI' },
]

export const LANES = [
  { id: 'fisico',    label: 'Físico',    en: 'Physical',  icon: 'dumbbell',  color: 'var(--lane-fisico)',    dailyMax: 40, weeklyTarget: '40 pts/día · pasos + entreno' },
  { id: 'nutricion', label: 'Nutrición', en: 'Nutrition', icon: 'utensils',  color: 'var(--lane-nutricion)', dailyMax: 30, weeklyTarget: '30 pts/día · macros + comidas' },
  { id: 'habitos',   label: 'Hábitos',   en: 'Habits',    icon: 'brain',     color: 'var(--lane-habitos)',   dailyMax: 20, weeklyTarget: '20 pts/día · 5 hábitos' },
  { id: 'descanso',  label: 'Descanso',  en: 'Rest',      icon: 'moon',      color: 'var(--lane-descanso)',  dailyMax: 10, weeklyTarget: '10 pts/día · sueño + recovery' },
]

// Which habits map to each lane (for week glance & aggregation)
export const HABIT_LANE = {
  // Físico
  pasos:          'fisico',
  ejercicio:      'fisico',
  rpe:            'fisico',
  // Nutrición
  agua:           'nutricion',
  calorias:       'nutricion',
  proteina:       'nutricion',
  alimentacion:   'nutricion',
  comidas:        'nutricion',
  // Hábitos
  duolingo:       'habitos',
  lectura:        'habitos',
  celular:        'habitos',
  dientes:        'habitos',
  ducha:          'habitos',
  // Descanso
  sueño:          'descanso',
  sueno:          'descanso',
  calidad_sueño:  'descanso',
  siesta:         'descanso',
  mood:           'descanso',
}

// Habits that are measurements only (no lane affiliation for week glance)
export const MEASUREMENT_HABITS = new Set(['peso', 'cintura'])

export const TODAY = new Date().toISOString().split('T')[0]

// Current week Mon–Sun range
export function getWeekRange(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return {
    start: mon.toISOString().split('T')[0],
    end:   sun.toISOString().split('T')[0],
  }
}

// Day labels in Spanish
export const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// Challenge timeline
export const CHALLENGE_START = '2026-05-25'
export const CHALLENGE_END   = '2026-09-27'
export const TOTAL_WEEKS = Math.ceil(
  (new Date(CHALLENGE_END) - new Date(CHALLENGE_START)) / (7 * 24 * 3600 * 1000)
)

export function currentWeekNumber() {
  const start = new Date(CHALLENGE_START)
  const now   = new Date()
  const diff  = Math.floor((now - start) / (7 * 24 * 3600 * 1000))
  return Math.max(0, Math.min(diff + 1, TOTAL_WEEKS))
}

export function currentDayNumber() {
  const start = new Date(CHALLENGE_START)
  const now   = new Date()
  return Math.max(0, Math.min(Math.floor((now - start) / 86400000) + 1, TOTAL_WEEKS * 7))
}
