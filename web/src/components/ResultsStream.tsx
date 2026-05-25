import { AnimatePresence, motion } from "motion/react"
import { useHistory } from "@/hooks/useHistory"
import { ResultCard } from "./ResultCard"
import { T } from "@/lib/i18n"

const cardSpring = { type: "spring", stiffness: 280, damping: 26 } as const

export function ResultsStream() {
  const { items, remove } = useHistory()

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-[880px] mx-auto rounded-[var(--radius-card)] p-10 text-center"
        style={{
          background: "var(--glass-thin-bg)",
          backdropFilter: "blur(var(--glass-thin-blur))",
          WebkitBackdropFilter: "blur(var(--glass-thin-blur))",
          border: "1.5px dashed var(--glass-regular-border)",
        }}
      >
        <p className="text-[14px] text-[var(--text-secondary)]">
          {T.results.empty}
        </p>
        <p className="text-[12px] mt-1.5 text-[var(--text-tertiary)]">
          在上方输入文本后点击「{T.composer.submit}」。
        </p>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.94, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
            transition={cardSpring}
          >
            <ResultCard
              item={item}
              onDelete={() => item.id != null && remove(item.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
