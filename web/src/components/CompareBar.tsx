import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { GitCompare, Loader2, Share2, Copy, ExternalLink, Check } from "lucide-react"
import { toast } from "sonner"
import { api, type ShareMetaVariant } from "@/lib/api"
import { useComposerStore } from "@/stores/useComposerStore"
import { useUiStore } from "@/stores/useUiStore"
import { ComparisonCard, type ComparisonColumn } from "@/components/ComparisonCard"
import { GlassCard } from "@/components/GlassCard"
import { EMOTION_PRESETS, EMOTION_ZH, emotionInstructFor } from "@/lib/emotions"
import { voiceNameById } from "@/lib/voiceMeta"
import { formatLanguage } from "@/lib/format"

type Axis = "voice" | "emotion" | "language" | "temperature" | "speed"
const MAX_PICKS = 4
const TEMP_PRESETS = [0.3, 0.6, 0.9, 1.2]
const SPEED_PRESETS = [0.8, 1.0, 1.2, 1.5]

const AXES: { key: Axis | "off"; label: string }[] = [
  { key: "off", label: "关闭" },
  { key: "voice", label: "按音色" },
  { key: "emotion", label: "按情绪" },
  { key: "language", label: "按语种" },
  { key: "temperature", label: "按随机度" },
  { key: "speed", label: "按语速" },
]

/** A share variant id must match [A-Za-z0-9_-]; temperature/speed picks have dots. */
function sanitizeVid(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32)
}

export function CompareBar() {
  const text = useComposerStore((s) => s.text)
  const language = useComposerStore((s) => s.language)
  const baseSpeaker = useComposerStore((s) => s.speakerId)
  const advanced = useUiStore((s) => s.advanced)
  const voicesQ = useQuery({ queryKey: ["voices"], queryFn: () => api.voices(), staleTime: 60_000 })
  const languagesQ = useQuery({ queryKey: ["languages"], queryFn: () => api.languages(), staleTime: 60_000 })

  const [axis, setAxis] = useState<Axis | null>(null)
  const [picks, setPicks] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [columns, setColumns] = useState<ComparisonColumn[] | null>(null)
  const [blobs, setBlobs] = useState<Record<string, Blob>>({})
  const [variants, setVariants] = useState<ShareMetaVariant[]>([])
  const [pubUrl, setPubUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const emotionOptions = EMOTION_PRESETS.filter((p) => p.name !== "Custom")
  const voiceOptions = voicesQ.data ?? []

  function chooseAxis(a: Axis | null) {
    setAxis(a)
    setPicks([])
    setColumns(null)
    setPubUrl(null)
  }

  function togglePick(id: string) {
    setColumns(null)
    setPubUrl(null)
    setPicks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id)
        : prev.length >= MAX_PICKS ? prev : [...prev, id])
  }

  async function onGenerate() {
    if (!axis || !text.trim() || picks.length < 2) return
    setBusy(true); setColumns(null); setPubUrl(null)
    try {
      const tasks = picks.map(async (pick) => {
        const vid = sanitizeVid(`${axis}-${pick}`)
        let blob: Blob
        let mv: ShareMetaVariant
        if (axis === "voice") {
          mv = { id: vid, label: voiceNameById(pick), voice: pick, language }
          ;({ blob } = await api.tts({ text, speaker: pick, language, sampling: advanced, response_format: "wav" }))
        } else if (axis === "emotion") {
          const inst = emotionInstructFor(pick, "")
          mv = { id: vid, label: EMOTION_ZH[pick] ?? pick, voice: baseSpeaker,
                 emotion: EMOTION_ZH[pick] ?? pick, instruct: inst || undefined }
          ;({ blob } = await api.tts({ text, speaker: baseSpeaker, language, instruct: inst || null, sampling: advanced, response_format: "wav" }))
        } else if (axis === "language") {
          mv = { id: vid, label: formatLanguage(pick), voice: baseSpeaker, language: pick }
          ;({ blob } = await api.tts({ text, speaker: baseSpeaker, language: pick, sampling: advanced, response_format: "wav" }))
        } else if (axis === "temperature") {
          const t = Number(pick)
          mv = { id: vid, label: `随机度 ${t}`, voice: baseSpeaker, temperature: t }
          ;({ blob } = await api.tts({ text, speaker: baseSpeaker, language, sampling: { ...advanced, temperature: t }, response_format: "wav" }))
        } else {
          // speed: native /v1/tts has no speed param; use the OpenAI-compatible
          // endpoint (librosa time-stretch). Base voice, no instruct — speed-only compare.
          const sp = Number(pick)
          mv = { id: vid, label: `${sp}×`, voice: baseSpeaker, speed: sp }
          ;({ blob } = await api.audioSpeech(text, baseSpeaker, sp))
        }
        return { vid, label: mv.label, blob, mv }
      })
      const settled = await Promise.all(tasks)
      const nextBlobs: Record<string, Blob> = {}
      const cols: ComparisonColumn[] = []
      const mvs: ShareMetaVariant[] = []
      for (const r of settled) {
        nextBlobs[r.vid] = r.blob
        cols.push({ id: r.vid, label: r.label, audioUrl: URL.createObjectURL(r.blob) })
        mvs.push(r.mv)
      }
      setBlobs(nextBlobs); setColumns(cols); setVariants(mvs)
    } catch (e) {
      toast.error(`并排生成失败：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function onPublish() {
    if (!axis || !columns) return
    try {
      const res = await api.publishShare({ text, dimension: axis, variants }, blobs)
      setPubUrl(window.location.origin + res.url)
      toast.success("已发布公开链接")
    } catch (e) {
      toast.error(`发布失败：${(e as Error).message}`)
    }
  }

  async function copyUrl() {
    if (!pubUrl) return
    try {
      await navigator.clipboard.writeText(pubUrl)
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    } catch { toast.error("复制失败") }
  }

  const languageOptions = (languagesQ.data ?? []).filter((l) => l.toLowerCase() !== "auto")
  const options: { id: string; label: string }[] =
    axis === "voice" ? voiceOptions.map((v) => ({ id: v.id, label: voiceNameById(v.id) }))
    : axis === "emotion" ? emotionOptions.map((e) => ({ id: e.name, label: `${e.emoji} ${EMOTION_ZH[e.name] ?? e.name}` }))
    : axis === "language" ? languageOptions.map((l) => ({ id: l, label: formatLanguage(l) }))
    : axis === "temperature" ? TEMP_PRESETS.map((t) => ({ id: String(t), label: `随机度 ${t}` }))
    : axis === "speed" ? SPEED_PRESETS.map((s) => ({ id: String(s), label: `${s}×` }))
    : []

  return (
    <GlassCard variant="thin" className="space-y-3 rounded-[var(--radius-card)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-secondary)]">
          <GitCompare className="size-3.5 text-[var(--brand)]" /> 对比模式
        </span>
        <div className="inline-flex gap-1 rounded-full p-0.5"
          style={{ background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}>
          {AXES.map((a) => {
            const active = (a.key === "off" && axis === null) || a.key === axis
            return (
              <button key={a.key} type="button"
                onClick={() => chooseAxis(a.key === "off" ? null : (a.key as Axis))}
                className="rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors"
                style={active
                  ? { background: "var(--brand-gradient)", color: "white", boxShadow: "0 4px 12px var(--brand-glow)" }
                  : { color: "var(--text-secondary)" }}>
                {a.label}
              </button>
            )
          })}
        </div>
        {axis && <span className="text-[11.5px] text-[var(--text-tertiary)]">选 2–{MAX_PICKS} 个并排听</span>}
      </div>

      {axis && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const active = picks.includes(o.id)
              return (
                <button key={o.id} type="button" onClick={() => togglePick(o.id)}
                  className="rounded-full px-3 py-1.5 text-[12.5px] transition-colors"
                  style={active
                    ? { background: "color-mix(in oklab, var(--brand) 16%, transparent)", color: "var(--text-primary)", border: "1px solid color-mix(in oklab, var(--brand) 40%, transparent)" }
                    : { background: "var(--glass-thin-bg)", color: "var(--text-secondary)", border: "1px solid var(--glass-thin-border)" }}>
                  {o.label}
                </button>
              )
            })}
          </div>

          <button type="button" onClick={onGenerate} disabled={busy || !text.trim() || picks.length < 2}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-white disabled:opacity-50"
            style={{ background: "var(--brand-gradient)", boxShadow: "0 6px 18px var(--brand-glow)" }}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <GitCompare className="size-4" />}
            {busy ? "并排生成中…" : `并排生成 ${picks.length || ""} 条`}
          </button>
          {!text.trim() && <span className="block text-[11.5px] text-[var(--text-tertiary)]">请先在上方输入合成文本</span>}
        </>
      )}

      {columns && (
        <div className="space-y-3 pt-1">
          <ComparisonCard text={text} dimension={axis!} columns={columns}
            footer={
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!pubUrl ? (
                  <button type="button" onClick={onPublish}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium text-white"
                    style={{ background: "var(--brand-gradient)", boxShadow: "0 6px 18px var(--brand-glow)" }}>
                    <Share2 className="size-3.5" /> 发布为公开链接
                  </button>
                ) : (
                  <div className="flex w-full flex-wrap items-center gap-2 rounded-full px-3 py-1.5"
                    style={{ background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-secondary)]" title={pubUrl}>{pubUrl}</span>
                    <button type="button" onClick={copyUrl} aria-label="复制链接"
                      className="inline-flex items-center gap-1 text-[12px] text-[var(--brand)]">
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "已复制" : "复制"}
                    </button>
                    <a href={pubUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                      <ExternalLink className="size-3.5" /> 打开
                    </a>
                  </div>
                )}
              </div>
            }
          />
        </div>
      )}
    </GlassCard>
  )
}
