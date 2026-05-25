import { useMemo } from "react"
import { Wand2 } from "lucide-react"
import { motion } from "motion/react"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GlassCard } from "@/components/GlassCard"
import { MagneticButton } from "@/components/MagneticButton"
import { useComposerStore } from "@/stores/useComposerStore"
import { useUiStore } from "@/stores/useUiStore"
import { useVoices, useLanguages } from "@/hooks/useVoices"
import { useGenerate } from "@/hooks/useGenerate"
import { EmotionPicker } from "./EmotionPicker"
import { VoicePill } from "./VoicePill"
import { SoundWave } from "./SoundWave"
import { formatLanguage } from "@/lib/format"
import { emotionInstructFor } from "@/lib/emotions"
import { T } from "@/lib/i18n"

const islandSpring = { type: "spring", stiffness: 220, damping: 28 } as const

export function Composer() {
  const composer = useComposerStore()
  const setPanelOpen = useUiStore((s) => s.setPanelOpen)
  const setPanelTab = useUiStore((s) => s.setPanelTab)
  const { data: voices = [] } = useVoices()
  const { data: languages = ["Auto"] } = useLanguages()
  const gen = useGenerate()

  const currentVoice = useMemo(
    () => voices.find((v) => v.id === composer.speakerId),
    [voices, composer.speakerId],
  )

  const langOptions = useMemo(() => {
    const seen = new Set<string>()
    return languages.filter((l) => {
      const k = l.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k); return true
    })
  }, [languages])

  const submit = () => {
    if (!composer.text.trim()) return
    gen.mutate({
      text: composer.text.trim(),
      speakerId: composer.speakerId,
      language: composer.language,
      emotionName: composer.emotionName,
      emotionInstruct: emotionInstructFor(composer.emotionName, composer.customInstruct) || null,
      customInstruct: composer.customInstruct,
      seed: composer.seed,
    })
  }

  return (
    <motion.section
      initial={{ y: 32, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={islandSpring}
      className="max-w-[880px] mx-auto"
    >
      <GlassCard
        variant="strong"
        className="rounded-[var(--radius-island)] p-5 md:p-7 space-y-4"
        style={{ boxShadow: "var(--shadow-elevate)" }}
      >
        <div
          className="rounded-[var(--radius-input)] transition-shadow duration-200 focus-within:[box-shadow:0_0_0_4px_var(--brand-glow)]"
        >
          <Textarea
            value={composer.text}
            onChange={(e) => composer.setText(e.target.value)}
            placeholder={T.composer.placeholder}
            className="min-h-[160px] resize-y rounded-[var(--radius-input)] text-[15px] leading-relaxed border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{
              background: "var(--glass-thin-bg)",
              backdropFilter: "blur(var(--glass-thin-blur))",
              WebkitBackdropFilter: "blur(var(--glass-thin-blur))",
              border: "1px solid var(--glass-thin-border)",
              color: "var(--text-primary)",
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault(); submit()
              }
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={composer.language} onValueChange={composer.setLanguage}>
            <SelectTrigger
              className="h-9 w-32 rounded-full border-0 px-3 text-[13px]"
              style={{
                background: "var(--glass-thin-bg)",
                backdropFilter: "blur(var(--glass-thin-blur))",
                WebkitBackdropFilter: "blur(var(--glass-thin-blur))",
                border: "1px solid var(--glass-thin-border)",
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {langOptions.map((l) => (
                <SelectItem key={l} value={l}>{formatLanguage(l)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <VoicePill
            voice={currentVoice}
            onClick={() => { setPanelTab("voices"); setPanelOpen(true) }}
          />
          <div className="ml-auto text-[12px] text-[var(--text-tertiary)] tabular-nums">
            {composer.text.length} 字
          </div>
        </div>

        <EmotionPicker
          value={composer.emotionName}
          onChange={composer.setEmotionName}
        />

        {composer.emotionName === "Custom" && (
          <Textarea
            value={composer.customInstruct}
            onChange={(e) => composer.setCustomInstruct(e.target.value)}
            placeholder={T.emotions.customPlaceholder}
            className="min-h-[60px] rounded-[var(--radius-input)] text-[14px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{
              background: "var(--glass-thin-bg)",
              backdropFilter: "blur(var(--glass-thin-blur))",
              WebkitBackdropFilter: "blur(var(--glass-thin-blur))",
              border: "1px solid var(--glass-thin-border)",
              color: "var(--text-primary)",
            }}
          />
        )}

        <div className="flex items-center gap-3 pt-1">
          <MagneticButton
            onClick={submit}
            disabled={!composer.text.trim() || gen.isPending}
          >
            {gen.isPending ? (
              <>
                <SoundWave color="white" />
                <span className="ml-1">{T.composer.submitting}</span>
              </>
            ) : (
              <>
                <Wand2 className="size-4" />
                <span>{T.composer.submit}</span>
              </>
            )}
          </MagneticButton>
          <span className="text-[12px] text-[var(--text-tertiary)] hidden sm:inline">
            {T.composer.shortcutHint}
          </span>
        </div>
      </GlassCard>
    </motion.section>
  )
}
