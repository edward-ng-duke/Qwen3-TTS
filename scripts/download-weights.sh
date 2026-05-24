#!/usr/bin/env bash
# Download Qwen3-TTS 1.7B weights to ./models/ on the host.
# Run this ONCE before `docker compose build`. The Dockerfile COPYs from these
# directories, so the image build itself stays offline-ish.
#
# Usage:
#   ./scripts/download-weights.sh                       # download all three variants
#   ./scripts/download-weights.sh --variant voicedesign # one variant
#   WEIGHT_SOURCE=ms ./scripts/download-weights.sh      # use ModelScope (大陆推荐)

set -euo pipefail

VARIANT="${MODEL_VARIANT:-all}"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --variant) VARIANT="$2"; shift 2 ;;
        --variant=*) VARIANT="${1#*=}"; shift ;;
        *) echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
done

WEIGHT_SOURCE="${WEIGHT_SOURCE:-hf}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export HF_HUB_ENABLE_HF_TRANSFER=1

# variant_key -> "repo_suffix:local_dir_name"
declare -A VARIANTS=(
    [customvoice]="Qwen3-TTS-12Hz-1.7B-CustomVoice"
    [voicedesign]="Qwen3-TTS-12Hz-1.7B-VoiceDesign"
    [base]="Qwen3-TTS-12Hz-1.7B-Base"
)

case "$VARIANT" in
    all) KEYS=(customvoice voicedesign base) ;;
    customvoice|voicedesign|base) KEYS=("$VARIANT") ;;
    *) echo "Invalid --variant: $VARIANT (want: all|customvoice|voicedesign|base)" >&2; exit 2 ;;
esac

# Install client once.
if [ "$WEIGHT_SOURCE" = "ms" ]; then
    pip install --quiet --upgrade "modelscope>=1.18"
else
    pip install --quiet --upgrade "huggingface_hub[hf_transfer,cli]>=0.30"
fi

for key in "${KEYS[@]}"; do
    name="${VARIANTS[$key]}"
    repo="Qwen/${name}"
    local_dir="${REPO_ROOT}/models/${name}"
    mkdir -p "$local_dir"
    if [ "$WEIGHT_SOURCE" = "ms" ]; then
        echo "[download-weights] ModelScope: $repo -> $local_dir"
        modelscope download --model "$repo" --local_dir "$local_dir"
    else
        echo "[download-weights] HuggingFace: $repo -> $local_dir"
        hf download "$repo" --local-dir "$local_dir"
    fi
done

echo "[download-weights] Done."
