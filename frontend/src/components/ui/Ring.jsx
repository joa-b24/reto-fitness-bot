import styles from './Ring.module.css'

export function Ring({ value = 0, max = 100, color = 'var(--accent)', size = 80, label, sublabel }) {
  const pct   = Math.min(1, value / max)
  const r     = (size - 12) / 2
  const circ  = 2 * Math.PI * r
  const dash  = circ * pct

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg width={size} height={size} className={styles.svg}>
        <circle cx={size / 2} cy={size / 2} r={r} className={styles.track} strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          className={styles.fill}
          strokeWidth={6}
          stroke={color}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className={styles.center}>
        {label    && <span className={styles.label}>{label}</span>}
        {sublabel && <span className={styles.sublabel}>{sublabel}</span>}
      </div>
    </div>
  )
}
