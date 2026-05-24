import { Mic } from "lucide-react"
import type { VoiceInfo } from "@/lib/api"
import { cn } from "@/lib/utils"

interface Props {
  voice?: VoiceInfo
  onClick?: () => void
  className?: string
}

export function VoicePill({ voice, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 h-9 px-3 rounded-btn border border-border bg-surface-2 hover:bg-surface text-sm transition",
        className
      )}
    >
      <Mic className="size-3.5 text-accent" />
      <span className="font-medium">{voice?.display_name ?? "选择音色"}</span>
      {voice && (
        <span className="text-text-muted text-xs">· {voice.language}</span>
      )}
    </button>
  )
}
