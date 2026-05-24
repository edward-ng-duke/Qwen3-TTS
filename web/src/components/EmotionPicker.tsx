import { cn } from "@/lib/utils"
import { EMOTION_PRESETS } from "@/lib/emotions"

const ZH_LABEL: Record<string, string> = {
  Neutral: "中性", Happy: "开心", Sad: "悲伤",
  Angry: "愤怒",   Fearful: "害怕", Calm: "平静", Custom: "自定义",
}

interface Props {
  value: string
  onChange: (name: string) => void
}

export function EmotionPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EMOTION_PRESETS.map((p) => (
        <button
          key={p.name}
          type="button"
          onClick={() => onChange(p.name)}
          className={cn(
            "inline-flex items-center gap-1 h-8 px-3 rounded-full text-sm border transition",
            value === p.name
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-surface-2 hover:bg-surface text-text-muted hover:text-text"
          )}
        >
          <span className="text-base leading-none">{p.emoji}</span>
          <span>{ZH_LABEL[p.name]}</span>
        </button>
      ))}
    </div>
  )
}
