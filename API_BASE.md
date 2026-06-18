# Qwen3-TTS Base 镜像 API 文档（音色克隆 / Voice Clone）

> 适用于以 `MODEL_VARIANT=base`（模型 `Qwen3-TTS-12Hz-1.7B-Base`）运行的服务。
> Base 变体的核心能力是**音色克隆**：用一条参考音频把音色"钉死"，之后说任意句子都是**同一个人**。
> 如需内置音色（vivian 等）或 OpenAI 兼容接口见 [`API_CUSTOMVOICE.md`](API_CUSTOMVOICE.md)；
> 想凭空设计音色见 [`API_VOICEDESIGN.md`](API_VOICEDESIGN.md)；总览见 [`API.md`](API.md)。

---

## 1. 概览

| 项 | 值 |
|---|---|
| Base URL | `http://<host>:<port>`（本机实测 `http://127.0.0.1:4970`；远程由 `PORT` 决定） |
| 变体 | `base`（`/v1/health` 返回 `"variant":"base"`） |
| 采样率 | 24000 Hz，单声道 |
| 鉴权 | `/v1/*` 公开，无需 token |
| 并发 | **全局生成锁，所有生成请求串行**（一次只跑一条，见 §6） |
| Swagger | `http://<host>:<port>/docs`（auth 开启时需登录） |

### 启动 base 服务
```bash
# 本机（flash-attn 未装时用 sdpa）
MODELS_ROOT="$(pwd)/models" python -m qwen_tts.serve \
  --variant base --models-root "$(pwd)/models" \
  --attn-impl sdpa --host 0.0.0.0 --port 4970

# 或容器：构建/运行时设环境变量 MODEL_VARIANT=base
```

---

## 2. 端点一览（base 变体实际注册的全部路由）

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/v1/clone` | **一步式克隆并合成**：传参考音频 + 目标文本，直接出音频 |
| `POST` | `/v1/voice/save` | 把参考音频**冻成可复用的 `.pt` 音色文件** |
| `POST` | `/v1/voice/generate` | 用保存的 `.pt` 音色文件合成（无需每次再传参考音频） |
| `GET` | `/v1/health` | 服务/模型就绪状态 |
| `GET` | `/v1/languages` | 支持的语言列表 |
| `GET` | `/` | 服务变体自适应 React 应用（`web/dist`）；未构建时回退 307 → `/legacy/` |
| `GET` | `/legacy` | 官方 Qwen Gradio 演示界面（始终可用，作回退） |

> 注意：`/v1/voices`、`/v1/tts`、`/v1/audio/speech`、`/v1/tts/design` **在 base 变体下不存在**（404）。
> 它们分别属于 `customvoice` / `voicedesign` 变体。

---

## 3. 核心接口：`POST /v1/clone`（一步式克隆）

**请求格式**：`multipart/form-data`

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `text` | str | ✅ | — | 待合成文本 |
| `ref_audio` | file | ✅ | — | 参考音频（wav/mp3/flac 等 soundfile 可解码格式；自动转单声道） |
| `ref_text` | str | 视情况 | `null` | 参考音频的**逐字转写**。`x_vector_only=false`（ICL 模式）时**必填** |
| `x_vector_only` | bool 串 | ❌ | `false` | `true` 仅用说话人向量（不需要 ref_text，保真略低）。真值：`1/true/yes/y/on` |
| `language` | str | ❌ | `Auto` | 见 §5 语言列表 |
| `response_format` | str | ❌ | `wav` | `wav` / `mp3` / `flac` / `pcm` |
| `seed` | int | ❌ | `null` | 固定后**同输入可复现**（实测同 seed 字节一致） |
| `temperature` | float | ❌ | 0.9 | 采样温度 |
| `top_k` | int | ❌ | 50 | Top-K |
| `top_p` | float | ❌ | 1.0 | Top-P |
| `repetition_penalty` | float | ❌ | 1.05 | 重复惩罚 |
| `max_new_tokens` | int | ❌ | 2048 | 最大生成长度（≈时长上限，约 30–60s） |

**响应**：音频二进制流，`Content-Type` 随 `response_format`（`wav→audio/wav`、`mp3→audio/mpeg`、`flac→audio/flac`、`pcm→audio/L16; rate=24000; channels=1`，pcm 为无 header 的 int16 LE）。
**错误**：400（缺 `text`；`x_vector_only=false` 却没给 `ref_text`；`ref_audio` 解码失败）。

### 示例（ICL 模式，推荐，保真最高）
```bash
curl --noproxy '*' -s http://127.0.0.1:4970/v1/clone \
  -F text="如果你有任何问题，随时都可以来找我。" \
  -F ref_audio=@ref.wav \
  -F ref_text="今天的天气非常晴朗，特别适合出去散步。" \
  -F x_vector_only=false \
  -F language=Chinese \
  -F seed=2024 \
  -F response_format=wav \
  -o out.wav
```

### 示例（x-vector 模式，省去转写）
```bash
curl --noproxy '*' -s http://127.0.0.1:4970/v1/clone \
  -F text="随时都可以来找我。" \
  -F ref_audio=@ref.wav \
  -F x_vector_only=true \
  -F language=Chinese \
  -o out.wav
```

---

## 4. 复用音色：`/v1/voice/save` + `/v1/voice/generate`

适合"同一个人念很多句"——把音色存一次，之后反复用，省去每次上传参考音频与重复提取。

### 4.1 `POST /v1/voice/save`（保存 `.pt`）
`multipart/form-data`：

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `ref_audio` | file | ✅ | — | 参考音频 |
| `ref_text` | str | 视情况 | `null` | `x_vector_only=false` 时必填 |
| `x_vector_only` | bool 串 | ❌ | `false` | 同上 |

**响应**：`application/octet-stream`，文件名 `voice.pt`（torch 序列化的 `{"items":[...]}`）。

```bash
curl --noproxy '*' -s http://127.0.0.1:4970/v1/voice/save \
  -F ref_audio=@ref.wav \
  -F ref_text="今天的天气非常晴朗，特别适合出去散步。" \
  -F x_vector_only=false \
  -o my_voice.pt
```

### 4.2 `POST /v1/voice/generate`（用 `.pt` 合成）
`multipart/form-data`：

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `text` | str | ✅ | — | 待合成文本 |
| `voice_prompt` | file | ✅ | — | 上一步保存的 `.pt` |
| `language` | str | ❌ | `Auto` | 语言 |
| `response_format` | str | ❌ | `wav` | 输出格式 |
| `seed` / `temperature` / `top_k` / `top_p` / `repetition_penalty` / `max_new_tokens` | — | ❌ | 同 §3 | 采样控制 |

```bash
curl --noproxy '*' -s http://127.0.0.1:4970/v1/voice/generate \
  -F text="明天可能会下雨，出门记得带上一把伞。" \
  -F voice_prompt=@my_voice.pt \
  -F language=Chinese \
  -F seed=2024 \
  -o out.wav
```

---

## 5. 元信息接口

### `GET /v1/health`
```json
{"status":"ok","model_ready":true,"model_path":"/.../Qwen3-TTS-12Hz-1.7B-Base","variant":"base"}
```
`status` ∈ `ok | loading | error`。

### `GET /v1/languages`
```json
{"languages":["Auto","auto","chinese","english","german","italian","portuguese","spanish","japanese","korean","french","russian"]}
```
语言匹配大小写不敏感；`Auto` 让模型自动判断。

---

## 5.1 参考音频从哪来（base 用什么声音？）

base **没有任何内置音色**，官方 demo 也不附带示例参考音频——声音 100% 由你传的 `ref_audio` 决定。
常见来源：

1. **现成参考音色库**：仓库 `samples/00_克隆参考音色库/` 收录了 9 条干净单人片段（customvoice 的
   vivian / ryan / serena / uncle_fu / aiden / ono_anna / sohee / eric / dylan），含每条的 `ref_text`，
   可直接当克隆源。
2. **你自己的录音**：一段干净 5–15s 的人声 + 对应文字稿，克隆出来就是"你"。
3. **任意目标说话人的干净片段**（注意版权/授权）。

参考音频越长越干净，克隆越像（建议 4–8s 起）。

## 6. 实测要点 / 注意事项

1. **要"始终是同一个人"** → 这就是 base 克隆的用途。实测配方：
   - 一条**干净、4–8 秒**的参考音频 + 它的**逐字转写**（`ref_text`）；
   - `x_vector_only=false`（ICL 模式，保真最高）；
   - 固定 `seed`。
   - 实测一条参考克隆 6 句不同文本，组内音色一致性比 customvoice **紧 3~4 倍**，且语调自然。
2. **seed 可复现**：本服务实测「相同输入 + 相同 seed」→ 输出**字节完全一致**。要复现/对拍就固定 seed。
3. **ICL vs x-vector**：ICL（带 `ref_text`）保真更高、更像；x-vector（`x_vector_only=true`）省去转写、对参考质量更鲁棒但略逊。
4. **全局生成锁**：服务端把所有生成请求**串行**（`_gen_lock`）。FastAPI 同步端点在客户端断开后**不取消**，因此**一条慢/卡的生成会阻塞整个生成接口**（`/v1/health` 不受影响）。批量请求请串行发、给足超时；不要把 `temperature` 设得过低（如 0.3），个别句子可能退化到不收敛、长时间占锁。
5. **`max_new_tokens`** 代码硬默认 2048（约 30–60s 音频）；文本建议 ≤ 500 字。
6. **本机性能**：未装 flash-attn 时用 `--attn-impl sdpa`，4090 上单条 ~2.5–3.5s。

---

## 7. 端到端最小示例（Python）

```python
import requests
BASE = "http://127.0.0.1:4970"

# 一步式克隆
with open("ref.wav", "rb") as f:
    r = requests.post(f"{BASE}/v1/clone", files={"ref_audio": f}, data={
        "text": "你好，我是你的语音助手，很高兴为你服务。",
        "ref_text": "今天的天气非常晴朗，特别适合出去散步。",
        "x_vector_only": "false",
        "language": "Chinese",
        "seed": 2024,
        "response_format": "wav",
    })
r.raise_for_status()
open("out.wav", "wb").write(r.content)
```
