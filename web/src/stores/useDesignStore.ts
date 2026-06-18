import { create } from "zustand"

interface DesignState {
  text: string
  instruct: string        // 音色设计描述（必填）
  language: string
  seed: number | null
  setText: (t: string) => void
  setInstruct: (s: string) => void
  setLanguage: (l: string) => void
  setSeed: (s: number | null) => void
  loadFromHistory: (item: {
    text: string; language: string; instruct?: string; seed?: number | null
  }) => void
}

export const useDesignStore = create<DesignState>()((set) => ({
  text: "",
  instruct: "",
  language: "Auto",
  seed: null,
  setText: (text) => set({ text }),
  setInstruct: (instruct) => set({ instruct }),
  setLanguage: (language) => set({ language }),
  setSeed: (seed) => set({ seed }),
  loadFromHistory: (item) => set({
    text: item.text,
    language: item.language,
    instruct: item.instruct ?? "",
    seed: item.seed ?? null,
  }),
}))
