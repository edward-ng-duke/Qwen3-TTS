// 与 qwen_tts/serve/schemas.py 对齐
export type AudioFormat = "wav" | "mp3" | "flac" | "pcm"

export interface VoiceInfo {
  id: string
  display_name: string
  gender: string
  age_group: string
  language: string
  accent: string
  description: string
  preview_url: string
}

export interface SamplingParams {
  temperature?: number | null
  top_k?: number | null
  top_p?: number | null
  repetition_penalty?: number | null
  max_new_tokens?: number | null
  subtalker_temperature?: number | null
  subtalker_top_k?: number | null
  subtalker_top_p?: number | null
}

export interface NativeTTSRequest {
  text: string
  speaker: string
  language?: string
  instruct?: string | null
  response_format?: AudioFormat
  sampling?: SamplingParams
  seed?: number | null
}

export interface HealthResponse {
  status: "ok" | "loading" | "error"
  model_ready: boolean
  model_path: string
}

const BASE = "" // 同源，dev 由 vite proxy 转发

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, init)
  if (!r.ok) {
    let detail = await r.text().catch(() => "")
    try { const j = JSON.parse(detail); detail = j.detail ?? detail } catch {}
    throw new Error(`${r.status} ${r.statusText}${detail ? `: ${detail}` : ""}`)
  }
  return r.json() as Promise<T>
}

export const api = {
  health: () => fetchJson<HealthResponse>("/v1/health"),
  voices: () => fetchJson<{ voices: VoiceInfo[] }>("/v1/voices").then(d => d.voices),
  languages: () => fetchJson<{ languages: string[] }>("/v1/languages").then(d => d.languages),
  previewUrl: (id: string) => `${BASE}/v1/voices/${encodeURIComponent(id)}/preview`,

  async tts(req: NativeTTSRequest, signal?: AbortSignal): Promise<{ blob: Blob; contentType: string }> {
    const r = await fetch(BASE + "/v1/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_format: "wav", ...req }),
      signal,
    })
    if (!r.ok) {
      let detail = await r.text().catch(() => "")
      try { const j = JSON.parse(detail); detail = j.detail ?? detail } catch {}
      throw new Error(`${r.status} ${r.statusText}${detail ? `: ${detail}` : ""}`)
    }
    const blob = await r.blob()
    return { blob, contentType: r.headers.get("Content-Type") ?? "audio/wav" }
  },
}
