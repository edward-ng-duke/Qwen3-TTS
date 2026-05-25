import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

type Blob = {
  color: string
  size: string
  anchor: CSSProperties
  duration: number
  keyframes: {
    x: number[]
    y: number[]
    scale: number[]
  }
}

const BLOBS: Blob[] = [
  {
    color: 'var(--bg-aurora-a)',
    size: '65vmax',
    anchor: { top: '-15%', left: '-10%' },
    duration: 42,
    keyframes: {
      x: [0, 80, -60, 40, 0],
      y: [0, 60, 90, 30, 0],
      scale: [1, 1.1, 0.95, 1.05, 1],
    },
  },
  {
    color: 'var(--bg-aurora-b)',
    size: '70vmax',
    anchor: { top: '20%', right: '-15%' },
    duration: 56,
    keyframes: {
      x: [0, -90, 40, -50, 0],
      y: [0, 70, -40, 60, 0],
      scale: [1, 0.92, 1.08, 1, 1],
    },
  },
  {
    color: 'var(--bg-aurora-c)',
    size: '60vmax',
    anchor: { bottom: '-20%', left: '20%' },
    duration: 48,
    keyframes: {
      x: [0, 60, -80, 50, 0],
      y: [0, -50, 30, -70, 0],
      scale: [1, 1.05, 0.95, 1.1, 1],
    },
  },
]

export function AuroraBackground() {
  const reduce = useReducedMotion()

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={{ background: 'var(--bg-base)' }}
    >
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          initial={false}
          animate={
            reduce
              ? undefined
              : { x: b.keyframes.x, y: b.keyframes.y, scale: b.keyframes.scale }
          }
          transition={
            reduce
              ? undefined
              : {
                  duration: b.duration,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  repeatType: 'loop',
                }
          }
          style={{
            position: 'absolute',
            width: b.size,
            height: b.size,
            ...b.anchor,
            borderRadius: '50%',
            filter: 'blur(80px)',
            opacity: 0.55,
            background: `radial-gradient(circle at 50% 50%, ${b.color}, transparent 65%)`,
            willChange: 'transform',
          }}
        />
      ))}
      {/* Subtle vignette to keep text contrast at the edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, oklch(0 0 0 / 0.04) 100%)',
        }}
      />
    </div>
  )
}
