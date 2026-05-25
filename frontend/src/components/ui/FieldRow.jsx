import styles from './FieldRow.module.css'

export function FieldRow({ label, hint, children }) {
  return (
    <div className={styles.row}>
      <div className={styles.top}>
        <label className={styles.label}>{label}</label>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}
