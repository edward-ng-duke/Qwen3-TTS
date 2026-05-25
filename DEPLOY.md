# Qwen3-TTS 部署指南

一份镜像、三个 1.7B 变体，按 `MODEL_VARIANT` 在容器启动时选择。

| 变体 | 用途 | 端点集 |
|---|---|---|
| `customvoice`（默认） | 9 个预置音色 + instruct 情绪控制 | `/v1/tts`, `/v1/tts/stream`, `/v1/audio/speech`, `/v1/voices`, `/v1/voices/{id}/preview` |
| `voicedesign` | 用文字描述生成虚拟人 / 角色 / 短视频配音音色 | `/v1/tts/design` |
| `base` | 3 秒参考音频克隆任何人的声音 | `/v1/clone`, `/v1/voice/save`, `/v1/voice/generate` |

三个变体都共用 `/v1/health`、`/v1/languages`，以及挂在 `/legacy/` 的 Gradio UI（customvoice 用自定义 UI + React 在 `/`，其它两个用 Qwen 官方 Gradio + `/` 307 重定向到 `/legacy/`）。

完整 API 参考见 [API.md](./API.md)。

---

## 0. 前置条件

| | 最低 | 推荐 |
|---|---|---|
| GPU | 1× NVIDIA，显存 ≥ 8 GB（bfloat16/FP16），CUDA 12.x 驱动 | 1× 24 GB（如 RTX 3090 / 4090 / A10） |
| 磁盘 | ~20 GB 镜像 + 12 GB 权重 ≈ 32 GB | 50 GB+ 余量 |
| 内存 | 16 GB | 32 GB |
| 软件 | Docker 24+、`docker compose` v2、`nvidia-container-toolkit` | 同左 |

确认 GPU 在 Docker 里可见：
```bash
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi
```
能看到显卡列表即可继续。

---

## 1. 下载权重（构建前必做）

镜像采用 **host-bake** 策略：先在宿主机下载好权重，`Dockerfile` 用 `COPY` 烘进镜像 —— 构建本身不再访问网络，部署到离线环境也能用。

### 方式 A — 使用项目脚本（推荐）

```bash
cd /path/to/Qwen3-TTS

# 默认下三套（约 12 GB）
./scripts/download-weights.sh

# 只下某一个
./scripts/download-weights.sh --variant voicedesign
./scripts/download-weights.sh --variant base
./scripts/download-weights.sh --variant customvoice

# 大陆推荐用 ModelScope（速度更稳）
WEIGHT_SOURCE=ms ./scripts/download-weights.sh
```

下完会得到（每个目录里都有 `model.safetensors`、`config.json`、tokenizer 等）：
```
models/
├── Qwen3-TTS-12Hz-1.7B-CustomVoice/
├── Qwen3-TTS-12Hz-1.7B-VoiceDesign/
└── Qwen3-TTS-12Hz-1.7B-Base/
```

> **注意：** 脚本会做 `pip install --upgrade "huggingface_hub[hf_transfer,cli]>=0.30"`。如果你已经在用受 `transformers<X.Y` 约束的 hf_hub 版本（比如 transformers 4.57 要求 `huggingface-hub<1.0`），先在专用 venv 里跑脚本，或者改用方式 B 手动下载。

### 方式 B — 手动 `hf` / `modelscope` CLI

```bash
pip install -U "huggingface_hub>=0.34,<1.0" hf_transfer
export HF_HUB_ENABLE_HF_TRANSFER=1

for name in CustomVoice VoiceDesign Base; do
  hf download "Qwen/Qwen3-TTS-12Hz-1.7B-${name}" \
    --local-dir "./models/Qwen3-TTS-12Hz-1.7B-${name}"
done
```

或 ModelScope：

```bash
pip install -U "modelscope>=1.18"
for name in CustomVoice VoiceDesign Base; do
  modelscope download --model "Qwen/Qwen3-TTS-12Hz-1.7B-${name}" \
    --local_dir "./models/Qwen3-TTS-12Hz-1.7B-${name}"
done
```

---

## 2. 构建镜像

```bash
docker compose build
```

构建依次完成：
- Node 22 编译 React UI（`web/dist`）
- NGC PyTorch 24.10 基础层
- `pip install` torch 2.5.1 + 项目依赖
- `COPY` 三套权重 → `/models/<variant-dir>/`
- 整合 React UI、暴露 4967 端口

镜像 tag：`qwen3-tts:local`。完整产物约 30 GB（PyTorch 基础层占大头）。

> 构建报错 "no such file or directory: models/..." → 跳回第 1 节先下完权重。

---

## 3. 启动 —— 选一个变体

`docker compose up -d` 默认起 customvoice。要切到另外两个，用环境变量。

### 3.1 CustomVoice（默认）—— 9 个预置音色

```bash
docker compose up -d
docker compose logs -f qwen-tts   # 等到 "Model loaded."
```

冒烟测试：

```bash
curl -s http://localhost:4967/v1/health | jq
# → {"status":"ok","model_ready":true,"model_path":"/models/Qwen3-TTS-12Hz-1.7B-CustomVoice","variant":"customvoice"}

curl -s http://localhost:4967/v1/voices | jq '.voices[].id'
# → "vivian", "ryan", "serena", ...

curl -X POST http://localhost:4967/v1/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"今天天气真好","speaker":"vivian","language":"Chinese","instruct":"用愤怒的语气说"}' \
  --output customvoice_out.wav
```

UI：
- React Studio：<http://localhost:4967/>
- 老 Gradio：<http://localhost:4967/legacy/>

### 3.2 VoiceDesign —— 文字描述生成音色

```bash
MODEL_VARIANT=voicedesign docker compose up -d
docker compose logs -f qwen-tts
```

冒烟：
```bash
curl -s http://localhost:4967/v1/health | jq .variant
# → "voicedesign"

curl -X POST http://localhost:4967/v1/tts/design \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "It is in the top drawer... wait, it is empty?",
    "instruct": "Speak in an incredulous tone, with a hint of panic.",
    "language": "English"
  }' \
  --output voicedesign_out.wav
```

UI：<http://localhost:4967/> 自动 307 → <http://localhost:4967/legacy/>（Qwen 官方 Gradio 的 VoiceDesign 面板）。

`/v1/voices` 在此变体下会返回 404 —— 这是预期，VoiceDesign 没有预置音色概念。

### 3.3 Base —— 3 秒克隆任何人的声音

```bash
MODEL_VARIANT=base docker compose up -d
docker compose logs -f qwen-tts
```

准备一份参考音频（3-30 秒 wav/mp3 都行）和它的文字转写：

```bash
# 一次性克隆并合成
curl -X POST http://localhost:4967/v1/clone \
  -F text="用克隆出来的音色读这段新文本。" \
  -F language=Chinese \
  -F ref_text="这是参考音频里说的内容。" \
  -F ref_audio=@my_ref.wav \
  --output cloned.wav

# 保存音色为 .pt（之后可复用）
curl -X POST http://localhost:4967/v1/voice/save \
  -F ref_text="这是参考音频里说的内容。" \
  -F ref_audio=@my_ref.wav \
  --output my_voice.pt

# 用保存好的音色合成新文本（无需再传参考音频）
curl -X POST http://localhost:4967/v1/voice/generate \
  -F text="用之前保存的音色说这句话。" \
  -F language=Chinese \
  -F voice_prompt=@my_voice.pt \
  --output out.wav
```

UI：同样 307 到 `/legacy/`，里面两个 Tab：「Clone & Generate」和「Save / Load Voice」。

切换变体 = 先 `docker compose down`，再用新的 `MODEL_VARIANT=xxx docker compose up -d`。

---

## 4. CLI 部署（不走 docker）

如果你想在裸 GPU 主机上直接跑：

```bash
pip install -e .[serve]

# 三种变体
python -m qwen_tts.serve --variant customvoice --models-root ./models
python -m qwen_tts.serve --variant voicedesign --models-root ./models
python -m qwen_tts.serve --variant base       --models-root ./models

# 或单纯用环境变量
MODEL_VARIANT=base MODELS_ROOT=./models python -m qwen_tts.serve
```

完整 CLI 参数：`python -m qwen_tts.serve --help`。

---

## 5. 排障

| 现象 | 原因 / 排查 |
|---|---|
| 容器启动后 `/v1/health` 一直 `{"status":"loading","model_ready":false}` | 模型还在装。看 `docker compose logs qwen-tts`，正常 20-60 秒。如果一直没好，多半 OOM —— 见下条。 |
| 日志 "CUDA out of memory" | 默认 `bfloat16`，1.7B 模型推理需要 ~5 GB。如果显存吃紧，加 `DTYPE=float16` 或调小 `max_new_tokens`。如果是 8 GB 卡跑 streaming + 多并发，降 `CONCURRENCY=1`。 |
| 镜像构建失败：`COPY models/Qwen3-TTS-12Hz-1.7B-...` 不存在 | 没下权重。回到第 1 节。 |
| `/v1/voices` 在 voicedesign / base 返回 404 | 预期行为 —— 那两个变体没有预置音色。 |
| `/legacy/` 是空白页 / 报错 | Gradio mount 失败，多半是模型没装好；先看 `/v1/health` 是否 `ok`。 |
| `flash_attn` 抱怨 ABI mismatch | 镜像默认 `ATTN_IMPL=sdpa` 已绕开。如果你自己重装了 flash-attn，确认它针对 `torch 2.5.1+cu124` 编译。 |
| `huggingface-hub>=0.34.0,<1.0 is required` | 宿主机的 `huggingface_hub` 被升过 1.0。`pip install "huggingface_hub<1.0,>=0.34"` 还原。 |
| 容器健康检查变红 | `curl http://localhost:4967/v1/health` 看返回；如果是 503 / 模型 load 错，看 `docker compose logs`. |

---

## 6. 离线 / 内网部署

镜像本身离线运行（`HF_HUB_OFFLINE=1` + `TRANSFORMERS_OFFLINE=1` 已写死在 Dockerfile）。流程：

1. 在能上网的机器跑第 1 + 2 节，得到 `qwen3-tts:local` 镜像。
2. `docker save qwen3-tts:local | gzip > qwen3-tts.tar.gz`（约 11 GB 压缩后）。
3. 内网机器 `docker load < qwen3-tts.tar.gz`。
4. 把 `docker-compose.yml` 拷过去，`docker compose up -d`。

无需把 `models/` 一起搬过去 —— 权重已经烘进镜像。

验证离线确实可用：
```bash
docker network disconnect bridge qwen3-tts
curl localhost:4967/v1/health   # 应仍 200
docker network connect bridge qwen3-tts
```

---

## 7. 监控与日志

容器日志：`docker compose logs -f qwen-tts`。

健康检查由 compose 内置（每 30 秒）；不健康会写进 `docker ps` 状态列。

服务自身没有 metrics / tracing 集成（私有部署假设有上层 nginx / sidecar 处理）。如果要接 Prometheus，建议在 nginx 层做请求计数；推理时延可以从应用日志的 `Starting Qwen3-TTS serve` 一行后看启动耗时，加 `--log-level debug` 看每次生成。

---

## 8. 升级 / 回滚

```bash
# 拉新代码
git pull

# 如果只改了代码不改权重：
docker compose build && docker compose up -d

# 如果新增了变体或更新了权重：
./scripts/download-weights.sh --variant <new-variant>
docker compose build && docker compose up -d
```

回滚：`git checkout <prev-tag>` 后重新 build。镜像 tag 始终是 `qwen3-tts:local`，要保留多版本就自己加 `docker tag qwen3-tts:local qwen3-tts:vN`。
