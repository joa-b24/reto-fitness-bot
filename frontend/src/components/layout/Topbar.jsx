import styles from './Topbar.module.css'
import { USERS } from '../../lib/constants'

const TITLES = {
  inicio:   { title: 'Inicio',   sub: 'Dashboard' },
  registro: { title: 'Registro', sub: 'Daily Log' },
}

export function Topbar({ screen, user, onUser }) {
  const { title, sub } = TITLES[screen] || { title: screen, sub: '' }
  const currentUser = USERS.find((u) => u.id === user)

  return (
    <header className={styles.bar}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.sub}>{sub}</p>
      </div>

      <div className={styles.right}>
        <div className={styles.userToggle}>
          {USERS.map((u) => (
            <button
              key={u.id}
              type="button"
              className={`${styles.userBtn} ${user === u.id ? styles.active : ''}`}
              onClick={() => onUser(u.id)}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
