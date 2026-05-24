import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { useHistory } from "@/hooks/useHistory"
import { HistoryItem } from "./HistoryItem"
import { formatGroupLabel } from "@/lib/format"

export function History() {
  const { items, clear, remove } = useHistory()

  const groups = useMemo(() => {
    const map = new Map<string, typeof items>()
    for (const it of items) {
      const k = formatGroupLabel(it.createdAt)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(it)
    }
    return Array.from(map.entries())
  }, [items])

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">还没有历史记录。</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{items.length} 条</span>
        <Button variant="ghost" size="sm" onClick={() => {
          if (confirm("清空所有历史？")) clear()
        }}>清空</Button>
      </div>
      {groups.map(([label, rows]) => (
        <div key={label} className="space-y-2">
          <h3 className="text-xs text-text-muted font-medium">{label}</h3>
          {rows.map((it) => (
            <HistoryItem
              key={it.id}
              item={it}
              onDelete={() => it.id != null && remove(it.id)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
