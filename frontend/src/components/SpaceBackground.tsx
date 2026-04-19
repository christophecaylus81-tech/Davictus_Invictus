import { useMemo } from 'react'

interface Star {
  id: number
  x: number
  y: number
  size: number
  opacity: number
  duration: number
  delay: number
}

function generateStars(count: number): Star[] {
  // Use seeded-like values for stability (no re-render flicker)
  return Array.from({ length: count }, (_, i) => {
    const seed = (i * 9301 + 49297) % 233280
    const r1 = seed / 233280
    const seed2 = (seed * 9301 + 49297) % 233280
    const r2 = seed2 / 233280
    const seed3 = (seed2 * 9301 + 49297) % 233280
    const r3 = seed3 / 233280
    const seed4 = (seed3 * 9301 + 49297) % 233280
    const r4 = seed4 / 233280
    return {
      id: i,
      x: r1 * 100,
      y: r2 * 100,
      size: r3 * 1.8 + 0.4,
      opacity: r4 * 0.5 + 0.15,
      duration: 3 + (i % 7),
      delay: -(i % 5),
    }
  })
}

interface Props {
  count?: number
  style?: React.CSSProperties
}

export default function SpaceBackground({ count = 200, style }: Props) {
  const stars = useMemo(() => generateStars(count), [count])

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      pointerEvents: 'none', ...style
    }}>
      {/* Deep space gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 30% 40%, rgba(20,10,50,0.8) 0%, transparent 60%), radial-gradient(ellipse at 75% 70%, rgba(10,20,45,0.6) 0%, transparent 50%)'
      }} />

      {/* Stars */}
      {stars.map(s => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: '#fff',
            opacity: s.opacity,
            animation: `twinkle ${s.duration}s ${s.delay}s ease-in-out infinite alternate`,
          }}
        />
      ))}

      {/* Nebula clouds */}
      <div style={{
        position: 'absolute', top: '15%', left: '10%',
        width: 400, height: 300,
        background: 'radial-gradient(ellipse, rgba(108,99,255,0.06) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '20%', right: '15%',
        width: 500, height: 350,
        background: 'radial-gradient(ellipse, rgba(16,185,129,0.05) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(50px)',
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '45%',
        width: 300, height: 300,
        background: 'radial-gradient(ellipse, rgba(56,189,248,0.04) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(40px)',
      }} />
    </div>
  )
}
