import styles from './Card.module.css'

export function Card({ children, className = '', accent, style }) {
  return (
    <div
      className={`${styles.card} ${className}`}
      style={accent ? { '--card-accent': accent, borderTopColor: accent, ...style } : style}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className={styles.header}>
      <div>
        <p className={styles.title}>{title}</p>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
