export function Sparkline({ data = [], width = 120, height = 32, color = 'var(--accent)', fill = true }) {
  const valid = data.filter((v) => v != null)
  if (valid.length < 2) return null

  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const range = max - min || 1
  const pad = 2

  const points = data
    .map((v, i) => {
      if (v == null) return null
      const x = (i / (data.length - 1)) * width
      const y = height - pad - ((v - min) / range) * (height - pad * 2)
      return [x, y]
    })
    .filter(Boolean)

  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      {fill && (
        <path
          d={`${path} L${lx},${height} L${points[0][0]},${height} Z`}
          fill={color}
          opacity={0.12}
        />
      )}
      <path d={path} stroke={color} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={2.5} fill={color} />
    </svg>
  )
}
