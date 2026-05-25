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
    <>
      <AuroraBackground />
      <div className="h-screen flex flex-col text-[var(--text-primary)]">
        <Topbar />
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
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
    </>
  )
}
