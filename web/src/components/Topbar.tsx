import { Moon, Sun, ExternalLink, PanelRightOpen, PanelRightClose } from "lucide-react"
import { motion } from "motion/react"
import { useUiStore } from "@/stores/useUiStore"
import { useHealth } from "@/hooks/useVoices"
import { GlassCard } from "@/components/GlassCard"
import { T } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> }
}

const spring = { type: "spring", stiffness: 260, damping: 24 } as const

function statusLabel(status: string | undefined, ready: boolean | undefined) {
  if (ready) return T.status.ready
  if (status === "loading") return T.status.loading
  return T.status.notReady
}

export function Topbar() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const panelOpen = useUiStore((s) => s.panelOpen)
  const togglePanel = useUiStore((s) => s.togglePanel)
  const { data: health } = useHealth()
  const ready = !!health?.model_ready

  const onToggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    const doc = document as DocumentWithViewTransition
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => setTheme(next))
    } else {
      setTheme(next)
    }
  }

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-40 px-3 w-[min(960px,calc(100%-1.5rem))]"
    >
      <GlassCard
        variant="strong"
        className="rounded-[var(--radius-pill)] px-3 py-1.5 flex items-center gap-2"
      >
        <span
          aria-hidden
          className="inline-flex w-7 h-7 items-center justify-center rounded-full text-white text-sm font-semibold"
          style={{ background: "var(--brand-gradient)", boxShadow: "0 4px 12px var(--brand-glow)" }}
        >
          微
        </span>
        <div className="flex items-baseline gap-1.5 select-none">
          <span className="font-semibold tracking-tight text-[15px] text-[var(--text-primary)]">
            {T.brand.name}
          </span>
          <span className="text-[var(--text-tertiary)]" aria-hidden>·</span>
          <span className="text-[13px] text-[var(--text-secondary)]">
            {T.brand.subtitle}
          </span>
        </div>

        <motion.span
          layout
          className={cn(
            "ml-1 text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1.5",
          )}
          style={{
            background: ready
              ? "oklch(0.7 0.18 150 / 0.18)"
              : "var(--glass-thin-bg)",
            color: ready ? "oklch(0.45 0.15 150)" : "var(--text-secondary)",
            border: `1px solid ${ready ? "oklch(0.7 0.18 150 / 0.3)" : "var(--glass-thin-border)"}`,
          }}
        >
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              background: ready ? "oklch(0.65 0.2 150)" : "var(--text-tertiary)",
              boxShadow: ready ? "0 0 6px oklch(0.65 0.2 150 / 0.6)" : undefined,
            }}
          />
          {statusLabel(health?.status, ready)}
        </motion.span>

        <div className="flex-1" />

        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded-[var(--radius-chip)] hover:bg-[var(--glass-thin-bg)]"
        >
          接口文档 <ExternalLink className="size-3" />
        </a>

        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={spring}
          aria-label={T.a11y.toggleTheme}
          onClick={onToggleTheme}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-thin-bg)] transition-colors"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={spring}
          aria-label={panelOpen ? T.topbar.sidePanelClose : T.topbar.sidePanelOpen}
          onClick={togglePanel}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-thin-bg)] transition-colors"
        >
          {panelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
        </motion.button>
      </GlassCard>
    </motion.header>
  )
}
