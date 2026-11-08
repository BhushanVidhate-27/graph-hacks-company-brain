#!/usr/bin/env bash
# Keep Render free service awake: ping /health every 5 min (it sleeps after 15 idle).
# Usage: RENDER_URL=https://helio-brain.onrender.com bash scripts/ping-render.sh
set -u
RENDER_URL="${RENDER_URL:-https://helio-brain.onrender.com}"
INTERVAL="${INTERVAL:-300}"
MAX_RETRIES="${MAX_RETRIES:-2}"
LOG="${LOG:-/tmp/helio-render-ping.log}"

ping_once() {
  local attempt=1
  while (( attempt <= MAX_RETRIES )); do
    if curl -fsS --max-time 30 -o /dev/null "$RENDER_URL/health" 2>/dev/null; then
      echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ok ($RENDER_URL/health)" >> "$LOG"
      return 0
    fi
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) miss attempt=$attempt url=$RENDER_URL/health" >> "$LOG"
    sleep 10
    attempt=$((attempt+1))
  done
  return 1
}

echo "Pinging $RENDER_URL every ${INTERVAL}s (Ctrl-C to stop). Log: $LOG"
ping_once || true
while true; do
  sleep "$INTERVAL"
  ping_once || true
done
