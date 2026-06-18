import { type ReactNode, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { useUiStore, type PanelTab } from "@/stores/useUiStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { GlassCard } from "@/components/GlassCard"
import { T } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface Props {
  voices?: ReactNode
  history: ReactNode
  advanced: ReactNode
  /** Which tabs to show. Default: all three (customvoice). */
  tabs?: PanelTab[]
}

const TAB_LABEL: Record<PanelTab, string> = {
  voices: T.sidePanel.tabs.voices,
  history: T.sidePanel.tabs.history,
  advanced: T.sidePanel.tabs.advanced,
}

const DEFAULT_TABS: PanelTab[] = ["voices", "history", "advanced"]

const desktopSpring = { type: "spring", stiffness: 240, damping: 28 } as const

function useMediaQuery(query: string) {
  const getMatches = () =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  const [matches, setMatches] = useState(getMatches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [query])

  return matches
}

function TabBar({
  tabs,
  tab,
  setTab,
}: {
  tabs: PanelTab[]
  tab: PanelTab
  setTab: (t: PanelTab) => void
}) {
  const reduce = useReducedMotion()
  return (
    <div
      className="relative grid p-1.5 rounded-full"
      style={{
        gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        background: "var(--glass-thin-bg)",
        border: "1px solid var(--glass-thin-border)",
      }}
    >
      {tabs.map((value) => {
        const active = tab === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "relative min-h-11 sm:min-h-9 sm:h-9 text-[12.5px] rounded-full select-none transition-colors",
              active
                ? "text-white font-medium"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {!active && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  background: "var(--glass-thin-bg)",
                  border: "1px solid var(--glass-thin-border)",
                }}
              />
            )}
            {active && (
              <motion.span
                layoutId="sidepanel-tab"
                aria-hidden
                className="absolute inset-0 rounded-full -z-0"
                style={{ background: "var(--brand-gradient)" }}
                animate={
                  reduce
                    ? { boxShadow: "0 4px 14px var(--brand-glow)" }
                    : {
                        boxShadow: [
                          "0 4px 14px var(--brand-glow)",
                          "0 6px 22px var(--brand-glow)",
                          "0 4px 14px var(--brand-glow)",
                        ],
                      }
                }
                transition={
                  reduce
                    ? desktopSpring
                    : {
                        layout: desktopSpring,
                        boxShadow: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                      }
                }
              />
            )}
            <span className="relative z-10">{TAB_LABEL[value]}</span>
          </button>
        )
      })}
    </div>
  )
}

function PanelInner({
  voices,
  history,
  advanced,
  tabs,
  tab,
  setTab,
}: Props & { tabs: PanelTab[]; tab: PanelTab; setTab: (t: PanelTab) => void }) {
  const reduce = useReducedMotion()
  const content =
    tab === "voices" ? voices : tab === "history" ? history : advanced
  const enter = reduce
    ? { opacity: 0 }
    : { opacity: 0, y: 10, scale: 0.985, filter: "blur(2px)" }
  const center = reduce
    ? { opacity: 1 }
    : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
  const leave = reduce
    ? { opacity: 0 }
    : { opacity: 0, y: -6, scale: 0.99, filter: "blur(2px)" }
  const trans = reduce
    ? { duration: 0.15 }
    : { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }
  return (
    <div className="h-full min-h-0 flex flex-col gap-3 p-3 safe-bottom">
      <TabBar tabs={tabs} tab={tab} setTab={setTab} />
      <ScrollArea className="flex-1 min-h-0 -mx-1">
        <div className="px-1 pb-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={enter}
              animate={center}
              exit={leave}
              transition={trans}
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  )
}

export function SidePanel(props: Props) {
  const { panelOpen, panelTab, setPanelTab, setPanelOpen } = useUiStore()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const initializedMobilePanel = useRef(false)

  const tabs = props.tabs ?? DEFAULT_TABS
  // Clamp the persisted tab into this panel's allowed set (e.g. a studio without
  // a "voices" tab must not get stuck on a persisted "voices" selection).
  const effectiveTab = tabs.includes(panelTab) ? panelTab : tabs[0]

  useEffect(() => {
    if (!isDesktop && !initializedMobilePanel.current) {
      initializedMobilePanel.current = true
      setPanelOpen(false)
    }
  }, [isDesktop, setPanelOpen])

  const inner = (
    <PanelInner {...props} tabs={tabs} tab={effectiveTab} setTab={setPanelTab} />
  )

  return (
    <>
      {/* Desktop: floating right glass island */}
      <AnimatePresence>
        {isDesktop && panelOpen && (
          <motion.aside
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.96 }}
            transition={desktopSpring}
            className="hidden md:block fixed right-4 top-24 bottom-4 w-[360px] z-30"
          >
            <GlassCard
              variant="regular"
              className="h-full rounded-[var(--radius-island)] overflow-hidden"
              style={{ boxShadow: "var(--shadow-elevate)" }}
            >
              {inner}
            </GlassCard>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile: bottom sheet opened from the top bar panel control. */}
      <Sheet open={!isDesktop && panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent
          side="bottom"
          className="!h-[min(88dvh,calc(100dvh-var(--safe-top)-0.75rem))] max-h-[min(88dvh,calc(100dvh-var(--safe-top)-0.75rem))] rounded-t-[var(--radius-island)] p-0 overflow-hidden"
          style={{
            background: "var(--bg-base)",
            borderColor: "var(--glass-regular-border)",
            boxShadow: "var(--shadow-elevate)",
          }}
        >
          <SheetTitle className="sr-only">控制面板</SheetTitle>
          <SheetDescription className="sr-only">
            切换音色库、历史记录和高级参数。
          </SheetDescription>
          {inner}
        </SheetContent>
      </Sheet>
    </>
  )
}
