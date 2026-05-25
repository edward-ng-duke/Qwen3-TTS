import { Trash2 } from "lucide-react"
import type { KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import type { HistoryItem as TItem } from "@/lib/db"
import { useComposerStore } from "@/stores/useComposerStore"
import { formatRelativeTime, truncate } from "@/lib/format"
import { voiceNameById } from "@/lib/voiceMeta"
import { EMOTION_ZH } from "@/lib/emotions"

interface Props {
  item: TItem
  onDelete: () => void
}

export function HistoryItem({ item, onDelete }: Props) {
  const loadFromHistory = useComposerStore((s) => s.loadFromHistory)
  const load = () =>
    loadFromHistory({
      text: item.text, language: item.language, speakerId: item.speakerId,
      emotion: item.emotion, customInstruct: item.customInstruct, seed: item.seed,
    })
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      load()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className="rounded-card border border-border bg-surface hover:bg-surface-2 p-3 cursor-pointer group transition"
      onClick={load}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className="text-text font-medium shrink-0">{voiceNameById(item.speakerId)}</span>
        {item.emotion === "Custom" && item.customInstruct?.trim() ? (
          <span
            className="min-w-0 truncate"
            title={item.customInstruct.trim()}
          >
            · ✨ {item.customInstruct.trim()}
          </span>
        ) : (
          <span className="shrink-0">· {EMOTION_ZH[item.emotion] ?? item.emotion}</span>
        )}
        <span className="ml-auto shrink-0">{formatRelativeTime(item.createdAt)}</span>
        <Button
          variant="ghost" size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-danger"
          aria-label="删除历史记录"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <p className="text-xs mt-1 leading-snug">{truncate(item.text, 60)}</p>
    </div>
  )
}
