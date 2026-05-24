import { cn } from "@/lib/utils"

export interface EmotionPreset {
  emoji: string
  name: string
  instruct: string
}

export const EMOTION_PRESETS: EmotionPreset[] = [
  { emoji: "😐", name: "Neutral",  instruct: "" },
  { emoji: "😊", name: "Happy",    instruct: "Speak in a happy and cheerful tone." },
  { emoji: "😢", name: "Sad",      instruct: "Speak in a sad and melancholic tone." },
  { emoji: "😡", name: "Angry",    instruct: "Speak in an angry and intense tone." },
  { emoji: "😨", name: "Fearful",  instruct: "Speak in a fearful and trembling tone." },
  { emoji: "😴", name: "Calm",     instruct: "Speak in a calm and soothing tone." },
  { emoji: "✨", name: "Custom",   instruct: "" },
]

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

export function emotionInstructFor(name: string, customInstruct: string): string {
  if (name === "Custom") return (customInstruct ?? "").trim()
  return EMOTION_PRESETS.find((p) => p.name === name)?.instruct ?? ""
}
