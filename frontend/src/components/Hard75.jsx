import { Icon } from './ui/Icon'
import { HARD75_TASKS, HARD75_TOTAL, countDone } from '../lib/hard75'
import styles from './Hard75.module.css'

function missing(tasks) {
  return HARD75_TASKS.filter((t) => !tasks[t.id]).map((t) => t.label.toLowerCase()).join(', ')
}

// Five small icons, lit when the task is done for that day
export function Hard75Tasks({ tasks, size = 12 }) {
  return (
    <div className={styles.tasks}>
      {HARD75_TASKS.map((t) => (
        <span
          key={t.id}
          className={`${styles.task} ${tasks[t.id] ? styles.taskDone : ''}`}
          title={`${t.label} · ${t.hint}`}
          aria-label={`${t.label}: ${tasks[t.id] ? 'cumplido' : 'pendiente'}`}
        >
          <Icon name={t.icon} size={size} />
        </span>
      ))}
    </div>
  )
}

// Shown while the data loads, or when the server did not answer
function Hard75Empty({ error, className }) {
  return (
    <div className={className}>
      <span className={styles.stripName}>75 HARD</span>
      <span className={`${styles.stripNote} ${error ? styles.stripNoteWarn : ''}`}>
        {error ? 'No se pudo cargar el progreso. Revisa que el servidor esté actualizado y corriendo.' : 'Cargando…'}
      </span>
    </div>
  )
}

// Slim one-row summary for Inicio
export function Hard75Strip({ state, error, onClick }) {
  if (!state) return <Hard75Empty error={error} className={styles.strip} />
  const { dia, hoy, ayer, completado } = state
  const note = completado
    ? 'Reto completado'
    : ayer
      ? `Ayer pendiente: ${missing(ayer.tasks)}`
      : hoy.status === 'done'
        ? 'Hoy completo'
        : `Hoy ${hoy.done}/${HARD75_TASKS.length}`

  return (
    <button type="button" className={styles.strip} onClick={onClick}>
      <span className={styles.stripName}>75 HARD</span>
      <span className={`${styles.stripDay} mono`}>
        Día {dia}<span className={styles.stripTotal}>/{HARD75_TOTAL}</span>
      </span>
      <div className={styles.stripBar}>
        <div className={styles.stripFill} style={{ width: `${(dia / HARD75_TOTAL) * 100}%` }} />
      </div>
      <Hard75Tasks tasks={hoy.tasks} />
      <span className={`${styles.stripNote} ${ayer ? styles.stripNoteWarn : ''}`}>{note}</span>
      <Icon name="chevron-right" size={14} color="var(--text-3)" />
    </button>
  )
}

function TaskList({ title, day }) {
  return (
    <div className={styles.dayBlock}>
      <p className={styles.dayTitle}>
        {title} <span className="mono">{countDone(day.tasks)}/{HARD75_TASKS.length}</span>
      </p>
      {HARD75_TASKS.map((t) => (
        <div key={t.id} className={`${styles.taskRow} ${day.tasks[t.id] ? styles.taskRowDone : ''}`}>
          <Icon name={day.tasks[t.id] ? 'check-circle' : t.icon} size={14} />
          <span className={styles.taskLabel}>{t.label}</span>
          <span className={styles.taskHint}>{t.hint}</span>
        </div>
      ))}
    </div>
  )
}

// Full detail for Más → Retos
export function Hard75Detail({ state, error }) {
  if (!state) return <Hard75Empty error={error} className={`${styles.detail} ${styles.detailEmpty}`} />
  const { dia, mejor, intentos, intento, hoy, ayer, completado } = state
  const cells = Array.from({ length: HARD75_TOTAL }, (_, i) => intento[i] || null)

  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <div>
          <p className={styles.stripName}>75 HARD</p>
          <p className={`${styles.detailDay} mono`}>
            Día {dia}<span className={styles.stripTotal}>/{HARD75_TOTAL}</span>
          </p>
        </div>
        <div className={styles.detailStats}>
          <span>Intento <b className="mono">{intentos}</b></span>
          <span>Mejor racha <b className="mono">{mejor}</b></span>
        </div>
      </div>

      {completado && <p className={styles.detailNote}>Reto completado. 75 días seguidos.</p>}
      {!completado && intentos > 1 && dia === 0 && (
        <p className={styles.detailNote}>Un día quedó incompleto y el conteo reinició. Hoy es día 1 de nuevo.</p>
      )}

      <div className={styles.grid}>
        {cells.map((c, i) => (
          <div
            key={i}
            className={`${styles.cell} ${c ? styles[`cell_${c.status}`] : ''}`}
            title={c ? `${c.date} · ${c.done}/${HARD75_TASKS.length}` : `Día ${i + 1}`}
          />
        ))}
      </div>

      <div className={styles.dayBlocks}>
        <TaskList title="Hoy" day={hoy} />
        {ayer && <TaskList title="Ayer · aún puedes registrarlo" day={ayer} />}
      </div>
    </div>
  )
}
