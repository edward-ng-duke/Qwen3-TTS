import { T } from "@/lib/i18n"

export interface EmotionPreset {
  emoji: string
  name: string
  instruct: string
}

export const EMOTION_PRESETS: EmotionPreset[] = [
  { emoji: "😐", name: "Neutral",  instruct: "" },
  { emoji: "😊", name: "Happy",    instruct: "Speak in a happy and cheerful tone." },
  { emoji: "😢", name: "Sad",      instruct: "Speak in a sad and melancholic tone." },
  { emoji: "😡", name: "Angry",    instruct: "Speak in an angry and intense tone." },
  { emoji: "😨", name: "Fearful",  instruct: "Speak in a fearful and trembling tone." },
  { emoji: "😴", name: "Calm",     instruct: "Speak in a calm and soothing tone." },
  { emoji: "✨", name: "Custom",   instruct: "" },
]

export const EMOTION_EMOJI: Record<string, string> = {
  Neutral: "😐", Happy: "😊", Sad: "😢", Angry: "😡", Fearful: "😨", Calm: "😴", Custom: "✨",
}

export const EMOTION_ZH: Record<string, string> = {
  Neutral: T.emotions.neutral,
  Happy: T.emotions.happy,
  Sad: T.emotions.sad,
  Angry: T.emotions.angry,
  Fearful: T.emotions.afraid,
  Calm: T.emotions.calm,
  Custom: T.emotions.custom,
}

export function emotionInstructFor(name: string, customInstruct: string): string {
  if (name === "Custom") return (customInstruct ?? "").trim()
  return EMOTION_PRESETS.find((p) => p.name === name)?.instruct ?? ""
}
