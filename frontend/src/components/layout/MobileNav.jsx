import { Icon } from '../ui/Icon'
import styles from './MobileNav.module.css'

const NAV = [
  { id: 'inicio',    label: 'Inicio',   icon: 'home'       },
  { id: 'registro',  label: 'Registro', icon: 'edit'       },
  { id: 'insights',  label: 'Stats',    icon: 'line-chart' },
  { id: 'plan',      label: 'Plan',     icon: 'calendar'   },
  { id: 'mas',       label: 'Más',      icon: 'grid'       },
]

export function MobileNav({ screen, onScreen }) {
  return (
    <nav className={styles.nav}>
      {NAV.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`${styles.item} ${screen === item.id ? styles.active : ''}`}
          onClick={() => onScreen(item.id)}
        >
          <Icon
            name={item.icon}
            size={20}
            color={screen === item.id ? 'var(--accent)' : 'var(--text-3)'}
            strokeWidth={screen === item.id ? 2 : 1.75}
          />
          <span className={styles.label}>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
