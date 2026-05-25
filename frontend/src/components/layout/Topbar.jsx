import { Avatar } from '../ui/Avatar'
import { USERS } from '../../lib/constants'
import styles from './Topbar.module.css'

const TITLES = {
  inicio:    { title: 'Inicio',    sub: 'Dashboard general' },
  registro:  { title: 'Registro',  sub: 'Daily log' },
  vision:    { title: 'Visión',    sub: 'Vision board' },
  plan:      { title: 'Plan',      sub: 'Entrenamiento & nutrición' },
  insights:  { title: 'Insights',  sub: 'Análisis & reportes' },
  mas:       { title: 'Más',       sub: 'Retos, logros y metas' },
}

export function Topbar({ screen, user, onUser }) {
  const { title, sub } = TITLES[screen] || { title: screen, sub: '' }
  const currentUser = USERS.find((u) => u.id === user)

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
        {sub && <p className={styles.sub}>{sub}</p>}
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
              <Avatar
                initials={u.initials}
                size={22}
                accent={user === u.id ? 'var(--accent)' : undefined}
              />
              {u.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
