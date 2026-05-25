import styles from './StatCard.module.css'

export function StatCard({ label, value, unit, color, icon, delta }) {
  const isPositive = delta > 0
  return (
    <div className={styles.card} style={{ '--sc-color': color || 'var(--accent)' }}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>
      <div className={styles.value}>
        <span className={styles.num}>{value ?? '—'}</span>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {delta != null && (
        <span className={`${styles.delta} ${isPositive ? styles.up : styles.down}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(delta)}
        </span>
      )}
    </div>
  )
}
