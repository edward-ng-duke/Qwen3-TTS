import { useRef, useState, type ReactNode } from "react"
import { Play, Pause, Download, PlayCircle, SlidersHorizontal } from "lucide-react"
import { motion } from "motion/react"
import { GlassCard } from "@/components/GlassCard"
import { formatSeconds } from "@/lib/format"

const spring = { type: "spring", stiffness: 320, damping: 24 } as const

export interface ComparisonColumn {
  id: string
  label: string
  sublabel?: string
  audioUrl: string
  durationSec?: number
}

const DIMENSION_ZH: Record<string, string> = {
  voice: "按音色",
  emotion: "按情绪",
  language: "按语种",
  temperature: "按随机度",
  speed: "按语速",
}

interface ColumnViewProps {
  col: ComparisonColumn
  registerAudio: (id: string, el: HTMLAudioElement | null) => void
  onUseParams?: (id: string) => void
}

function ColumnView({ col, registerAudio, onUseParams }: ColumnViewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(col.durationSec ?? 0)

  const toggle = async () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      try { await a.play(); setPlaying(true) } catch { setPlaying(false) }
    } else {
      a.pause(); setPlaying(false)
    }
  }

  return (
    <div
      className="flex w-[180px] shrink-0 flex-col gap-2.5 rounded-[var(--radius-card)] p-3"
      style={{ background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}
    >
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]" title={col.label}>
          {col.label}
        </div>
        {col.sublabel && (
          <div className="truncate text-[11px] text-[var(--text-tertiary)]" title={col.sublabel}>
            {col.sublabel}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          onClick={toggle}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={spring}
          aria-label={playing ? "暂停" : "播放"}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: "var(--brand-gradient)", boxShadow: "0 6px 18px var(--brand-glow)" }}
        >
          {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
        </motion.button>
        <div className="min-w-0 flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "color-mix(in oklab, var(--text-primary) 14%, transparent)" }}>
            <div className="h-full rounded-full"
              style={{ width: `${progress * 100}%`, background: "var(--brand-gradient)" }} />
          </div>
          <div className="mt-1 text-right text-[10.5px] tabular-nums text-[var(--text-tertiary)]">
            {formatSeconds(duration)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <a
          href={col.audioUrl}
          download={`${col.id}.wav`}
          className="inline-flex min-h-8 flex-1 items-center justify-center gap-1 rounded-full text-[11.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          style={{ background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}
        >
          <Download className="size-3" /> 下载
        </a>
        {onUseParams && (
          <button
            type="button"
            onClick={() => onUseParams(col.id)}
            aria-label="用这套参数到工作台"
            title="用这套参数到工作台"
            className="inline-flex min-h-8 items-center justify-center rounded-full px-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            style={{ background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}
          >
            <SlidersHorizontal className="size-3.5" />
          </button>
        )}
      </div>

      <audio
        ref={(el) => { audioRef.current = el; registerAudio(col.id, el) }}
        src={col.audioUrl}
        preload="metadata"
        onLoadedMetadata={(e) => { if (e.currentTarget.duration) setDuration(e.currentTarget.duration) }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget
          setProgress(a.duration ? a.currentTime / a.duration : 0)
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0) }}
        hidden
      />
    </div>
  )
}

export function ComparisonCard({
  text,
  dimension,
  columns,
  onUseParams,
  footer,
}: {
  text: string
  dimension: string
  columns: ComparisonColumn[]
  onUseParams?: (id: string) => void
  footer?: ReactNode
}) {
  const audios = useRef<Map<string, HTMLAudioElement>>(new Map())
  const registerAudio = (id: string, el: HTMLAudioElement | null) => {
    if (el) audios.current.set(id, el)
    else audios.current.delete(id)
  }

  const playAll = () => {
    for (const a of audios.current.values()) {
      a.currentTime = 0
      void a.play().catch(() => {})
    }
  }

  return (
    <GlassCard variant="regular" className="space-y-4 rounded-[var(--radius-card)] p-4 sm:p-5">
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full px-2.5 py-1 text-[11px] font-medium text-[var(--brand)]"
          style={{
            background: "color-mix(in oklab, var(--brand) 10%, transparent)",
            border: "1px solid color-mix(in oklab, var(--brand) 18%, transparent)",
          }}>
          {DIMENSION_ZH[dimension] ?? dimension} · {columns.length} 条
        </span>
        <motion.button
          type="button"
          onClick={playAll}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          transition={spring}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-white"
          style={{ background: "var(--brand-gradient)", boxShadow: "0 6px 18px var(--brand-glow)" }}
        >
          <PlayCircle className="size-4" /> 全部同步播
        </motion.button>
      </header>

      <p className="min-w-0 break-words text-[14px] leading-relaxed text-[var(--text-primary)]">
        {text}
      </p>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {columns.map((col) => (
          <ColumnView key={col.id} col={col} registerAudio={registerAudio} onUseParams={onUseParams} />
        ))}
      </div>

      {footer}
    </GlassCard>
  )
}
