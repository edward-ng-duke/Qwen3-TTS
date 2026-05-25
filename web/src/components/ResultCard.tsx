import { useEffect, useMemo, useRef, useState } from "react"
import { Play, Pause, Download, RotateCcw, Copy, Trash2 } from "lucide-react"
import { motion } from "motion/react"
import type { HistoryItem } from "@/lib/db"
import { useComposerStore } from "@/stores/useComposerStore"
import { downloadBlob, blobToObjectURL, revokeObjectURL } from "@/lib/audio"
import { formatLanguage, formatRelativeTime, formatSeconds, truncate } from "@/lib/format"
import { toast } from "sonner"
import { emotionInstructFor } from "@/lib/emotions"
import { GlassCard } from "@/components/GlassCard"
import { T } from "@/lib/i18n"

const EMOJI: Record<string, string> = {
  Neutral: "😐", Happy: "😊", Sad: "😢", Angry: "😡", Fearful: "😨", Calm: "😴", Custom: "✨",
}
const EMOTION_ZH: Record<string, string> = {
  Neutral: T.emotions.neutral,
  Happy: T.emotions.happy,
  Sad: T.emotions.sad,
  Angry: T.emotions.angry,
  Fearful: T.emotions.afraid,
  Calm: T.emotions.calm,
  Custom: T.emotions.custom,
}

const spring = { type: "spring", stiffness: 320, damping: 24 } as const

interface Props {
  item: HistoryItem
  onDelete?: () => void
}

function ActionButton({
  onClick,
  label,
  children,
  danger,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      transition={spring}
      aria-label={label}
      className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12.5px] transition-colors"
      style={{
        color: danger ? "oklch(0.65 0.22 25)" : "var(--text-secondary)",
        background: "var(--glass-thin-bg)",
        border: "1px solid var(--glass-thin-border)",
      }}
    >
      {children}
    </motion.button>
  )
}

export function ResultCard({ item, onDelete }: Props) {
  const loadFromHistory = useComposerStore((s) => s.loadFromHistory)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [seekHover, setSeekHover] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [expanded, setExpanded] = useState(false)

  const url = useMemo(() => blobToObjectURL(item.audioBlob), [item.audioBlob])
  useEffect(() => () => revokeObjectURL(url), [url])

  const ext = useMemo(
    () =>
      item.audioMime.includes("flac") ? "flac"
        : item.audioMime.includes("mp3") ? "mp3"
        : item.audioMime.includes("pcm") ? "pcm" : "wav",
    [item.audioMime],
  )

  const toggle = async () => {
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

  const onDownload = () =>
    downloadBlob(item.audioBlob, `weiqu-${item.id ?? Date.now()}.${ext}`)

  const onReuse = () => {
    loadFromHistory({
      text: item.text,
      language: item.language,
      speakerId: item.speakerId,
      emotion: item.emotion,
      customInstruct: item.customInstruct,
      seed: item.seed,
    })
    toast.success("已载入到编辑器")
  }

  const onCopyCurl = async () => {
    const instruct = emotionInstructFor(item.emotion, item.customInstruct ?? "") || null
    const body = JSON.stringify({
      text: item.text,
      speaker: item.speakerId,
      language: item.language,
      instruct,
      response_format: ext,
      sampling: item.sampling ?? undefined,
      seed: item.seed ?? null,
    }, null, 2)
    const cmd = `curl -X POST ${window.location.origin}/v1/tts \\
  -H 'Content-Type: application/json' \\
  --data-binary @- \\
  --output out.${ext} <<'JSON'
${body}
JSON`
    try {
      await writeClipboard(cmd)
      toast.success(T.results.copied)
    } catch {
      toast.error(T.results.copyFailed)
    }
  }

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    const t = trackRef.current
    if (!a || !t || !a.duration) return
    const rect = t.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    a.currentTime = ratio * a.duration
    setProgress(ratio)
  }

  return (
    <GlassCard
      variant="regular"
      className="max-w-[880px] mx-auto rounded-[var(--radius-card)] p-5 space-y-4"
    >
      <header className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] flex-wrap">
        <span className="text-[var(--text-primary)] font-medium">{item.speakerId}</span>
        <span className="text-[var(--text-tertiary)]">·</span>
        <span>{formatLanguage(item.language)}</span>
        <span className="text-[var(--text-tertiary)]">·</span>
        <span>
          {EMOJI[item.emotion] ?? ""} {EMOTION_ZH[item.emotion] ?? item.emotion}
        </span>
        <span className="text-[var(--text-tertiary)]">·</span>
        <span className="tabular-nums">{(item.generationMs / 1000).toFixed(2)} 秒</span>
        <span className="ml-auto text-[var(--text-tertiary)]">
          {formatRelativeTime(item.createdAt)}
        </span>
      </header>

      <p
        className="text-[14px] leading-relaxed text-[var(--text-primary)] cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? item.text : truncate(item.text, 120)}
      </p>

      <div className="flex items-center gap-3">
        <motion.button
          type="button"
          onClick={toggle}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={spring}
          aria-label={playing ? T.results.pause : T.results.play}
          className="inline-flex items-center justify-center w-11 h-11 rounded-full text-white shrink-0"
          style={{
            background: "var(--brand-gradient)",
            boxShadow: "0 6px 18px var(--brand-glow)",
          }}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
        </motion.button>

        <div
          ref={trackRef}
          onClick={seekTo}
          onMouseEnter={() => setSeekHover(true)}
          onMouseLeave={() => setSeekHover(false)}
          aria-label={T.a11y.seekProgress}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="relative flex-1 cursor-pointer py-3"
        >
          <div
            className="h-1 rounded-full"
            style={{ background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: "var(--brand-gradient)",
                width: `${progress * 100}%`,
              }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.12, ease: "linear" }}
            />
          </div>
          {(playing || seekHover) && (
            <motion.span
              aria-hidden
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white"
              style={{
                left: `${progress * 100}%`,
                boxShadow: "0 2px 8px var(--brand-glow)",
              }}
              layout
              transition={spring}
            />
          )}
        </div>

        <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums shrink-0">
          {formatSeconds(item.audioDurationSec)}
        </span>

        <audio
          ref={audioRef}
          src={url}
          onTimeUpdate={(e) => {
            const a = e.currentTarget
            setProgress(a.duration ? a.currentTime / a.duration : 0)
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setProgress(0) }}
          hidden
        />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <ActionButton onClick={onDownload} label={T.results.download}>
          <Download className="size-3.5" /> {T.results.download}
        </ActionButton>
        <ActionButton onClick={onReuse} label={T.results.regenerate}>
          <RotateCcw className="size-3.5" /> {T.results.regenerate}
        </ActionButton>
        <ActionButton onClick={onCopyCurl} label={T.results.copyApi}>
          <Copy className="size-3.5" /> {T.results.copyApi}
        </ActionButton>
        <div className="flex-1" />
        {onDelete && (
          <ActionButton onClick={onDelete} label={T.results.delete} danger>
            <Trash2 className="size-3.5" />
          </ActionButton>
        )}
      </div>
    </GlassCard>
  )
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  try {
    if (!document.execCommand("copy")) throw new Error("copy command failed")
  } finally {
    document.body.removeChild(textarea)
  }
}
