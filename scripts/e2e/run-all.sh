#!/usr/bin/env bash
# Sprint B — E2E suite orquestrador. Roda todos cenários sequencialmente.
# Uso: bash scripts/e2e/run-all.sh [server-url]

set -u
SERVER="${1:-http://localhost:3001}"
OUTPUT_DIR="scripts/e2e/out"
mkdir -p "$OUTPUT_DIR"

TS=$(date -u +%Y%m%dT%H%M%SZ)
LOG="$OUTPUT_DIR/run-$TS.json"

echo "Running E2E suite against $SERVER"
echo "Output: $LOG"

npx tsx scripts/e2e/runner.ts all --server="$SERVER" > "$LOG" 2>&1
EXIT=$?

if [ "$EXIT" -eq 0 ]; then
  echo "OK — all scenarios passed/skipped"
else
  echo "FAIL — see $LOG"
fi

exit "$EXIT"
