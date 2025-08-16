#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[error] .env not found at $ENV_FILE" >&2
  exit 1
fi

read_env() {
  # Prints the last value for a given key from .env (simple parser)
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n1
}

URL="$(read_env VITE_N8N_API_URL)"
KEY="$(read_env VITE_N8N_API_KEY || true)"
FIELD="$(read_env VITE_UPLOAD_FIELD_NAME || true)"
[[ -n "${FIELD:-}" ]] || FIELD="audio"

FILE_PATH="${1:-}"
if [[ -z "$FILE_PATH" ]]; then
  echo "Usage: bash scripts/curl-n8n.sh path/to/file.webm" >&2
  exit 2
fi
if [[ ! -f "$FILE_PATH" ]]; then
  echo "[error] File not found: $FILE_PATH" >&2
  exit 2
fi
if [[ -z "${URL:-}" ]]; then
  echo "[error] VITE_N8N_API_URL is not set in .env" >&2
  exit 2
fi

if command -v file >/dev/null 2>&1; then
  MIME="$(file --mime-type -b "$FILE_PATH" || echo application/octet-stream)"
else
  MIME="application/octet-stream"
fi

echo "Posting $FILE_PATH as field '$FIELD' to: $URL"
if [[ -n "${KEY:-}" ]]; then
  echo "Preview: curl -X POST -H 'Authorization: Bearer ***' -F '$FIELD=@$FILE_PATH;type=$MIME' '$URL'"
  curl -sS --fail-with-body -X POST -H "Authorization: Bearer $KEY" \
    -F "$FIELD=@$FILE_PATH;type=$MIME" \
    "$URL"
else
  echo "Preview: curl -X POST -F '$FIELD=@$FILE_PATH;type=$MIME' '$URL'"
  curl -sS --fail-with-body -X POST \
    -F "$FIELD=@$FILE_PATH;type=$MIME" \
    "$URL"
fi
echo

