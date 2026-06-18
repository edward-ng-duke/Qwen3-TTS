import { useMutation } from "@tanstack/react-query"
import { api, type VoiceDesignRequest } from "@/lib/api"
import { historyDb, notifyHistoryChanged, type HistoryItem } from "@/lib/db"
import { getAudioDuration } from "@/lib/audio"
import { useUiStore } from "@/stores/useUiStore"
import { toast } from "sonner"

interface DesignInput {
  text: string
  instruct: string
  language: string
  seed: number | null
}

export function useGenerateDesign() {
  const advanced = useUiStore((s) => s.advanced)

  return useMutation({
    mutationFn: async (input: DesignInput) => {
      const start = performance.now()
      const req: VoiceDesignRequest = {
        text: input.text,
        instruct: input.instruct,
        language: input.language,
        seed: input.seed,
        sampling: advanced,
        response_format: "wav",
      }
      const { blob, contentType } = await api.ttsDesign(req)
      const generationMs = Math.round(performance.now() - start)
      const audioDurationSec = await getAudioDuration(blob)
      const item: Omit<HistoryItem, "id"> = {
        createdAt: Date.now(),
        kind: "design",
        text: input.text,
        language: input.language,
        instruct: input.instruct,
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
    onError: (e: Error) => toast.error(`生成失败：${e.message}`),
  })
}
