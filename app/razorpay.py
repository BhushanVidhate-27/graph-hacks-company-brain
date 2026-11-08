"""app/razorpay.py — Razorpay payment links (redirect checkout) + callback + webhook.

Razorpay is Helio's primary payment rail (user-verified account). Uses payment
links, which only need a redirect — no frontend JS SDK changes needed.

Env:
  RAZORPAY_KEY_ID        Key ID (rzp_live_… / rzp_test_…)
  RAZORPAY_KEY_SECRET    Key secret (never leaves server)
  RAZORPAY_WEBHOOK_SECRET (optional — only for /api/razorpay/webhook)
  RAZORPAY_CURRENCY      Default INR. USD requires international payments enabled.
  PAYMENT_PROVIDER       razorpay | stripe | local (default: razorpay when keys set, else existing)
"""

from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app import plans, store

RAZORPAY_API = "https://api.razorpay.com/v1"


def key_id() -> str:
    return os.getenv("RAZORPAY_KEY_ID", "").strip()


def key_secret() -> str:
    return os.getenv("RAZORPAY_KEY_SECRET", "").strip()


def webhook_secret() -> str:
    return os.getenv("RAZORPAY_WEBHOOK_SECRET", "").strip()


def currency() -> str:
    return (os.getenv("RAZORPAY_CURRENCY", "INR") or "INR").strip().upper()


def is_configured() -> bool:
    return bool(key_id() and key_secret())


def setup_details() -> dict[str, Any]:
    return {
        "configured": is_configured(),
        "mode": "razorpay",
        "currency": currency(),
        "trial_days": plans.trial_days(),
        "trial_enabled": plans.trial_days() > 0,
        "required_env": ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_CURRENCY"],
        "missing": [name for name in ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET") if not os.getenv(name)],
    }


def _amount_for(plan: dict[str, Any]) -> int:
    price = plan.get("price_monthly")
    if not price:
        return 0
    # INR is paise; USD-style units are cents — same *100 convention.
    return int(round(float(price) * 100))


def _request(method: str, path: str, data: dict[str, Any] | list[tuple[str, str]] | None = None) -> tuple[dict | None, str | None]:
    sid = key_id()
    secret = key_secret()
    if not sid or not secret:
        return None, "Razorpay is not configured."
    try:
        with httpx.Client(timeout=20) as client:
            response = client.request(method, f"{RAZORPAY_API}{path}", json=data if isinstance(data, dict) else None, data=data if isinstance(data, list) else None, auth=(sid, secret))
    except httpx.HTTPError as exc:
        return None, f"Could not reach Razorpay ({type(exc).__name__})."
    try:
        body = response.json()
    except ValueError:
        body = {"error": {"description": response.text[:200]}}
    if response.status_code >= 400:
        err = (body.get("error") or {}).get("description") or body.get("message") or f"HTTP {response.status_code}"
        return None, str(err)
    return body, None


def build_checkout(*, plan_id: str, account: dict[str, Any], user: dict[str, Any], success_url: str, cancel_url: str, trial: bool = False) -> dict[str, Any]:
    """Create a Razorpay payment link for a paid plan.

    Trials are granted locally (no charge) for HELIO_TRIAL_DAYS; payment happens
    when the user converts or pays for the first month.
    """

    plan = plans.get_plan(plan_id)
    if not plans.is_paid(plan["id"]):
        return {"ok": False, "error": "invalid_plan", "message": "The free plan does not require checkout."}

    days = plans.trial_days()
    if trial and days > 0:
        period_end = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat(timespec="seconds")
        store.upsert_subscription(account["id"], plan=plan["id"], status="trialing", current_period_end=period_end, cancel_at_period_end=False)
        store.audit(account["id"], "billing.trial_start", plan["id"], {"days": days}, actor=user.get("email", "owner"))
        return {"ok": True, "mode": "trial", "upgraded": True, "plan": plan["id"], "status": "trialing", "trial": True, "trial_days": days, "message": f"{plan['name']} trial started ({days} days, no card required)."}

    amount = _amount_for(plan)
    if amount <= 0:
        return {"ok": False, "error": "invalid_amount", "message": "This plan has no monthly price."}

    # Local map link -> account/plan, so the callback can activate without trusting redirect query params.
    body, err = _request(
        "POST",
        "/payment_links",
        {
            "amount": amount,
            "currency": currency(),
            "description": f"Helio {plan['name']} — monthly",
            "customer": {"name": user.get("name") or "Helio customer", "email": user.get("email")},
            "notify": {"sms": False, "email": True},
            "callback_url": f"{success_url}",
            "callback_method": "get",
            "notes": {"account_id": account["id"], "plan": plan["id"]},
        },
    )
    if err:
        return {"ok": False, "error": "razorpay_error", "message": err}
    link_id = (body or {}).get("id") or ""
    short_url = (body or {}).get("short_url") or (body or {}).get("url")
    if not link_id or not short_url:
        return {"ok": False, "error": "razorpay_error", "message": "Razorpay did not return a payment link."}
    with store.connect() as conn:
        conn.execute(
            "INSERT INTO payment_links (id, account_id, plan_id, status, created_at) VALUES (?, ?, ?, ?, ?)",
            (link_id, account["id"], plan["id"], "created", store.now_iso()),
        )
    store.audit(account["id"], "billing.checkout", plan["id"], {"provider": "razorpay", "link_id": link_id}, actor=user.get("email", "owner"))
    return {"ok": True, "mode": "razorpay", "url": short_url, "session_id": link_id, "plan": plan["id"], "message": "Redirecting to secure checkout…"}


def verify_callback_signature(payment_id: str, link_id: str, signature: str) -> bool:
    if not key_secret():
        return False
    digest = hmac.new(key_secret().encode(), f"{link_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature or "")


def activate_link(link_id: str) -> dict[str, Any] | None:
    with store.connect() as conn:
        row = conn.execute("SELECT id, account_id, plan_id FROM payment_links WHERE id = ?", (link_id,)).fetchone()
        if not row:
            return None
        conn.execute("UPDATE payment_links SET status = 'paid', paid_at = ? WHERE id = ?", (store.now_iso(), link_id))
    plan_name = plans.get_plan(row["plan_id"])["name"]
    period_end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(timespec="seconds")
    store.upsert_subscription(row["account_id"], plan=row["plan_id"], status="active", current_period_end=period_end, cancel_at_period_end=False)
    store.audit(row["account_id"], "billing.activated", row["plan_id"], {"provider": "razorpay", "link_id": link_id}, actor="system")
    return {"account_id": row["account_id"], "plan_id": row["plan_id"], "plan_name": plan_name}


def verify_webhook_signature(raw: bytes, signature: str | None) -> bool:
    secret = webhook_secret()
    if not secret or not signature:
        return False
    digest = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def handle_webhook(raw: bytes, event_id: str | None = None) -> dict[str, Any]:
    import json

    try:
        body = json.loads(raw or b"{}")
    except ValueError:
        return {"ok": False, "error": "invalid_json"}
    event_type = body.get("event", "")
    if event_type == "payment.captured":
        notes = (((body.get("payload") or {}).get("payment") or {}).get("entity") or {}).get("notes") or {}
        account_id, plan_id = notes.get("account_id"), notes.get("plan")
        if account_id and plan_id and plans.get_plan(plan_id) and plans.is_paid(plan_id):
            period_end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(timespec="seconds")
            store.upsert_subscription(account_id, plan=plan_id, status="active", current_period_end=period_end, cancel_at_period_end=False)
            store.audit(account_id, "billing.activated", plan_id, {"provider": "razorpay", "webhook": event_id or ""}, actor="system")
            return {"ok": True, "synced": account_id}
    return {"ok": True, "ignored": event_type}
