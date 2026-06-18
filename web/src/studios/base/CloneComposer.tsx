import { useEffect, useMemo, useRef, useState } from "react"
import { Wand2, UploadCloud, FileCheck2 } from "lucide-react"
import { motion } from "motion/react"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GlassCard } from "@/components/GlassCard"
import { MagneticButton } from "@/components/MagneticButton"
import { SoundWave } from "@/components/SoundWave"
import { RefAudioInput } from "./RefAudioInput"
import { SampleVoices } from "./SampleVoices"
import { SaveVoicePanel } from "./SaveVoicePanel"
import { useCloneStore, type CloneMode } from "@/stores/useCloneStore"
import { useLanguages } from "@/hooks/useVoices"
import { useGenerateClone } from "@/hooks/useGenerateClone"
import { estimateGenerationMs, formatEtaSec, formatLanguage } from "@/lib/format"
import { T } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const islandSpring = { type: "spring", stiffness: 220, damping: 28 } as const

const inputWell = {
  background: "var(--input-well-bg)",
  border: "1px solid var(--input-well-border)",
  boxShadow: "var(--input-well-shadow)",
  color: "var(--text-primary)",
} as const

function Segmented<T extends string>({
  options, value, onChange, idBase,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; idBase: string }) {
  return (
    <div
      className="relative grid p-1 rounded-full"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))`, background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}
    >
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "relative min-h-10 sm:min-h-9 text-[12.5px] rounded-full select-none transition-colors",
              active ? "text-white font-medium" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {active && (
              <motion.span
                layoutId={`${idBase}-active`}
                aria-hidden
                className="absolute inset-0 rounded-full -z-0"
                style={{ background: "var(--brand-gradient)", boxShadow: "0 4px 14px var(--brand-glow)" }}
                transition={islandSpring}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function CloneComposer() {
  const s = useCloneStore()
  const { data: languages = ["Auto"] } = useLanguages()
  const gen = useGenerateClone()
  const ptInputRef = useRef<HTMLInputElement | null>(null)

  const langOptions = useMemo(() => {
    const seen = new Set<string>()
    return languages.filter((l) => {
      const k = l.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k); return true
    })
  }, [languages])

  const estimatedMs = useMemo(() => estimateGenerationMs(s.text.trim()), [s.text])
  const [elapsedMs, setElapsedMs] = useState(0)
  useEffect(() => {
    if (!gen.isPending) return
    const t0 = performance.now()
    const id = window.setInterval(() => setElapsedMs(performance.now() - t0), 100)
    return () => clearInterval(id)
  }, [gen.isPending])

  const refReady = s.mode === "saved"
    ? !!s.savedVoice
    : !!s.refAudio && (s.xVectorOnly || !!s.refText.trim())
  const canSubmit = !!s.text.trim() && refReady

  const blockReason = !s.text.trim()
    ? ""
    : s.mode === "saved"
      ? (!s.savedVoice ? T.clone.needSavedVoice : "")
      : !s.refAudio
        ? T.clone.needRefAudio
        : (!s.xVectorOnly && !s.refText.trim() ? T.clone.needRefText : "")

  const remainingMs = Math.max(0, estimatedMs - elapsedMs)
  const hintText = gen.isPending
    ? remainingMs > 200 ? `${T.composer.etaRemaining} ${formatEtaSec(remainingMs)}` : T.composer.etaAlmostDone
    : blockReason || (s.text.trim() && estimatedMs >= 1500
      ? `${T.composer.etaEstimate} ~${formatEtaSec(estimatedMs)} · ${T.composer.shortcutHint}`
      : T.composer.shortcutHint)

  const submit = () => {
    if (!canSubmit) return
    setElapsedMs(0)
    gen.mutate({
      mode: s.mode,
      text: s.text.trim(),
      language: s.language,
      seed: s.seed,
      refAudio: s.refAudio,
      refAudioName: s.refAudioName,
      refText: s.refText,
      xVectorOnly: s.xVectorOnly,
      label: s.refLabel || undefined,
      voicePrompt: s.savedVoice?.blob ?? null,
      voicePromptName: s.savedVoice?.filename,
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
        <div className="max-w-[20rem]">
          <Segmented<CloneMode>
            idBase="clone-mode"
            value={s.mode}
            onChange={s.setMode}
            options={[{ value: "instant", label: T.clone.modeInstant }, { value: "saved", label: T.clone.modeSaved }]}
          />
        </div>

        {s.mode === "instant" ? (
          <div className="space-y-4">
            <RefAudioInput />
            <SampleVoices />

            <div className="space-y-2">
              <div className="max-w-[24rem]">
                <Segmented<"icl" | "xvec">
                  idBase="clone-mode-icl"
                  value={s.xVectorOnly ? "xvec" : "icl"}
                  onChange={(v) => s.setXVectorOnly(v === "xvec")}
                  options={[{ value: "icl", label: T.clone.iclLabel }, { value: "xvec", label: T.clone.xVectorLabel }]}
                />
              </div>
              {!s.xVectorOnly && (
                <div>
                  <label htmlFor="clone-reftext" className="block text-[12px] font-medium text-[var(--text-secondary)]">
                    {T.clone.refTextLabel}
                  </label>
                  <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">{T.clone.refTextHelper}</p>
                  <Textarea
                    id="clone-reftext"
                    value={s.refText}
                    onChange={(e) => s.setRefText(e.target.value)}
                    placeholder={T.clone.refTextPlaceholder}
                    className="mt-1.5 min-h-[64px] resize-y rounded-[var(--radius-input)] text-base sm:text-[14px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[var(--text-secondary)]"
                    style={inputWell}
                  />
                </div>
              )}
            </div>

            <SaveVoicePanel />
            <p className="text-[11px] text-[var(--text-tertiary)] leading-snug">{T.clone.savedHint}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="block text-[13px] font-semibold text-[var(--text-primary)]">{T.clone.modeSaved}</span>
            {s.savedVoice ? (
              <div
                className="rounded-[var(--radius-input)] p-3 flex items-center gap-3"
                style={inputWell}
              >
                <FileCheck2 className="size-5 shrink-0 text-[var(--brand)]" />
                <p className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-primary)]">{s.savedVoice.filename}</p>
                <button
                  type="button"
                  onClick={() => ptInputRef.current?.click()}
                  className="shrink-0 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-2"
                >
                  更换
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => ptInputRef.current?.click()}
                className="w-full rounded-[var(--radius-input)] p-4 flex flex-col items-center gap-2 text-center transition-colors"
                style={{ background: "var(--input-well-bg)", border: "1.5px dashed var(--input-well-border)", boxShadow: "var(--input-well-shadow)" }}
              >
                <UploadCloud className="size-6 text-[var(--brand)]" />
                <span className="text-[13px] text-[var(--text-secondary)]">{T.clone.uploadPt}</span>
              </button>
            )}
            <input
              ref={ptInputRef}
              type="file"
              accept=".pt"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) s.setSavedVoice({ blob: f, filename: f.name })
                e.currentTarget.value = ""
              }}
            />
          </div>
        )}

        {/* 合成文本 */}
        <div>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <label htmlFor="clone-text" className="block text-[14px] font-semibold text-[var(--text-primary)]">
              {T.clone.textLabel}
            </label>
            <div
              className="shrink-0 rounded-full px-2.5 py-1 text-[12px] tabular-nums text-[var(--text-tertiary)]"
              style={{ background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}
            >
              {s.text.length} 字
            </div>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-tertiary)]">{T.clone.textHelper}</p>
          <div className="mt-2 rounded-[var(--radius-input)] transition-shadow duration-200 focus-within:[box-shadow:0_0_0_4px_var(--brand-glow)]">
            <Textarea
              id="clone-text"
              value={s.text}
              onChange={(e) => s.setText(e.target.value)}
              placeholder={T.composer.placeholder}
              className="min-h-[110px] sm:min-h-[150px] resize-y rounded-[var(--radius-input)] text-base sm:text-[15px] leading-relaxed border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[var(--text-secondary)]"
              style={inputWell}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit() } }}
            />
          </div>
        </div>

        <div className="max-w-[12rem]">
          <span className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)]">{T.composer.languageLabel}</span>
          <Select value={s.language} onValueChange={s.setLanguage}>
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
                <span className="ml-1">{T.clone.submitting}</span>
              </>
            ) : (
              <>
                <Wand2 className="size-4" />
                <span>{T.clone.submit}</span>
              </>
            )}
          </MagneticButton>
          <span
            className="text-[12px] text-[var(--text-tertiary)] tabular-nums text-center sm:text-left"
            aria-live={gen.isPending ? "polite" : undefined}
          >
            {hintText}
          </span>
        </div>
      </GlassCard>
    </motion.section>
  )
}
