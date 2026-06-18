import { Trash2 } from "lucide-react"
import type { KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import type { HistoryItem as TItem } from "@/lib/db"
import { useComposerStore } from "@/stores/useComposerStore"
import { useStudioApi } from "@/lib/studioContext"
import { formatRelativeTime, truncate } from "@/lib/format"
import { voiceNameById } from "@/lib/voiceMeta"
import { EMOTION_ZH } from "@/lib/emotions"

interface Props {
  item: TItem
  onDelete: () => void
}

export function HistoryItem({ item, onDelete }: Props) {
  const studio = useStudioApi()
  const loadFromHistory = useComposerStore((s) => s.loadFromHistory)
  const load = () => {
    if (studio) {
      studio.reuse(item)
      return
    }
    loadFromHistory({
      text: item.text, language: item.language, speakerId: item.speakerId ?? "vivian",
      emotion: item.emotion ?? "Neutral", customInstruct: item.customInstruct, seed: item.seed,
    })
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      load()
    }
  }

  const kind = item.kind ?? "customvoice"
  const leadLabel =
    kind === "design" ? "声音设计"
      : kind === "clone" ? (item.label || "声音克隆")
      : voiceNameById(item.speakerId ?? "")
  const descriptor =
    kind === "design" ? (item.instruct?.trim() ? `🎨 ${item.instruct.trim()}` : "")
      : kind === "clone" ? (item.xVectorOnly ? "🎙 向量" : "🎙 ICL")
      : item.emotion === "Custom" && item.customInstruct?.trim()
        ? `✨ ${item.customInstruct.trim()}`
        : EMOTION_ZH[item.emotion ?? "Neutral"] ?? item.emotion
  // 完整文本作为 hover tooltip，避免截断后看不全（与 ResultCard 一致）
  const descriptorTitle =
    kind === "design" ? item.instruct?.trim()
      : kind === "clone" ? item.refText?.trim()
      : item.emotion === "Custom" ? item.customInstruct?.trim()
      : undefined

  return (
    <div
      role="button"
      tabIndex={0}
      className="min-h-[44px] rounded-card border border-border bg-surface hover:bg-surface-2 p-3 cursor-pointer group transition"
      onClick={load}
      onKeyDown={onKeyDown}
    >
      <div className="flex min-w-0 items-center gap-2 text-xs text-text-muted">
        <span className="text-text font-medium shrink-0 max-w-[38%] truncate">{leadLabel}</span>
        {descriptor ? <span className="min-w-0 truncate" title={descriptorTitle || undefined}>· {descriptor}</span> : null}
        <span className="ml-auto shrink-0 max-[360px]:hidden">{formatRelativeTime(item.createdAt)}</span>
        <Button
          variant="ghost" size="icon"
          className="h-9 w-9 sm:h-6 sm:w-6 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-danger"
          aria-label="删除历史记录"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <p className="min-w-0 break-words text-xs mt-1 leading-snug">{truncate(item.text, 60)}</p>
    </div>
  )
}
