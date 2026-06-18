import { useQuery } from "@tanstack/react-query"
import { Loader2, Sparkles } from "lucide-react"
import { api, ApiError } from "@/lib/api"
import { ComparisonCard } from "@/components/ComparisonCard"
import { GlassCard } from "@/components/GlassCard"
import { PublicShell } from "@/pages/PublicShell"
import { Link, segmentAfter, usePath } from "@/lib/router"
import { columnsFromWork } from "@/lib/shareView"

export function SharePage() {
  const path = usePath()
  const slug = segmentAfter(path, "/share")
  const q = useQuery({
    queryKey: ["share", slug],
    queryFn: () => api.share(slug),
    enabled: !!slug,
    retry: false,
  })

  return (
    <PublicShell>
      {q.isLoading && (
        <div className="grid place-items-center py-24 text-[var(--text-secondary)]">
          <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
        </div>
      )}

      {q.isError && (
        <GlassCard variant="regular" className="mx-auto max-w-md rounded-[var(--radius-card)] p-6 text-center">
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">
            {q.error instanceof ApiError && q.error.status === 404 ? "这个分享不存在或已下架" : "加载失败"}
          </p>
          <Link to="/gallery"
            className="mt-4 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[13px] font-medium text-white"
            style={{ background: "var(--brand-gradient)" }}>
            去看看画廊
          </Link>
        </GlassCard>
      )}

      {q.data && (
        <div className="space-y-5">
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[var(--text-tertiary)]">Qwen3-TTS · 对比作品</p>
            <h1 className="mt-1 text-[22px] font-bold text-[var(--text-primary)]">同一句话，听听不同表现</h1>
          </div>
          <ComparisonCard text={q.data.text} dimension={q.data.dimension} columns={columnsFromWork(q.data)} />
          <GlassCard variant="thin" className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] p-4">
            <span className="text-[13px] text-[var(--text-secondary)]">想自己也做一个？几秒钟就能生成属于你的对比。</span>
            <Link to="/"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-white"
              style={{ background: "var(--brand-gradient)", boxShadow: "0 6px 18px var(--brand-glow)" }}>
              <Sparkles className="size-3.5" /> 去工作台试试
            </Link>
          </GlassCard>
        </div>
      )}
    </PublicShell>
  )
}
