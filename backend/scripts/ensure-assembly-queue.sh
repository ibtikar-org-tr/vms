#!/usr/bin/env bash
set -euo pipefail

QUEUE_NAME="${ASSEMBLY_QUEUE_NAME:-membership-app-backend-assembly-announcements}"
DLQ_NAME="${ASSEMBLY_DLQ_NAME:-membership-app-backend-assembly-announcements-dlq}"
WRANGLER_CONFIG="${WRANGLER_CONFIG:-}"

if [[ -z "$WRANGLER_CONFIG" && -f wrangler.local.jsonc ]]; then
  WRANGLER_CONFIG="wrangler.local.jsonc"
fi

WRANGLER_CONFIG_ARGS=()
if [[ -n "$WRANGLER_CONFIG" ]]; then
  WRANGLER_CONFIG_ARGS=(--config "$WRANGLER_CONFIG")
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required to manage Queues."
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "CLOUDFLARE_ACCOUNT_ID is required to manage Queues."
  exit 1
fi

is_auth_error() {
  local output="$1"
  echo "$output" | grep -qiE 'Authentication error|code: 10000|correct permissions|not have permission'
}

queue_exists() {
  local name="$1"
  local output="$2"
  echo "$output" | grep -Fqi "$name"
}

ensure_queue() {
  local name="$1"
  echo "Ensuring Cloudflare Queue '${name}'"

  set +e
  LIST_OUTPUT="$(wrangler queues list "${WRANGLER_CONFIG_ARGS[@]}" 2>&1)"
  LIST_STATUS=$?
  set -e

  if [[ "$LIST_STATUS" -ne 0 ]]; then
    if is_auth_error "$LIST_OUTPUT"; then
      echo "::warning::Cloudflare token cannot list Queues. Skipping queue ensure; deploy will fail if the queue is missing."
      echo "$LIST_OUTPUT"
      return 0
    fi
    echo "$LIST_OUTPUT"
    exit 1
  fi

  if queue_exists "$name" "$LIST_OUTPUT"; then
    echo "Queue already exists: ${name}"
    return 0
  fi

  echo "Creating queue: ${name}"
  set +e
  CREATE_OUTPUT="$(wrangler queues create "$name" "${WRANGLER_CONFIG_ARGS[@]}" 2>&1)"
  CREATE_STATUS=$?
  set -e

  if [[ "$CREATE_STATUS" -eq 0 ]]; then
    echo "Queue created: ${name}"
    return 0
  fi

  if echo "$CREATE_OUTPUT" | grep -qiE 'already exists|duplicate'; then
    echo "Queue already exists: ${name}"
    return 0
  fi

  if is_auth_error "$CREATE_OUTPUT"; then
    echo "::warning::Cloudflare token cannot create Queues. Skipping; deploy will fail if the queue is missing."
    echo "$CREATE_OUTPUT"
    return 0
  fi

  echo "$CREATE_OUTPUT"
  exit 1
}

ensure_queue "$QUEUE_NAME"
ensure_queue "$DLQ_NAME"
