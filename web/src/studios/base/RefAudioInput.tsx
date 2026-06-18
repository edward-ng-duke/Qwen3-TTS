import { useEffect, useRef, useState } from "react"
import { UploadCloud, Mic, Square, X, Play, Pause, AlertTriangle } from "lucide-react"
import { motion } from "motion/react"
import { useCloneStore } from "@/stores/useCloneStore"
import { useRecorder } from "@/hooks/useRecorder"
import { getAudioDuration } from "@/lib/audio"
import { formatSeconds } from "@/lib/format"
import { T } from "@/lib/i18n"
import { toast } from "sonner"

export function RefAudioInput() {
  const refAudio = useCloneStore((s) => s.refAudio)
  const refAudioName = useCloneStore((s) => s.refAudioName)
  const setRefAudio = useCloneStore((s) => s.setRefAudio)
  const recorder = useRecorder()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  // 把时长和它对应的 blob 绑定，避免换/删音频后还显示上一条的时长（陈旧的"太短"警告）。
  const [measured, setMeasured] = useState<{ blob: Blob; sec: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const duration = measured && measured.blob === refAudio ? measured.sec : 0

  // 预览音频对象 URL + 时长（duration 只在异步回调里写，避免 effect 内同步 setState）
  useEffect(() => {
    if (!refAudio) return
    const url = URL.createObjectURL(refAudio)
    const a = audioRef.current
    if (a) a.src = url
    let alive = true
    void getAudioDuration(refAudio).then((d) => { if (alive) setMeasured({ blob: refAudio, sec: d }) })
    return () => {
      alive = false
      if (a && a.src === url) a.removeAttribute("src")
      URL.revokeObjectURL(url)
    }
  }, [refAudio])

  const acceptFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("audio/") && !/\.(wav|mp3|flac|ogg|m4a|aac)$/i.test(file.name)) {
      toast.error("请选择音频文件")
      return
    }
    setRefAudio(file, file.name, "自定义参考")
  }

  const onRecordToggle = async () => {
    if (recorder.recording) {
      const blob = await recorder.stop()
      if (blob) setRefAudio(blob, "recording.wav", "录音")
    } else {
      const err = await recorder.start()
      if (err) toast.error(err)
    }
  }

  const togglePlay = async () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) { try { await a.play(); setPlaying(true) } catch { setPlaying(false) } }
    else { a.pause(); setPlaying(false) }
  }

  const tooShort = !!refAudio && duration > 0 && duration < 4

  return (
    <div>
      <span className="block text-[13px] font-semibold text-[var(--text-primary)]">{T.clone.refAudioLabel}</span>

      {!refAudio ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files?.[0]) }}
          className="mt-2 rounded-[var(--radius-input)] p-4 sm:p-5 flex flex-col items-center text-center gap-2 transition-colors"
          style={{
            background: "var(--input-well-bg)",
            border: `1.5px dashed ${dragOver ? "var(--brand)" : "var(--input-well-border)"}`,
            boxShadow: dragOver ? "0 0 0 4px var(--brand-glow)" : "var(--input-well-shadow)",
          }}
        >
          <UploadCloud className="size-6 text-[var(--brand)]" />
          <p className="text-[13px] text-[var(--text-secondary)]">{T.clone.dropHint}</p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              style={{ background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}
            >
              <UploadCloud className="size-3.5" /> {T.clone.pickFile}
            </button>
            {recorder.supported && (
              <button
                type="button"
                onClick={onRecordToggle}
                aria-label={recorder.recording ? T.a11y.stopRecording : T.a11y.startRecording}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-white transition-colors"
                style={{
                  background: recorder.recording ? "var(--danger)" : "var(--brand-gradient)",
                  boxShadow: "0 4px 14px var(--brand-glow)",
                }}
              >
                {recorder.recording
                  ? <><Square className="size-3.5" /> {T.clone.recordStop} {formatSeconds(recorder.elapsedMs / 1000)}</>
                  : <><Mic className="size-3.5" /> {T.clone.recordStart}</>}
              </button>
            )}
          </div>
          {recorder.recording && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--danger)]" aria-live="polite">
              <motion.span
                className="inline-block size-2 rounded-full bg-[var(--danger)]"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              {T.a11y.recording}
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => { acceptFile(e.target.files?.[0]); e.currentTarget.value = "" }}
          />
        </div>
      ) : (
        <div
          className="mt-2 rounded-[var(--radius-input)] p-3 flex items-center gap-3"
          style={{ background: "var(--input-well-bg)", border: "1px solid var(--input-well-border)", boxShadow: "var(--input-well-shadow)" }}
        >
          <motion.button
            type="button"
            onClick={togglePlay}
            whileTap={{ scale: 0.94 }}
            aria-label={playing ? T.results.pause : T.results.play}
            className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-full text-white"
            style={{ background: "var(--brand-gradient)", boxShadow: "0 6px 18px var(--brand-glow)" }}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
          </motion.button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-[var(--text-primary)]">{refAudioName}</p>
            <p className="text-[12px] text-[var(--text-tertiary)] tabular-nums">
              {duration > 0 ? `${formatSeconds(duration)}` : "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setRefAudio(null); setPlaying(false) }}
            aria-label={T.a11y.removeRefAudio}
            className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            style={{ background: "var(--glass-thin-bg)", border: "1px solid var(--glass-thin-border)" }}
          >
            <X className="size-4" />
          </button>
          <audio ref={audioRef} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} hidden />
        </div>
      )}

      <p className={`mt-1.5 text-[11px] leading-snug ${tooShort ? "text-[var(--danger)]" : "text-[var(--text-tertiary)]"}`}>
        {tooShort ? <><AlertTriangle className="inline size-3 mr-1 -mt-0.5" />{T.clone.durationHint}</> : T.clone.durationHint}
      </p>
    </div>
  )
}
