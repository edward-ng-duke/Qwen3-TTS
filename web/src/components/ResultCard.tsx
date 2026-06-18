import { useEffect, useMemo, useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { Play, Pause, Download, RotateCcw, Copy, Trash2 } from "lucide-react"
import { motion } from "motion/react"
import type { HistoryItem } from "@/lib/db"
import { useComposerStore } from "@/stores/useComposerStore"
import { useStudioApi } from "@/lib/studioContext"
import { downloadBlob } from "@/lib/audio"
import { formatLanguage, formatRelativeTime, formatSeconds, truncate } from "@/lib/format"
import { toast } from "sonner"
import { emotionInstructFor, EMOTION_EMOJI, EMOTION_ZH } from "@/lib/emotions"
import { voiceNameById } from "@/lib/voiceMeta"
import { GlassCard } from "@/components/GlassCard"
import { T } from "@/lib/i18n"

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
      className="inline-flex min-h-11 sm:min-h-8 sm:h-8 items-center gap-1 px-3.5 sm:px-3 rounded-full text-[12.5px] transition-colors"
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
  const studio = useStudioApi()
  const loadFromHistory = useComposerStore((s) => s.loadFromHistory)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [seekHover, setSeekHover] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const canExpand = item.text.length > 120

  const kind = item.kind ?? "customvoice"
  const leadLabel =
    kind === "design" ? "声音设计"
      : kind === "clone" ? (item.label || "声音克隆")
      : voiceNameById(item.speakerId ?? "")

  useEffect(() => {
    const u = URL.createObjectURL(item.audioBlob)
    const a = audioRef.current
    if (a) a.src = u
    return () => {
      if (a && a.src === u) a.removeAttribute("src")
      URL.revokeObjectURL(u)
    }
  }, [item.audioBlob])

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
    // Studio-provided handler routes "reuse" to the active studio's store;
    // customvoice has no provider and falls back to the composer store.
    if (studio) {
      studio.reuse(item)
    } else {
      loadFromHistory({
        text: item.text,
        language: item.language,
        speakerId: item.speakerId ?? "vivian",
        emotion: item.emotion ?? "Neutral",
        customInstruct: item.customInstruct,
        seed: item.seed,
      })
    }
    toast.success("已载入到编辑器")
  }

  const onCopyCurl = async () => {
    const origin = window.location.origin
    let cmd: string
    if (item.kind === "design") {
      const body = JSON.stringify({
        text: item.text,
        instruct: item.instruct ?? "",
        language: item.language,
        response_format: ext,
        sampling: item.sampling ?? undefined,
        seed: item.seed ?? null,
      }, null, 2)
      cmd = `curl -X POST ${origin}/v1/tts/design \\
  -H 'Content-Type: application/json' \\
  --data-binary @- \\
  --output out.${ext} <<'JSON'
${body}
JSON`
    } else if (item.kind === "clone") {
      const lines = [
        `curl -X POST ${origin}/v1/clone \\`,
        `  -F text=${shellQuote(item.text)} \\`,
        `  -F ref_audio=@ref.wav \\`,
      ]
      if (!item.xVectorOnly && item.refText) lines.push(`  -F ref_text=${shellQuote(item.refText)} \\`)
      lines.push(`  -F x_vector_only=${item.xVectorOnly ? "true" : "false"} \\`)
      lines.push(`  -F language=${shellQuote(item.language)} \\`)
      if (item.seed != null) lines.push(`  -F seed=${item.seed} \\`)
      lines.push(`  --output out.${ext}`)
      cmd = lines.join("\n")
    } else {
      const instruct = emotionInstructFor(item.emotion ?? "Neutral", item.customInstruct ?? "") || null
      const body = JSON.stringify({
        text: item.text,
        speaker: item.speakerId,
        language: item.language,
        instruct,
        response_format: ext,
        sampling: item.sampling ?? undefined,
        seed: item.seed ?? null,
      }, null, 2)
      cmd = `curl -X POST ${origin}/v1/tts \\
  -H 'Content-Type: application/json' \\
  --data-binary @- \\
  --output out.${ext} <<'JSON'
${body}
JSON`
    }
    try {
      await writeClipboard(cmd)
      toast.success(T.results.copied)
    } catch {
      toast.error(T.results.copyFailed)
    }
  }

  const setAudioProgress = (ratio: number) => {
    const a = audioRef.current
    if (!a || !a.duration) return
    const next = Math.max(0, Math.min(1, ratio))
    a.currentTime = next * a.duration
    setProgress(next)
    setCurrentTime(a.currentTime)
  }

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = trackRef.current
    if (!t) return
    const rect = t.getBoundingClientRect()
    setAudioProgress((e.clientX - rect.left) / rect.width)
  }

  const onSeekKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return
    e.preventDefault()
    if (e.key === "Home") return setAudioProgress(0)
    if (e.key === "End") return setAudioProgress(1)
    setAudioProgress(progress + (e.key === "ArrowRight" ? 0.05 : -0.05))
  }

  return (
    <GlassCard
      variant="regular"
      className="max-w-[880px] mx-auto rounded-[var(--radius-card)] p-4 sm:p-5 space-y-4"
    >
      <header className="min-w-0 flex items-center gap-2 text-[12px] text-[var(--text-secondary)] flex-wrap">
        <span className="text-[var(--text-primary)] font-medium">{leadLabel}</span>
        <span className="text-[var(--text-tertiary)]">·</span>
        <span>{formatLanguage(item.language)}</span>
        {kind === "design" && item.instruct?.trim() ? (
          <>
            <span className="text-[var(--text-tertiary)]">·</span>
            <span className="min-w-0 max-w-full sm:max-w-[420px] truncate" title={item.instruct.trim()}>
              🎨 {truncate(item.instruct.trim(), 40)}
            </span>
          </>
        ) : kind === "clone" ? (
          <>
            <span className="text-[var(--text-tertiary)]">·</span>
            <span className="min-w-0 max-w-full sm:max-w-[420px] truncate" title={item.refText?.trim() || undefined}>
              {item.xVectorOnly ? "🎙 向量" : "🎙 ICL"}
              {item.refText?.trim() ? ` · ${truncate(item.refText.trim(), 32)}` : ""}
            </span>
          </>
        ) : item.emotion === "Custom" && item.customInstruct?.trim() ? (
          <>
            <span className="text-[var(--text-tertiary)]">·</span>
            <span className="min-w-0 max-w-full sm:max-w-[420px] truncate" title={item.customInstruct.trim()}>
              {EMOTION_EMOJI.Custom} {truncate(item.customInstruct.trim(), 40)}
            </span>
          </>
        ) : (
          <>
            <span className="text-[var(--text-tertiary)]">·</span>
            <span>
              {EMOTION_EMOJI[item.emotion ?? "Neutral"] ?? ""} {EMOTION_ZH[item.emotion ?? "Neutral"] ?? item.emotion}
            </span>
          </>
        )}
        <span className="text-[var(--text-tertiary)]">·</span>
        <span className="tabular-nums">{(item.generationMs / 1000).toFixed(2)} 秒</span>
        <span className="ml-auto max-[430px]:ml-0 text-[var(--text-tertiary)]">
          {formatRelativeTime(item.createdAt)}
        </span>
      </header>

      <div className="space-y-2">
        <p
          className="min-w-0 break-words text-[14px] leading-relaxed text-[var(--text-primary)]"
        >
          {expanded ? item.text : truncate(item.text, 120)}
        </p>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex min-h-9 items-center rounded-full px-3 text-[12px] font-medium text-[var(--brand)] transition-colors hover:text-[var(--text-primary)]"
            style={{
              background: "color-mix(in oklab, var(--brand) 8%, transparent)",
              border: "1px solid color-mix(in oklab, var(--brand) 16%, transparent)",
            }}
          >
            {expanded ? T.results.collapse : T.results.expand}
          </button>
        ) : null}
      </div>

      <div
        className="flex max-[430px]:flex-col items-stretch gap-2 rounded-2xl p-2 sm:pl-2 sm:pr-4 sm:py-2"
        style={{
          background: "color-mix(in oklab, var(--text-primary) 4%, transparent)",
          border: "1px solid color-mix(in oklab, var(--text-primary) 6%, transparent)",
        }}
      >
        <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3">
          <motion.button
            type="button"
            onClick={toggle}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={spring}
            aria-label={playing ? T.results.pause : T.results.play}
            className="inline-flex items-center justify-center w-11 h-11 sm:w-10 sm:h-10 rounded-full text-white shrink-0"
            style={{
              background: "var(--brand-gradient)",
              boxShadow: "0 6px 18px var(--brand-glow)",
            }}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
          </motion.button>

          <span
            className="text-[11.5px] text-[var(--text-secondary)] tabular-nums shrink-0 w-8 text-right"
            aria-hidden
          >
            {formatSeconds(currentTime)}
          </span>

          <div
            ref={trackRef}
            onClick={seekTo}
            onMouseEnter={() => setSeekHover(true)}
            onMouseLeave={() => setSeekHover(false)}
            onKeyDown={onSeekKeyDown}
            aria-label={T.a11y.seekProgress}
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="group relative min-w-0 flex-1 cursor-pointer py-4 sm:py-3"
          >
            <div
              className="h-1.5 rounded-full overflow-hidden transition-[height] group-hover:h-2"
              style={{
                background: "color-mix(in oklab, var(--text-primary) 14%, transparent)",
              }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "var(--brand-gradient)",
                  width: `${progress * 100}%`,
                  boxShadow: playing ? "0 0 12px var(--brand-glow)" : "none",
                }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.12, ease: "linear" }}
              />
            </div>
            {(playing || seekHover || progress > 0) && (
              <motion.span
                aria-hidden
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white"
                style={{
                  left: `${progress * 100}%`,
                  width: seekHover ? 14 : 12,
                  height: seekHover ? 14 : 12,
                  border: "2px solid var(--brand)",
                  boxShadow: "0 2px 10px var(--brand-glow)",
                }}
                transition={spring}
              />
            )}
          </div>

          <span className="text-[11.5px] text-[var(--text-tertiary)] tabular-nums shrink-0 w-8">
            {formatSeconds(item.audioDurationSec)}
          </span>
        </div>

        <audio
          ref={audioRef}
          onTimeUpdate={(e) => {
            const a = e.currentTarget
            setProgress(a.duration ? a.currentTime / a.duration : 0)
            setCurrentTime(a.currentTime)
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime(0) }}
          hidden
        />
      </div>

      <div className="flex min-w-0 items-center gap-2 sm:gap-1.5 flex-wrap">
        <ActionButton onClick={onDownload} label={T.results.download}>
          <Download className="size-3.5" /> {T.results.download}
        </ActionButton>
        <ActionButton onClick={onReuse} label={T.results.regenerate}>
          <RotateCcw className="size-3.5" /> {T.results.regenerate}
        </ActionButton>
        <ActionButton onClick={onCopyCurl} label={T.results.copyApi}>
          <Copy className="size-3.5" /> {T.results.copyApi}
        </ActionButton>
        <div className="hidden sm:block flex-1" />
        {onDelete && (
          <ActionButton onClick={onDelete} label={T.results.delete} danger>
            <Trash2 className="size-3.5" />
          </ActionButton>
        )}
      </div>
    </GlassCard>
  )
}

/** Single-quote a value for a shell -F field, escaping embedded single quotes. */
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
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
