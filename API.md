# Qwen3-TTS API · 总览

Base URL：`http://localhost:4967`（默认；通过 `PORT` 环境变量改）

镜像内置三个 1.7B 模型，**一个容器只跑一个变体**，运行时通过 `MODEL_VARIANT` 环境变量选择（也可用 CLI `--variant` 覆盖）。每个变体暴露**不同的一套 `/v1/*` API**，本文件是总入口，详细接口见各变体文档。

所有接口都是**无状态**的：每次请求自包含全部参数，不依赖 cookie / session。
交互式 Swagger 文档：`http://localhost:4967/docs`（按变体生成）。

> 用户系统开启后，`/docs`、`/openapi.json`、Web UI 和 `/legacy/` 需要登录；`/v1/*` 模型 API 保持公开兼容，不要求用户 token。

---

## 变体选择（先看这张表）

| MODEL_VARIANT | 模型 | 一句话能力 | 可用端点 | 详细文档 |
|---|---|---|---|---|
| `customvoice`（默认） | Qwen3-TTS-12Hz-1.7B-CustomVoice | 9 个内置音色 + 情绪 instruct + OpenAI 兼容 | `/v1/tts`、`/v1/tts/stream`、`/v1/audio/speech`、`/v1/voices`、`/v1/voices/{id}/preview`、`/v1/languages`、`/v1/health` | [API_CUSTOMVOICE.md](API_CUSTOMVOICE.md) |
| `voicedesign` | Qwen3-TTS-12Hz-1.7B-VoiceDesign | 用自然语言**描述**凭空设计音色 | `/v1/tts/design`、`/v1/languages`、`/v1/health` | [API_VOICEDESIGN.md](API_VOICEDESIGN.md) |
| `base` | Qwen3-TTS-12Hz-1.7B-Base | 用参考音频**克隆**音色 | `/v1/clone`、`/v1/voice/save`、`/v1/voice/generate`、`/v1/languages`、`/v1/health` | [API_BASE.md](API_BASE.md) |

切换变体：

```bash
docker compose up -d                              # 默认 customvoice
MODEL_VARIANT=voicedesign docker compose up -d    # voicedesign
MODEL_VARIANT=base docker compose up -d           # base

# 或本机直接跑
python -m qwen_tts.serve --variant base --models-root ./models --attn-impl sdpa --port 4967
```

客户端 / 前端可调 `GET /v1/health` 读 `variant` 字段，自动判断当前连的是哪个变体。

---

## 共用约定（三变体通用）

- **采样率**：24000 Hz，单声道。
- **输出格式** `response_format`：`wav` | `mp3` | `flac` | `pcm`，默认 `wav`。响应是二进制音频流，`Content-Type` 随格式：

  | 格式 | Content-Type |
  |---|---|
  | `wav` | `audio/wav` |
  | `mp3` | `audio/mpeg` |
  | `flac` | `audio/flac` |
  | `pcm` | `audio/L16; rate=24000; channels=1`（无 header 的 int16 LE） |

- **全局生成锁**：服务端把所有生成请求**串行**（`_gen_lock`）。一条慢/卡的生成会阻塞整个生成接口（`/v1/health` 不受影响）。批量请求请串行发、给足超时；不要把 `temperature` 设得过低（如 0.3），个别句子可能退化到不收敛、长时间占锁。
- **长度**：`max_new_tokens` 默认 2048（约 30–60s 音频），文本建议 ≤ 500 字。
- **`seed`**：固定后「相同输入 + 相同 seed」可复现（实测字节一致）。
- **鉴权**：`/v1/*` 公开，无需 token（见下「用户系统」）。

---

## Web UI / Gradio

三个变体的根路径 `/` 都挂载**同一个 React 应用**（`web/dist`，`StaticFiles html=True`）；前端通过 `/v1/health.variant` 自适应渲染对应界面（CustomVoice 工作台 / VoiceDesign 声音设计 / Base 声音克隆）。Gradio 演示界面始终在 `/legacy/` 作为回退（customvoice 是本项目定制 Gradio，voicedesign / base 复用 Qwen 官方 demo）。若镜像内未构建 `web/dist`，`/` 会 307 跳 `/legacy/`。

部署细节见 [DEPLOY.md](DEPLOY.md)。

---

## 用户系统认证（可选）

当 `AUTH_ENABLED=auto` 且检测到共享 Mongo/JWT 配置，或显式设置 `AUTH_ENABLED=true` 时，浏览器 UI 和文档入口会启用登录保护。认证复用同一个 MongoDB `conference_ws.users` 集合和同一个 `JWT_SECRET_KEY`。

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/auth/me` | 使用 `access_token` cookie 或 Bearer token 获取当前用户 |
| `POST` | `/api/auth/login` | 用 Mongo 中已有用户登录，不创建用户 |
| `POST` | `/api/auth/logout` | 清理本系统 `access_token` cookie |
| `POST` | `/api/auth/verify-es-token` | 用 `token2` cookie 或 `X-token-2` 换取本系统 JWT |

登录成功会设置 HttpOnly `access_token` cookie。禁用或删除用户后，旧 JWT 会因为 Mongo 回查失败而失效。

---

## 快速开始（每个变体一条）

```bash
# customvoice：内置音色 + 情绪
curl -X POST http://localhost:4967/v1/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"今天天气真好","speaker":"vivian","language":"Chinese","instruct":"用愤怒的语气说"}' \
  --output out.wav

# voicedesign：描述设计音色
curl -X POST http://localhost:4967/v1/tts/design \
  -H 'Content-Type: application/json' \
  -d '{"text":"包裹在桌上，但标签不见了。","instruct":"沉稳精准的纪录片旁白","language":"Chinese"}' \
  --output design.wav

# base：参考音频克隆
curl -X POST http://localhost:4967/v1/clone \
  -F text="用克隆音色说这句话" -F ref_audio=@ref.wav \
  -F ref_text="参考音频的逐字内容" -F x_vector_only=false -F language=Chinese \
  --output cloned.wav
```

完整参数、Python 示例与注意事项见各变体文档（上表「详细文档」列）。
