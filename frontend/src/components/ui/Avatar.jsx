import styles from './Avatar.module.css'

export function Avatar({ initials = '?', size = 32, accent }) {
  return (
    <div
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        ...(accent
          ? {
              background: `linear-gradient(135deg, ${accent}44, ${accent}18)`,
              color: accent,
              border: `1px solid ${accent}44`,
            }
          : {}),
      }}
    >
      {initials}
    </div>
  )
}
