import { Topbar } from "@/components/Topbar"
import { Composer } from "@/components/Composer"
import { ResultsStream } from "@/components/ResultsStream"
import { SidePanel } from "@/components/SidePanel"
import { AuroraBackground } from "@/components/AuroraBackground"
import { VoiceLibrary } from "@/components/panels/VoiceLibrary"
import { History } from "@/components/panels/History"
import { Advanced } from "@/components/panels/Advanced"
import { useUiStore } from "@/stores/useUiStore"
import { useShortcuts } from "@/hooks/useShortcuts"
import { useEffect } from "react"
import { AuthGate } from "@/components/AuthGate"
import { T } from "@/lib/i18n"
import { ExternalLink } from "lucide-react"

const TAB_CYCLE = ["voices", "history", "advanced"] as const

export default function App() {
  const theme = useUiStore((s) => s.theme)
  const panelTab = useUiStore((s) => s.panelTab)
  const setPanelTab = useUiStore((s) => s.setPanelTab)
  const setPanelOpen = useUiStore((s) => s.setPanelOpen)

  // 同步主题到 <html class>
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.classList.toggle("light", theme === "light")
  }, [theme])

  useShortcuts({
    onCyclePanelTab: (dir) => {
      const i = TAB_CYCLE.indexOf(panelTab as typeof TAB_CYCLE[number])
      const next = TAB_CYCLE[(i + dir + TAB_CYCLE.length) % TAB_CYCLE.length]
      setPanelTab(next); setPanelOpen(true)
    },
    onEscape: () => setPanelOpen(false),
  })

  return (
    <AuthGate>
      <AuroraBackground />
      <div className="min-h-dvh overflow-hidden flex flex-col text-[var(--text-primary)]">
        <Topbar />
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain">
          <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 md:px-6 pt-[calc(5.75rem+var(--safe-top))] pb-[calc(6.75rem+var(--safe-bottom))] md:pb-10 space-y-5 sm:space-y-6">
            <section className="max-w-[880px] mx-auto pt-1 sm:pt-3">
              <p className="text-[12px] font-medium text-[var(--brand)]">
                {T.home.eyebrow}
              </p>
              <div className="mt-1 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-[26px] sm:text-[34px] leading-tight font-semibold tracking-tight text-[var(--text-primary)]">
                    {T.home.title}
                  </h1>
                  <p className="mt-2 max-w-2xl break-words text-[14px] sm:text-[15px] leading-relaxed text-[var(--text-secondary)]">
                    {T.home.description}
                  </p>
                </div>
                <a
                  href="/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 sm:min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  style={{
                    background: "var(--glass-thin-bg)",
                    border: "1px solid var(--glass-thin-border)",
                  }}
                >
                  {T.home.docs}
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </section>
            <Composer />
            <div>
              <div className="max-w-[880px] mx-auto mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">{T.home.resultsTitle}</h2>
                  <p className="text-[12px] leading-relaxed text-[var(--text-tertiary)]">
                    {T.home.resultsDescription}
                  </p>
                </div>
              </div>
              <ResultsStream />
            </div>
          </div>
        </main>
        <SidePanel
          voices={<VoiceLibrary />}
          history={<History />}
          advanced={<Advanced />}
        />
        </div>
      </div>
    </AuthGate>
  )
}
