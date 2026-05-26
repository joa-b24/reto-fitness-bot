import { Icon } from './Icon'
import styles from './AlertRow.module.css'

const SEVERITY_COLOR = {
  warn:   'var(--warn)',
  danger: 'var(--danger)',
  ok:     'var(--ok)',
  info:   'var(--lane-habitos)',
}

export function AlertRow({ alert, onDismiss, onAction }) {
  const color = SEVERITY_COLOR[alert.severity] || SEVERITY_COLOR.info
  return (
    <div className={styles.row}>
      <div className={styles.iconWrap} style={{ '--a-color': color }}>
        <Icon name={alert.icon} size={18} color={color} />
      </div>
      <div className={styles.body}>
        <div className={styles.top}>
          <span className={styles.title}>{alert.title}</span>
          {onDismiss && (
            <button className={styles.dismiss} onClick={() => onDismiss(alert.id)}>
              <Icon name="x" size={13} color="var(--text-3)" />
            </button>
          )}
        </div>
        <p className={styles.text}>{alert.body}</p>
        {alert.action && (
          <button className={styles.action} onClick={() => onAction?.(alert)}>
            {alert.action} <Icon name="chevron-right" size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
