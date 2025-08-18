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

print_usage() {
  cat >&2 <<USAGE
Usage:
  # Transcribe (audio upload)
  bash scripts/curl-n8n.sh transcribe path/to/file.webm

  # Summary (text → summary)
  bash scripts/curl-n8n.sh summary path/to/text.txt [path/to/context.txt]

Notes:
  - Requires .env with VITE_N8N_TRANSCRIBE_URL and/or VITE_N8N_SUMMARY_URL.
  - If API key is needed, set VITE_N8N_API_KEY in .env.
USAGE
}

MODE="transcribe"
if [[ "${1:-}" == "transcribe" || "${1:-}" == "summary" ]]; then
  MODE="$1"
  shift
fi

KEY="$(read_env VITE_N8N_API_KEY || true)"

if [[ "$MODE" == "summary" ]]; then
  URL="$(read_env VITE_N8N_SUMMARY_URL)"
  if [[ -z "${URL:-}" ]]; then
    echo "[error] VITE_N8N_SUMMARY_URL is not set in .env" >&2
    print_usage
    exit 2
  fi
  TEXT_FILE="${1:-}"
  CONTEXT_FILE="${2:-}"
  if [[ -z "$TEXT_FILE" ]]; then
    echo "[error] Missing text file for summary" >&2
    print_usage
    exit 2
  fi
  if [[ ! -f "$TEXT_FILE" ]]; then
    echo "[error] File not found: $TEXT_FILE" >&2
    exit 2
  fi
  TEXT_CONTENT="$(cat "$TEXT_FILE")"
  if [[ -n "${CONTEXT_FILE:-}" ]]; then
    if [[ ! -f "$CONTEXT_FILE" ]]; then
      echo "[error] Context file not found: $CONTEXT_FILE" >&2
      exit 2
    fi
    CONTEXT_CONTENT="$(cat "$CONTEXT_FILE")"
  else
    CONTEXT_CONTENT=""
  fi
  echo "Posting summary text (len=${#TEXT_CONTENT}) with context (len=${#CONTEXT_CONTENT}) to: $URL"
  if [[ -n "${KEY:-}" ]]; then
    echo "Preview: curl -X POST -H 'Authorization: Bearer ***' --form-string 'text=...' --form-string 'context=...' '$URL'"
    curl -sS --fail-with-body -X POST -H "Authorization: Bearer $KEY" \
      --form-string "text=$TEXT_CONTENT" \
      $( [[ -n "$CONTEXT_CONTENT" ]] && printf -- "--form-string context=%s" "$CONTEXT_CONTENT" ) \
      "$URL"
  else
    echo "Preview: curl -X POST --form-string 'text=...' --form-string 'context=...' '$URL'"
    curl -sS --fail-with-body -X POST \
      --form-string "text=$TEXT_CONTENT" \
      $( [[ -n "$CONTEXT_CONTENT" ]] && printf -- "--form-string context=%s" "$CONTEXT_CONTENT" ) \
      "$URL"
  fi
  echo
  exit 0
fi

# Default: transcribe (audio upload)
FIELD="$(read_env VITE_UPLOAD_FIELD_NAME || true)"
[[ -n "${FIELD:-}" ]] || FIELD="audio"

URL="$(read_env VITE_N8N_TRANSCRIBE_URL)"
FILE_PATH="${1:-}"
if [[ -z "$FILE_PATH" ]]; then
  print_usage
  exit 2
fi
if [[ ! -f "$FILE_PATH" ]]; then
  echo "[error] File not found: $FILE_PATH" >&2
  exit 2
fi
if [[ -z "${URL:-}" ]]; then
  echo "[error] VITE_N8N_TRANSCRIBE_URL is not set in .env" >&2
  print_usage
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
