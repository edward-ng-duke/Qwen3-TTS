#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRET_FILE="${JWT_SECRET_FILE:-$ROOT_DIR/auth_doc/jwt}"

if [[ ! -f "$SECRET_FILE" ]]; then
  echo "JWT secret file not found: $SECRET_FILE" >&2
  exit 1
fi

secret="$(tr -d '\r\n' < "$SECRET_FILE")"

if [[ -z "$secret" ]]; then
  echo "JWT secret file is empty: $SECRET_FILE" >&2
  exit 1
fi

if (( ${#secret} < 32 )); then
  echo "JWT secret is too short: $SECRET_FILE" >&2
  exit 1
fi

printf '%s' "$secret"
