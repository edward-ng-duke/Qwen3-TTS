import { Mic } from "lucide-react"
import { motion } from "motion/react"
import type { VoiceInfo } from "@/lib/api"
import { T } from "@/lib/i18n"
import { formatLanguage } from "@/lib/format"
import { voiceName } from "@/lib/voiceMeta"
import { cn } from "@/lib/utils"

const spring = { type: "spring", stiffness: 320, damping: 24 } as const

interface Props {
  voice?: VoiceInfo
  onClick?: () => void
  className?: string
}

export function VoicePill({ voice, onClick, className }: Props) {
  const selected = !!voice
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={spring}
      className={cn(
        "inline-flex items-center gap-2 h-9 px-3 rounded-full text-[13px] select-none",
        "text-[var(--text-primary)]",
        className,
      )}
      style={{
        background: "var(--glass-thin-bg)",
        backdropFilter: "blur(var(--glass-thin-blur)) saturate(180%)",
        WebkitBackdropFilter: "blur(var(--glass-thin-blur)) saturate(180%)",
        border: selected
          ? "1px solid var(--brand)"
          : "1px solid var(--glass-thin-border)",
        boxShadow: selected
          ? "0 0 0 3px var(--brand-glow), var(--glass-inset-highlight)"
          : "var(--glass-inset-highlight)",
      }}
    >
      <Mic
        className="size-3.5"
        style={{ color: selected ? "var(--brand)" : "var(--text-tertiary)" }}
      />
      <span className="font-medium">
        {voice ? voiceName(voice) : T.composer.pickVoice}
      </span>
      {voice && (
        <span className="text-[12px] text-[var(--text-tertiary)]">
          · {formatLanguage(voice.language)}
        </span>
      )}
    </motion.button>
  )
}
