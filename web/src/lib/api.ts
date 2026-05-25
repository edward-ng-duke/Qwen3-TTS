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

export interface AuthUser {
  id: string
  username: string
  display_name: string
  role: "admin" | "user" | string
  status: "active" | "disabled" | string
  auth_source: "local" | "es" | string
  created_at?: string | null
  last_login?: string | null
}

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, statusText: string, detail: string) {
    super(`${status} ${statusText}${detail ? `: ${detail}` : ""}`)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
  }
}

const BASE = "" // 同源，dev 由 vite proxy 转发

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, { credentials: "include", ...init })
  if (!r.ok) {
    let detail = await r.text().catch(() => "")
    try { const j = JSON.parse(detail); detail = j.detail ?? detail } catch { /* ignore non-JSON error body */ }
    throw new ApiError(r.status, r.statusText, detail)
  }
  return r.json() as Promise<T>
}

export const api = {
  health: () => fetchJson<HealthResponse>("/v1/health"),
  voices: () => fetchJson<{ voices: VoiceInfo[] }>("/v1/voices").then(d => d.voices),
  languages: () => fetchJson<{ languages: string[] }>("/v1/languages").then(d => d.languages),
  previewUrl: (id: string) => `${BASE}/v1/voices/${encodeURIComponent(id)}/preview`,
  me: () => fetchJson<{ user: AuthUser }>("/api/auth/me").then(d => d.user),
  verifyEsToken: () => fetchJson<{ user: AuthUser; access_token: string }>("/api/auth/verify-es-token", {
    method: "POST",
  }),
  login: (username: string, password: string, rememberMe = false) =>
    fetchJson<{ user: AuthUser; access_token: string }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, remember_me: rememberMe }),
    }),
  logout: () => fetchJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  async tts(req: NativeTTSRequest, signal?: AbortSignal): Promise<{ blob: Blob; contentType: string }> {
    const r = await fetch(BASE + "/v1/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ response_format: "wav", ...req }),
      signal,
    })
    if (!r.ok) {
      let detail = await r.text().catch(() => "")
      try { const j = JSON.parse(detail); detail = j.detail ?? detail } catch { /* ignore non-JSON error body */ }
      throw new ApiError(r.status, r.statusText, detail)
    }
    const blob = await r.blob()
    return { blob, contentType: r.headers.get("Content-Type") ?? "audio/wav" }
  },
}
