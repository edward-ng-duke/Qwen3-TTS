import { useEffect, useRef, useState } from "react"
import type { KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react"
import { Play, Pause, Check } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type { VoiceInfo } from "@/lib/api"
import { api } from "@/lib/api"
import { T } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { formatLanguage, formatAccent } from "@/lib/format"
import { voiceName, voiceDescription } from "@/lib/voiceMeta"

const AGE_ZH: Record<string, string> = {
  young: "青年",
  adult: "成年",
  senior: "年长",
  child: "儿童",
}

const spring = { type: "spring", stiffness: 300, damping: 26 } as const
const springCheck = { type: "spring", stiffness: 380, damping: 22 } as const

function VoiceChip({ children, tinted }: { children: ReactNode; tinted: boolean }) {
  return (
    <motion.span
      layout
      transition={spring}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] leading-[1.3] whitespace-nowrap"
      style={{
        background: tinted
          ? "linear-gradient(135deg, var(--brand-glow), oklch(1 0 0 / 0.08))"
          : "color-mix(in oklch, var(--text-primary) 6%, transparent)",
        border: `1px solid ${
          tinted
            ? "color-mix(in oklch, var(--brand) 35%, transparent)"
            : "color-mix(in oklch, var(--text-primary) 12%, transparent)"
        }`,
        color: tinted
          ? "color-mix(in oklch, var(--brand) 65%, var(--text-primary))"
          : "var(--text-secondary)",
        boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.4)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {children}
    </motion.span>
  )
}

interface PlayButtonProps {
  playing: boolean
  onClick: (e: ReactMouseEvent) => void
  reduce: boolean
}

function PlayButton({ playing, onClick, reduce }: PlayButtonProps) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      transition={spring}
      onClick={onClick}
      aria-label={playing ? T.voiceCard.pausePreview : T.voiceCard.preview}
      className="relative ml-auto inline-flex items-center justify-center w-7 h-7 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
    >
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: "var(--glass-thin-bg)",
          border: "1px solid var(--glass-thin-border)",
        }}
      />

      {playing && !reduce && (
        <>
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full pointer-events-none"
            initial={{ scale: 1, opacity: 0.55 }}
            animate={{ scale: 1.55, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            style={{ border: "1.5px solid var(--brand)" }}
          />
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full pointer-events-none"
            initial={{ scale: 1, opacity: 0.55 }}
            animate={{ scale: 1.55, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
            style={{ border: "1.5px solid var(--brand)" }}
          />
        </>
      )}

      <span className="relative inline-flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {playing ? (
            <motion.span
              key="pause"
              initial={{ rotate: -45, scale: 0.6, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 45, scale: 0.6, opacity: 0 }}
              transition={spring}
              className="inline-flex"
            >
              <Pause className="size-3.5" />
            </motion.span>
          ) : (
            <motion.span
              key="play"
              initial={{ rotate: -45, scale: 0.6, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 45, scale: 0.6, opacity: 0 }}
              transition={spring}
              className="inline-flex"
            >
              <Play className="size-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  )
}

interface Props {
  voice: VoiceInfo
  selected: boolean
  onSelect: () => void
}

export function VoiceCard({ voice, selected, onSelect }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [shimmerKey, setShimmerKey] = useState(0)
  const prevSelectedRef = useRef(selected)
  const reduceRaw = useReducedMotion()
  const reduce = !!reduceRaw

  useEffect(() => {
    if (selected && !prevSelectedRef.current && !reduce) {
      setShimmerKey((k) => k + 1)
    }
    prevSelectedRef.current = selected
  }, [selected, reduce])

  const togglePreview = async (e: ReactMouseEvent) => {
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

  const onMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (reduce) return
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`)
    el.style.setProperty("--my", `${e.clientY - rect.top}px`)
  }

  const genderZh = T.voiceCard.genderValue[voice.gender] ?? ""
  const hoverY = selected ? -3 : -2
  const baseY = selected ? -1 : 0

  return (
    <motion.div
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={onMouseMove}
      animate={reduce ? undefined : { y: hovered ? hoverY : baseY }}
      whileTap={{ scale: 0.985 }}
      transition={spring}
      className={cn(
        "relative w-full text-left rounded-[var(--radius-card)] p-3 outline-none cursor-pointer overflow-hidden",
      )}
      style={{
        background: "var(--glass-regular-bg)",
        backdropFilter: "blur(var(--glass-regular-blur)) saturate(180%)",
        WebkitBackdropFilter: "blur(var(--glass-regular-blur)) saturate(180%)",
        border: "1px solid var(--glass-regular-border)",
        boxShadow: hovered ? "var(--shadow-glass)" : "var(--glass-inset-highlight)",
        transition: "box-shadow var(--dur-base) var(--ease-premium)",
      }}
    >
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.85)" }}
      />

      {!reduce && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: selected
              ? "radial-gradient(180px circle at var(--mx, 50%) var(--my, 50%), var(--brand-glow), transparent 45%)"
              : "radial-gradient(180px circle at var(--mx, 50%) var(--my, 50%), oklch(1 0 0 / 0.08), transparent 45%)",
          }}
        />
      )}

      <AnimatePresence>
        {selected && (
          <motion.span
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            style={{
              background:
                "radial-gradient(120% 80% at 0% 0%, var(--brand-glow) 0%, transparent 60%)",
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <motion.span
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            style={{
              boxShadow:
                "inset 0 0 0 1px var(--brand), 0 0 0 1px color-mix(in oklch, var(--brand) 30%, transparent), 0 0 32px var(--brand-glow)",
            }}
          />
        )}
      </AnimatePresence>

      {!reduce && shimmerKey > 0 && (
        <motion.span
          aria-hidden
          key={shimmerKey}
          className="absolute inset-y-0 w-1/2 pointer-events-none"
          initial={{ x: "-120%" }}
          animate={{ x: "260%" }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background:
              "linear-gradient(105deg, transparent 30%, oklch(1 0 0 / 0.45) 50%, transparent 70%)",
            mixBlendMode: "soft-light",
          }}
        />
      )}

      <div className="relative flex items-center gap-2">
        <span className="font-medium text-[14px] text-[var(--text-primary)]">
          {voiceName(voice)}
        </span>
        <AnimatePresence>
          {selected && (
            <motion.span
              initial={{ scale: 0, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, rotate: 30, opacity: 0 }}
              transition={springCheck}
              className="inline-flex"
            >
              <Check
                className="size-3.5"
                style={{ color: "var(--brand)" }}
                aria-label={T.voiceCard.selected}
              />
            </motion.span>
          )}
        </AnimatePresence>

        <PlayButton playing={playing} onClick={togglePreview} reduce={reduce} />
      </div>

      <div className="relative mt-1.5 flex flex-wrap gap-1">
        {genderZh && <VoiceChip tinted={selected}>{genderZh}</VoiceChip>}
        <VoiceChip tinted={selected}>{formatLanguage(voice.language)}</VoiceChip>
        {formatAccent(voice.accent) && (
          <VoiceChip tinted={selected}>{formatAccent(voice.accent)}</VoiceChip>
        )}
        {AGE_ZH[voice.age_group] && (
          <VoiceChip tinted={selected}>{AGE_ZH[voice.age_group]}</VoiceChip>
        )}
      </div>

      {voiceDescription(voice) && (
        <p className="relative mt-1.5 text-[12px] text-[var(--text-secondary)] leading-snug">
          {voiceDescription(voice)}
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
