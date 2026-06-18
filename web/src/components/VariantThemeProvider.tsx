import { useEffect, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { variantTheme } from "@/lib/variantTheme"
import type { ModelVariant } from "@/lib/api"

const VARIANT_CLASSES = ["variant-voicedesign", "variant-base"] as const

/**
 * 给整套 Studio 子树套上变体强调色。
 *
 * 1) 用 `display:contents` 包裹器立即给 in-tree 内容上色（无首帧闪烁）；CSS 变量
 *    （--brand / --bg-aurora-* 等，见 globals.css 的 .variant-* 规则）被后代继承。
 * 2) 同时在 <html> 上挂同名 class（effect），让经 Radix Portal 渲染到 document.body
 *    的下拉/弹层（Select 等）也继承到变体强调色。
 */
export function VariantThemeProvider({
  variant,
  children,
}: {
  variant: ModelVariant
  children: ReactNode
}) {
  const cls = variantTheme(variant).className // customvoice 为空字符串

  useEffect(() => {
    const root = document.documentElement
    VARIANT_CLASSES.forEach((c) => root.classList.toggle(c, c === cls))
    return () => VARIANT_CLASSES.forEach((c) => root.classList.remove(c))
  }, [cls])

  return <div className={cn("contents", cls)}>{children}</div>
}
