# Qwen3-TTS VoiceDesign 镜像 API 文档（按描述设计音色 / Voice Design）

> 适用于以 `MODEL_VARIANT=voicedesign`（模型 `Qwen3-TTS-12Hz-1.7B-VoiceDesign`）运行的服务。
> VoiceDesign 的核心能力是**用一段自然语言描述（`instruct`）凭空设计音色/角色/情绪**，并合成目标文本。
> 这里的 `instruct` 是**音色设计描述**，不是「在某个预置音色上叠加情绪」——它直接决定说话人是谁。
> 想要内置音色见 [`API_CUSTOMVOICE.md`](API_CUSTOMVOICE.md)；想用参考音频克隆见 [`API_BASE.md`](API_BASE.md)；总览见 [`API.md`](API.md)。

---

## 1. 概览

| 项 | 值 |
|---|---|
| Base URL | `http://<host>:<port>`（默认 `http://localhost:4967`，由 `PORT` 决定） |
| 变体 | `voicedesign`（`/v1/health` 返回 `"variant":"voicedesign"`） |
| 采样率 | 24000 Hz，单声道 |
| 鉴权 | `/v1/*` 公开，无需 token |
| 并发 | **全局生成锁，所有生成请求串行** |
| Swagger | `http://<host>:<port>/docs`（auth 开启时需登录） |

### 启动 voicedesign 服务
```bash
MODEL_VARIANT=voicedesign docker compose up -d

# 或本机
python -m qwen_tts.serve --variant voicedesign --models-root "$(pwd)/models" \
  --attn-impl sdpa --host 0.0.0.0 --port 4967
```

---

## 2. 端点一览

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/v1/health` | 服务/模型就绪状态 + `variant` |
| `GET` | `/v1/languages` | 支持的语言列表 |
| `POST` | `/v1/tts/design` | 按音色/风格描述生成语音 |

> 以下端点在 voicedesign 下**不存在**（404）：`/v1/voices`、`/v1/voices/{id}/preview`、`/v1/tts`、`/v1/tts/stream`、`/v1/audio/speech`、`/v1/clone`、`/v1/voice/save`、`/v1/voice/generate`。

---

## 3. 元信息接口

### `GET /v1/health`
```json
{"status":"ok","model_ready":true,"model_path":"/models/Qwen3-TTS-12Hz-1.7B-VoiceDesign","variant":"voicedesign"}
```
`status` ∈ `ok | loading | error`。

### `GET /v1/languages`
```json
{"languages":["Auto","auto","chinese","english","german","italian","portuguese","spanish","japanese","korean","french","russian"]}
```
语言匹配大小写不敏感；`Auto` 让模型自动判断。

---

## 4. 设计并合成：`POST /v1/tts/design`

请求体（`application/json`）：

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `text` | str | ✅ | — | 待合成文本 |
| `instruct` | str | ✅ | — | **音色设计描述**：性别、年龄、音色、角色、语气、语速、场景…（不要只写情绪词） |
| `language` | str | ❌ | `Auto` | 见 §3 语言列表 |
| `response_format` | enum | ❌ | `wav` | `wav` / `mp3` / `flac` / `pcm` |
| `sampling` | obj | ❌ | 服务端默认 | 同 customvoice 的 `SamplingParams`（temperature/top_k/top_p/repetition_penalty/max_new_tokens/subtalker_*） |
| `seed` | int | ❌ | `null` | 固定后可复现（同 instruct + 同 seed → 同一个声音） |

**响应**：二进制音频流，`Content-Type` 随 `response_format`（见 [`API.md`](API.md) 共用约定）。
**错误**：

| 场景 | 状态码 | 示例 |
|---|---:|---|
| `text` 为空 | 400 | `{"detail":"text is required"}` |
| `instruct` 为空 | 400 | `{"detail":"instruct is required"}` |
| `response_format` 非法 | 422 | Pydantic 校验错误 |
| 模型推理参数非法 | 400 | `{"detail":"..."}` |

```bash
curl -X POST http://localhost:4967/v1/tts/design \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "It is in the top drawer... wait, it is empty?",
    "instruct": "Speak in an incredulous tone, with a hint of panic.",
    "language": "English",
    "response_format": "wav",
    "sampling": {"max_new_tokens": 512},
    "seed": 21
  }' \
  --output design.wav
```

---

## 5. instruct 写法建议

`instruct` 是 VoiceDesign 的核心字段，建议**直接描述目标声音**，越具体越稳定（性别 + 年龄 + 音色 + 语气 + 场景）。

| 目标 | instruct 示例 |
|---|---|
| 纪录片旁白 | `沉稳精准的中年男播音腔，纪录片旁白` / `Use a mature documentary narrator voice, calm and precise.` |
| 惊讶但紧张 | `Speak in an incredulous tone, with a hint of panic.` |
| 短视频口播 | `活泼俏皮的少女配音，语调上扬，节奏偏快但吐字清楚` |
| 温柔客服 | `温柔耐心的客服女声` / `Use a warm and patient customer service voice.` |
| 低沉角色音 | `低沉磁性的男声角色，克制而严肃` |
| 萝莉撒娇 | `体现撒娇稚嫩的萝莉女声，音调偏高且起伏明显` |

这些示例同时也是前端「声音设计」工作台里的快捷示例。

---

## 6. 限制 / 注意事项

- VoiceDesign **没有内置音色、没有预置 speaker 列表**：声音完全由 `instruct` 决定，因此没有 `/v1/voices`。
- 同一段 `instruct` 在不同 `seed` 下声音会有差异；要复现/对拍请固定 `seed`。
- 单次最大输出 `max_new_tokens=2048`（约 30–60 秒），文本建议 ≤ 500 字。
- **全局生成锁**：所有生成串行；不要把 `temperature` 设得过低（个别句子可能不收敛、长时间占锁）。

---

## 7. 端到端最小示例（Python）

```python
import requests
BASE = "http://localhost:4967"

r = requests.post(f"{BASE}/v1/tts/design", json={
    "text": "欢迎收听今天的睡前故事。",
    "instruct": "温柔的 ASMR 耳语女声，气声明显，语速缓慢",
    "language": "Chinese",
    "response_format": "wav",
    "seed": 21,
})
r.raise_for_status()
open("design.wav", "wb").write(r.content)
```
