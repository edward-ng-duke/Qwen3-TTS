# Qwen3-TTS CustomVoice 镜像 API 文档（内置音色 / 情绪 instruct / OpenAI 兼容）

> 适用于以 `MODEL_VARIANT=customvoice`（默认，模型 `Qwen3-TTS-12Hz-1.7B-CustomVoice`）运行的服务。
> CustomVoice 的核心能力是 **9 个内置音色**，可用自然语言 `instruct` 控制情绪/风格，并提供 **OpenAI 兼容**端点。
> 想凭空设计音色见 [`API_VOICEDESIGN.md`](API_VOICEDESIGN.md)；想用参考音频克隆见 [`API_BASE.md`](API_BASE.md)；总览见 [`API.md`](API.md)。

---

## 1. 概览

| 项 | 值 |
|---|---|
| Base URL | `http://<host>:<port>`（默认 `http://localhost:4967`，由 `PORT` 决定） |
| 变体 | `customvoice`（`/v1/health` 返回 `"variant":"customvoice"`） |
| 采样率 | 24000 Hz，单声道 |
| 鉴权 | `/v1/*` 公开，无需 token |
| 并发 | **全局生成锁，所有生成请求串行**（一次只跑一条） |
| Swagger | `http://<host>:<port>/docs`（auth 开启时需登录） |

### 启动 customvoice 服务
```bash
docker compose up -d          # MODEL_VARIANT 默认 customvoice

# 或本机
python -m qwen_tts.serve --variant customvoice --models-root "$(pwd)/models" \
  --attn-impl sdpa --host 0.0.0.0 --port 4967
```

---

## 2. 端点一览

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/v1/health` | 服务/模型就绪状态 + `variant` |
| `GET` | `/v1/voices` | 9 个内置音色元数据 + 试听链接 |
| `GET` | `/v1/voices/{voice_id}/preview` | 试听音频（首次自动生成并缓存，`audio/wav`） |
| `GET` | `/v1/languages` | 支持的语言列表 |
| `POST` | `/v1/tts` | **原生端点**：完整参数（instruct、sampling、seed） |
| `POST` | `/v1/tts/stream` | 流式 PCM（chunked transfer） |
| `POST` | `/v1/audio/speech` | **OpenAI 兼容**端点 |

> `/v1/tts/design`、`/v1/clone`、`/v1/voice/save`、`/v1/voice/generate` 在 customvoice 下**不存在**（404），分别属于 `voicedesign` / `base` 变体。

---

## 3. 元信息接口

### `GET /v1/health`
```json
{"status":"ok","model_ready":true,"model_path":"/models/Qwen3-TTS-12Hz-1.7B-CustomVoice","variant":"customvoice"}
```
`status` ∈ `ok | loading | error`。

### `GET /v1/voices`
返回 9 个内置音色。每个音色字段：`id`、`display_name`、`gender`、`age_group`、`language`、`accent`、`description`、`preview_url`。

| id | 名称 | 性别 | 年龄 | 语言 | 口音 | 描述 |
|---|---|---|---|---|---|---|
| `vivian` | Vivian | female | adult | Chinese | Mandarin | 温暖成熟的普通话女声，吐字清晰 |
| `ryan` | Ryan | male | adult | English | American | 自信的美式英语男声 |
| `serena` | Serena | female | young | English | British | 明亮的青年女声，带英式语调 |
| `uncle_fu` | Uncle Fu | male | senior | Chinese | Mandarin | 沙哑年长的普通话男声，讲故事节奏 |
| `aiden` | Aiden | male | young | English | American | 充满活力的美式青年男声 |
| `ono_anna` | Ono Anna | female | adult | Japanese | Standard | 干净利落的标准日语女声 |
| `sohee` | Sohee | female | young | Korean | Standard | 温柔的青年韩语女声 |
| `eric` | Eric | male | adult | German | Standard | 沉稳的标准德语男声 |
| `dylan` | Dylan | male | adult | English | British | 醇厚的英式男声，适合播客 |

```bash
curl -s http://localhost:4967/v1/voices | jq
```

### `GET /v1/voices/{voice_id}/preview`
返回该音色的试听 WAV（首次访问自动生成并缓存）。未知音色返回 404；生成失败返回 503。

### `GET /v1/languages`
```json
{"languages":["Auto","Chinese","English","Japanese","Korean","German","French","Russian","Portuguese","Spanish","Italian"]}
```

---

## 4. 原生 TTS：`POST /v1/tts`

请求体（`application/json`）：

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `text` | str | ✅ | — | 待合成文本 |
| `speaker` | str | ✅ | — | `/v1/voices` 的 `id`（如 `vivian`），大小写不敏感 |
| `language` | str | ❌ | `Auto` | 见 §3 语言列表 |
| `instruct` | str | ❌ | `null` | **内置音色上的情绪/风格控制**（自然语言，中英皆可）。它不改变音色身份 |
| `response_format` | enum | ❌ | `wav` | `wav` / `mp3` / `flac` / `pcm` |
| `sampling` | obj | ❌ | 服务端默认 | 见下表 |
| `seed` | int | ❌ | `null` | 固定后可复现 |

`sampling` 子字段（缺省走服务端默认）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `temperature` | 0.9 | 采样温度 |
| `top_k` | 50 | Top-K |
| `top_p` | 1.0 | Top-P |
| `repetition_penalty` | 1.05 | 重复惩罚 |
| `max_new_tokens` | 2048 | 最大生成长度（≈30–60s） |
| `subtalker_temperature` / `subtalker_top_k` / `subtalker_top_p` | 0.9 / 50 / 1.0 | 12Hz 子音轨采样 |

**响应**：二进制音频流，`Content-Type` 随 `response_format`（见 [`API.md`](API.md) 共用约定）。
**错误**：400（`text is required` / `speaker is required` / 模型参数非法）、422（`response_format` 不合法）。

```bash
curl -X POST http://localhost:4967/v1/tts \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "今天天气真好",
    "speaker": "vivian",
    "language": "Chinese",
    "instruct": "用愤怒的语气说",
    "response_format": "wav",
    "seed": 2024
  }' \
  --output out.wav
```

---

## 5. 流式 TTS：`POST /v1/tts/stream`

请求体同 `/v1/tts`，外加 `chunk_ms`（int，默认 200）。返回 `Transfer-Encoding: chunked`，每个 chunk 是 raw PCM int16 LE（按 `chunk_ms` 切分），媒体类型 `audio/L16; rate=24000; channels=1`。

> **注意**：当前实现是「先全量生成后分块输出」，**不是**真正的 token 级流式。

```bash
curl -N -X POST http://localhost:4967/v1/tts/stream \
  -H 'Content-Type: application/json' \
  -d '{"text":"流式测试","speaker":"vivian","language":"Chinese","chunk_ms":100}' \
  --output stream.pcm
```

---

## 6. OpenAI 兼容：`POST /v1/audio/speech`

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

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `model` | str | ❌ | `qwen3-tts-12hz-1.7b-customvoice` | 占位即可，实际模型由服务端决定 |
| `input` | str | ✅ | — | 待合成文本 |
| `voice` | str | ✅ | — | 内置 speaker，大小写不敏感（`Vivian` / `vivian` 都行）；未知音色：含大写则原样、全小写则首字母大写后交给模型（模型不认识会报错） |
| `response_format` | enum | ❌ | `wav` | `wav` / `mp3` / `flac` / `pcm` |
| `speed` | float | ❌ | `1.0` | `> 0`；通过 librosa time-stretch 实现（不改变音高），`<= 0` 返回 400 |

**OpenAI 兼容端点不支持** `instruct` / `sampling` / `seed`，需要这些参数请用 `/v1/tts`。

---

## 7. 情绪 instruct 速查（推荐写法）

| 情绪 | 英文 instruct | 中文 instruct |
|---|---|---|
| 开心 | `Speak in a happy and cheerful tone.` | `用开心的语气说` |
| 悲伤 | `Speak in a sad and melancholic tone.` | `用悲伤的语气说` |
| 愤怒 | `Speak in an angry and intense tone.` | `用愤怒的语气说` |
| 害怕 | `Speak in a fearful and trembling tone.` | `用害怕颤抖的语气说` |
| 平静 | `Speak in a calm and soothing tone.` | `用平静温和的语气说` |
| 自定义 | 任意自然语言 | 例如：`像在悄悄说秘密一样` |

instruct 用模型本身的语言理解，**英中都接受**，可叠加修饰（例如：`用愤怒但克制的语气，缓慢地说`）。
**与 voicedesign 的区别**：这里 instruct 是「在某个**预置音色**上叠加情绪/风格」，不会改变说话人身份；voicedesign 的 instruct 则是**设计音色本身**。

---

## 8. 限制 / 注意事项

- 单次最大输出 `max_new_tokens=2048`（约 30–60 秒音频，取决于内容）。
- 文本超长会被截断；建议每次 ≤ 500 字。
- **全局生成锁**：所有生成串行，一条慢/卡的请求阻塞整个生成接口；不要把 `temperature` 设得过低。
- 浏览器端历史只在本机 IndexedDB（无后端持久化）；`/v1/*` 无鉴权 / 限流（私有部署，自行加 nginx 等前置）。

---

## 9. 端到端最小示例（Python）

```python
import requests
BASE = "http://localhost:4967"

r = requests.post(f"{BASE}/v1/tts", json={
    "text": "你好，我是你的语音助手，很高兴为你服务。",
    "speaker": "vivian",
    "language": "Chinese",
    "instruct": "用平静温和的语气说",
    "response_format": "wav",
    "seed": 2024,
})
r.raise_for_status()
open("out.wav", "wb").write(r.content)
```
