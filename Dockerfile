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

# NGC PyTorch images ship torch / torchaudio / torchvision built against the
# image's CUDA toolkit. pip would otherwise upgrade torchaudio (and friends) to
# a CUDA-13 wheel and break the runtime. Freeze the pre-installed versions into
# a constraints file before installing our package.
RUN pip freeze | grep -E '^(torch|torchaudio|torchvision)==' > /tmp/torch-constraints.txt \
 && cat /tmp/torch-constraints.txt \
 && pip install --no-cache-dir -c /tmp/torch-constraints.txt -e ".[serve]"

# Bake pre-downloaded weights into the image (run ./scripts/download-weights.sh first).
COPY models/Qwen3-TTS-12Hz-1.7B-CustomVoice/ /models/Qwen3-TTS-12Hz-1.7B-CustomVoice/

RUN mkdir -p "$PREVIEW_CACHE_DIR"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/v1/health || exit 1

CMD ["python", "-m", "qwen_tts.serve", "--host", "0.0.0.0", "--port", "8000"]
