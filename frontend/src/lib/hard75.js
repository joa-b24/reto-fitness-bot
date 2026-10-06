// 75 Hard sub-challenge: pure rule evaluation + streak maths.
// The day count is always derived from the logged data, never stored, so
// nothing resets at midnight and back-filling a past day restores the streak.

export const HARD75_TOTAL = 75

export const HARD75_TASKS = [
  { id: 'sesiones', label: '2 sesiones', hint: '45 min+ · una al exterior', icon: 'dumbbell'  },
  { id: 'agua',     label: 'Agua',       hint: '1 galón',                   icon: 'droplet'   },
  { id: 'foto',     label: 'Foto',       hint: 'de progreso',               icon: 'camera'    },
  { id: 'dieta',    label: 'Dieta',      hint: 'kcal · proteína · 0 azúcar', icon: 'utensils'  },
  { id: 'lectura',  label: 'Lectura',    hint: '10 páginas',                icon: 'book-open' },
]

const EPS = 1e-9

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// cfg: { aguaMin, lecturaMin, calorias, proteina }
export function evalDay(v = {}, cfg) {
  const n = (k) => Number(v[k]) || 0
  return {
    sesiones: n('sesiones') >= 2 && n('sesion_exterior') >= 1,
    agua:     n('agua') + EPS >= cfg.aguaMin,
    foto:     n('foto') >= 1,
    dieta:    n('calorias') > 0 && n('calorias') <= cfg.calorias && n('proteina') >= cfg.proteina && n('sin_azucar') >= 1,
    lectura:  n('lectura') >= cfg.lecturaMin,
  }
}

export function countDone(tasks) {
  return HARD75_TASKS.filter((t) => tasks[t.id]).length
}

// Highest value per habit, so a draft can be layered over what is already saved.
export function mergeDay(a = {}, b = {}) {
  const out = { ...a }
  for (const [k, val] of Object.entries(b)) out[k] = Math.max(Number(out[k]) || 0, Number(val) || 0)
  return out
}

// Day statuses:
//   done    — 5/5
//   open    — today, still in progress (never a failure)
//   pending — yesterday, incomplete, but still inside the grace window
//   failed  — closed day that was not completed → the count restarts
export function computeHard75({ days = {}, today, hour = 0, cfg }) {
  const timeline = []
  let run = 0, mejor = 0, intentos = 1, attemptStart = 0, completado = false

  if (today && cfg?.inicio && cfg.inicio <= today) {
    const yesterday = addDays(today, -1)
    for (let date = cfg.inicio; date <= today; date = addDays(date, 1)) {
      const tasks = evalDay(days[date], cfg)
      const done  = countDone(tasks)
      let status
      if (done === HARD75_TASKS.length) status = 'done'
      else if (date === today) status = 'open'
      else if (date === yesterday && hour < cfg.graciaHora) status = 'pending'
      else status = 'failed'

      if (!completado) {
        if (status === 'done') {
          run++
          mejor = Math.max(mejor, run)
          if (run >= HARD75_TOTAL) completado = true
        } else if (status === 'failed') {
          run = 0
          intentos++
          attemptStart = timeline.length + 1
        }
      }
      timeline.push({ date, status, tasks, done })
    }
  }

  const last = timeline[timeline.length - 1]
  const prev = timeline[timeline.length - 2]
  return {
    dia: run,
    mejor,
    intentos,
    completado,
    timeline,
    intento: timeline.slice(attemptStart),   // days of the current attempt
    hoy:  last || { date: today, status: 'open', tasks: evalDay({}, cfg), done: 0 },
    ayer: prev?.status === 'pending' ? prev : null,
  }
}
