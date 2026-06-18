import type { ModelVariant } from "@/lib/api"

export interface VariantTheme {
  /** globals.css 里对应的换肤 class（customvoice 用默认紫色，无 class）。 */
  className: string
  /** Topbar 左上角 logo 字形。 */
  logo: string
  /** 品牌副标题（"微趣 · {subtitle}"）。 */
  subtitle: string
}

export const VARIANT_THEME: Record<ModelVariant, VariantTheme> = {
  customvoice: { className: "", logo: "微", subtitle: "语音工作台" },
  voicedesign: { className: "variant-voicedesign", logo: "设", subtitle: "声音设计" },
  base: { className: "variant-base", logo: "克", subtitle: "声音克隆" },
}

export function variantTheme(v: ModelVariant | undefined): VariantTheme {
  return VARIANT_THEME[v ?? "customvoice"] ?? VARIANT_THEME.customvoice
}
