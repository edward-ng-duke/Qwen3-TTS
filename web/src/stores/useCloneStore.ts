import { create } from "zustand"

export type CloneMode = "instant" | "saved"

export interface SavedVoice {
  blob: Blob
  filename: string
}

interface CloneState {
  text: string
  language: string
  seed: number | null
  mode: CloneMode
  // instant 模式
  refAudio: Blob | null
  refAudioName: string
  refText: string
  xVectorOnly: boolean
  refLabel: string          // 参考来源短标签（样例说话人名 / "自定义参考"）
  // saved 模式
  savedVoice: SavedVoice | null

  setText: (t: string) => void
  setLanguage: (l: string) => void
  setSeed: (s: number | null) => void
  setMode: (m: CloneMode) => void
  setRefAudio: (blob: Blob | null, name?: string, label?: string) => void
  setRefText: (s: string) => void
  setXVectorOnly: (b: boolean) => void
  setSavedVoice: (v: SavedVoice | null) => void
  loadFromHistory: (item: {
    text: string; language: string; seed?: number | null
  }) => void
}

// 注意：blob 不持久化（不入 localStorage），仅存内存。
export const useCloneStore = create<CloneState>()((set) => ({
  text: "",
  language: "Auto",
  seed: null,
  mode: "instant",
  refAudio: null,
  refAudioName: "",
  refText: "",
  xVectorOnly: false,
  refLabel: "",
  savedVoice: null,

  setText: (text) => set({ text }),
  setLanguage: (language) => set({ language }),
  setSeed: (seed) => set({ seed }),
  setMode: (mode) => set({ mode }),
  setRefAudio: (refAudio, refAudioName = "ref_audio.wav", refLabel = "自定义参考") =>
    set({ refAudio, refAudioName: refAudio ? refAudioName : "", refLabel: refAudio ? refLabel : "" }),
  setRefText: (refText) => set({ refText }),
  setXVectorOnly: (xVectorOnly) => set({ xVectorOnly }),
  setSavedVoice: (savedVoice) => set({ savedVoice }),
  loadFromHistory: (item) => set({
    text: item.text,
    language: item.language,
    seed: item.seed ?? null,
  }),
}))
