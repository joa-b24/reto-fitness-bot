import styles from './Button.module.css'

export function Button({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button' }) {
  return (
    <button
      type={type}
      className={`${styles.btn} ${styles[variant]} ${styles[size]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
