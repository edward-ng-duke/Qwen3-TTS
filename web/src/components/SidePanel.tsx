import { type ReactNode } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useUiStore, type PanelTab } from "@/stores/useUiStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Props {
  voices: ReactNode
  history: ReactNode
  advanced: ReactNode
}

const TABS: { value: PanelTab; label: string }[] = [
  { value: "voices",   label: "音色库" },
  { value: "history",  label: "历史" },
  { value: "advanced", label: "高级" },
]

function PanelInner({ voices, history, advanced, tab, setTab }:
  Props & { tab: PanelTab; setTab: (t: PanelTab) => void }) {
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as PanelTab)} className="h-full flex flex-col">
      <TabsList className="grid grid-cols-3 m-2">
        {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
      </TabsList>
      <ScrollArea className="flex-1">
        <TabsContent value="voices" className="p-3 m-0">{voices}</TabsContent>
        <TabsContent value="history" className="p-3 m-0">{history}</TabsContent>
        <TabsContent value="advanced" className="p-3 m-0">{advanced}</TabsContent>
      </ScrollArea>
    </Tabs>
  )
}

export function SidePanel(props: Props) {
  const { panelOpen, panelTab, setPanelTab, setPanelOpen } = useUiStore()

  return (
    <>
      {/* desktop: side column */}
      <aside className={cn(
        "hidden md:flex border-l border-border bg-surface transition-[width]",
        panelOpen ? "w-[360px]" : "w-0 overflow-hidden"
      )}>
        <div className="w-[360px] h-full">
          <PanelInner {...props} tab={panelTab} setTab={setPanelTab} />
        </div>
      </aside>

      {/* mobile: bottom sheet trigger floating */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetTrigger asChild>
          <button
            className="md:hidden fixed bottom-4 right-4 z-30 px-4 h-11 rounded-full bg-accent text-white shadow-sm"
            aria-label="打开侧边面板"
          >
            {TABS.find((t) => t.value === panelTab)?.label}
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] p-0">
          <PanelInner {...props} tab={panelTab} setTab={setPanelTab} />
        </SheetContent>
      </Sheet>
    </>
  )
}
