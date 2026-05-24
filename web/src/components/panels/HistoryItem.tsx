import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { HistoryItem as TItem } from "@/lib/db"
import { useComposerStore } from "@/stores/useComposerStore"
import { formatRelativeTime, truncate } from "@/lib/format"

interface Props {
  item: TItem
  onDelete: () => void
}

export function HistoryItem({ item, onDelete }: Props) {
  const loadFromHistory = useComposerStore((s) => s.loadFromHistory)
  return (
    <div
      className="rounded-card border border-border bg-surface hover:bg-surface-2 p-3 cursor-pointer group transition"
      onClick={() =>
        loadFromHistory({
          text: item.text, language: item.language, speakerId: item.speakerId,
          emotion: item.emotion, customInstruct: item.customInstruct, seed: item.seed,
        })
      }
    >
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className="text-text font-medium">{item.speakerId}</span>
        <span>· {item.emotion}</span>
        <span className="ml-auto">{formatRelativeTime(item.createdAt)}</span>
        <Button
          variant="ghost" size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-danger"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <p className="text-xs mt-1 leading-snug">{truncate(item.text, 60)}</p>
    </div>
  )
}
