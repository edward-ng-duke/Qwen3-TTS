import {
  forwardRef,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { cn } from '@/lib/utils'

const MAX_PULL = 8
const springConfig = { stiffness: 260, damping: 24, mass: 0.6 }

type Props = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
> & {
  fullWidth?: boolean
}

const baseStyle: CSSProperties = {
  background: 'var(--brand-gradient)',
  color: 'white',
  borderRadius: 'var(--radius-pill)',
  boxShadow: '0 8px 24px var(--brand-glow), var(--glass-inset-highlight)',
  border: '1px solid oklch(1 0 0 / 0.2)',
}

export const MagneticButton = forwardRef<HTMLButtonElement, Props>(
  function MagneticButton(
    { className, style, fullWidth, children, disabled, onPointerMove, onPointerLeave, ...rest },
    ref,
  ) {
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const sx = useSpring(x, springConfig)
    const sy = useSpring(y, springConfig)
    const localRef = useRef<HTMLButtonElement | null>(null)

    const setRef = (node: HTMLButtonElement | null) => {
      localRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    }

    const handleMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
      onPointerMove?.(e)
      if (disabled) return
      const el = localRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) / (rect.width / 2)
      const dy = (e.clientY - cy) / (rect.height / 2)
      x.set(Math.max(-1, Math.min(1, dx)) * MAX_PULL)
      y.set(Math.max(-1, Math.min(1, dy)) * MAX_PULL)
    }

    const handleLeave = (e: ReactPointerEvent<HTMLButtonElement>) => {
      onPointerLeave?.(e)
      x.set(0)
      y.set(0)
    }

    return (
      <motion.button
        ref={setRef}
        type="button"
        disabled={disabled}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        whileHover={disabled ? undefined : { scale: 1.02 }}
        whileTap={disabled ? undefined : { scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        style={{
          ...baseStyle,
          ...style,
          x: sx,
          y: sy,
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        className={cn(
          'inline-flex items-center justify-center gap-2 px-6 h-11 font-medium select-none',
          fullWidth && 'w-full',
          className,
        )}
        {...rest}
      >
        {children}
      </motion.button>
    )
  },
)
