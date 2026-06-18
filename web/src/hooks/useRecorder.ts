import { useCallback, useEffect, useRef, useState } from "react"
import { audioBufferToWavBlob } from "@/lib/audio"

export interface RecorderApi {
  supported: boolean
  recording: boolean
  elapsedMs: number
  error: string | null
  /** 开始录音；失败时返回错误信息字符串，成功返回 null（调用方据此提示，避免读到陈旧的 error 状态）。 */
  start: () => Promise<string | null>
  /** 停止录音，返回 16-bit WAV blob（服务端可解码），失败返回 null。 */
  stop: () => Promise<Blob | null>
}

type ACtor = typeof AudioContext

export function useRecorder(): RecorderApi {
  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    "MediaRecorder" in window

  const [recording, setRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const t0Ref = useRef(0)
  const timerRef = useRef<number | null>(null)

  const clearTimer = () => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }
  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => () => { clearTimer(); stopStream() }, [])

  const start = useCallback(async (): Promise<string | null> => {
    if (!supported || recording) return null
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      mrRef.current = mr
      mr.start()
      t0Ref.current = performance.now()
      setElapsedMs(0)
      setRecording(true)
      timerRef.current = window.setInterval(
        () => setElapsedMs(performance.now() - t0Ref.current),
        100,
      )
      return null
    } catch (e) {
      const msg = e instanceof Error ? e.message : "无法访问麦克风"
      setError(msg)
      stopStream()
      setRecording(false)
      return msg
    }
  }, [supported, recording])

  const stop = useCallback(async (): Promise<Blob | null> => {
    const mr = mrRef.current
    if (!mr) return null
    clearTimer()
    const recordedType = mr.mimeType || "audio/webm"
    const done = new Promise<Blob>((resolve) => {
      mr.onstop = () => resolve(new Blob(chunksRef.current, { type: recordedType }))
    })
    mr.stop()
    setRecording(false)
    const recorded = await done
    stopStream()
    mrRef.current = null

    // Re-encode to WAV so libsndfile on the server can decode it.
    try {
      const w = window as unknown as { AudioContext?: ACtor; webkitAudioContext?: ACtor }
      const AC = w.AudioContext || w.webkitAudioContext
      if (!AC) return recorded
      const ctx = new AC()
      try {
        const buf = await ctx.decodeAudioData(await recorded.arrayBuffer())
        return audioBufferToWavBlob(buf)
      } catch {
        // Some browsers (e.g. Safari) can't decode webm/opus — fall back to raw.
        return recorded
      } finally {
        // Always release the context, even when decode fails, or we leak it
        // (browsers cap concurrent AudioContexts and re-encode would later break).
        await ctx.close().catch(() => {})
      }
    } catch {
      return recorded
    }
  }, [])

  return { supported, recording, elapsedMs, error, start, stop }
}
