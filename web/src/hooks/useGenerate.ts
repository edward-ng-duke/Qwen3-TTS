import { useMutation } from "@tanstack/react-query"
import { api, type NativeTTSRequest } from "@/lib/api"
import { historyDb, type HistoryItem } from "@/lib/db"
import { getAudioDuration } from "@/lib/audio"
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

  return useMutation({
    mutationFn: async (input: GenerateInput) => {
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
      const { blob, contentType } = await api.tts(req)
      const generationMs = Math.round(performance.now() - start)
      const audioDurationSec = await getAudioDuration(blob)
      const item: Omit<HistoryItem, "id"> = {
        createdAt: Date.now(),
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
      return { ...item, id }
    },
    onError: (e: Error) => toast.error(`生成失败：${e.message}`),
  })
}
