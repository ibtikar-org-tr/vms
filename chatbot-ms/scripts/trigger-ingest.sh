#!/usr/bin/env bash
set -euo pipefail

# Trigger full website + database Vectorize ingest on a deployed chatbot Worker.
# Usage:
#   INTERNAL_SECRET=... CHATBOT_BASE_URL=https://dev.ibtikar.tr/ms/chatbot \
#     bash scripts/trigger-ingest.sh
#
# In CI, CHATBOT_BASE_URL is always ${VITE_SITE_URL}/ms/chatbot
# (frontend host + /ms/chatbot). Daily ingest remains on the Worker cron.



SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

CHATBOT_BASE_URL="${CHATBOT_BASE_URL:-}"
INTERNAL_SECRET="${INTERNAL_SECRET:-}"

if [[ -z "$CHATBOT_BASE_URL" ]]; then
  echo "CHATBOT_BASE_URL is required (e.g. https://dev.ibtikar.tr/ms/chatbot)"

  exit 1
fi

if [[ -z "$INTERNAL_SECRET" ]]; then
  echo "INTERNAL_SECRET is required to authorize ingest."
  exit 1
fi

INGEST_URL="${CHATBOT_BASE_URL%/}/internal/ingest"
echo "Triggering Vectorize ingest at ${INGEST_URL}"

curl -fsS -X POST "$INGEST_URL" \
  -H "Authorization: Bearer ${INTERNAL_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 300

echo ""
echo "Ingest request completed."
