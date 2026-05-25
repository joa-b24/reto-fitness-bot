import { USERS } from '../../lib/constants'
import styles from './UserSelector.module.css'

export function UserSelector({ user, onChange }) {
  return (
    <div className={styles.wrap}>
      {USERS.map((u) => (
        <button
          key={u.id}
          type="button"
          className={`${styles.btn} ${user === u.id ? styles.active : ''}`}
          onClick={() => onChange(u.id)}
        >
          <span className={styles.avatar}>{u.initials}</span>
          <span className={styles.name}>{u.label}</span>
        </button>
      ))}
    </div>
  )
}
