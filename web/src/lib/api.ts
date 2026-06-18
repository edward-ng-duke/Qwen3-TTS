// 与 qwen_tts/serve/schemas.py 对齐
import { getAuthToken, setAuthUser } from "@/lib/authStorage"

export type AudioFormat = "wav" | "mp3" | "flac" | "pcm"

/** 后端 MODEL_VARIANT，决定本容器加载哪个模型、暴露哪套 API。 */
export type ModelVariant = "customvoice" | "voicedesign" | "base"

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

/** voicedesign 变体：用自然语言描述设计音色（instruct 必填）。 */
export interface VoiceDesignRequest {
  text: string
  instruct: string
  language?: string
  response_format?: AudioFormat
  sampling?: SamplingParams
  seed?: number | null
}

/** base 变体：克隆端点的扁平采样字段（不接受 subtalker_*）。 */
export interface CloneSampling {
  seed?: number | null
  temperature?: number | null
  top_k?: number | null
  top_p?: number | null
  repetition_penalty?: number | null
  max_new_tokens?: number | null
}

/** base 变体：一步式克隆 /v1/clone（multipart）。 */
export interface CloneParams extends CloneSampling {
  text: string
  refAudio: Blob
  refAudioName?: string
  refText?: string | null
  xVectorOnly?: boolean
  language?: string
  responseFormat?: AudioFormat
}

/** base 变体：保存可复用音色 /v1/voice/save（multipart → .pt）。 */
export interface SaveVoiceParams {
  refAudio: Blob
  refAudioName?: string
  refText?: string | null
  xVectorOnly?: boolean
}

/** base 变体：用保存的 .pt 合成 /v1/voice/generate（multipart）。 */
export interface GenerateFromVoiceParams extends CloneSampling {
  text: string
  voicePrompt: Blob
  voicePromptName?: string
  language?: string
  responseFormat?: AudioFormat
}

export interface HealthResponse {
  status: "ok" | "loading" | "error"
  model_ready: boolean
  model_path: string
  variant: ModelVariant
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

// —— share / gallery ——
export interface ShareVariantOut {
  id: string
  label: string
  voice?: string | null
  language?: string | null
  emotion?: string | null
  instruct?: string | null
  temperature?: number | null
  speed?: number | null
  duration_ms?: number | null
  audio_url: string
}
export interface ShareWork {
  slug: string
  text: string
  dimension: string
  variants: ShareVariantOut[]
  kind: string
  created_at?: string | null
  gallery_order?: number | null
  title?: string | null
}
export interface ShareMetaVariant {
  id: string
  label: string
  voice?: string
  language?: string
  emotion?: string
  instruct?: string
  temperature?: number
  speed?: number
  duration_ms?: number
}
export interface ShareMetadata {
  text: string
  dimension: string
  variants: ShareMetaVariant[]
}
export interface RegenerateVariant {
  id: string
  label: string
  audio_base64: string
  duration_ms: number
}
export interface RegenerateResult {
  text: string
  variants: RegenerateVariant[]
}

const BASE = "" // 同源，dev 由 vite proxy 转发

function withAuth(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers)
  const token = getAuthToken()
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  return { credentials: "include", ...init, headers }
}

async function throwApiError(r: Response): Promise<never> {
  let detail = await r.text().catch(() => "")
  try { const j = JSON.parse(detail); detail = j.detail ?? detail } catch { /* ignore non-JSON error body */ }
  throw new ApiError(r.status, r.statusText, detail)
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, withAuth(init))
  if (!r.ok) await throwApiError(r)
  return r.json() as Promise<T>
}

/** 所有「返回二进制音频」的端点共用：发请求、解错、读 blob + Content-Type。 */
async function fetchAudio(
  path: string,
  init: RequestInit,
): Promise<{ blob: Blob; contentType: string }> {
  const r = await fetch(BASE + path, withAuth(init))
  if (!r.ok) await throwApiError(r)
  const blob = await r.blob()
  return { blob, contentType: r.headers.get("Content-Type") ?? "audio/wav" }
}

/** 仅追加已定义的字段，避免给后端发 "null"/"undefined" 字符串。 */
function appendDefined(fd: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null || value === "") return
  fd.append(key, String(value))
}

function appendCloneSampling(fd: FormData, s: CloneSampling): void {
  appendDefined(fd, "seed", s.seed)
  appendDefined(fd, "temperature", s.temperature)
  appendDefined(fd, "top_k", s.top_k)
  appendDefined(fd, "top_p", s.top_p)
  appendDefined(fd, "repetition_penalty", s.repetition_penalty)
  appendDefined(fd, "max_new_tokens", s.max_new_tokens)
}

export const api = {
  health: () => fetchJson<HealthResponse>("/v1/health"),
  voices: () => fetchJson<{ voices: VoiceInfo[] }>("/v1/voices").then(d => d.voices),
  languages: () => fetchJson<{ languages: string[] }>("/v1/languages").then(d => d.languages),
  previewUrl: (id: string) => `${BASE}/v1/voices/${encodeURIComponent(id)}/preview`,
  me: () => fetchJson<{ user: AuthUser }>("/api/auth/me").then((d) => {
    setAuthUser(d.user)
    return d.user
  }),
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

  // —— customvoice ——
  tts(req: NativeTTSRequest, signal?: AbortSignal) {
    return fetchAudio("/v1/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_format: "wav", ...req }),
      signal,
    })
  },

  // —— voicedesign ——
  ttsDesign(req: VoiceDesignRequest, signal?: AbortSignal) {
    return fetchAudio("/v1/tts/design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_format: "wav", ...req }),
      signal,
    })
  },

  // —— base：一步式克隆 ——
  clone(p: CloneParams, signal?: AbortSignal) {
    const fd = new FormData()
    fd.append("text", p.text)
    fd.append("ref_audio", p.refAudio, p.refAudioName ?? "ref_audio.wav")
    appendDefined(fd, "ref_text", p.refText)
    fd.append("x_vector_only", String(!!p.xVectorOnly))
    appendDefined(fd, "language", p.language ?? "Auto")
    appendDefined(fd, "response_format", p.responseFormat ?? "wav")
    appendCloneSampling(fd, p)
    return fetchAudio("/v1/clone", { method: "POST", body: fd, signal })
  },

  // —— base：保存音色为 .pt ——
  async saveVoice(p: SaveVoiceParams): Promise<{ blob: Blob; filename: string }> {
    const fd = new FormData()
    fd.append("ref_audio", p.refAudio, p.refAudioName ?? "ref_audio.wav")
    appendDefined(fd, "ref_text", p.refText)
    fd.append("x_vector_only", String(!!p.xVectorOnly))
    const r = await fetch(BASE + "/v1/voice/save", withAuth({ method: "POST", body: fd }))
    if (!r.ok) await throwApiError(r)
    const blob = await r.blob()
    const cd = r.headers.get("Content-Disposition") ?? ""
    const m = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(cd)
    const filename = m ? decodeURIComponent(m[1]) : "voice.pt"
    return { blob, filename }
  },

  // —— base：用保存的 .pt 合成 ——
  generateFromVoice(p: GenerateFromVoiceParams, signal?: AbortSignal) {
    const fd = new FormData()
    fd.append("text", p.text)
    fd.append("voice_prompt", p.voicePrompt, p.voicePromptName ?? "voice.pt")
    appendDefined(fd, "language", p.language ?? "Auto")
    appendDefined(fd, "response_format", p.responseFormat ?? "wav")
    appendCloneSampling(fd, p)
    return fetchAudio("/v1/voice/generate", { method: "POST", body: fd, signal })
  },

  // —— share / gallery ——
  gallery: () => fetchJson<{ items: ShareWork[] }>("/v1/gallery").then((d) => d.items),
  share: (slug: string) => fetchJson<ShareWork>(`/v1/share/${encodeURIComponent(slug)}`),
  shareAudioUrl: (slug: string, variantId: string) =>
    `${BASE}/v1/share/${encodeURIComponent(slug)}/audio/${encodeURIComponent(variantId)}`,
  publishShare(meta: ShareMetadata, audioByVariant: Record<string, Blob>) {
    const fd = new FormData()
    fd.append("metadata", JSON.stringify(meta))
    for (const [id, blob] of Object.entries(audioByVariant)) {
      fd.append(`audio_${id}`, blob, `${id}.wav`)
    }
    return fetchJson<{ slug: string; url: string }>("/v1/share/publish", { method: "POST", body: fd })
  },
  regenerate: (sourceSlug: string, newText: string) =>
    fetchJson<RegenerateResult>("/v1/share/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_slug: sourceSlug, new_text: newText }),
    }),
}
