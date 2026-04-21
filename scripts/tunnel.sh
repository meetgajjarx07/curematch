#!/usr/bin/env bash
# ── CureMatch public tunnel ──────────────────────────────────────
# Exposes the local Next.js dev server via a free Cloudflare Tunnel.
# No account or DNS config needed — URL is fresh each run.
#
# Prerequisites:
#   brew install cloudflared
#
# Run:
#   ./scripts/tunnel.sh
#
# The script:
#   1. Starts the Next.js dev server on :3000 if it isn't already running
#   2. Starts cloudflared → writes its public URL to /tmp/cloudflared.log
#   3. Prints the public https URL you can share
#
# The URL lives as long as the script (and the laptop) stays running.
# Ctrl-C to kill the tunnel. Next.js stays running.

set -euo pipefail

cd "$(dirname "$0")/.."

# 1 · make sure Next.js is up
if ! curl -sf -o /dev/null http://localhost:3000 2>/dev/null; then
  echo "→ starting Next.js dev server on :3000 (background)…"
  (cd frontend && npm run dev >/tmp/curematch-next.log 2>&1 &)
  # Wait up to 45 s for port 3000
  for i in {1..45}; do
    sleep 1
    if curl -sf -o /dev/null http://localhost:3000; then
      echo "  ✓ Next.js responding"
      break
    fi
  done
fi

if ! curl -sf -o /dev/null http://localhost:3000; then
  echo "✗ Next.js is not responding on :3000 — see /tmp/curematch-next.log"
  exit 1
fi

# 2 · kill any previous cloudflared we spawned
pkill -f "cloudflared tunnel --url http://localhost:3000" 2>/dev/null || true
sleep 1

# 3 · start the tunnel
echo "→ starting Cloudflare tunnel…"
: > /tmp/cloudflared.log
cloudflared tunnel --url http://localhost:3000 > /tmp/cloudflared.log 2>&1 &
CF_PID=$!
trap "kill $CF_PID 2>/dev/null || true" EXIT

# 4 · wait for the public URL to appear in the log
URL=""
for i in {1..30}; do
  sleep 1
  URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/cloudflared.log | head -1 || true)
  if [ -n "$URL" ]; then break; fi
done

if [ -z "$URL" ]; then
  echo "✗ no public URL in cloudflared log — see /tmp/cloudflared.log"
  tail -20 /tmp/cloudflared.log
  exit 1
fi

echo
echo "══════════════════════════════════════════════════════════════"
echo "  CureMatch is live at:"
echo
echo "  $URL"
echo
echo "  Keep this terminal open. Ctrl-C to stop the tunnel."
echo "══════════════════════════════════════════════════════════════"
echo

# 5 · stream cloudflared logs so the user can see health
tail -f /tmp/cloudflared.log
