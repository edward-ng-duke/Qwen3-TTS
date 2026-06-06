import { AnimatePresence, motion } from "motion/react"
import { FileAudio2, Wand2 } from "lucide-react"
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
        className="max-w-[880px] mx-auto rounded-[var(--radius-card)] p-6 sm:p-10 text-center"
        style={{
          background: "var(--glass-thin-bg)",
          backdropFilter: "blur(var(--glass-thin-blur))",
          WebkitBackdropFilter: "blur(var(--glass-thin-blur))",
          border: "1.5px dashed var(--glass-regular-border)",
        }}
      >
        <span
          aria-hidden
          className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--brand)]"
          style={{
            background: "var(--glass-thin-bg)",
            border: "1px solid var(--glass-thin-border)",
          }}
        >
          <FileAudio2 className="size-5" />
        </span>
        <p className="break-words text-[15px] font-medium text-[var(--text-primary)]">
          {T.results.empty}
        </p>
        <p className="mx-auto mt-1.5 max-w-sm break-words text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {T.results.emptyHint}
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-[var(--text-tertiary)]"
          style={{
            background: "color-mix(in oklab, var(--brand) 8%, transparent)",
            border: "1px solid color-mix(in oklab, var(--brand) 16%, transparent)",
          }}
        >
          <Wand2 className="size-3.5" />
          {T.composer.submit}
        </div>
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
