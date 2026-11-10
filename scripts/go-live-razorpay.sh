#!/usr/bin/env bash
# Switch Helio from Razorpay test links to live links.
#
# Prerequisites:
#   1. Razorpay account is KYC-verified and live keys are generated.
#   2. The CLI is configured with the LIVE key pair:
#        razorpay configure --key-id rzp_live_xxxxxxxx --key-secret '...' --output-format yaml
#   3. `render` CLI is logged in (it is: ~/.render/cli.yaml).
#
# What it does:
#   - Refuses to run unless the configured key is a live key.
#   - Creates (or reuses) one live payment link per paid plan.
#   - Updates Render's RAZORPAY_PAYMENT_LINK_* variables, preserving every
#     other variable (Render's env PUT replaces the whole set).
#   - Triggers a deploy and prints the resulting URLs.
#
# It never prints a key or secret.

set -euo pipefail
cd "$(dirname "$0")/.."

SERVICE_ID="srv-db9l2uom7kps73dq32q0"
CONFIG="$HOME/.razorpay/config.yaml"

command -v razorpay >/dev/null 2>&1 || PATH="$HOME/.local/bin:$PATH"
command -v razorpay >/dev/null 2>&1 || { echo "razorpay CLI not found"; exit 1; }

key_id=$(awk -F': *' '/^key_id:/{print $2}' "$CONFIG" 2>/dev/null || true)
case "$key_id" in
  rzp_live_*) ;;
  *)
    echo "CLI is not on a live key (found: ${key_id:-none})."
    echo "Run: razorpay configure --key-id rzp_live_xxxxxxxx --key-secret '...' --output-format yaml"
    exit 1
    ;;
esac

echo "Live key detected: ${key_id:0:12}…"

read -r -p "Create LIVE links and point helio.runs-on.dev at them? [y/N] " answer
case "$answer" in
  y|Y) ;;
  *) echo "Aborted. Nothing changed."; exit 0 ;;
esac

ensure_link() {
  local amount="$1" description="$2" reference="$3"
  local url
  url=$(razorpay payment-links list --reference-id "$reference" 2>/dev/null \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); links=d.get("payment_links") or []; print(links[0]["short_url"] if links else "")' \
    || true)
  if [ -n "$url" ]; then
    echo "$url"
    return
  fi
  razorpay payment-links create \
    --amount "$amount" \
    --currency INR \
    --description "$description" \
    --reference-id "$reference" \
    --checkout-name Helio \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["short_url"])'
}

echo "Creating live links…"
STARTER_URL=$(ensure_link 129900 "Helio Starter — ₹1,299/mo" "helio-starter-live")
PROFESSIONAL_URL=$(ensure_link 429900 "Helio Professional — ₹4,299/mo" "helio-professional-live")

echo "Starter:      $STARTER_URL"
echo "Professional: $PROFESSIONAL_URL"

python3 - "$STARTER_URL" "$PROFESSIONAL_URL" "$SERVICE_ID" <<'PY'
import re, sys
from pathlib import Path
import httpx

starter, professional, service_id = sys.argv[1:4]
token = re.search(r'api:\s*\n\s*key:\s*(\S+)', Path('~/.render/cli.yaml').expanduser().read_text()).group(1)
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
base = f'https://api.render.com/v1/services/{service_id}/env-vars'

current = httpx.get(f'{base}?limit=100', headers=headers, timeout=30).json()
env = [{'key': e['envVar']['key'], 'value': e['envVar']['value']} for e in current]
updates = {
    'RAZORPAY_PAYMENT_LINK_STARTER': starter,
    'RAZORPAY_PAYMENT_LINK_PROFESSIONAL': professional,
}
for item in env:
    if item['key'] in updates:
        item['value'] = updates.pop(item['key'])
env.extend({'key': k, 'value': v} for k, v in updates.items())

r = httpx.put(base, headers=headers, json=env, timeout=30)
print('Render env update:', r.status_code, f'({len(env)} variables kept)')
if r.status_code != 200:
    raise SystemExit('Render env update failed; not deploying.')
PY

if command -v render >/dev/null 2>&1; then
  render deploys create "$SERVICE_ID" --confirm
  echo "Deploy triggered. Verify: curl -s https://helio.runs-on.dev/api/plans | grep -A3 payment_links"
else
  echo "render CLI not found; deploy manually, then verify /api/plans."
fi
