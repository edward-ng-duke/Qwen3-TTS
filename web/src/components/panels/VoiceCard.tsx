import { useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { Play, Pause, Check } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { Badge } from "@/components/ui/badge"
import type { VoiceInfo } from "@/lib/api"
import { api } from "@/lib/api"
import { T } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { formatLanguage } from "@/lib/format"

const AGE_ZH: Record<string, string> = {
  young: "青年",
  adult: "成年",
  senior: "年长",
  child: "儿童",
}

const spring = { type: "spring", stiffness: 300, damping: 26 } as const

interface Props {
  voice: VoiceInfo
  selected: boolean
  onSelect: () => void
}

export function VoiceCard({ voice, selected, onSelect }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const togglePreview = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      try {
        await a.play()
        setPlaying(true)
      } catch {
        setPlaying(false)
      }
    } else {
      a.pause()
      setPlaying(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onSelect()
    }
  }

  const genderZh = T.voiceCard.genderValue[voice.gender] ?? ""

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      whileTap={{ scale: 0.98 }}
      transition={spring}
      className={cn(
        "relative w-full text-left rounded-[var(--radius-card)] p-3 outline-none cursor-pointer",
        "focus-visible:[box-shadow:0_0_0_3px_var(--brand-glow)]",
      )}
      style={{
        background: "var(--glass-regular-bg)",
        backdropFilter: "blur(var(--glass-regular-blur)) saturate(180%)",
        WebkitBackdropFilter: "blur(var(--glass-regular-blur)) saturate(180%)",
        border: "1px solid var(--glass-regular-border)",
        boxShadow: "var(--glass-inset-highlight)",
      }}
    >
      <AnimatePresence>
        {selected && (
          <motion.span
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring}
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            style={{
              boxShadow:
                "inset 0 0 0 1.5px var(--brand), 0 0 24px var(--brand-glow)",
            }}
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-center gap-2">
        <span className="font-medium text-[14px] text-[var(--text-primary)]">
          {voice.display_name}
        </span>
        {selected && (
          <Check
            className="size-3.5"
            style={{ color: "var(--brand)" }}
            aria-label={T.voiceCard.selected}
          />
        )}
        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={spring}
          onClick={togglePreview}
          aria-label={playing ? T.voiceCard.pausePreview : T.voiceCard.preview}
          className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-thin-bg)] transition-colors"
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </motion.button>
      </div>

      <div className="relative mt-1.5 flex flex-wrap gap-1">
        {genderZh && (
          <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
            {genderZh}
          </Badge>
        )}
        <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
          {formatLanguage(voice.language)}
        </Badge>
        {voice.accent && voice.accent !== "Unknown" && (
          <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
            {voice.accent}
          </Badge>
        )}
        {AGE_ZH[voice.age_group] && (
          <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
            {AGE_ZH[voice.age_group]}
          </Badge>
        )}
      </div>

      {voice.description && (
        <p className="relative mt-1.5 text-[12px] text-[var(--text-secondary)] leading-snug">
          {voice.description}
        </p>
      )}

      <audio
        ref={audioRef}
        src={api.previewUrl(voice.id)}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        preload="none"
        hidden
      />
    </motion.div>
  )
}
