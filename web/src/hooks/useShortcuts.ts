import { useEffect } from "react"

interface Shortcuts {
  onGenerate?: () => void
  onCyclePanelTab?: (dir: 1 | -1) => void
  onEscape?: () => void
}

export function useShortcuts({ onGenerate, onCyclePanelTab, onEscape }: Shortcuts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrlOrMeta = e.ctrlKey || e.metaKey
      if (ctrlOrMeta && e.key === "Enter") { e.preventDefault(); onGenerate?.() }
      else if (e.key === "[" && !isInTextField(e)) { onCyclePanelTab?.(-1) }
      else if (e.key === "]" && !isInTextField(e)) { onCyclePanelTab?.(1) }
      else if (e.key === "Escape") { onEscape?.() }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onGenerate, onCyclePanelTab, onEscape])
}

function isInTextField(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable
}
