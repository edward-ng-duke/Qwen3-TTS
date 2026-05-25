import { motion } from "motion/react"
import { EMOTION_PRESETS } from "@/lib/emotions"
import { T } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const ZH_LABEL: Record<string, string> = {
  Neutral: T.emotions.neutral,
  Happy: T.emotions.happy,
  Sad: T.emotions.sad,
  Angry: T.emotions.angry,
  Fearful: T.emotions.afraid,
  Calm: T.emotions.calm,
  Custom: T.emotions.custom,
}

const spring = { type: "spring", stiffness: 360, damping: 28 } as const

interface Props {
  value: string
  onChange: (name: string) => void
}

export function EmotionPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EMOTION_PRESETS.map((p) => {
        const selected = value === p.name
        return (
          <motion.button
            key={p.name}
            type="button"
            onClick={() => onChange(p.name)}
            whileHover={selected ? undefined : { scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={spring}
            aria-pressed={selected}
            className={cn(
              "relative inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] select-none",
              "transition-colors",
              selected
                ? "text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
            style={{
              border: selected
                ? "1px solid transparent"
                : "1px solid var(--glass-thin-border)",
              background: selected ? "transparent" : "var(--glass-thin-bg)",
              backdropFilter: selected ? undefined : "blur(8px)",
              WebkitBackdropFilter: selected ? undefined : "blur(8px)",
            }}
          >
            {selected && (
              <motion.span
                layoutId="emotion-active"
                aria-hidden
                className="absolute inset-0 rounded-full -z-0"
                style={{
                  background: "var(--brand-gradient)",
                  boxShadow: "0 6px 18px var(--brand-glow)",
                }}
                transition={spring}
              />
            )}
            <span className="relative z-10 text-[15px] leading-none">{p.emoji}</span>
            <span className="relative z-10">{ZH_LABEL[p.name] ?? p.name}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
