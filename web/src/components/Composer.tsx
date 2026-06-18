import { useEffect, useMemo, useState } from "react"
import { Wand2, X } from "lucide-react"
import { motion } from "motion/react"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GlassCard } from "@/components/GlassCard"
import { MagneticButton } from "@/components/MagneticButton"
import { CompareBar } from "@/components/CompareBar"
import { useComposerStore } from "@/stores/useComposerStore"
import { useUiStore } from "@/stores/useUiStore"
import { useVoices, useLanguages } from "@/hooks/useVoices"
import { useGenerate } from "@/hooks/useGenerate"
import { EmotionPicker } from "./EmotionPicker"
import { VoicePill } from "./VoicePill"
import { SoundWave } from "./SoundWave"
import { estimateGenerationMs, formatEtaSec, formatLanguage } from "@/lib/format"
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

  const trimmedLen = composer.text.trim().length
  const estimatedMs = useMemo(
    () => estimateGenerationMs(composer.text.trim()),
    [composer.text],
  )

  const [elapsedMs, setElapsedMs] = useState(0)
  useEffect(() => {
    if (!gen.isPending) return
    const t0 = performance.now()
    const id = window.setInterval(() => {
      setElapsedMs(performance.now() - t0)
    }, 100)
    return () => clearInterval(id)
  }, [gen.isPending])

  const remainingMs = Math.max(0, estimatedMs - elapsedMs)
  const hintText = gen.isPending
    ? remainingMs > 200
      ? `${T.composer.etaRemaining} ${formatEtaSec(remainingMs)}`
      : T.composer.etaAlmostDone
    : trimmedLen > 0 && estimatedMs >= 1500
      ? `${T.composer.etaEstimate} ~${formatEtaSec(estimatedMs)} · ${T.composer.shortcutHint}`
      : T.composer.shortcutHint

  const submit = () => {
    if (!composer.text.trim()) return
    setElapsedMs(0)
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
        className="rounded-[var(--radius-island)] p-3 sm:p-5 md:p-7 space-y-4 sm:space-y-5"
        style={{ boxShadow: "var(--shadow-elevate)" }}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <label
              htmlFor="tts-text"
              className="block text-[14px] font-semibold text-[var(--text-primary)]"
            >
              {T.composer.textLabel}
            </label>
            <p className="mt-1 break-words text-[12px] leading-relaxed text-[var(--text-tertiary)]">
              {T.composer.textHelper}
            </p>
          </div>
          <div className="shrink-0 rounded-full px-2.5 py-1 text-[12px] tabular-nums text-[var(--text-tertiary)]"
            style={{
              background: "var(--glass-thin-bg)",
              border: "1px solid var(--glass-thin-border)",
            }}
          >
            {composer.text.length} 字
          </div>
        </div>
        <div
          className="rounded-[var(--radius-input)] transition-shadow duration-200 focus-within:[box-shadow:0_0_0_4px_var(--brand-glow)]"
        >
          <Textarea
            id="tts-text"
            value={composer.text}
            onChange={(e) => composer.setText(e.target.value)}
            placeholder={T.composer.placeholder}
            className="min-h-[120px] sm:min-h-[200px] resize-y rounded-[var(--radius-input)] text-base sm:text-[15px] leading-relaxed border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[var(--text-secondary)]"
            style={{
              background: "var(--input-well-bg)",
              border: "1px solid var(--input-well-border)",
              boxShadow: "var(--input-well-shadow)",
              color: "var(--text-primary)",
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault(); submit()
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">
              {T.composer.controlsLabel}
            </span>
            <span className="hidden sm:inline text-[12px] text-[var(--text-tertiary)]">
              {T.composer.shortcutHint}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(8rem,10rem)_minmax(0,1fr)]">
            <div className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)]">
                {T.composer.languageLabel}
              </span>
              <Select value={composer.language} onValueChange={composer.setLanguage}>
                <SelectTrigger
                  className="h-11 sm:h-9 w-full rounded-full border-0 px-3 text-base sm:text-[13px]"
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
            </div>
            <div className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)]">
                {T.composer.voiceLabel}
              </span>
              <VoicePill
                voice={currentVoice}
                onClick={() => { setPanelTab("voices"); setPanelOpen(true) }}
                className="w-full justify-start"
              />
            </div>
          </div>
        </div>

        <EmotionPicker
          value={composer.emotionName}
          onChange={composer.setEmotionName}
        />

        {composer.emotionName === "Custom" && (
          <div className="space-y-2">
            <Textarea
              value={composer.customInstruct}
              onChange={(e) => composer.setCustomInstruct(e.target.value)}
              placeholder={T.emotions.customPlaceholder}
              className="min-h-[72px] sm:min-h-[60px] rounded-[var(--radius-input)] text-base sm:text-[14px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[var(--text-secondary)]"
              style={{
                background: "var(--input-well-bg)",
                border: "1px solid var(--input-well-border)",
                boxShadow: "var(--input-well-shadow)",
                color: "var(--text-primary)",
              }}
            />
            <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="text-[var(--text-tertiary)] pr-1">
                {T.emotions.customSamplesHint}
              </span>
              {T.emotions.customSamples.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => composer.setCustomInstruct(s)}
                  className="min-h-10 sm:min-h-0 px-2.5 py-1 rounded-full border border-[var(--input-well-border)] bg-[var(--input-well-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pt-1">
          <MagneticButton
            onClick={submit}
            disabled={!composer.text.trim() || gen.isPending}
            fullWidth
            className="sm:w-auto"
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
          {gen.isPending && (
            <button
              type="button"
              onClick={() => gen.cancel()}
              className="inline-flex min-h-11 sm:min-h-9 items-center justify-center gap-1 rounded-full px-4 text-[13px] font-medium transition-colors"
              style={{
                color: "var(--danger)",
                background: "var(--glass-thin-bg)",
                border: "1px solid var(--glass-thin-border)",
              }}
            >
              <X className="size-3.5" /> 取消
            </button>
          )}
          <span
            className="text-[12px] text-[var(--text-tertiary)] hidden sm:inline tabular-nums"
            aria-live={gen.isPending ? "polite" : undefined}
          >
            {hintText}
          </span>
          <span
            className="text-center text-[12px] text-[var(--text-tertiary)] sm:hidden tabular-nums"
            aria-live={gen.isPending ? "polite" : undefined}
          >
            {hintText}
          </span>
        </div>
      </GlassCard>

      <CompareBar />
    </motion.section>
  )
}
