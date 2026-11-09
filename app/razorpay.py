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
from urllib.parse import quote_plus

import httpx

from app import plans, store

RAZORPAY_API = "https://api.razorpay.com/v1"
# Interim public payment page (no API keys). Accepts a fixed ?amount=<INR>.
DEFAULT_PAYMENT_PAGE = "https://razorpay.me/@helio"


def payment_page() -> str:
    return (os.getenv("RAZORPAY_PAYMENT_PAGE", DEFAULT_PAYMENT_PAGE) or DEFAULT_PAYMENT_PAGE).rstrip("/")


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


def plan_payment_links() -> dict[str, str]:
    """Static Razorpay Payment Links for each plan, created via Razorpay CLI.

    These are public Razorpay links for fixed amounts (one per paid pack), so
    the frontend can redirect directly to the hosted Razorpay checkout without
    calling the API to create an Order. Booking-created links do not need a
    server callback to exist, but activation after a payment is still manual
    until webhook + Orders API wiring is used.
    """

    links: dict[str, str] = {}
    for plan_id in plans.PAID_PLANS:
        url = os.getenv(f"RAZORPAY_PAYMENT_LINK_{plan_id.upper()}", "").strip()
        if url:
            links[plan_id] = url
    return links


def setup_details() -> dict[str, Any]:
    ready = all(_amount_for(plans.get_plan(plan_id)) for plan_id in plans.PAID_PLANS)
    interim = all(inr_amount(plans.get_plan(plan_id)) for plan_id in plans.PAID_PLANS)
    links = plan_payment_links()
    return {
        "configured": is_configured() or interim or bool(links),
        "mode": "razorpay" if is_configured() else "razorpay-link" if links else "razorpay-page",
        "provider": "razorpay",
        "currency": currency(),
        "trial_days": plans.trial_days(),
        "trial_enabled": plans.trial_days() > 0,
        "price_ready": bool(ready),
        "payment_page": payment_page() if not is_configured() else None,
        "payment_links": links,
        "required_env": ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_CURRENCY"],
        "missing": [name for name in ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET") if not os.getenv(name)],
    }


def _amount_for(plan: dict[str, Any]) -> int | None:
    """Charge amount in the smallest unit (paise/cents). Used by API checkout.

    The site's prices are locked in USD. A Razorpay account charging INR needs
    either an explicit pack amount (RAZORPAY_PRICE_STARTER / _PROFESSIONAL in
    paise) or an FX rate (RAZORPAY_INR_RATE). Never silently charge $15 as ₹15.
    """

    price = plan.get("price_monthly")
    if not price:
        return None
    if currency() == "USD":
        return int(round(float(price) * 100))
    explicit = os.getenv(f"RAZORPAY_PRICE_{str(plan.get('id', '')).upper()}", "").strip()
    if explicit:
        try:
            return int(explicit)
        except ValueError:
            return None
    rate = os.getenv("RAZORPAY_INR_RATE", "").strip()
    if rate:
        try:
            return int(round(float(price) * float(rate) * 100))
        except ValueError:
            return None
    return None


def inr_amount(plan: dict[str, Any]) -> int | None:
    """Fixed whole-rupee amount for the interim razorpay.me page.

    Preferred: RAZORPAY_PRICE_<PLAN> in rupees (e.g. 1299). Falls back to the
    smallest-unit helper ÷100 when an explicit paise/FX amount is set.
    """
    price = plan.get("price_monthly")
    if not price:
        return None
    explicit = os.getenv(f"RAZORPAY_PRICE_{str(plan.get('id', '')).upper()}", "").strip()
    if explicit:
        try:
            val = int(explicit)
            # Treat 4+ digits (or >= 10000) as paise from older config.
            return val // 100 if val >= 10000 else val
        except ValueError:
            return None
    smallest = _amount_for(plan)
    if smallest:
        return max(1, smallest // 100)
    return None


def _amount_hint(plan: dict[str, Any]) -> str:
    if currency() == "USD":
        return "This pack has no monthly price. Enable international payments on Razorpay or set RAZORPAY_CURRENCY."
    return (
        f"Set RAZORPAY_INR_RATE (for example 88) or RAZORPAY_PRICE_{str(plan.get('id', '')).upper()} "
        f"in paise so the ${plan.get('price_monthly')} pack is not charged as ₹{plan.get('price_monthly')}."
    )



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
    """Create a Razorpay payment link for a paid plan, or redirect to the
    interim razorpay.me page with a fixed amount while API setup is pending.

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

    # Interim path (no API keys): prefer a pre-created Razorpay Payment Link for
    # this plan when one is configured; otherwise fall back to the public
    # razorpay.me fixed-amount page.
    if not is_configured():
        links = plan_payment_links()
        if links.get(plan["id"]):
            intent_id = store.new_id("payme")
            with store.connect() as conn:
                conn.execute(
                    "INSERT INTO payment_links (id, account_id, plan_id, status, created_at) VALUES (?, ?, ?, ?, ?)",
                    (intent_id, account["id"], plan["id"], "created", store.now_iso()),
                )
            store.audit(account["id"], "billing.checkout", plan["id"], {"provider": "razorpay-link", "intent_id": intent_id, "amount_inr": inr_amount(plan)}, actor=user.get("email", "owner"))
            return {
                "ok": True,
                "mode": "razorpay-link",
                "url": links[plan["id"]],
                "session_id": intent_id,
                "plan": plan["id"],
                "amount": (inr_amount(plan) or 0) * 100,
                "currency": "INR",
                "message": f"Redirecting to Razorpay (₹{inr_amount(plan) or 0}). Activation is confirmed after payment is received.",
            }
        amt = inr_amount(plan)
        if not amt:
            return {"ok": False, "error": "invalid_amount", "message": f"Set RAZORPAY_PRICE_{str(plan.get('id', '')).upper()} (rupees) or RAZORPAY_PAYMENT_LINK_{str(plan.get('id', '')).upper()} to enable checkout."}
        intent_id = store.new_id("payme")
        with store.connect() as conn:
            conn.execute(
                "INSERT INTO payment_links (id, account_id, plan_id, status, created_at) VALUES (?, ?, ?, ?, ?)",
                (intent_id, account["id"], plan["id"], "created", store.now_iso()),
            )
        store.audit(account["id"], "billing.checkout", plan["id"], {"provider": "razorpay-page", "intent_id": intent_id, "amount_inr": amt}, actor=user.get("email", "owner"))
        note = quote_plus(f"Helio {plan['name']} {user.get('email', '')}")
        url = f"{payment_page()}?amount={amt}&purpose={note}"
        return {"ok": True, "mode": "razorpay-page", "url": url, "session_id": intent_id, "plan": plan["id"], "amount": amt, "currency": "INR", "message": f"Redirecting to Razorpay (₹{amt}). Activation is confirmed after payment is received."}

    amount = _amount_for(plan)
    if not amount:
        return {"ok": False, "error": "invalid_amount", "message": _amount_hint(plan)}

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


def build_order(*, plan_id: str, account: dict[str, Any], user: dict[str, Any], trial: bool = False) -> dict[str, Any]:
    """Create a Razorpay Order for embedded Checkout (the /pay page).

    Unlike payment links, an order keeps the customer on Helio while Razorpay's
    modal collects the payment. The order id is stored locally so verification
    and webhooks can activate the right account without trusting the browser.
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

    # Interim path (no API keys): prefer a pre-created Razorpay Payment Link for
    # this plan when one is configured; otherwise fall back to the public
    # razorpay.me fixed-amount page.
    if not is_configured():
        links = plan_payment_links()
        if links.get(plan["id"]):
            intent_id = store.new_id("payme")
            with store.connect() as conn:
                conn.execute(
                    "INSERT INTO payment_orders (id, account_id, plan_id, amount, currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (intent_id, account["id"], plan["id"], inr_amount(plan) or 0, "INR", "created", store.now_iso()),
                )
            store.audit(account["id"], "billing.checkout", plan["id"], {"provider": "razorpay-link", "intent_id": intent_id, "amount_inr": inr_amount(plan)}, actor=user.get("email", "owner"))
            return {
                "ok": True,
                "mode": "razorpay-link",
                "provider": "razorpay-link",
                "url": links[plan["id"]],
                "order_id": intent_id,
                "amount": (inr_amount(plan) or 0) * 100,
                "currency": "INR",
                "plan": plan["id"],
                "plan_name": plan["name"],
                "name": "Helio",
                "description": f"Helio {plan['name']} — ₹{inr_amount(plan) or 0}/mo",
                "prefill": {"name": user.get("name") or "", "email": user.get("email") or ""},
                "manual_activation": True,
                "message": f"Redirecting to Razorpay (₹{inr_amount(plan) or 0}, fixed). Activation is confirmed after payment is received.",
            }

        amt = inr_amount(plan)
        if not amt:
            return {"ok": False, "error": "billing_not_configured", "message": f"Set RAZORPAY_PRICE_{str(plan.get('id', '')).upper()} (rupees) to enable interim checkout."}
        intent_id = store.new_id("payme")
        with store.connect() as conn:
            conn.execute(
                "INSERT INTO payment_orders (id, account_id, plan_id, amount, currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (intent_id, account["id"], plan["id"], amt, "INR", "created", store.now_iso()),
            )
        store.audit(account["id"], "billing.checkout", plan["id"], {"provider": "razorpay-page", "intent_id": intent_id, "amount_inr": amt}, actor=user.get("email", "owner"))
        note = quote_plus(f"Helio {plan['name']} {user.get('email', '')}")
        url = f"{payment_page()}?amount={amt}&purpose={note}"
        return {
            "ok": True,
            "mode": "razorpay-page",
            "provider": "razorpay-page",
            "url": url,
            "order_id": intent_id,
            "amount": amt * 100,
            "currency": "INR",
            "plan": plan["id"],
            "plan_name": plan["name"],
            "name": "Helio",
            "description": f"Helio {plan['name']} — ₹{amt}/mo",
            "prefill": {"name": user.get("name") or "", "email": user.get("email") or ""},
            "manual_activation": True,
            "message": f"Redirecting to Razorpay (₹{amt}, fixed). Activation is confirmed after payment is received.",
        }

    amount = _amount_for(plan)
    if not amount:
        return {"ok": False, "error": "invalid_amount", "message": _amount_hint(plan)}

    body, err = _request(
        "POST",
        "/orders",
        {
            "amount": amount,
            "currency": currency(),
            "receipt": f"helio_{plan['id']}_{account['id'][-8:]}",
            "notes": {"account_id": account["id"], "plan": plan["id"]},
        },
    )
    if err:
        return {"ok": False, "error": "razorpay_error", "message": err}
    order_id = (body or {}).get("id") or ""
    if not order_id:
        return {"ok": False, "error": "razorpay_error", "message": "Razorpay did not return an order id."}

    with store.connect() as conn:
        conn.execute(
            "INSERT INTO payment_orders (id, account_id, plan_id, amount, currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (order_id, account["id"], plan["id"], amount, currency(), "created", store.now_iso()),
        )
    store.audit(account["id"], "billing.order", plan["id"], {"provider": "razorpay", "order_id": order_id, "amount": amount, "currency": currency()}, actor=user.get("email", "owner"))
    return {
        "ok": True,
        "mode": "razorpay",
        "provider": "razorpay",
        "order_id": order_id,
        "key_id": key_id(),
        "amount": int((body or {}).get("amount") or amount),
        "currency": (body or {}).get("currency") or currency(),
        "plan": plan["id"],
        "plan_name": plan["name"],
        "name": "Helio",
        "description": f"Helio {plan['name']} — monthly",
        "prefill": {"name": user.get("name") or "", "email": user.get("email") or ""},
        "notes": {"account_id": account["id"], "plan": plan["id"]},
    }


def get_order(order_id: str) -> dict[str, Any] | None:
    with store.connect() as conn:
        row = conn.execute(
            "SELECT id, account_id, plan_id, amount, currency, status, payment_id, created_at, paid_at FROM payment_orders WHERE id = ?",
            (order_id,),
        ).fetchone()
    return store.row_to_dict(row)


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """HMAC check for Checkout's handler response."""

    if not key_secret():
        return False
    digest = hmac.new(key_secret().encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature or "")


def activate_order(order_id: str, payment_id: str = "") -> dict[str, Any] | None:
    """Mark an order paid and move the account onto the pack. Idempotent."""

    with store.connect() as conn:
        row = conn.execute(
            "SELECT id, account_id, plan_id, status FROM payment_orders WHERE id = ?",
            (order_id,),
        ).fetchone()
        if not row:
            return None
        already_paid = row["status"] == "paid"
        if not already_paid:
            conn.execute(
                "UPDATE payment_orders SET status = 'paid', payment_id = ?, paid_at = ? WHERE id = ?",
                (payment_id or None, store.now_iso(), order_id),
            )
    if already_paid:
        return {"account_id": row["account_id"], "plan_id": row["plan_id"], "plan_name": plans.get_plan(row["plan_id"])["name"]}
    period_end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(timespec="seconds")
    store.upsert_subscription(row["account_id"], plan=row["plan_id"], status="active", current_period_end=period_end, cancel_at_period_end=False)
    store.audit(row["account_id"], "billing.activated", row["plan_id"], {"provider": "razorpay", "order_id": order_id, "payment_id": payment_id}, actor="system")
    return {"account_id": row["account_id"], "plan_id": row["plan_id"], "plan_name": plans.get_plan(row["plan_id"])["name"]}


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
    payload = body.get("payload") or {}

    if event_type == "payment.captured":
        entity = ((payload.get("payment") or {}).get("entity") or {})
        order_id = entity.get("order_id") or ""
        if order_id:
            activated = activate_order(order_id, entity.get("id") or "")
            if activated:
                return {"ok": True, "synced": activated["account_id"]}
        notes = entity.get("notes") or {}
        account_id, plan_id = notes.get("account_id"), notes.get("plan")
        if account_id and plan_id and plans.get_plan(plan_id) and plans.is_paid(plan_id):
            period_end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(timespec="seconds")
            store.upsert_subscription(account_id, plan=plan_id, status="active", current_period_end=period_end, cancel_at_period_end=False)
            store.audit(account_id, "billing.activated", plan_id, {"provider": "razorpay", "webhook": event_id or ""}, actor="system")
            return {"ok": True, "synced": account_id}

    if event_type == "order.paid":
        entity = ((payload.get("order") or {}).get("entity") or {})
        order_id = entity.get("id") or ""
        if order_id:
            activated = activate_order(order_id)
            if activated:
                return {"ok": True, "synced": activated["account_id"]}

    return {"ok": True, "ignored": event_type}
