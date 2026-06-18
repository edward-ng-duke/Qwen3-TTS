import { useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { api, type NativeTTSRequest } from "@/lib/api"
import { historyDb, notifyHistoryChanged, type HistoryItem } from "@/lib/db"
import { getAudioDuration, isAbortError } from "@/lib/audio"
import { useUiStore } from "@/stores/useUiStore"
import { toast } from "sonner"

interface GenerateInput {
  text: string
  speakerId: string
  language: string
  emotionName: string
  emotionInstruct: string | null   // 已根据 emotionName 解析好的 instruct
  customInstruct?: string
  seed: number | null
}

export function useGenerate() {
  const advanced = useUiStore((s) => s.advanced)
  const abortRef = useRef<AbortController | null>(null)

  const mutation = useMutation({
    mutationFn: async (input: GenerateInput) => {
      const controller = new AbortController()
      abortRef.current = controller
      const start = performance.now()
      const req: NativeTTSRequest = {
        text: input.text,
        speaker: input.speakerId,
        language: input.language,
        instruct: input.emotionInstruct || null,
        seed: input.seed,
        sampling: advanced,
        response_format: "wav",
      }
      const { blob, contentType } = await api.tts(req, controller.signal)
      const generationMs = Math.round(performance.now() - start)
      const audioDurationSec = await getAudioDuration(blob)
      const item: Omit<HistoryItem, "id"> = {
        createdAt: Date.now(),
        kind: "customvoice",
        text: input.text,
        language: input.language,
        speakerId: input.speakerId,
        emotion: input.emotionName,
        customInstruct: input.customInstruct,
        sampling: advanced,
        seed: input.seed,
        audioBlob: blob,
        audioMime: contentType,
        audioDurationSec,
        generationMs,
      }
      const id = await historyDb.add(item)
      notifyHistoryChanged()
      return { ...item, id }
    },
    onError: (e: Error) => { if (!isAbortError(e)) toast.error(`生成失败：${e.message}`) },
    onSettled: () => { abortRef.current = null },
  })

  return Object.assign(mutation, { cancel: () => abortRef.current?.abort() })
}
