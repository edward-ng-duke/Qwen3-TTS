# Qwen3-TTS API

Base URL: `http://localhost:4967`（默认；通过 `PORT` 环境变量改）

所有接口都是**无状态**的：每次请求自包含全部参数，不依赖 cookie / session。
交互式 Swagger 文档：`http://localhost:4967/docs`

---

## 快速开始

```bash
# 健康检查
curl http://localhost:4967/v1/health

# 列出 9 个内置音色
curl http://localhost:4967/v1/voices | jq

# 中文 + 愤怒情绪 + 下载 WAV
curl -X POST http://localhost:4967/v1/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"今天天气真好","speaker":"vivian","language":"Chinese","instruct":"用愤怒的语气说"}' \
  --output out.wav

# OpenAI 兼容客户端（可直接配 OpenAI SDK 的 base_url）
curl -X POST http://localhost:4967/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3-tts","input":"Hello","voice":"Ryan","response_format":"mp3"}' \
  --output hello.mp3
```

---

## 端点一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/v1/health` | 服务/模型就绪状态 |
| GET | `/v1/voices` | 9 个音色元数据 + 试听链接 |
| GET | `/v1/voices/{voice_id}/preview` | 试听音频（首次自动生成并缓存） |
| GET | `/v1/languages` | 支持的语言列表 |
| POST | `/v1/tts` | **原生端点**：完整参数（instruct、sampling、seed） |
| POST | `/v1/tts/stream` | 流式 PCM（chunked transfer） |
| POST | `/v1/audio/speech` | **OpenAI 兼容**端点 |

---

## 元信息接口

### `GET /v1/health`
```json
{"status":"ok","model_ready":true,"model_path":"/models/..."}
```
`status` ∈ `ok | loading | error`。

### `GET /v1/voices`
```json
{"voices":[
  {"id":"vivian","display_name":"Vivian","gender":"female","age_group":"adult",
   "language":"Chinese","accent":"Mandarin","description":"...",
   "preview_url":"/v1/voices/vivian/preview"},
  ...
]}
```
9 个：`vivian, ryan, serena, uncle_fu, aiden, ono_anna, sohee, eric, dylan`。

### `GET /v1/languages`
```json
{"languages":["Auto","Chinese","English","Japanese","Korean","German","French","Russian","Portuguese","Spanish","Italian"]}
```

---

## 原生 TTS：`POST /v1/tts`

请求体：
```json
{
  "text": "今天天气真好",                      // 必填
  "speaker": "vivian",                         // 必填，从 /v1/voices 的 id
  "language": "Chinese",                       // 可选，默认 "Auto"
  "instruct": "用愤怒的语气说",                 // 可选，自然语言控制情绪/风格
  "response_format": "wav",                    // 可选，wav | mp3 | flac | pcm
  "sampling": {                                // 可选；缺省走模型默认
    "temperature": 0.9,
    "top_k": 50,
    "top_p": 1.0,
    "repetition_penalty": 1.05,
    "max_new_tokens": 2048,
    "subtalker_temperature": 0.9,
    "subtalker_top_k": 50,
    "subtalker_top_p": 1.0
  },
  "seed": null                                 // 可选；填 int 可复现
}
```

响应：二进制音频字节流，`Content-Type` 对应格式：
- `wav` → `audio/wav`
- `mp3` → `audio/mpeg`
- `flac` → `audio/flac`
- `pcm` → `audio/L16; rate=24000; channels=1`（int16 LE，无 header）

错误：400（参数缺失/校验失败）、500（模型异常）。

---

## 流式 TTS：`POST /v1/tts/stream`

请求体同 `/v1/tts`，外加：
```json
{"chunk_ms": 200}
```

返回 `Transfer-Encoding: chunked`，每个 chunk 是 raw PCM int16（按 `chunk_ms` 切分）。
**注意：** 当前实现是"先全量生成后分块输出"，不是真正的 token 级流式。

```bash
curl -N -X POST http://localhost:4967/v1/tts/stream \
  -H 'Content-Type: application/json' \
  -d '{"text":"流式测试","speaker":"vivian","language":"Chinese","chunk_ms":100}' \
  --output stream.pcm
```

---

## OpenAI 兼容：`POST /v1/audio/speech`

可以直接用 OpenAI Python SDK：
```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:4967/v1", api_key="not-needed")

with client.audio.speech.with_streaming_response.create(
    model="qwen3-tts",
    voice="Vivian",
    input="今天天气真好",
    response_format="mp3",
) as r:
    r.stream_to_file("out.mp3")
```

请求体：
```json
{
  "model": "qwen3-tts",            // 占位即可，实际模型由服务端决定
  "input": "Hello world",          // 必填
  "voice": "Vivian",               // 必填；大小写不敏感，自动 → 内置 speaker
  "response_format": "wav",        // 可选，wav | mp3 | flac | pcm
  "speed": 1.0                     // 可选，0.5-2.0 之间
}
```

**OpenAI 兼容端点不支持** `instruct` / `sampling` / `seed`，需要这些参数请用 `/v1/tts`。

`speed` 通过 librosa time-stretch 实现（不会改变音高）。

---

## 情绪 instruct 速查（推荐写法）

| 情绪 | 英文 instruct | 中文 instruct |
|---|---|---|
| 开心 | `Speak in a happy and cheerful tone.` | `用开心的语气说` |
| 悲伤 | `Speak in a sad and melancholic tone.` | `用悲伤的语气说` |
| 愤怒 | `Speak in an angry and intense tone.` | `用愤怒的语气说` |
| 害怕 | `Speak in a fearful and trembling tone.` | `用害怕颤抖的语气说` |
| 平静 | `Speak in a calm and soothing tone.` | `用平静温和的语气说` |
| 自定义 | 任意自然语言 | 例如：`像在悄悄说秘密一样` |

instruct 用模型本身的语言理解，**英中都接受**，可叠加修饰（例如：`用愤怒但克制的语气，缓慢地说`）。

---

## 限制

- 单次最大输出 `max_new_tokens=2048`（约 30-60 秒音频，取决于内容）。
- 文本超长会被截断；建议每次 ≤ 500 字。
- 没有鉴权 / 限流（私有部署，自行加 nginx 等前置）。
- 历史记录只在浏览器 IndexedDB 里（无后端持久化）。

---

## 模型变体 (Model Variants)

镜像内置三个 1.7B 模型，运行时通过 `MODEL_VARIANT` 环境变量选择（也可用 CLI `--variant` 覆盖）：

| MODEL_VARIANT | 模型 | 可用端点 |
|---|---|---|
| `customvoice`（默认） | Qwen3-TTS-12Hz-1.7B-CustomVoice | `/v1/tts`, `/v1/tts/stream`, `/v1/audio/speech`, `/v1/voices`, `/v1/voices/{id}/preview`, `/v1/languages`, `/v1/health` |
| `voicedesign` | Qwen3-TTS-12Hz-1.7B-VoiceDesign | `/v1/tts/design`, `/v1/languages`, `/v1/health` |
| `base` | Qwen3-TTS-12Hz-1.7B-Base | `/v1/clone`, `/v1/voice/save`, `/v1/voice/generate`, `/v1/languages`, `/v1/health` |

`/v1/health` 现在返回 `{"variant": "..."}` 字段。`/v1/voices*` 仅在 `customvoice` 下注册，其他变体调用会返回 404。

非-customvoice 变体下，`/` 会 307 重定向到 `/legacy/`（Qwen 官方 Gradio 界面），不挂载 React UI。

---

## VoiceDesign：`POST /v1/tts/design`

只在 `MODEL_VARIANT=voicedesign` 时可用。用一段自然语言描述生成对应音色的语音。

```json
{
  "text": "It's in the top drawer... wait, it's empty?",
  "instruct": "Speak in an incredulous tone, with a hint of panic.",
  "language": "Auto",
  "response_format": "wav",
  "sampling": {"temperature": 0.9, "top_k": 50},
  "seed": null
}
```

`instruct` 必填——它是音色/情绪的设计描述。返回值与 `/v1/tts` 一致。

---

## Voice Clone (Base)

只在 `MODEL_VARIANT=base` 时可用。三个端点协同工作：

### `POST /v1/clone` — 一次性克隆并合成

multipart/form-data 字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `ref_audio` | ✅ | 参考音频文件（wav/mp3/flac 任意 soundfile 支持的格式） |
| `text` | ✅ | 待合成文本 |
| `ref_text` | 视情况 | 参考音频的文字转写。`x_vector_only=true` 时可省略 |
| `x_vector_only` | optional | `true` 时只使用说话人向量（效果略差但不需要参考文本）。默认 `false` |
| `language` | optional | 默认 `Auto` |
| `response_format` | optional | `wav` / `mp3` / `flac` / `pcm`，默认 `wav` |
| `temperature` / `top_k` / `top_p` / `repetition_penalty` / `max_new_tokens` / `seed` | optional | 采样控制 |

```bash
curl -X POST http://localhost:4967/v1/clone \
  -F text="这是用克隆音色合成的语音" \
  -F language=Chinese \
  -F ref_text="这是参考音频的文字稿" \
  -F ref_audio=@ref.wav \
  --output cloned.wav
```

### `POST /v1/voice/save` — 保存可复用的音色文件

```bash
curl -X POST http://localhost:4967/v1/voice/save \
  -F ref_text="参考文字" \
  -F ref_audio=@ref.wav \
  --output my_voice.pt
```

返回 `application/octet-stream`，即一个可加载的 `.pt` blob（与 Qwen 官方 Gradio 保存的格式一致）。

### `POST /v1/voice/generate` — 用保存的音色文件合成

```bash
curl -X POST http://localhost:4967/v1/voice/generate \
  -F voice_prompt=@my_voice.pt \
  -F text="用之前保存的音色说这句话" \
  -F language=Chinese \
  --output out.wav
```
