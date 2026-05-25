import { motion, useReducedMotion, type Variants } from "motion/react"
import { useVoices } from "@/hooks/useVoices"
import { useComposerStore } from "@/stores/useComposerStore"
import { VoiceCard } from "./VoiceCard"

const containerCinematic: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const itemCinematic: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 220, damping: 26, mass: 0.9 },
  },
}

const containerMinimal: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
}

const itemMinimal: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
}

export function VoiceLibrary() {
  const { data: voices = [], isLoading, error } = useVoices()
  const speakerId = useComposerStore((s) => s.speakerId)
  const setSpeakerId = useComposerStore((s) => s.setSpeakerId)
  const reduce = useReducedMotion()
  const container = reduce ? containerMinimal : containerCinematic
  const item = reduce ? itemMinimal : itemCinematic

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
