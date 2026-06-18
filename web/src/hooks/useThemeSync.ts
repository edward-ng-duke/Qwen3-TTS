import { useEffect } from "react"
import { useUiStore } from "@/stores/useUiStore"

/** 把当前主题同步到 <html class>，供所有 Studio 共用。 */
export function useThemeSync(): void {
  const theme = useUiStore((s) => s.theme)
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.classList.toggle("light", theme === "light")
  }, [theme])
}
