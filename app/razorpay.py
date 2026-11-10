"""app/razorpay.py — Razorpay subscriptions, payment links, orders and webhooks.

Razorpay is Helio's payment rail. Paid plans are sold as monthly Razorpay
Subscriptions: the customer authorises an e-mandate once on Razorpay's hosted
page and Razorpay charges the same amount every month until cancellation.
One-time payment links and one-time Orders remain as fallbacks so the site can
keep taking money before subscription plans are configured.

Env:
  RAZORPAY_KEY_ID        Key ID (rzp_live_… / rzp_test_…)
  RAZORPAY_KEY_SECRET    Key secret (never leaves server)
  RAZORPAY_WEBHOOK_SECRET (optional — only for /api/razorpay/webhook)
  RAZORPAY_CURRENCY      Default INR. USD requires international payments enabled.
  RAZORPAY_PLAN_STARTER  Monthly Plan id created with `razorpay subscriptions plans create`
  RAZORPAY_PLAN_PROFESSIONAL
  RAZORPAY_PLAN_CHECKOUT 1 to sell subscriptions, 0 to force one-time links
  RAZORPAY_PAYMENT_LINK_<PLAN>  One-time link fallback
  RAZORPAY_PRICE_<PLAN>  Whole-rupee price fallback (e.g. 1299)
  PAYMENT_PROVIDER       razorpay | stripe | local
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


def plan_id_for(plan_id: str) -> str:
    """Razorpay Plan id for a Helio plan (env-driven so test/live can differ)."""

    return os.getenv(f"RAZORPAY_PLAN_{str(plan_id).upper()}", "").strip()


def plan_for_razorpay_plan(razorpay_plan_id: str | None) -> str | None:
    if not razorpay_plan_id:
        return None
    for candidate in plans.PAID_PLANS:
        if plan_id_for(candidate) == razorpay_plan_id:
            return candidate
    return None


def subscriptions_ready() -> bool:
    """True when monthly subscriptions can be sold end to end."""

    if os.getenv("RAZORPAY_PLAN_CHECKOUT", "1").strip() == "0":
        return False
    return is_configured() and all(plan_id_for(plan) for plan in plans.PAID_PLANS)


def subscription_total_count() -> int:
    """Billing cycles in one mandate. 120 months = 10 years, effectively open-ended."""

    try:
        return max(1, int(os.getenv("RAZORPAY_SUBSCRIPTION_TOTAL_COUNT", "120")))
    except ValueError:
        return 120


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
    subscriptions = subscriptions_ready()
    return {
        "configured": is_configured() or interim or bool(links),
        "mode": "razorpay" if is_configured() else "razorpay-link" if links else "razorpay-page",
        "provider": "razorpay",
        "currency": currency(),
        "trial_days": plans.trial_days(),
        "trial_enabled": plans.trial_days() > 0,
        "price_ready": bool(ready),
        "subscriptions": subscriptions,
        "checkout_mode": "subscription" if subscriptions else "one-time",
        "subscription_plans": {
            plan_id: plan_id_for(plan_id) for plan_id in plans.PAID_PLANS if plan_id_for(plan_id)
        },
        "prices_inr": {
            plan_id: inr_amount(plans.get_plan(plan_id))
            for plan_id in plans.PAID_PLANS
            if inr_amount(plans.get_plan(plan_id))
        },
        "payment_page": payment_page() if not is_configured() else None,
        "payment_links": links,
        "required_env": ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_CURRENCY"],
        "missing": [name for name in ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET") if not os.getenv(name)],
    }


def _inr_price(plan: dict[str, Any]) -> int | None:
    """Monthly price in whole rupees for a plan, or None when it is unknown.

    ``RAZORPAY_PRICE_<PLAN>`` is configured in rupees (1299). Older configs
    stored paise (129900); values of 10000+ are read as paise so a legacy
    deployment does not suddenly charge 100x.
    """

    if not plan.get("price_monthly"):
        return None
    explicit = os.getenv(f"RAZORPAY_PRICE_{str(plan.get('id', '')).upper()}", "").strip()
    if explicit:
        try:
            value = int(explicit)
        except ValueError:
            return None
        return value // 100 if value >= 10000 else value
    rate = os.getenv("RAZORPAY_INR_RATE", "").strip()
    if rate:
        try:
            return max(1, int(round(float(plan["price_monthly"]) * float(rate))))
        except (TypeError, ValueError):
            return None
    return None


def _amount_for(plan: dict[str, Any]) -> int | None:
    """Charge amount in the smallest unit (paise/cents). Used by API checkout."""

    price = plan.get("price_monthly")
    if not price:
        return None
    if currency() == "USD":
        return int(round(float(price) * 100))
    rupees = _inr_price(plan)
    return rupees * 100 if rupees else None


def inr_amount(plan: dict[str, Any]) -> int | None:
    """Fixed whole-rupee amount for hosted pages and plan comparison."""

    if currency() == "USD":
        return None
    return _inr_price(plan)


def _amount_hint(plan: dict[str, Any]) -> str:
    if currency() == "USD":
        return "This pack has no monthly price. Enable international payments on Razorpay or set RAZORPAY_CURRENCY."
    return (
        f"Set RAZORPAY_INR_RATE (for example 88) or RAZORPAY_PRICE_{str(plan.get('id', '')).upper()} "
        f"in whole rupees so the ${plan.get('price_monthly')} pack is not charged as ₹{plan.get('price_monthly')}."
    )


def _timestamp_to_iso(value: Any) -> str | None:
    try:
        if not value:
            return None
        return datetime.fromtimestamp(int(value), timezone.utc).isoformat(timespec="seconds")
    except (TypeError, ValueError, OSError):
        return None


def _is_future(value: str | None) -> bool:
    if not value:
        return False
    try:
        instant = datetime.fromisoformat(value)
    except ValueError:
        return False
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    return instant > datetime.now(timezone.utc)


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

    if subscriptions_ready():
        return build_subscription(plan_id=plan["id"], account=account, user=user)

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


def build_subscription(*, plan_id: str, account: dict[str, Any], user: dict[str, Any]) -> dict[str, Any]:
    """Create a monthly Razorpay Subscription and return its hosted auth URL.

    The customer authorises an e-mandate once on Razorpay's page; Razorpay then
    charges the same amount every month until the subscription is cancelled.
    Webhooks (subscription.authenticated / charged / cancelled / halted) keep
    the account's plan in sync, so access never depends on the redirect.
    """

    plan = plans.get_plan(plan_id)
    if not plans.is_paid(plan["id"]):
        return {"ok": False, "error": "invalid_plan", "message": "The free plan does not require checkout."}

    rzp_plan = plan_id_for(plan["id"])
    if not rzp_plan:
        return {
            "ok": False,
            "error": "billing_not_configured",
            "message": f"Set RAZORPAY_PLAN_{str(plan.get('id', '')).upper()} to the Razorpay monthly Plan id.",
        }

    body, err = _request(
        "POST",
        "/subscriptions",
        {
            "plan_id": rzp_plan,
            "total_count": subscription_total_count(),
            "quantity": 1,
            "customer_notify": True,
            "notes": {"account_id": account["id"], "plan": plan["id"]},
        },
    )
    if err:
        return {"ok": False, "error": "razorpay_error", "message": err}
    subscription_id = (body or {}).get("id") or ""
    short_url = (body or {}).get("short_url") or ""
    if not subscription_id or not short_url:
        return {"ok": False, "error": "razorpay_error", "message": "Razorpay did not return a subscription link."}

    store.upsert_payment_subscription(
        subscription_id,
        account["id"],
        plan=plan["id"],
        status="created",
        cancel_at_period_end=False,
    )
    store.audit(
        account["id"],
        "billing.subscription_created",
        plan["id"],
        {"provider": "razorpay", "subscription_id": subscription_id, "plan_id": rzp_plan},
        actor=user.get("email", "owner"),
    )
    amount = (inr_amount(plan) or 0) * 100
    return {
        "ok": True,
        "mode": "razorpay-subscription",
        "provider": "razorpay-subscription",
        "subscription_id": subscription_id,
        "url": short_url,
        "amount": amount,
        "currency": currency(),
        "plan": plan["id"],
        "plan_name": plan["name"],
        "name": "Helio",
        "description": f"Helio {plan['name']} — monthly",
        "prefill": {"name": user.get("name") or "", "email": user.get("email") or ""},
        "monthly": True,
        "cancel_anytime": True,
        "message": f"Redirecting to Razorpay to authorise ₹{inr_amount(plan) or 0}/month. Cancel anytime.",
    }


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

    if subscriptions_ready():
        return build_subscription(plan_id=plan["id"], account=account, user=user)

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


# --------------------------------------------------------------------------- #
# Subscriptions
# --------------------------------------------------------------------------- #


def _subscription_scope(subscription_id: str, entity: dict[str, Any] | None = None) -> tuple[str | None, str | None]:
    """Resolve (account_id, plan_id) for a Razorpay subscription.

    The local row is authoritative. If a webhook arrives for a subscription
    created before this deployment (or from the Razorpay dashboard), fall back
    to the notes, the Razorpay Plan id env mapping, and finally a live fetch.
    """

    row = store.get_payment_subscription(subscription_id) or {}
    entity = entity or {}
    notes = entity.get("notes") or {}
    account_id = row.get("account_id") or notes.get("account_id")
    plan_id = row.get("plan_id") or notes.get("plan")
    rzp_plan = (entity.get("plan") or {}).get("id") or entity.get("plan_id")
    plan_id = plan_id or plan_for_razorpay_plan(rzp_plan)

    if (not account_id or not plans.is_paid(plan_id)) and is_configured():
        body, _err = _request("GET", f"/subscriptions/{subscription_id}")
        if body:
            notes = body.get("notes") or notes
            account_id = account_id or notes.get("account_id")
            plan_id = (
                (plan_id if plans.is_paid(plan_id) else None)
                or notes.get("plan")
                or plan_for_razorpay_plan((body.get("plan") or {}).get("id") or body.get("plan_id"))
            )

    return account_id, (plan_id if plans.is_paid(plan_id) else None)


def fetch_subscription(subscription_id: str) -> dict[str, Any] | None:
    if not is_configured() or not subscription_id:
        return None
    body, _err = _request("GET", f"/subscriptions/{subscription_id}")
    return body


def activate_subscription(
    subscription_id: str,
    payment_id: str = "",
    *,
    current_end: str | None = None,
    event: str = "",
    account_id: str | None = None,
    plan_id: str | None = None,
) -> dict[str, Any] | None:
    """Move an account onto the subscribed plan after authorisation or a charge."""

    if not account_id or not plan_id:
        account_id, plan_id = _subscription_scope(subscription_id)
    if not account_id or not plan_id:
        return None
    # A payment.captured event carries no period end. Keep the paid-through date
    # that subscription.charged already stored instead of shortening it to 30
    # days from now (which drifts earlier every cycle it fires).
    existing_end = (store.get_payment_subscription(subscription_id) or {}).get("current_end")
    period_end = (
        current_end
        or (existing_end if _is_future(existing_end) else None)
        or (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(timespec="seconds")
    )
    store.upsert_payment_subscription(
        subscription_id,
        account_id,
        plan=plan_id,
        status="active",
        current_end=period_end,
        cancel_at_period_end=False,
    )
    store.upsert_subscription(
        account_id,
        plan=plan_id,
        status="active",
        current_period_end=period_end,
        cancel_at_period_end=False,
    )
    store.audit(
        account_id,
        "billing.subscription_active",
        plan_id,
        {"provider": "razorpay", "subscription_id": subscription_id, "payment_id": payment_id, "event": event},
        actor="system",
    )
    return {
        "account_id": account_id,
        "plan_id": plan_id,
        "plan_name": plans.get_plan(plan_id)["name"],
        "status": "active",
        "current_period_end": period_end,
    }


def sync_subscription(
    subscription_id: str,
    raw_status: str,
    *,
    current_end: str | None = None,
    event: str = "",
    entity: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Apply a Razorpay subscription lifecycle event to local access state.

    Access is kept until the paid period ends when a subscription is cancelled,
    completed, paused or halted mid-cycle. Otherwise the account drops to Free.
    """

    account_id, plan_id = _subscription_scope(subscription_id, entity)
    if not account_id or not plan_id:
        return None

    status = (raw_status or "").lower() or "active"
    if status in {"active", "authenticated"}:
        return activate_subscription(
            subscription_id,
            current_end=current_end,
            event=event,
            account_id=account_id,
            plan_id=plan_id,
        )

    terminal = {"cancelled", "completed", "expired", "paused", "halted"}
    if status not in terminal:
        # In-flight states (created, pending) and unknown future states must not
        # revoke access: subscription.updated/pending can fire before a mandate
        # is authorised or while a renewal is being retried.
        return None

    in_grace = _is_future(current_end)
    if in_grace:
        store.upsert_payment_subscription(
            subscription_id,
            account_id,
            plan=plan_id,
            status=status,
            current_end=current_end,
            cancel_at_period_end=True,
        )
        store.upsert_subscription(
            account_id,
            plan=plan_id,
            status="active",
            current_period_end=current_end,
            cancel_at_period_end=True,
        )
        store.audit(
            account_id,
            "billing.subscription_ending",
            plan_id,
            {"provider": "razorpay", "subscription_id": subscription_id, "status": status, "event": event},
            actor="system",
        )
        return {
            "account_id": account_id,
            "plan_id": plan_id,
            "status": "active",
            "cancel_at_period_end": True,
            "current_period_end": current_end,
        }

    store.upsert_payment_subscription(
        subscription_id,
        account_id,
        plan=plan_id,
        status=status,
        current_end=current_end,
        cancel_at_period_end=False,
    )
    store.upsert_subscription(
        account_id,
        plan="free",
        status="active",
        current_period_end=current_end,
        cancel_at_period_end=False,
    )
    store.audit(
        account_id,
        "billing.subscription_ended",
        plan_id,
        {"provider": "razorpay", "subscription_id": subscription_id, "status": status, "event": event},
        actor="system",
    )
    return {"account_id": account_id, "plan_id": "free", "status": "active", "ended": status}


def cancel_subscription(
    account: dict[str, Any],
    subscription_id: str | None = None,
    *,
    at_cycle_end: bool = True,
) -> dict[str, Any]:
    """Cancel the account's Razorpay subscription (default: at period end)."""

    row = (
        store.get_payment_subscription(subscription_id)
        if subscription_id
        else store.get_active_payment_subscription(account["id"])
    )
    if not row or row.get("account_id") != account["id"]:
        return {"ok": False, "error": "no_subscription", "message": "No active subscription was found for this account."}

    body, err = _request(
        "POST",
        f"/subscriptions/{row['id']}/cancel",
        {"cancel_at_cycle_end": 1 if at_cycle_end else 0},
    )
    if err:
        return {"ok": False, "error": "razorpay_error", "message": err}

    current_end = _timestamp_to_iso((body or {}).get("current_end")) or row.get("current_end")
    raw_status = ((body or {}).get("status") or "cancelled").lower()
    kept = at_cycle_end and _is_future(current_end)

    if kept:
        store.upsert_payment_subscription(
            row["id"],
            account["id"],
            plan=row["plan_id"],
            status="cancelled",
            current_end=current_end,
            cancel_at_period_end=True,
        )
        store.upsert_subscription(
            account["id"],
            plan=row["plan_id"],
            status="active",
            current_period_end=current_end,
            cancel_at_period_end=True,
        )
    else:
        store.upsert_payment_subscription(
            row["id"],
            account["id"],
            plan=row["plan_id"],
            status=raw_status,
            current_end=current_end,
            cancel_at_period_end=False,
        )
        store.upsert_subscription(
            account["id"],
            plan="free",
            status="active",
            current_period_end=current_end,
            cancel_at_period_end=False,
        )

    store.audit(
        account["id"],
        "billing.subscription_cancelled",
        row["plan_id"],
        {"provider": "razorpay", "subscription_id": row["id"], "at_cycle_end": at_cycle_end},
        actor="owner",
    )
    return {
        "ok": True,
        "subscription_id": row["id"],
        "status": raw_status,
        "current_period_end": current_end,
        "cancel_at_period_end": kept,
        "message": (
            f"Subscription cancelled. {plans.get_plan(row['plan_id'])['name']} stays active until {current_end[:10]}."
            if kept
            else "Subscription cancelled. The account is now on the Free plan."
        ),
    }


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

    if event_type.startswith("subscription."):
        entity = ((payload.get("subscription") or {}).get("entity") or {})
        subscription_id = entity.get("id") or ""
        if subscription_id:
            synced = sync_subscription(
                subscription_id,
                entity.get("status") or "",
                current_end=_timestamp_to_iso(entity.get("current_end")),
                event=event_type,
                entity=entity,
            )
            if synced:
                return {"ok": True, "synced": synced["account_id"], "event": event_type, "status": synced.get("status")}
        return {"ok": True, "ignored": event_type}

    if event_type == "payment.captured":
        entity = ((payload.get("payment") or {}).get("entity") or {})
        subscription_id = entity.get("subscription_id") or ""
        if subscription_id:
            activated = activate_subscription(subscription_id, entity.get("id") or "", event=event_type)
            if activated:
                return {"ok": True, "synced": activated["account_id"]}
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
