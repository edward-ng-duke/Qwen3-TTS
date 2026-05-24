import { useMemo } from "react"
import { Wand2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useComposerStore } from "@/stores/useComposerStore"
import { useUiStore } from "@/stores/useUiStore"
import { useVoices, useLanguages } from "@/hooks/useVoices"
import { useGenerate } from "@/hooks/useGenerate"
import { EmotionPicker } from "./EmotionPicker"
import { VoicePill } from "./VoicePill"
import { SoundWave } from "./SoundWave"
import { formatLanguage } from "@/lib/format"
import { emotionInstructFor } from "@/lib/emotions"

export function Composer() {
  const composer = useComposerStore()
  const setPanelOpen = useUiStore((s) => s.setPanelOpen)
  const setPanelTab = useUiStore((s) => s.setPanelTab)
  const { data: voices = [] } = useVoices()
  const { data: languages = ["Auto"] } = useLanguages()
  const gen = useGenerate()

  const currentVoice = useMemo(
    () => voices.find((v) => v.id === composer.speakerId),
    [voices, composer.speakerId],
  )

  const langOptions = useMemo(() => {
    // 去重 (auto/Auto 合并)
    const seen = new Set<string>()
    return languages.filter((l) => {
      const k = l.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k); return true
    })
  }, [languages])

  const submit = () => {
    if (!composer.text.trim()) return
    gen.mutate({
      text: composer.text.trim(),
      speakerId: composer.speakerId,
      language: composer.language,
      emotionName: composer.emotionName,
      emotionInstruct: emotionInstructFor(composer.emotionName, composer.customInstruct) || null,
      customInstruct: composer.customInstruct,
      seed: composer.seed,
    })
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4 md:p-6 space-y-4">
      <Textarea
        value={composer.text}
        onChange={(e) => composer.setText(e.target.value)}
        placeholder="在这里输入你想合成的文本…（支持中、英、日、韩、德、法、俄、葡、西、意 10 种语言）"
        className="min-h-[140px] resize-y bg-surface-2 border-border rounded-input"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault(); submit()
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Select value={composer.language} onValueChange={composer.setLanguage}>
          <SelectTrigger className="w-32 bg-surface-2 border-border h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {langOptions.map((l) => (
              <SelectItem key={l} value={l}>{formatLanguage(l)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <VoicePill
          voice={currentVoice}
          onClick={() => { setPanelTab("voices"); setPanelOpen(true) }}
        />
        <div className="ml-auto text-xs text-text-muted">
          {composer.text.length} 字
        </div>
      </div>
      <EmotionPicker
        value={composer.emotionName}
        onChange={composer.setEmotionName}
      />
      {composer.emotionName === "Custom" && (
        <Textarea
          value={composer.customInstruct}
          onChange={(e) => composer.setCustomInstruct(e.target.value)}
          placeholder="例如：用极慢的语速悄悄地说。"
          className="min-h-[60px] bg-surface-2 border-border rounded-input"
        />
      )}
      <div className="flex items-center gap-3">
        <Button
          onClick={submit}
          disabled={!composer.text.trim() || gen.isPending}
          className="h-11 px-6 rounded-btn bg-cta hover:bg-cta/90 text-white font-medium gap-2"
        >
          {gen.isPending ? (
            <>
              <SoundWave color="#fff" />
              <span>生成中…</span>
            </>
          ) : (
            <>
              <Wand2 className="size-4" />
              <span>生成</span>
            </>
          )}
        </Button>
        <span className="text-xs text-text-muted">
          快捷键 ⌘/Ctrl + Enter
        </span>
      </div>
    </section>
  )
}
