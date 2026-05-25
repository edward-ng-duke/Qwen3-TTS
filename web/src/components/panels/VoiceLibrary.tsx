import { motion, type Variants } from "motion/react"
import { useVoices } from "@/hooks/useVoices"
import { useComposerStore } from "@/stores/useComposerStore"
import { VoiceCard } from "./VoiceCard"

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 24 },
  },
}

export function VoiceLibrary() {
  const { data: voices = [], isLoading, error } = useVoices()
  const speakerId = useComposerStore((s) => s.speakerId)
  const setSpeakerId = useComposerStore((s) => s.setSpeakerId)

  if (isLoading) {
    return (
      <p className="text-[13px] text-[var(--text-secondary)]">加载音色中…</p>
    )
  }
  if (error) {
    return (
      <p className="text-[13px] text-[oklch(0.65_0.22_25)]">
        音色加载失败：{(error as Error).message}
      </p>
    )
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-2.5"
    >
      {voices.map((v) => (
        <motion.div key={v.id} variants={item}>
          <VoiceCard
            voice={v}
            selected={v.id === speakerId}
            onSelect={() => setSpeakerId(v.id)}
          />
        </motion.div>
      ))}
    </motion.div>
  )
}
