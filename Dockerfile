# syntax=docker/dockerfile:1.7

###############################################################################
# Stage 1: download model weights
###############################################################################
FROM python:3.11-slim AS weights

ARG WEIGHT_SOURCE=hf
ARG MODEL_REPO=Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice
ARG LOCAL_DIR=/models/Qwen3-TTS-12Hz-1.7B-CustomVoice

ENV HF_HUB_ENABLE_HF_TRANSFER=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "huggingface_hub[hf_transfer,cli]>=0.25" "modelscope>=1.18"

RUN mkdir -p "$LOCAL_DIR" && \
    if [ "$WEIGHT_SOURCE" = "ms" ]; then \
        modelscope download --model "$MODEL_REPO" --local_dir "$LOCAL_DIR"; \
    else \
        hf download "$MODEL_REPO" --local-dir "$LOCAL_DIR"; \
    fi

###############################################################################
# Stage 2: runtime
###############################################################################
FROM nvcr.io/nvidia/pytorch:24.10-py3 AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    MODEL_PATH=/models/Qwen3-TTS-12Hz-1.7B-CustomVoice \
    PREVIEW_CACHE_DIR=/var/qwen-tts/previews \
    HOST=0.0.0.0 \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml MANIFEST.in ./
COPY qwen_tts/ ./qwen_tts/

RUN pip install --no-cache-dir -e ".[serve]"

COPY --from=weights /models /models
RUN mkdir -p "$PREVIEW_CACHE_DIR"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/v1/health || exit 1

CMD ["python", "-m", "qwen_tts.serve", "--host", "0.0.0.0", "--port", "8000"]
