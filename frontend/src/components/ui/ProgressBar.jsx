import styles from './ProgressBar.module.css'

export function ProgressBar({ value = 0, max = 100, color, label, showPercent }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className={styles.wrap}>
      {(label || showPercent) && (
        <div className={styles.meta}>
          {label && <span className={styles.label}>{label}</span>}
          {showPercent && <span className={styles.pct}>{pct}%</span>}
        </div>
      )}
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${pct}%`, background: color || 'var(--accent)' }}
        />
      </div>
    </div>
  )
}
