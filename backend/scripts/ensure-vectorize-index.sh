#!/usr/bin/env bash
set -euo pipefail

# Must match @cf/baai/bge-m3 dense output used by note-embeddings.service.ts
INDEX_NAME="${VECTORIZE_INDEX_NAME:-vms-project-notes}"
DIMENSIONS="${VECTORIZE_DIMENSIONS:-1024}"
METRIC="${VECTORIZE_METRIC:-cosine}"
METADATA_PROPERTY="${VECTORIZE_METADATA_PROPERTY:-projectId}"
METADATA_TYPE="${VECTORIZE_METADATA_TYPE:-string}"
WRANGLER_CONFIG="${WRANGLER_CONFIG:-}"

if [[ -z "$WRANGLER_CONFIG" && -f wrangler.local.jsonc ]]; then
  WRANGLER_CONFIG="wrangler.local.jsonc"
fi

WRANGLER_CONFIG_ARGS=()
if [[ -n "$WRANGLER_CONFIG" ]]; then
  WRANGLER_CONFIG_ARGS=(--config "$WRANGLER_CONFIG")
fi

wrangler_vectorize() {
  wrangler vectorize "$@" "${WRANGLER_CONFIG_ARGS[@]}"
}

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required to manage Vectorize."
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "CLOUDFLARE_ACCOUNT_ID is required to manage Vectorize."
  exit 1
fi

is_auth_error() {
  local output="$1"
  echo "$output" | grep -qiE 'Authentication error|code: 10000|correct permissions|not have permission'
}

is_missing_index() {
  local output="$1"
  echo "$output" | grep -qiE 'not found|does not exist|couldn.t find|10159|code: 404'
}

echo "Ensuring Vectorize index '${INDEX_NAME}' (dimensions=${DIMENSIONS}, metric=${METRIC})"
if [[ -n "$WRANGLER_CONFIG" ]]; then
  echo "Using wrangler config: ${WRANGLER_CONFIG}"
fi

set +e
GET_OUTPUT="$(wrangler_vectorize get "$INDEX_NAME" --json 2>&1)"
GET_STATUS=$?
set -e

if [[ "$GET_STATUS" -eq 0 ]]; then
  echo "Vectorize index already exists: ${INDEX_NAME}"
elif is_auth_error "$GET_OUTPUT"; then
  echo "::warning::Cloudflare token cannot manage Vectorize. Skipping index ensure; deploy will fail if the index is missing."
  echo "$GET_OUTPUT"
  exit 0
elif is_missing_index "$GET_OUTPUT"; then
  echo "Creating Vectorize index: ${INDEX_NAME}"
  wrangler_vectorize create "$INDEX_NAME" \
    --dimensions="$DIMENSIONS" \
    --metric="$METRIC" \
    --description="VMS notes and tasks embeddings for @cf/baai/bge-m3"
else
  echo "$GET_OUTPUT"
  exit 1
fi

set +e
META_OUTPUT="$(wrangler_vectorize list-metadata-index "$INDEX_NAME" --json 2>&1)"
META_STATUS=$?
set -e

if [[ "$META_STATUS" -ne 0 ]]; then
  if is_auth_error "$META_OUTPUT"; then
    echo "::warning::Cloudflare token cannot list Vectorize metadata indexes. Continuing."
    echo "$META_OUTPUT"
    exit 0
  fi
  echo "$META_OUTPUT"
  exit 1
fi

if echo "$META_OUTPUT" | grep -q "$METADATA_PROPERTY"; then
  echo "Metadata index already exists: ${METADATA_PROPERTY}"
  exit 0
fi

echo "Creating metadata index: ${METADATA_PROPERTY} (${METADATA_TYPE})"
set +e
CREATE_META_OUTPUT="$(wrangler_vectorize create-metadata-index "$INDEX_NAME" --propertyName="$METADATA_PROPERTY" --type="$METADATA_TYPE" 2>&1)"
CREATE_META_STATUS=$?
set -e

if [[ "$CREATE_META_STATUS" -eq 0 ]]; then
  echo "Metadata index create requested: ${METADATA_PROPERTY}"
  exit 0
fi

if echo "$CREATE_META_OUTPUT" | grep -qiE 'already exists|duplicate'; then
  echo "Metadata index already exists: ${METADATA_PROPERTY}"
  exit 0
fi

if is_auth_error "$CREATE_META_OUTPUT"; then
  echo "::warning::Cloudflare token cannot create Vectorize metadata indexes. Continuing."
  echo "$CREATE_META_OUTPUT"
  exit 0
fi

echo "$CREATE_META_OUTPUT"
exit 1
