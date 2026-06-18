import { useEffect, useMemo, useState } from "react"
import { Wand2, Palette } from "lucide-react"
import { motion } from "motion/react"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GlassCard } from "@/components/GlassCard"
import { MagneticButton } from "@/components/MagneticButton"
import { SoundWave } from "@/components/SoundWave"
import { useDesignStore } from "@/stores/useDesignStore"
import { useLanguages } from "@/hooks/useVoices"
import { useGenerateDesign } from "@/hooks/useGenerateDesign"
import { estimateGenerationMs, formatEtaSec, formatLanguage } from "@/lib/format"
import { T } from "@/lib/i18n"

const islandSpring = { type: "spring", stiffness: 220, damping: 28 } as const

const inputWell = {
  background: "var(--input-well-bg)",
  border: "1px solid var(--input-well-border)",
  boxShadow: "var(--input-well-shadow)",
  color: "var(--text-primary)",
} as const

export function DesignComposer() {
  const design = useDesignStore()
  const { data: languages = ["Auto"] } = useLanguages()
  const gen = useGenerateDesign()

  const langOptions = useMemo(() => {
    const seen = new Set<string>()
    return languages.filter((l) => {
      const k = l.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k); return true
    })
  }, [languages])

  const canSubmit = !!design.text.trim() && !!design.instruct.trim()
  const estimatedMs = useMemo(() => estimateGenerationMs(design.text.trim()), [design.text])

  const [elapsedMs, setElapsedMs] = useState(0)
  useEffect(() => {
    if (!gen.isPending) return
    const t0 = performance.now()
    const id = window.setInterval(() => setElapsedMs(performance.now() - t0), 100)
    return () => clearInterval(id)
  }, [gen.isPending])

  const remainingMs = Math.max(0, estimatedMs - elapsedMs)
  const hintText = gen.isPending
    ? remainingMs > 200
      ? `${T.composer.etaRemaining} ${formatEtaSec(remainingMs)}`
      : T.composer.etaAlmostDone
    : design.text.trim().length > 0 && estimatedMs >= 1500
      ? `${T.composer.etaEstimate} ~${formatEtaSec(estimatedMs)} · ${T.composer.shortcutHint}`
      : T.composer.shortcutHint

  const submit = () => {
    if (!canSubmit) return
    setElapsedMs(0)
    gen.mutate({
      text: design.text.trim(),
      instruct: design.instruct.trim(),
      language: design.language,
      seed: design.seed,
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
        {/* 声音描述（主角，置顶） */}
        <div>
          <label htmlFor="design-instruct" className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text-primary)]">
            <Palette className="size-4 text-[var(--brand)]" />
            {T.design.instructLabel}
          </label>
          <p className="mt-1 break-words text-[12px] leading-relaxed text-[var(--text-tertiary)]">
            {T.design.instructHelper}
          </p>
          <div className="mt-2 rounded-[var(--radius-input)] transition-shadow duration-200 focus-within:[box-shadow:0_0_0_4px_var(--brand-glow)]">
            <Textarea
              id="design-instruct"
              value={design.instruct}
              onChange={(e) => design.setInstruct(e.target.value)}
              placeholder={T.design.instructPlaceholder}
              className="min-h-[88px] sm:min-h-[96px] resize-y rounded-[var(--radius-input)] text-base sm:text-[15px] leading-relaxed border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[var(--text-secondary)]"
              style={inputWell}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="text-[var(--text-tertiary)] pr-1">{T.design.examplesHint}</span>
            {T.design.examples.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => design.setInstruct(s)}
                className="min-h-10 sm:min-h-0 px-2.5 py-1 rounded-full border border-[var(--input-well-border)] bg-[var(--input-well-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 合成文本 */}
        <div>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor="design-text" className="block text-[14px] font-semibold text-[var(--text-primary)]">
                {T.design.textLabel}
              </label>
              <p className="mt-1 break-words text-[12px] leading-relaxed text-[var(--text-tertiary)]">
                {T.design.textHelper}
              </p>
            </div>
            <div
              className="shrink-0 rounded-full px-2.5 py-1 text-[12px] tabular-nums text-[var(--text-tertiary)]"
              style={{ background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}
            >
              {design.text.length} 字
            </div>
          </div>
          <div className="mt-2 rounded-[var(--radius-input)] transition-shadow duration-200 focus-within:[box-shadow:0_0_0_4px_var(--brand-glow)]">
            <Textarea
              id="design-text"
              value={design.text}
              onChange={(e) => design.setText(e.target.value)}
              placeholder={T.composer.placeholder}
              className="min-h-[110px] sm:min-h-[150px] resize-y rounded-[var(--radius-input)] text-base sm:text-[15px] leading-relaxed border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[var(--text-secondary)]"
              style={inputWell}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit() }
              }}
            />
          </div>
        </div>

        {/* 语种 */}
        <div className="max-w-[12rem]">
          <span className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)]">
            {T.composer.languageLabel}
          </span>
          <Select value={design.language} onValueChange={design.setLanguage}>
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pt-1">
          <MagneticButton onClick={submit} disabled={!canSubmit || gen.isPending} fullWidth className="sm:w-auto">
            {gen.isPending ? (
              <>
                <SoundWave color="white" />
                <span className="ml-1">{T.design.submitting}</span>
              </>
            ) : (
              <>
                <Wand2 className="size-4" />
                <span>{T.design.submit}</span>
              </>
            )}
          </MagneticButton>
          <span
            className="text-[12px] text-[var(--text-tertiary)] tabular-nums text-center sm:text-left"
            aria-live={gen.isPending ? "polite" : undefined}
          >
            {!canSubmit && !gen.isPending ? T.design.needBoth : hintText}
          </span>
        </div>
      </GlassCard>
    </motion.section>
  )
}
