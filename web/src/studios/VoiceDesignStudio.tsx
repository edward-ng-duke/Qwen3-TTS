import { useMemo } from "react"
import { Images } from "lucide-react"
import { Link } from "@/lib/router"
import { Topbar } from "@/components/Topbar"
import { AuroraBackground } from "@/components/AuroraBackground"
import { SidePanel } from "@/components/SidePanel"
import { ResultsStream } from "@/components/ResultsStream"
import { History } from "@/components/panels/History"
import { Advanced } from "@/components/panels/Advanced"
import { AuthGate } from "@/components/AuthGate"
import { VariantThemeProvider } from "@/components/VariantThemeProvider"
import { DesignComposer } from "@/studios/voicedesign/DesignComposer"
import { useUiStore } from "@/stores/useUiStore"
import { useDesignStore } from "@/stores/useDesignStore"
import { useShortcuts } from "@/hooks/useShortcuts"
import { StudioContext, type StudioApi } from "@/lib/studioContext"
import { T } from "@/lib/i18n"

const TAB_CYCLE = ["history", "advanced"] as const

export function VoiceDesignStudio() {
  const panelTab = useUiStore((s) => s.panelTab)
  const setPanelTab = useUiStore((s) => s.setPanelTab)
  const setPanelOpen = useUiStore((s) => s.setPanelOpen)
  const loadFromHistory = useDesignStore((s) => s.loadFromHistory)

  const studioApi = useMemo<StudioApi>(() => ({
    reuse: (item) => loadFromHistory({
      text: item.text, language: item.language, instruct: item.instruct, seed: item.seed,
    }),
  }), [loadFromHistory])

  useShortcuts({
    onCyclePanelTab: (dir) => {
      const i = Math.max(0, TAB_CYCLE.indexOf(panelTab as typeof TAB_CYCLE[number]))
      const next = TAB_CYCLE[(i + dir + TAB_CYCLE.length) % TAB_CYCLE.length]
      setPanelTab(next); setPanelOpen(true)
    },
    onEscape: () => setPanelOpen(false),
  })

  return (
    <AuthGate>
      <VariantThemeProvider variant="voicedesign">
        <StudioContext.Provider value={studioApi}>
          <AuroraBackground />
          <div className="min-h-dvh overflow-hidden flex flex-col text-[var(--text-primary)]">
            <Topbar variant="voicedesign" />
            <div className="flex-1 flex min-h-0">
              <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain">
                <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 md:px-6 pt-[calc(5.75rem+var(--safe-top))] pb-[calc(6.75rem+var(--safe-bottom))] md:pb-10 space-y-5 sm:space-y-6">
                  <section className="max-w-[880px] mx-auto pt-1 sm:pt-3">
                    <p className="text-[12px] font-medium text-[var(--brand)]">{T.design.eyebrow}</p>
                    <div className="mt-1 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <h1 className="text-[26px] sm:text-[34px] leading-tight font-semibold tracking-tight text-[var(--text-primary)]">
                          {T.design.title}
                        </h1>
                        <p className="mt-2 max-w-2xl break-words text-[14px] sm:text-[15px] leading-relaxed text-[var(--text-secondary)]">
                          {T.design.description}
                        </p>
                      </div>
                      <Link
                        to="/gallery"
                        className="inline-flex min-h-11 sm:min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors"
                        style={{ color: "var(--brand)", background: "color-mix(in oklab, var(--brand) 10%, transparent)", border: "1px solid color-mix(in oklab, var(--brand) 22%, transparent)" }}
                      >
                        <Images className="size-3.5" />
                        听听画廊
                      </Link>
                    </div>
                  </section>
                  <DesignComposer />
                  <div>
                    <div className="max-w-[880px] mx-auto mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-[var(--text-primary)]">{T.design.resultsTitle}</h2>
                        <p className="text-[12px] leading-relaxed text-[var(--text-tertiary)]">
                          {T.design.resultsDescription}
                        </p>
                      </div>
                    </div>
                    <ResultsStream />
                  </div>
                </div>
              </main>
              <SidePanel
                history={<History />}
                advanced={<Advanced />}
                tabs={["history", "advanced"]}
              />
            </div>
          </div>
        </StudioContext.Provider>
      </VariantThemeProvider>
    </AuthGate>
  )
}
