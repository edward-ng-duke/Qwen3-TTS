import { api, type ShareVariantOut, type ShareWork } from "@/lib/api"
import type { ComparisonColumn } from "@/components/ComparisonCard"
import { formatLanguage } from "@/lib/format"

/** Short distinguishing caption per column, based on the compared dimension. */
export function variantSublabel(v: ShareVariantOut, dimension: string): string {
  switch (dimension) {
    case "language":
      return v.language ? formatLanguage(v.language) : ""
    case "emotion":
      return v.emotion || (v.instruct ? v.instruct.slice(0, 18) : "")
    case "temperature":
      return v.temperature != null ? `随机度 ${v.temperature}` : ""
    case "speed":
      return v.speed != null ? `${v.speed}×` : ""
    case "dialect":
      return ""  // the dialect name is already the column label
    case "voice":
    default:
      return v.voice || ""
  }
}

export function columnsFromWork(work: ShareWork): ComparisonColumn[] {
  return work.variants.map((v) => ({
    id: v.id,
    label: v.label,
    sublabel: variantSublabel(v, work.dimension),
    audioUrl: api.shareAudioUrl(work.slug, v.id),
    durationSec: v.duration_ms ? v.duration_ms / 1000 : undefined,
    text: v.text ?? undefined,
  }))
}
