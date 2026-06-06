import { useMemo } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Clock3 } from "lucide-react"
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
      <div className="rounded-[var(--radius-card)] p-4 text-center"
        style={{
          background: "var(--glass-thin-bg)",
          border: "1px dashed var(--glass-regular-border)",
        }}
      >
        <Clock3 className="mx-auto mb-2 size-5 text-[var(--brand)]" />
        <p className="text-[13px] font-medium text-[var(--text-primary)]">
          {T.sidePanel.history.empty}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          每次合成后会自动保存文本、音色、情绪和参数，便于复用。
        </p>
      </div>
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
