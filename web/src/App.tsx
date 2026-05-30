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
            <Composer />
            <div>
              <h2 className="text-sm font-medium text-text-muted mb-3">最近生成</h2>
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
