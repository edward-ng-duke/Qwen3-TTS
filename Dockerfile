# syntax=docker/dockerfile:1.7
#
# Build with model weights pre-downloaded to ./models/Qwen3-TTS-12Hz-1.7B-CustomVoice/
# (run ./scripts/download-weights.sh first). The build itself is fully offline
# for weights — only python packages are fetched.

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

# NGC PyTorch 24.10 ships torch 2.5.0 + CUDA 12.6 but does NOT include
# torchaudio. The latest torchaudio on PyPI requires CUDA 13, which would
# break the runtime ("libcudart.so.13: cannot open shared object file").
# Install the CUDA-12 torchaudio 2.5.1 wheel explicitly with --no-deps so it
# doesn't drag a non-NGC torch in, then pin it via a constraints file so
# `pip install -e .[serve]` does not overwrite it. BuildKit cache mounts on
# /root/.cache/pip keep iterative rebuilds fast.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-deps torchaudio==2.5.1 \
        --index-url https://download.pytorch.org/whl/cu124
RUN --mount=type=cache,target=/root/.cache/pip \
    echo 'torchaudio==2.5.1' > /tmp/constraints.txt \
 && pip install -c /tmp/constraints.txt -e ".[serve]"

# Bake pre-downloaded weights into the image (run ./scripts/download-weights.sh first).
COPY models/Qwen3-TTS-12Hz-1.7B-CustomVoice/ /models/Qwen3-TTS-12Hz-1.7B-CustomVoice/

RUN mkdir -p "$PREVIEW_CACHE_DIR"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/v1/health || exit 1

CMD ["python", "-m", "qwen_tts.serve", "--host", "0.0.0.0", "--port", "8000"]
