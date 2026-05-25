import { Moon, Sun, ExternalLink, PanelRightOpen, PanelRightClose } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUiStore } from "@/stores/useUiStore"
import { useHealth } from "@/hooks/useVoices"
import { cn } from "@/lib/utils"

export function Topbar() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const panelOpen = useUiStore((s) => s.panelOpen)
  const togglePanel = useUiStore((s) => s.togglePanel)
  const { data: health } = useHealth()

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center px-4 gap-3 sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <span className="inline-block w-7 h-7 rounded-card bg-accent text-white font-bold leading-7 text-center">微</span>
        <span className="font-semibold tracking-tight">微趣 TTS Studio</span>
        <span className={cn(
          "ml-2 text-xs px-2 py-0.5 rounded-full",
          health?.model_ready ? "bg-success/20 text-success" : "bg-text-muted/20 text-text-muted"
        )}>
          {health?.model_ready ? "已就绪" : health?.status === "loading" ? "加载中…" : "离线"}
        </span>
      </div>
      <div className="flex-1" />
      <Button variant="ghost" size="sm" asChild>
        <a href="/docs" target="_blank" rel="noreferrer">
          API 文档 <ExternalLink className="ml-1 size-3.5" />
        </a>
      </Button>
      <Button
        variant="ghost" size="icon"
        aria-label={theme === "dark" ? "切换到亮色" : "切换到暗色"}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
      <Button
        variant="ghost" size="icon"
        aria-label={panelOpen ? "收起面板" : "展开面板"}
        onClick={togglePanel}
      >
        {panelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
      </Button>
    </header>
  )
}
