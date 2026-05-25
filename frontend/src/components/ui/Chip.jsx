import styles from './Chip.module.css'

export function Chip({ children, active, color, onClick }) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${active ? styles.active : ''}`}
      style={active && color ? { '--chip-color': color } : {}}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
