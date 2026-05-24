import { useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { Play, Pause, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { VoiceInfo } from "@/lib/api"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { formatLanguage } from "@/lib/format"

const GENDER_ZH: Record<string, string> = { female: "女", male: "男", unknown: "" }
const AGE_ZH: Record<string, string> = { young: "青年", adult: "成年", senior: "年长", child: "儿童" }

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

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        "w-full text-left rounded-card border p-3 transition outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        selected
          ? "border-accent bg-accent/5"
          : "border-border bg-surface hover:bg-surface-2"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{voice.display_name}</span>
        {selected && <Check className="size-3.5 text-accent" />}
        <Button
          variant="ghost" size="icon"
          onClick={togglePreview}
          aria-label={playing ? "暂停" : "试听"}
          className="ml-auto h-7 w-7"
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </Button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {GENDER_ZH[voice.gender] && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">{GENDER_ZH[voice.gender]}</Badge>
        )}
        <Badge variant="secondary" className="text-xs px-1.5 py-0">{formatLanguage(voice.language)}</Badge>
        {voice.accent && voice.accent !== "Unknown" && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">{voice.accent}</Badge>
        )}
        {AGE_ZH[voice.age_group] && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">{AGE_ZH[voice.age_group]}</Badge>
        )}
      </div>
      {voice.description && (
        <p className="mt-1.5 text-xs text-text-muted leading-snug">{voice.description}</p>
      )}
      <audio
        ref={audioRef}
        src={api.previewUrl(voice.id)}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        preload="none"
        hidden
      />
    </div>
  )
}
