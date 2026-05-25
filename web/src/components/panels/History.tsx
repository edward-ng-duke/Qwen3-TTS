import { useMemo } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { useHistory } from "@/hooks/useHistory"
import { HistoryItem } from "./HistoryItem"
import { formatGroupLabel } from "@/lib/format"
import { T } from "@/lib/i18n"

const itemSpring = { type: "spring", stiffness: 280, damping: 26 } as const

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
    return (
      <p className="text-[13px] text-[var(--text-secondary)]">
        {T.sidePanel.history.empty}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums">
          {items.length} 条
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("清空所有历史？")) clear()
          }}
        >
          {T.sidePanel.history.clearAll}
        </Button>
      </div>
      {groups.map(([label, rows]) => (
        <div key={label} className="space-y-2">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium">
            {label}
          </h3>
          <AnimatePresence mode="popLayout" initial={false}>
            {rows.map((it) => (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16, scale: 0.96 }}
                transition={itemSpring}
              >
                <HistoryItem
                  item={it}
                  onDelete={() => it.id != null && remove(it.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
