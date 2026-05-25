import styles from './SliderInput.module.css'

export function SliderInput({ value, min = 0, max = 100, step = 1, onChange, suffix, color = 'var(--accent)' }) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className={styles.wrap}>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={styles.slider}
        style={{
          '--s-color': color,
          '--s-pct':   `${pct}%`,
        }}
      />
      <div className={`${styles.val} mono`}>
        {value}
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
    </div>
  )
}
