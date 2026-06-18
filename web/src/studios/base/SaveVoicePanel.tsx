import { useState } from "react"
import { Save, Loader2, Download, CheckCircle2, ArrowRight } from "lucide-react"
import { api } from "@/lib/api"
import { useCloneStore } from "@/stores/useCloneStore"
import { downloadBlob } from "@/lib/audio"
import { T } from "@/lib/i18n"
import { toast } from "sonner"

export function SaveVoicePanel() {
  const refAudio = useCloneStore((s) => s.refAudio)
  const refAudioName = useCloneStore((s) => s.refAudioName)
  const refText = useCloneStore((s) => s.refText)
  const xVectorOnly = useCloneStore((s) => s.xVectorOnly)
  const savedVoice = useCloneStore((s) => s.savedVoice)
  const setSavedVoice = useCloneStore((s) => s.setSavedVoice)
  const setMode = useCloneStore((s) => s.setMode)
  const [saving, setSaving] = useState(false)

  const canSave = !!refAudio && (xVectorOnly || !!refText.trim())

  const onSave = async () => {
    if (!refAudio) return
    setSaving(true)
    try {
      const res = await api.saveVoice({
        refAudio,
        refAudioName,
        refText: refText.trim() || null,
        xVectorOnly,
      })
      setSavedVoice(res)
      toast.success(T.clone.savedOk)
    } catch (e) {
      toast.error(`保存失败：${e instanceof Error ? e.message : ""}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave || saving}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
        style={{ background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
        {saving ? T.clone.saving : T.clone.saveVoice}
      </button>

      {savedVoice && (
        <span
          className="inline-flex items-center gap-2 rounded-full pl-3 pr-1.5 py-1 text-[12px] text-[var(--text-secondary)]"
          style={{ background: "color-mix(in oklab, var(--brand) 10%, transparent)", border: "1px solid color-mix(in oklab, var(--brand) 22%, transparent)" }}
        >
          <CheckCircle2 className="size-3.5 text-[var(--brand)]" />
          <span className="truncate max-w-[120px]">{savedVoice.filename}</span>
          <button
            type="button"
            onClick={() => downloadBlob(savedVoice.blob, savedVoice.filename)}
            aria-label={T.clone.download}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Download className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMode("saved")}
            className="inline-flex items-center gap-1 rounded-full px-2.5 h-7 text-[12px] font-medium text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            {T.clone.useSaved} <ArrowRight className="size-3" />
          </button>
        </span>
      )}
    </div>
  )
}
