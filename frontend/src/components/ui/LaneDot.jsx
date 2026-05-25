const COLORS = {
  fisico:    'var(--lane-fisico)',
  nutricion: 'var(--lane-nutricion)',
  habitos:   'var(--lane-habitos)',
  descanso:  'var(--lane-descanso)',
}

export function LaneDot({ lane, size = 8 }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: COLORS[lane] || 'var(--text-3)',
        flexShrink: 0,
      }}
    />
  )
}
