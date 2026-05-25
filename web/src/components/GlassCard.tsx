import { forwardRef, type HTMLAttributes, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type GlassVariant = 'strong' | 'regular' | 'thin'

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: GlassVariant
}

const styleFor = (variant: GlassVariant): CSSProperties => ({
  background: `var(--glass-${variant}-bg)`,
  backdropFilter: `blur(var(--glass-${variant}-blur)) saturate(180%)`,
  WebkitBackdropFilter: `blur(var(--glass-${variant}-blur)) saturate(180%)`,
  border: `1px solid var(--glass-${variant}-border)`,
  boxShadow: 'var(--shadow-glass)',
})

export const GlassCard = forwardRef<HTMLDivElement, Props>(function GlassCard(
  { variant = 'regular', className, style, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('rounded-[var(--radius-card)]', className)}
      style={{ ...styleFor(variant), ...style }}
      {...rest}
    >
      {children}
    </div>
  )
})
