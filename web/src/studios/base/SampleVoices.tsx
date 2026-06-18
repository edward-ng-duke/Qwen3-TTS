import { useState } from "react"
import { Loader2 } from "lucide-react"
import { CLONE_SAMPLES, type CloneSample } from "@/lib/cloneSamples"
import { useCloneStore } from "@/stores/useCloneStore"
import { formatLanguage } from "@/lib/format"
import { T } from "@/lib/i18n"
import { toast } from "sonner"

export function SampleVoices() {
  const setRefAudio = useCloneStore((s) => s.setRefAudio)
  const setRefText = useCloneStore((s) => s.setRefText)
  const setLanguage = useCloneStore((s) => s.setLanguage)
  const setXVectorOnly = useCloneStore((s) => s.setXVectorOnly)
  const refLabel = useCloneStore((s) => s.refLabel)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const pick = async (s: CloneSample) => {
    setLoadingId(s.id)
    try {
      const r = await fetch(s.file)
      if (!r.ok) throw new Error(String(r.status))
      const blob = await r.blob()
      setRefAudio(blob, `${s.id}.wav`, s.name)
      setRefText(s.refText)
      setLanguage(s.language)
      setXVectorOnly(false) // 样例自带文字稿 → 用 ICL 高保真
    } catch {
      toast.error("加载示例音频失败")
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{T.clone.samplesTitle}</span>
        <span className="text-[11px] text-[var(--text-tertiary)]">{T.clone.samplesHint}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CLONE_SAMPLES.map((s) => {
          const active = refLabel === s.name
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s)}
              disabled={loadingId != null}
              aria-pressed={active}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[12.5px] transition-colors disabled:opacity-60"
              style={{
                background: active ? "color-mix(in oklab, var(--brand) 14%, transparent)" : "var(--glass-thin-bg)",
                border: `1px solid ${active ? "color-mix(in oklab, var(--brand) 30%, transparent)" : "var(--glass-thin-border)"}`,
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {loadingId === s.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
              <span className="font-medium">{s.name}</span>
              <span className="text-[var(--text-tertiary)]">{s.genderAge.split(" · ")[0]} · {formatLanguage(s.language)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
