import { useHistory } from "@/hooks/useHistory"
import { ResultCard } from "./ResultCard"

export function ResultsStream() {
  const { items, remove } = useHistory()

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border p-10 text-center text-text-muted">
        <p className="text-sm">还没有生成记录。</p>
        <p className="text-xs mt-1">在上方输入文本后点击生成。</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ResultCard
          key={item.id}
          item={item}
          onDelete={() => item.id != null && remove(item.id)}
        />
      ))}
    </div>
  )
}
