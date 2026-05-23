#!/usr/bin/env bash
# Download Qwen3-TTS-12Hz-1.7B-CustomVoice weights to ./models/ on the host.
# Run this ONCE before `docker compose build`. The Dockerfile COPYs from this
# directory, so the image build itself stays offline-ish (no model download).
#
# Usage:
#   ./scripts/download-weights.sh           # default: HuggingFace
#   WEIGHT_SOURCE=ms ./scripts/download-weights.sh   # use ModelScope (大陆推荐)

set -euo pipefail

MODEL_REPO="${MODEL_REPO:-Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice}"
WEIGHT_SOURCE="${WEIGHT_SOURCE:-hf}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DIR="${LOCAL_DIR:-$REPO_ROOT/models/Qwen3-TTS-12Hz-1.7B-CustomVoice}"

mkdir -p "$LOCAL_DIR"
export HF_HUB_ENABLE_HF_TRANSFER=1

if [ "$WEIGHT_SOURCE" = "ms" ]; then
    echo "[download-weights] Using ModelScope → $LOCAL_DIR"
    pip install --quiet --upgrade "modelscope>=1.18"
    modelscope download --model "$MODEL_REPO" --local_dir "$LOCAL_DIR"
else
    echo "[download-weights] Using HuggingFace → $LOCAL_DIR"
    pip install --quiet --upgrade "huggingface_hub[hf_transfer,cli]>=0.30"
    hf download "$MODEL_REPO" --local-dir "$LOCAL_DIR"
fi

echo "[download-weights] Done. Files:"
ls -lh "$LOCAL_DIR" | head -10
