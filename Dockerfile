# syntax=docker/dockerfile:1.7
#
# Build with model weights pre-downloaded to ./models/Qwen3-TTS-12Hz-1.7B-CustomVoice/
# (run ./scripts/download-weights.sh first). The build itself is fully offline
# for weights — only python packages are fetched.

###############################################################################
# Stage: web-build — compile the React frontend (web/dist).
###############################################################################
FROM node:22-alpine AS web-build
WORKDIR /web

# Use BuildKit cache mount to speed up iterative rebuilds
COPY web/package.json web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY web/ ./
RUN npm run build      # outputs to /web/dist

###############################################################################
# Stage: runtime
###############################################################################
FROM nvcr.io/nvidia/pytorch:24.10-py3 AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    MODELS_ROOT=/models \
    MODEL_VARIANT=customvoice \
    PREVIEW_CACHE_DIR=/var/qwen-tts/previews \
    HOST=0.0.0.0 \
    PORT=4967 \
    ATTN_IMPL=sdpa

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# NGC PyTorch 24.10 ships torch 2.5.0a0 + torchvision (matched) but NO
# torchaudio. Installing only torchaudio from PyPI causes pip to "upgrade"
# torch to 2.5.0 stable (its hard dep) and leave torchvision behind, broken.
# Solution: install the matching torch / torchvision / torchaudio triple from
# the PyTorch CUDA-12.4 index in one shot, then pin them via a constraints
# file so `pip install -e .[serve]` does not touch them again.
# Layered before project metadata and source so dependency/app edits don't
# invalidate this 3 GB layer.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --index-url https://download.pytorch.org/whl/cu124 \
        torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1

COPY pyproject.toml MANIFEST.in ./
COPY qwen_tts/ ./qwen_tts/

RUN --mount=type=cache,target=/root/.cache/pip \
    printf 'torch==2.5.1\ntorchvision==0.20.1\ntorchaudio==2.5.1\ngradio<6\ngradio_client<2\n' > /tmp/constraints.txt \
 && pip install -c /tmp/constraints.txt -e ".[serve]"

# Bake pre-downloaded weights into the image
# (run ./scripts/download-weights.sh first; default downloads all three variants).
COPY models/Qwen3-TTS-12Hz-1.7B-CustomVoice/ /models/Qwen3-TTS-12Hz-1.7B-CustomVoice/
COPY models/Qwen3-TTS-12Hz-1.7B-VoiceDesign/ /models/Qwen3-TTS-12Hz-1.7B-VoiceDesign/
COPY models/Qwen3-TTS-12Hz-1.7B-Base/        /models/Qwen3-TTS-12Hz-1.7B-Base/

# Bundle the React UI built in the web-build stage.
COPY --from=web-build /web/dist /app/web/dist

RUN mkdir -p "$PREVIEW_CACHE_DIR"

EXPOSE 4967

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4967/v1/health || exit 1

CMD ["python", "-m", "qwen_tts.serve", "--host", "0.0.0.0", "--port", "4967"]
