import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface SoundWaveProps {
  className?: string
  bars?: number
  /** CSS color, gradient, or var — defaults to brand gradient */
  color?: string
}

export function SoundWave({
  className,
  bars = 12,
  color = "var(--brand-gradient)",
}: SoundWaveProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-[3px] h-[18px]", className)}
      role="img"
      aria-label="正在生成"
    >
      {Array.from({ length: bars }).map((_, i) => {
        // Each bar gets a slightly different period and phase so the
        // wave reads as organic rather than mechanically uniform.
        const duration = 0.7 + (i % 5) * 0.07
        const delay = -((i * 137) % 1000) / 1000
        return (
          <motion.span
            key={i}
            className="block w-[3px] rounded-full origin-center"
            style={{ height: 16, background: color, willChange: "transform" }}
            initial={{ scaleY: 0.25 }}
            animate={{ scaleY: [0.25, 1, 0.45, 0.85, 0.3] }}
            transition={{
              duration,
              delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )
      })}
    </div>
  )
}
