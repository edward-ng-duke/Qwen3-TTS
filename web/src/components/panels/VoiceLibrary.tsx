import { motion, useReducedMotion, type Variants } from "motion/react"
import { AlertCircle, Mic2 } from "lucide-react"
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
      <div className="space-y-2.5" aria-label="正在加载音色">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-[var(--radius-card)]"
            style={{
              background: "var(--glass-thin-bg)",
              border: "1px solid var(--glass-thin-border)",
            }}
          />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-[var(--radius-card)] p-4"
        style={{
          background: "oklch(0.65 0.22 25 / 0.08)",
          border: "1px solid oklch(0.65 0.22 25 / 0.22)",
        }}
      >
        <AlertCircle className="mb-2 size-4 text-[var(--danger)]" />
        <p className="break-words text-[13px] font-medium text-[var(--danger)]">
          音色加载失败
        </p>
        <p className="mt-1 break-words text-[12px] leading-relaxed text-[var(--text-secondary)]">
          {(error as Error).message}
        </p>
      </div>
    )
  }
  if (voices.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] p-4 text-center"
        style={{
          background: "var(--glass-thin-bg)",
          border: "1px dashed var(--glass-regular-border)",
        }}
      >
        <Mic2 className="mx-auto mb-2 size-5 text-[var(--brand)]" />
        <p className="text-[13px] font-medium text-[var(--text-primary)]">暂无可用音色</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          请确认后端模型已加载并返回音色列表。
        </p>
      </div>
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
