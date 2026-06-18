import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Loader2, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { api, ApiError, type RegenerateResult } from "@/lib/api"
import { ComparisonCard, type ComparisonColumn } from "@/components/ComparisonCard"
import { GlassCard } from "@/components/GlassCard"
import { PublicShell } from "@/pages/PublicShell"
import { Link, segmentAfter, usePath } from "@/lib/router"
import { columnsFromWork } from "@/lib/shareView"

const DIMENSION_ZH: Record<string, string> = {
  voice: "音色", emotion: "情绪", language: "语种", temperature: "随机度", speed: "语速", dialect: "方言",
}

function GalleryList() {
  const q = useQuery({ queryKey: ["gallery"], queryFn: () => api.gallery(), retry: false })

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[12px] uppercase tracking-wider text-[var(--text-tertiary)]">Qwen3-TTS · 能力画廊</p>
        <h1 className="mt-1 text-[24px] font-bold text-[var(--text-primary)]">一听就懂的语音能力展示</h1>
        <p className="mt-1 text-[14px] text-[var(--text-secondary)]">挑一个场景，点开就能对比着听——无需登录。</p>
      </div>

      {q.isLoading && (
        <div className="grid place-items-center py-20 text-[var(--text-secondary)]">
          <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
        </div>
      )}

      {!q.isLoading && (q.isError || (q.data && q.data.length === 0)) && (
        <GlassCard variant="regular" className="rounded-[var(--radius-card)] p-8 text-center">
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">画廊还没有内容</p>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            运行 <code className="rounded bg-[var(--glass-thin-bg)] px-1.5 py-0.5">scripts/seed-gallery.py</code> 预置展示场景，或回到工作台自己生成并发布。
          </p>
        </GlassCard>
      )}

      {q.data && q.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data.map((work) => (
            <Link key={work.slug} to={`/gallery/${work.slug}`}
              className="group block rounded-[var(--radius-card)] p-5 transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--glass-regular-bg)", border: "1px solid var(--glass-regular-border)", boxShadow: "var(--shadow-glass)" }}>
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2.5 py-1 text-[11px] font-medium text-[var(--brand)]"
                  style={{ background: "color-mix(in oklab, var(--brand) 10%, transparent)" }}>
                  按{DIMENSION_ZH[work.dimension] ?? work.dimension} · {work.variants.length} 条
                </span>
              </div>
              <h2 className="mt-3 text-[17px] font-semibold text-[var(--text-primary)]">
                {work.title || work.text}
              </h2>
              <p className="mt-1 line-clamp-1 text-[13px] text-[var(--text-secondary)]">“{work.text}”</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--brand)]">
                进入对比 <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function GalleryDetail({ slug }: { slug: string }) {
  const q = useQuery({ queryKey: ["share", slug], queryFn: () => api.share(slug), retry: false })
  const [newText, setNewText] = useState("")
  const [regen, setRegen] = useState<RegenerateResult | null>(null)
  const [busy, setBusy] = useState(false)

  const onRegenerate = async () => {
    const text = newText.trim()
    if (!text) return
    setBusy(true)
    try {
      const res = await api.regenerate(slug, text)
      setRegen(res)
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : "换一句失败"
      toast.error(typeof msg === "string" ? msg : "换一句失败")
    } finally {
      setBusy(false)
    }
  }

  const regenColumns: ComparisonColumn[] = (regen?.variants ?? []).map((v) => ({
    id: v.id,
    label: v.label,
    audioUrl: `data:audio/wav;base64,${v.audio_base64}`,
    durationSec: v.duration_ms / 1000,
  }))

  return (
    <div className="space-y-5">
      <Link to="/gallery" className="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        ← 返回画廊
      </Link>

      {q.isLoading && (
        <div className="grid place-items-center py-20 text-[var(--text-secondary)]">
          <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
        </div>
      )}
      {q.isError && (
        <GlassCard variant="regular" className="rounded-[var(--radius-card)] p-6 text-center text-[var(--text-primary)]">
          没找到这个场景。
        </GlassCard>
      )}

      {q.data && (
        <>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)]">{q.data.title || q.data.text}</h1>
          <ComparisonCard text={q.data.text} dimension={q.data.dimension} columns={columnsFromWork(q.data)} />

          <GlassCard variant="thin" className="space-y-3 rounded-[var(--radius-card)] p-4">
            <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
              <Wand2 className="size-4 text-[var(--brand)]" /> 换一句话试试
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onRegenerate() }}
                maxLength={50}
                placeholder="输入一句话（≤ 50 字），用同一组参数重听…"
                className="min-w-0 flex-1 rounded-full px-4 py-2 text-[14px] text-[var(--text-primary)] outline-none"
                style={{ background: "var(--input-well-bg)", border: "1px solid var(--input-well-border)" }}
              />
              <button type="button" onClick={onRegenerate} disabled={busy || !newText.trim()}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: "var(--brand-gradient)", boxShadow: "0 6px 18px var(--brand-glow)" }}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} 生成
              </button>
            </div>
          </GlassCard>

          {regen && (
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-[var(--text-secondary)]">你的新句子：</p>
              <ComparisonCard text={regen.text} dimension={q.data.dimension} columns={regenColumns} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function GalleryPage() {
  const path = usePath()
  const slug = segmentAfter(path, "/gallery")
  return <PublicShell>{slug ? <GalleryDetail slug={slug} /> : <GalleryList />}</PublicShell>
}
