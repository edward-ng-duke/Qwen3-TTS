import { useVoices } from "@/hooks/useVoices"
import { useComposerStore } from "@/stores/useComposerStore"
import { VoiceCard } from "./VoiceCard"

export function VoiceLibrary() {
  const { data: voices = [], isLoading, error } = useVoices()
  const speakerId = useComposerStore((s) => s.speakerId)
  const setSpeakerId = useComposerStore((s) => s.setSpeakerId)

  if (isLoading) return <p className="text-sm text-text-muted">加载音色中…</p>
  if (error) return <p className="text-sm text-danger">音色加载失败：{(error as Error).message}</p>

  return (
    <div className="space-y-2">
      {voices.map((v) => (
        <VoiceCard
          key={v.id}
          voice={v}
          selected={v.id === speakerId}
          onSelect={() => setSpeakerId(v.id)}
        />
      ))}
    </div>
  )
}
