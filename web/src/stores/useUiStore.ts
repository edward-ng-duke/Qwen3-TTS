import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SamplingParams } from "@/lib/api"

export type PanelTab = "voices" | "history" | "advanced"
export type Theme = "dark" | "light"

interface UiState {
  theme: Theme
  panelOpen: boolean
  panelTab: PanelTab
  advanced: SamplingParams
  setTheme: (t: Theme) => void
  togglePanel: () => void
  setPanelOpen: (open: boolean) => void
  setPanelTab: (tab: PanelTab) => void
  setAdvanced: (s: Partial<SamplingParams>) => void
  resetAdvanced: () => void
}

const ADVANCED_DEFAULTS: SamplingParams = {
  temperature: 0.9, top_k: 50, top_p: 1.0,
  repetition_penalty: 1.05, max_new_tokens: 2048,
  subtalker_temperature: 0.9, subtalker_top_k: 50, subtalker_top_p: 1.0,
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "light",
      panelOpen: true,
      panelTab: "voices",
      advanced: ADVANCED_DEFAULTS,
      setTheme: (theme) => set({ theme }),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setPanelTab: (panelTab) => set({ panelTab }),
      setAdvanced: (patch) => set((s) => ({ advanced: { ...s.advanced, ...patch } })),
      resetAdvanced: () => set({ advanced: ADVANCED_DEFAULTS }),
    }),
    {
      name: "qwen-tts-ui",
      // Bump when we want to force-reset some persisted state. v2 forces theme
      // back to "light" while keeping the user's panel/advanced settings.
      version: 2,
      migrate: (persistedState, fromVersion) => {
        const s = (persistedState ?? {}) as Partial<UiState>
        if (fromVersion < 2) {
          return { ...s, theme: "light" as Theme }
        }
        return s
      },
    }
  )
)
