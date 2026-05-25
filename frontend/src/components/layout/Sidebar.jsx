import { Icon } from '../ui/Icon'
import { Avatar } from '../ui/Avatar'
import { USERS } from '../../lib/constants'
import styles from './Sidebar.module.css'

const NAV = [
  { id: 'inicio',    label: 'Inicio',    icon: 'home'       },
  { id: 'registro',  label: 'Registro',  icon: 'edit'       },
  { id: 'vision',    label: 'Visión',    icon: 'eye'        },
  { id: 'plan',      label: 'Plan',      icon: 'calendar'   },
  { id: 'insights',  label: 'Insights',  icon: 'line-chart' },
  { id: 'mas',       label: 'Más',       icon: 'grid'       },
]

export function Sidebar({ screen, onScreen, user, onUser }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.logo}>FQ</span>
        <div className={styles.brandText}>
          <span className={styles.brandName}>FitQuest</span>
          <span className={styles.brandSub}>Reto Pretemporada</span>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV.map((item) => {
          const active = screen === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.navItem} ${active ? styles.active : ''}`}
              onClick={() => onScreen(item.id)}
            >
              <Icon
                name={item.icon}
                size={18}
                color={active ? 'var(--accent)' : 'var(--text-3)'}
                strokeWidth={active ? 2 : 1.75}
              />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className={styles.spacer} />

      <div className={styles.userSection}>
        <p className={styles.sectionLabel}>Usuario</p>
        {USERS.map((u) => (
          <button
            key={u.id}
            type="button"
            className={`${styles.userBtn} ${user === u.id ? styles.userActive : ''}`}
            onClick={() => onUser(u.id)}
          >
            <Avatar
              initials={u.initials}
              size={26}
              accent={user === u.id ? 'var(--accent)' : undefined}
            />
            <span>{u.label}</span>
            {user === u.id && <span className={styles.dot} />}
          </button>
        ))}
      </div>
    </aside>
  )
}
