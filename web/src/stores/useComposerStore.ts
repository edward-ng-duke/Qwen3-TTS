import { create } from "zustand"

interface ComposerState {
  text: string
  language: string
  speakerId: string
  emotionName: string         // "Neutral" | "Happy" | ... | "Custom"
  customInstruct: string
  seed: number | null
  setText: (t: string) => void
  setLanguage: (l: string) => void
  setSpeakerId: (id: string) => void
  setEmotionName: (n: string) => void
  setCustomInstruct: (s: string) => void
  setSeed: (s: number | null) => void
  loadFromHistory: (item: {
    text: string; language: string; speakerId: string;
    emotion: string; customInstruct?: string; seed?: number | null
  }) => void
}

export const useComposerStore = create<ComposerState>()((set) => ({
  text: "",
  language: "Auto",
  speakerId: "vivian",
  emotionName: "Neutral",
  customInstruct: "",
  seed: null,
  setText: (text) => set({ text }),
  setLanguage: (language) => set({ language }),
  setSpeakerId: (speakerId) => set({ speakerId }),
  setEmotionName: (emotionName) => set({ emotionName }),
  setCustomInstruct: (customInstruct) => set({ customInstruct }),
  setSeed: (seed) => set({ seed }),
  loadFromHistory: (item) => set({
    text: item.text,
    language: item.language,
    speakerId: item.speakerId,
    emotionName: item.emotion,
    customInstruct: item.customInstruct ?? "",
    seed: item.seed ?? null,
  }),
}))
