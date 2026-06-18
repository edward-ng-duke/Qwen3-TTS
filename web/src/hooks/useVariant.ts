import { useMemo } from "react"
import { useHealth } from "@/hooks/useVoices"
import type { ModelVariant } from "@/lib/api"

const VALID: readonly string[] = ["customvoice", "voicedesign", "base"]

/** ?variant= 覆盖（本地 dev / 一台后端截图三套用）→ VITE_FORCE_VARIANT 构建钉死。 */
function readOverride(): ModelVariant | undefined {
  try {
    const q = new URLSearchParams(window.location.search).get("variant")
    if (q && VALID.includes(q)) return q as ModelVariant
  } catch { /* ignore */ }
  const forced = import.meta.env.VITE_FORCE_VARIANT
  if (typeof forced === "string" && VALID.includes(forced)) return forced as ModelVariant
  return undefined
}

export type VariantStatus = "loading" | "ready" | "error"

/** 决定当前应渲染哪套 Studio：覆盖 > /v1/health.variant。 */
export function useVariant(): { variant: ModelVariant | undefined; status: VariantStatus } {
  const override = useMemo(() => readOverride(), [])
  const health = useHealth()

  if (override) return { variant: override, status: "ready" }
  const v = health.data?.variant
  if (v && VALID.includes(v)) return { variant: v, status: "ready" }
  if (health.isError) return { variant: undefined, status: "error" }
  return { variant: undefined, status: "loading" }
}
