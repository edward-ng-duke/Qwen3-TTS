# Qwen3-TTS VoiceDesign API

Base URL: `http://localhost:4967`（默认；通过 `PORT` 环境变量改）

VoiceDesign 变体通过自然语言描述来设计音色/情绪，并合成目标文本。启动时需要选择：

```bash
MODEL_VARIANT=voicedesign docker compose up -d
```

交互式 Swagger 文档：`http://localhost:4967/docs`

---

## 端点一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/v1/health` | 服务/模型就绪状态 |
| GET | `/v1/languages` | 支持语言列表 |
| POST | `/v1/tts/design` | 根据音色/风格描述生成语音 |

以下端点在 VoiceDesign 变体下不可用，返回 `404`：

- `/v1/voices`
- `/v1/voices/{voice_id}/preview`
- `/v1/tts`
- `/v1/tts/stream`
- `/v1/audio/speech`
- `/v1/clone`
- `/v1/voice/save`
- `/v1/voice/generate`

---

## 快速开始

```bash
# 启动 VoiceDesign
MODEL_VARIANT=voicedesign docker compose up -d

# 健康检查
curl -s http://localhost:4967/v1/health | jq

# 生成一个英文纪录片旁白风格的声音
curl -X POST http://localhost:4967/v1/tts/design \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "The package is on the table, but the label is missing.",
    "instruct": "Use a mature documentary narrator voice, calm and precise.",
    "language": "English",
    "response_format": "wav",
    "sampling": {"max_new_tokens": 512},
    "seed": 21
  }' \
  --output voicedesign.wav
```

---

## 元信息接口

### `GET /v1/health`

返回服务状态、模型路径和当前变体。

示例：

```json
{
  "status": "ok",
  "model_ready": true,
  "model_path": "/models/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
  "variant": "voicedesign"
}
```

字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | string | `ok` 表示模型已加载，`loading` 表示仍在加载 |
| `model_ready` | boolean | 模型是否可推理 |
| `model_path` | string | 当前加载的模型路径 |
| `variant` | string | 当前应为 `voicedesign` |

### `GET /v1/languages`

返回模型支持的语言列表。`Auto` 表示由模型自动判断。

示例：

```json
{
  "languages": [
    "Auto",
    "auto",
    "chinese",
    "english",
    "german",
    "italian",
    "portuguese",
    "spanish",
    "japanese",
    "korean",
    "french",
    "russian"
  ]
}
```

---

## 生成语音：`POST /v1/tts/design`

根据目标文本和自然语言音色描述生成音频。

### 请求体

```json
{
  "text": "The package is on the table, but the label is missing.",
  "instruct": "Use a mature documentary narrator voice, calm and precise.",
  "language": "English",
  "response_format": "wav",
  "sampling": {
    "temperature": 0.9,
    "top_k": 50,
    "top_p": 1.0,
    "repetition_penalty": 1.05,
    "max_new_tokens": 2048
  },
  "seed": 21
}
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---|---|
| `text` | 是 | 要合成的文本 |
| `instruct` | 是 | 音色、情绪、角色、语气、说话方式等自然语言描述 |
| `language` | 否 | 默认 `Auto` |
| `response_format` | 否 | `wav`、`mp3`、`flac`、`pcm`，默认 `wav` |
| `sampling` | 否 | 采样参数；缺省使用服务端默认值 |
| `seed` | 否 | 整数；用于尽量复现同一次生成 |

### 响应

成功时返回二进制音频。

| `response_format` | `Content-Type` | 说明 |
|---|---|---|
| `wav` | `audio/wav` | WAV 容器，24kHz 单声道 |
| `mp3` | `audio/mpeg` | MP3 音频 |
| `flac` | `audio/flac` | FLAC 音频 |
| `pcm` | `audio/L16; rate=24000; channels=1` | raw PCM int16 little-endian |

### 错误

| 场景 | 状态码 | 示例 |
|---|---:|---|
| `text` 为空 | 400 | `{"detail":"text is required"}` |
| `instruct` 为空 | 400 | `{"detail":"instruct is required"}` |
| `response_format` 不在允许值内 | 422 | Pydantic 校验错误 |
| 模型推理参数非法 | 400 | `{"detail":"..."}` |

---

## instruct 写法建议

`instruct` 是 VoiceDesign 的核心字段，建议直接描述目标声音，不要只写情绪词。

示例：

| 目标 | instruct 示例 |
|---|---|
| 纪录片旁白 | `Use a mature documentary narrator voice, calm and precise.` |
| 惊讶但紧张 | `Speak in an incredulous tone, with a hint of panic.` |
| 短视频口播 | `Use an energetic young creator voice, fast but clear.` |
| 温柔客服 | `Use a warm and patient customer service voice.` |
| 低沉角色音 | `Use a deep male character voice, restrained and serious.` |

---

## 可用性验证

本地已按以下方式实测：

- `MODEL_VARIANT=voicedesign docker compose up -d`
- `/v1/health` 返回 `variant=voicedesign` 且 `model_ready=true`
- `/v1/languages` 返回 200
- `/v1/voices` 返回 404，符合预期
- `/v1/tts` 返回 404，符合预期
- `/v1/tts/design` 返回 200，并生成可解码 WAV
- 生成音频实测为 24kHz 单声道，非静音，时长和波形能量正常

测试产物示例：`/tmp/qwen3-tts-api-functional/voicedesign_documentary.wav`

