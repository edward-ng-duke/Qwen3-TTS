import { type ReactNode, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useUiStore, type PanelTab } from "@/stores/useUiStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { GlassCard } from "@/components/GlassCard"
import { T } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface Props {
  voices: ReactNode
  history: ReactNode
  advanced: ReactNode
}

const TABS: { value: PanelTab; label: string }[] = [
  { value: "voices", label: T.sidePanel.tabs.voices },
  { value: "history", label: T.sidePanel.tabs.history },
  { value: "advanced", label: T.sidePanel.tabs.advanced },
]

const desktopSpring = { type: "spring", stiffness: 240, damping: 28 } as const
const mobileSpring = { type: "spring", stiffness: 200, damping: 30 } as const

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

function TabBar({ tab, setTab }: { tab: PanelTab; setTab: (t: PanelTab) => void }) {
  const reduce = useReducedMotion()
  return (
    <div
      className="relative grid grid-cols-3 p-1.5 rounded-full"
      style={{
        background: "var(--glass-thin-bg)",
        border: "1px solid var(--glass-thin-border)",
      }}
    >
      {TABS.map((t) => {
        const active = tab === t.value
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "relative h-9 text-[12.5px] rounded-full select-none transition-colors",
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
            <span className="relative z-10">{t.label}</span>
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
  tab,
  setTab,
}: Props & { tab: PanelTab; setTab: (t: PanelTab) => void }) {
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
    <div className="h-full flex flex-col gap-3 p-3">
      <TabBar tab={tab} setTab={setTab} />
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

  useEffect(() => {
    if (!isDesktop && !initializedMobilePanel.current) {
      initializedMobilePanel.current = true
      setPanelOpen(false)
    }
  }, [isDesktop, setPanelOpen])

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
              <PanelInner {...props} tab={panelTab} setTab={setPanelTab} />
            </GlassCard>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile: floating trigger + bottom sheet */}
      <Sheet open={!isDesktop && panelOpen} onOpenChange={setPanelOpen}>
        <SheetTrigger asChild>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={mobileSpring}
            className="md:hidden fixed bottom-5 right-5 z-30 inline-flex items-center justify-center px-5 h-12 rounded-full text-white text-[14px] font-medium"
            style={{
              background: "var(--brand-gradient)",
              boxShadow: "0 12px 32px var(--brand-glow)",
            }}
            aria-label={T.a11y.toggleSidePanel}
          >
            {TABS.find((t) => t.value === panelTab)?.label}
          </motion.button>
        </SheetTrigger>
        <SheetContent side="bottom" className="!h-[85vh] max-h-[85vh] p-0">
          <SheetTitle className="sr-only">控制面板</SheetTitle>
          <SheetDescription className="sr-only">
            切换音色库、历史记录和高级参数。
          </SheetDescription>
          <PanelInner {...props} tab={panelTab} setTab={setPanelTab} />
        </SheetContent>
      </Sheet>
    </>
  )
}
