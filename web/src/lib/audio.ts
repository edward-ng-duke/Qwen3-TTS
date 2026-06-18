export function blobToObjectURL(blob: Blob): string {
  return URL.createObjectURL(blob)
}

export function revokeObjectURL(url: string): void {
  try { URL.revokeObjectURL(url) } catch { /* ignore */ }
}

export async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio()
    audio.preload = "metadata"
    audio.onloadedmetadata = () => {
      const d = audio.duration
      URL.revokeObjectURL(url)
      resolve(isFinite(d) ? d : 0)
    }
    audio.onerror = () => { URL.revokeObjectURL(url); resolve(0) }
    audio.src = url
  })
}

/**
 * Downmix an AudioBuffer to mono 16-bit PCM WAV. Browser MediaRecorder emits
 * webm/opus which libsndfile (the server's decoder) can't read; we decode the
 * recording with the Web Audio API and re-encode to WAV here so /v1/clone accepts it.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels || 1
  const sr = buffer.sampleRate
  const len = buffer.length
  const mono = new Float32Array(len)
  for (let c = 0; c < numCh; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < len; i++) mono[i] += data[i] / numCh
  }
  const dataSize = len * 2
  const ab = new ArrayBuffer(44 + dataSize)
  const view = new DataView(ab)
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  writeStr(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, "WAVE")
  writeStr(12, "fmt ")
  view.setUint32(16, 16, true)   // PCM chunk size
  view.setUint16(20, 1, true)    // PCM format
  view.setUint16(22, 1, true)    // mono
  view.setUint32(24, sr, true)
  view.setUint32(28, sr * 2, true) // byte rate (mono * 2 bytes)
  view.setUint16(32, 2, true)    // block align
  view.setUint16(34, 16, true)   // bits per sample
  writeStr(36, "data")
  view.setUint32(40, dataSize, true)
  let off = 44
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    off += 2
  }
  return new Blob([ab], { type: "audio/wav" })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
