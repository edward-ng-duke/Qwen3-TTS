import type { ReactNode } from "react"
import { Moon, Sun, Sparkles } from "lucide-react"
import { AuroraBackground } from "@/components/AuroraBackground"
import { Link } from "@/lib/router"
import { useUiStore } from "@/stores/useUiStore"

/** Minimal chrome for the public (no-login) gallery & share pages. */
export function PublicShell({ children }: { children: ReactNode }) {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)

  return (
    <div className="relative min-h-dvh text-[var(--text-primary)] pb-[calc(2rem+var(--safe-bottom))]">
      <AuroraBackground />
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 backdrop-blur-md"
        style={{ borderBottom: "1px solid var(--glass-thin-border)", background: "var(--glass-thin-bg)" }}>
        <Link to="/gallery" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-full text-white"
            style={{ background: "var(--brand-gradient)" }}>微</span>
          <span>微趣 · 画廊</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1.5 text-[13px]">
          <Link to="/gallery"
            className="rounded-full px-3 py-1.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
            画廊
          </Link>
          <Link to="/"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium text-white"
            style={{ background: "var(--brand-gradient)", boxShadow: "0 6px 18px var(--brand-glow)" }}>
            <Sparkles className="size-3.5" /> 去工作台
          </Link>
          <button type="button" aria-label="切换主题"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="grid h-9 w-9 place-items-center rounded-full text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            style={{ background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </nav>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
