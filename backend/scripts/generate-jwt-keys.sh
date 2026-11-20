#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-./jwt-keys}"
mkdir -p "$OUT_DIR"

openssl genrsa 2048 2>/dev/null | openssl pkcs8 -topk8 -nocrypt -out "$OUT_DIR/private.pem"
openssl rsa -in "$OUT_DIR/private.pem" -pubout -out "$OUT_DIR/public.pem" 2>/dev/null

echo "Wrote $OUT_DIR/private.pem and $OUT_DIR/public.pem"
echo
echo "One-line private key for wrangler secret / .dev.vars:"
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' "$OUT_DIR/private.pem"
echo
