import { createContext, useContext } from "react"
import type { HistoryItem } from "@/lib/db"

/**
 * 让共享的历史组件（ResultCard / HistoryItem）把"复用参数"路由到当前 Studio
 * 自己的 store，而不必硬编码 useComposerStore。customvoice Studio 不提供
 * Provider，组件回退到 composer store（保持原行为不变）。
 */
export interface StudioApi {
  /** 把一条历史记录回填到当前 Studio 的编辑器。 */
  reuse: (item: HistoryItem) => void
}

export const StudioContext = createContext<StudioApi | null>(null)

export function useStudioApi(): StudioApi | null {
  return useContext(StudioContext)
}
