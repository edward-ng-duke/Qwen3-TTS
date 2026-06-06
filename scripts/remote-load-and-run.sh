#!/usr/bin/env bash
# Load the pre-built qwen3-tts image on a REMOTE machine and run it via compose.
# Copied into the deploy bundle by `make deploy-remote-*`. Self-contained: the
# image bakes in weights + deps + web UI, so we NEVER rebuild here (--no-build).
# Run from inside the bundle dir. Honors $PORT (default 4967).
set -euo pipefail
cd "$(dirname "$0")"

IMG_ZST="qwen3-tts-local.tar.zst"
PORT="${PORT:-4967}"
CONTAINER="qwen3-tts"

echo "==> [0/4] host check"
[ "$(uname -m)" = "x86_64" ] || { echo "    ERROR: host arch $(uname -m) != x86_64 (image is amd64)"; exit 1; }
command -v zstd >/dev/null   || { echo "    ERROR: zstd not installed (apt-get install -y zstd)"; exit 1; }

echo "==> [1/4] integrity check (sha256)"
if [ -f "${IMG_ZST}.sha256" ]; then
  sha256sum -c "${IMG_ZST}.sha256"
else
  echo "    (no .sha256 file; skipping)"
fi

echo "==> [2/4] decompress + docker load  (--long=31 must match compression)"
zstd -d --long=31 -T0 -c "${IMG_ZST}" | docker load

echo "==> [3/4] docker compose up -d --no-build"
docker compose up -d --no-build

echo "==> [4/4] waiting for model_ready=true (up to 300s)"
for i in $(seq 1 150); do
  r="$(curl -fsS "http://localhost:${PORT}/v1/health" 2>/dev/null || true)"
  case "$r" in
    *'"model_ready":true'*) echo "    READY (${i}x2s): $r"; echo; echo "==> done → http://localhost:${PORT}/"; exit 0;;
  esac
  if ! docker ps --filter "name=^${CONTAINER}$" --format '{{.Names}}' | grep -q "${CONTAINER}"; then
    echo "    container exited; recent logs:"; docker logs "${CONTAINER}" --tail 40 || true; exit 1
  fi
  sleep 2
done
echo "    timeout after 300s; recent logs:"; docker logs "${CONTAINER}" --tail 40 || true
exit 1
