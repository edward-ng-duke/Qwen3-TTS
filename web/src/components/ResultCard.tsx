import { useEffect, useMemo, useRef, useState } from "react"
import { Play, Pause, Download, RotateCcw, Copy, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { HistoryItem } from "@/lib/db"
import { useComposerStore } from "@/stores/useComposerStore"
import { downloadBlob, blobToObjectURL, revokeObjectURL } from "@/lib/audio"
import { formatLanguage, formatRelativeTime, formatSeconds, truncate } from "@/lib/format"
import { toast } from "sonner"
import { emotionInstructFor } from "@/lib/emotions"

const EMOJI: Record<string, string> = {
  Neutral: "😐", Happy: "😊", Sad: "😢", Angry: "😡", Fearful: "😨", Calm: "😴", Custom: "✨",
}

interface Props {
  item: HistoryItem
  onDelete?: () => void
}

export function ResultCard({ item, onDelete }: Props) {
  const loadFromHistory = useComposerStore((s) => s.loadFromHistory)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [expanded, setExpanded] = useState(false)

  const url = useMemo(() => blobToObjectURL(item.audioBlob), [item.audioBlob])

  useEffect(() => {
    return () => revokeObjectURL(url)
  }, [url])


  const ext = useMemo(() => item.audioMime.includes("flac") ? "flac"
    : item.audioMime.includes("mp3") ? "mp3"
    : item.audioMime.includes("pcm") ? "pcm" : "wav", [item.audioMime])

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
      toast.success("已复制 cURL 命令")
    } catch { toast.error("剪贴板不可用") }
  }

  return (
    <article className="rounded-card border border-border bg-surface p-4 space-y-3">
      <header className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
        <span className="text-text font-medium">{item.speakerId}</span>
        <span>·</span>
        <span>{formatLanguage(item.language)}</span>
        <span>·</span>
        <span>{EMOJI[item.emotion] ?? ""} {item.emotion}</span>
        <span>·</span>
        <span>{(item.generationMs / 1000).toFixed(2)}s</span>
        <span className="ml-auto">{formatRelativeTime(item.createdAt)}</span>
      </header>
      <p
        className="text-sm leading-relaxed cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? item.text : truncate(item.text, 120)}
      </p>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggle} className="text-accent">
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-waveform transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-xs text-text-muted tabular-nums">
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
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onDownload} className="gap-1">
          <Download className="size-3.5" /> 下载
        </Button>
        <Button variant="ghost" size="sm" onClick={onReuse} className="gap-1">
          <RotateCcw className="size-3.5" /> 重新生成
        </Button>
        <Button variant="ghost" size="sm" onClick={onCopyCurl} className="gap-1">
          <Copy className="size-3.5" /> 复制 cURL
        </Button>
        <div className="flex-1" />
        {onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger gap-1">
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </article>
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
    if (!document.execCommand("copy")) {
      throw new Error("copy command failed")
    }
  } finally {
    document.body.removeChild(textarea)
  }
}
