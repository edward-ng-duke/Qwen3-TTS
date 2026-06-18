import { useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { api, type CloneSampling } from "@/lib/api"
import { historyDb, notifyHistoryChanged, type HistoryItem } from "@/lib/db"
import { getAudioDuration, isAbortError } from "@/lib/audio"
import { useUiStore } from "@/stores/useUiStore"
import { toast } from "sonner"
import { T } from "@/lib/i18n"
import type { CloneMode } from "@/stores/useCloneStore"

interface CloneInput {
  mode: CloneMode
  text: string
  language: string
  seed: number | null
  // instant
  refAudio?: Blob | null
  refAudioName?: string
  refText?: string
  xVectorOnly?: boolean
  label?: string
  // saved
  voicePrompt?: Blob | null
  voicePromptName?: string
}

export function useGenerateClone() {
  const advanced = useUiStore((s) => s.advanced)
  const abortRef = useRef<AbortController | null>(null)

  const mutation = useMutation({
    mutationFn: async (input: CloneInput) => {
      const controller = new AbortController()
      abortRef.current = controller
      // 克隆端点采样字段是扁平的，且不接受 subtalker_*。
      const sampling: CloneSampling = {
        seed: input.seed,
        temperature: advanced.temperature,
        top_k: advanced.top_k,
        top_p: advanced.top_p,
        repetition_penalty: advanced.repetition_penalty,
        max_new_tokens: advanced.max_new_tokens,
      }

      const start = performance.now()
      let res: { blob: Blob; contentType: string }
      if (input.mode === "saved") {
        if (!input.voicePrompt) throw new Error(T.clone.needSavedVoice)
        res = await api.generateFromVoice({
          text: input.text,
          voicePrompt: input.voicePrompt,
          voicePromptName: input.voicePromptName,
          language: input.language,
          ...sampling,
        }, controller.signal)
      } else {
        if (!input.refAudio) throw new Error(T.clone.needRefAudio)
        if (!input.xVectorOnly && !input.refText?.trim()) throw new Error(T.clone.needRefText)
        res = await api.clone({
          text: input.text,
          refAudio: input.refAudio,
          refAudioName: input.refAudioName,
          refText: input.refText?.trim() || null,
          xVectorOnly: input.xVectorOnly,
          language: input.language,
          ...sampling,
        }, controller.signal)
      }
      const generationMs = Math.round(performance.now() - start)
      const audioDurationSec = await getAudioDuration(res.blob)
      const item: Omit<HistoryItem, "id"> = {
        createdAt: Date.now(),
        kind: "clone",
        text: input.text,
        language: input.language,
        refText: input.mode === "instant" ? input.refText : undefined,
        xVectorOnly: input.mode === "instant" ? input.xVectorOnly : undefined,
        cloneMode: input.mode,
        label: input.mode === "saved" ? "复用音色" : input.label,
        seed: input.seed,
        audioBlob: res.blob,
        audioMime: res.contentType,
        audioDurationSec,
        generationMs,
      }
      const id = await historyDb.add(item)
      notifyHistoryChanged()
      return { ...item, id }
    },
    onError: (e: Error) => { if (!isAbortError(e)) toast.error(`克隆失败：${e.message}`) },
    onSettled: () => { abortRef.current = null },
  })

  return Object.assign(mutation, { cancel: () => abortRef.current?.abort() })
}
