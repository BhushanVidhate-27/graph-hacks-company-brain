#!/usr/bin/env bash
# Switch Helio from Razorpay test billing to live monthly subscriptions.
#
# Prerequisites:
#   1. Razorpay account is KYC-verified and live keys are generated.
#   2. The live key pair is available either in the environment / .env
#      (RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET) or in the CLI config:
#        razorpay configure --key-id rzp_live_xxxxxxxx --key-secret '...' --output-format yaml
#   3. `render` CLI is logged in (it is: ~/.render/cli.yaml).
#
# What it does:
#   - Refuses to run unless the key is a live key.
#   - Creates (or reuses) one live monthly Plan per paid plan.
#   - Updates Render's Razorpay key + plan variables, preserving every other
#     variable (Render's env PUT replaces the whole set).
#   - Optionally sets RAZORPAY_WEBHOOK_SECRET when provided.
#   - Triggers a deploy and prints where to verify.
#
# It never prints a key, secret or webhook secret.

set -euo pipefail
cd "$(dirname "$0")/.."

SERVICE_ID="srv-db9l2uom7kps73dq32q0"
CONFIG="$HOME/.razorpay/config.yaml"

# Load .env without overriding variables already set in the shell.
if [ -f .env ]; then
  while IFS='=' read -r key value || [ -n "$key" ]; do
    case "$key" in ''|\#*) continue ;; esac
    if [ -z "${!key:-}" ]; then
      export "$key=$value"
    fi
  done < .env
fi

command -v razorpay >/dev/null 2>&1 || PATH="$HOME/.local/bin:$PATH"

# Prefer explicit env credentials (live keys from .env); fall back to the CLI.
key_id="${RAZORPAY_KEY_ID:-}"
key_secret="${RAZORPAY_KEY_SECRET:-}"
if [ -z "$key_id" ] || [ -z "$key_secret" ]; then
  key_id=$(awk -F': *' '/^key_id:/{print $2}' "$CONFIG" 2>/dev/null || true)
  key_secret=$(awk -F': *' '/^key_secret:/{print $2}' "$CONFIG" 2>/dev/null || true)
fi

case "$key_id" in
  rzp_live_*) ;;
  *)
    echo "No live Razorpay key found (found: ${key_id:-none})."
    echo "Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET, or run:"
    echo "  razorpay configure --key-id rzp_live_xxxxxxxx --key-secret '...' --output-format yaml"
    exit 1
    ;;
esac

[ -n "$key_secret" ] || { echo "Live key id found but no key secret."; exit 1; }

echo "Live key detected: ${key_id:0:12}…"

read -r -p "Create LIVE plans and point helio.runs-on.dev at them? [y/N] " answer
case "$answer" in
  y|Y) ;;
  *) echo "Aborted. Nothing changed."; exit 0 ;;
esac

echo "Ensuring live monthly plans…"
PLANS_JSON=$(RAZORPAY_KEY_ID="$key_id" RAZORPAY_KEY_SECRET="$key_secret" python3 - <<'PY'
import json
import os

import httpx

auth = (os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"])
wanted = [
    ("Helio Starter", 129900, "Starter"),
    ("Helio Professional", 429900, "Professional"),
]

existing = httpx.get(
    "https://api.razorpay.com/v1/plans",
    params={"count": 100},
    auth=auth,
    timeout=30,
).json()
items = existing.get("items") or existing.get("plans") or []

found: dict[str, str] = {}
for name, amount, _label in wanted:
    for plan in items:
        item = plan.get("item") or {}
        if (
            item.get("name") == name
            and int(item.get("amount") or 0) == amount
            and plan.get("period") == "monthly"
            and int(plan.get("interval") or 1) == 1
        ):
            found[name] = plan["id"]
            break

for name, amount, label in wanted:
    if name in found:
        continue
    resp = httpx.post(
        "https://api.razorpay.com/v1/plans",
        auth=auth,
        timeout=30,
        json={
            "period": "monthly",
            "interval": 1,
            "item": {
                "name": name,
                "amount": amount,
                "currency": "INR",
                "description": f"Helio {label} — monthly subscription",
            },
        },
    )
    body = resp.json()
    if resp.status_code != 200 or not body.get("id"):
        raise SystemExit(f"Could not create {name} plan: {body}")
    found[name] = body["id"]

print(json.dumps({"starter": found["Helio Starter"], "professional": found["Helio Professional"]}))
PY
)

STARTER_PLAN=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["starter"])' "$PLANS_JSON")
PROFESSIONAL_PLAN=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["professional"])' "$PLANS_JSON")

echo "Starter plan:      $STARTER_PLAN"
echo "Professional plan: $PROFESSIONAL_PLAN"

RAZORPAY_KEY_ID="$key_id" \
RAZORPAY_KEY_SECRET="$key_secret" \
STARTER_PLAN="$STARTER_PLAN" \
PROFESSIONAL_PLAN="$PROFESSIONAL_PLAN" \
RAZORPAY_WEBHOOK_SECRET="${RAZORPAY_WEBHOOK_SECRET:-}" \
SERVICE_ID="$SERVICE_ID" \
python3 - <<'PY'
import os
import re
from pathlib import Path

import httpx

service_id = os.environ["SERVICE_ID"]
token = re.search(r'api:\s*\n\s*key:\s*(\S+)', Path('~/.render/cli.yaml').expanduser().read_text()).group(1)
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
base = f"https://api.render.com/v1/services/{service_id}/env-vars"

current = httpx.get(f"{base}?limit=100", headers=headers, timeout=30).json()
env = [{"key": e["envVar"]["key"], "value": e["envVar"]["value"]} for e in current]

updates = {
    "RAZORPAY_KEY_ID": os.environ["RAZORPAY_KEY_ID"],
    "RAZORPAY_KEY_SECRET": os.environ["RAZORPAY_KEY_SECRET"],
    "RAZORPAY_PLAN_STARTER": os.environ["STARTER_PLAN"],
    "RAZORPAY_PLAN_PROFESSIONAL": os.environ["PROFESSIONAL_PLAN"],
    "RAZORPAY_PRICE_STARTER": "1299",
    "RAZORPAY_PRICE_PROFESSIONAL": "4299",
    "RAZORPAY_CURRENCY": "INR",
    "PAYMENT_PROVIDER": "razorpay",
    "RAZORPAY_PLAN_CHECKOUT": "1",
    "RAZORPAY_SUBSCRIPTION_TOTAL_COUNT": "120",
}
webhook_secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "").strip()
if webhook_secret:
    updates["RAZORPAY_WEBHOOK_SECRET"] = webhook_secret

for item in env:
    if item["key"] in updates:
        item["value"] = updates.pop(item["key"])
env.extend({"key": k, "value": v} for k, v in updates.items())

r = httpx.put(base, headers=headers, json=env, timeout=30)
print("Render env update:", r.status_code, f"({len(env)} variables kept)")
if r.status_code != 200:
    raise SystemExit("Render env update failed; not deploying.")
PY

if command -v render >/dev/null 2>&1; then
  render deploys create "$SERVICE_ID" --confirm
  echo "Deploy triggered."
else
  echo "render CLI not found; deploy manually."
fi

echo "Verify: curl -s https://helio.runs-on.dev/api/plans | python3 -m json.tool | grep -A12 billing"
