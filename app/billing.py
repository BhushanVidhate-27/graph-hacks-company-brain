"""app/billing.py - Stripe Checkout, Customer Portal and webhooks.

This module owns the money path. It is intentionally small and explicit:

* Checkout is created with Stripe's REST API over httpx. No SDK, no hidden
  global state, and no secret ever leaves the server.
* The webhook verifies the raw body against ``STRIPE_WEBHOOK_SECRET`` and is
  idempotent on the Stripe event id.
* ``STRIPE_MODE=local`` plus ``HELIO_ALLOW_LOCAL_BILLING=1`` is a development
  escape hatch that upgrades an account without contacting Stripe. It is off by
  default, and the README says why: a deployment that leaves it on gives away
  paid plans.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app import plans, store

STRIPE_API = "https://api.stripe.com/v1"

# Tolerance for the webhook timestamp. Events older than this are rejected so a
# captured request cannot be replayed forever.
WEBHOOK_TOLERANCE_SECONDS = 300


# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #


def _secret_key() -> str:
    return os.getenv("STRIPE_SECRET_KEY", "")


def _webhook_secret() -> str:
    return os.getenv("STRIPE_WEBHOOK_SECRET", "")


def stripe_mode() -> str:
    return os.getenv("STRIPE_MODE", "local")


def is_configured() -> bool:
    return plans.billing_configured()


def local_billing_enabled() -> bool:
    return stripe_mode() == "local" and os.getenv("HELIO_ALLOW_LOCAL_BILLING", "0") == "1"


def setup_details() -> dict[str, Any]:
    return {
        "configured": is_configured(),
        "mode": stripe_mode(),
        "local_billing": local_billing_enabled(),
        "required_env": [
            "STRIPE_SECRET_KEY",
            "STRIPE_WEBHOOK_SECRET",
            "STRIPE_PRICE_STARTER",
            "STRIPE_PRICE_PROFESSIONAL",
        ],
        "missing": [
            name
            for name in (
                "STRIPE_SECRET_KEY",
                "STRIPE_WEBHOOK_SECRET",
                "STRIPE_PRICE_STARTER",
                "STRIPE_PRICE_PROFESSIONAL",
            )
            if not os.getenv(name)
        ],
    }


# --------------------------------------------------------------------------- #
# Stripe REST
# --------------------------------------------------------------------------- #


def _stripe_request(
    method: str, path: str, data: list[tuple[str, str]] | None = None
) -> tuple[dict[str, Any] | None, str | None]:
    """Call Stripe and return ``(json, error)`` without leaking credentials."""

    secret = _secret_key()
    if not secret:
        return None, "Stripe is not configured."

    try:
        with httpx.Client(timeout=20) as client:
            response = client.request(
                method,
                f"{STRIPE_API}{path}",
                data=data or [],
                auth=(secret, ""),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
    except httpx.HTTPError as exc:
        return None, f"Could not reach Stripe ({type(exc).__name__})."

    try:
        body = response.json()
    except ValueError:
        return None, f"Stripe returned a non-JSON response (HTTP {response.status_code})."

    if response.status_code >= 400:
        message = (body.get("error") or {}).get("message") or "Stripe rejected the request."
        return None, message
    return body, None


# --------------------------------------------------------------------------- #
# Checkout and portal
# --------------------------------------------------------------------------- #


def _local_upgrade(account_id: str, plan_id: str) -> dict[str, Any]:
    period_end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(
        timespec="seconds"
    )
    store.upsert_subscription(
        account_id,
        plan=plan_id,
        status="active",
        current_period_end=period_end,
        cancel_at_period_end=False,
    )
    return {
        "ok": True,
        "mode": "local",
        "upgraded": True,
        "plan": plan_id,
        "message": (
            f"Local billing enabled: the account is now on the "
            f"{plans.get_plan(plan_id)['name']} plan for 30 days."
        ),
    }


def build_checkout(
    *,
    plan_id: str,
    account: dict[str, Any],
    user: dict[str, Any],
    success_url: str,
    cancel_url: str,
) -> dict[str, Any]:
    """Create a Stripe Checkout Session for a paid plan."""

    plan = plans.get_plan(plan_id)
    if not plans.is_paid(plan["id"]):
        return {
            "ok": False,
            "error": "invalid_plan",
            "message": "The free plan does not require checkout.",
        }

    if local_billing_enabled():
        return _local_upgrade(account["id"], plan["id"])

    if not is_configured():
        return {
            "ok": False,
            "error": "billing_not_configured",
            "message": (
                "Checkout is not configured on this deployment. Set "
                "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and the plan price IDs, "
                "or contact us for a manual invoice."
            ),
        }

    price_id = plans.price_id_for(plan["id"])
    if not price_id:
        return {
            "ok": False,
            "error": "missing_price",
            "message": f"No Stripe price is configured for the {plan['name']} plan.",
        }

    data: list[tuple[str, str]] = [
        ("mode", "subscription"),
        ("success_url", success_url),
        ("cancel_url", cancel_url),
        ("client_reference_id", account["id"]),
        ("metadata[account_id]", account["id"]),
        ("metadata[plan]", plan["id"]),
        ("line_items[0][price]", price_id),
        ("line_items[0][quantity]", "1"),
        ("allow_promotion_codes", "true"),
        ("billing_address_collection", "auto"),
    ]
    customer_id = account.get("stripe_customer_id")
    if customer_id:
        data.append(("customer", customer_id))
    else:
        data.append(("customer_email", user["email"]))

    body, error = _stripe_request("POST", "/checkout/sessions", data)
    if error or body is None:
        return {"ok": False, "error": "stripe_error", "message": error}

    return {
        "ok": True,
        "mode": stripe_mode(),
        "plan": plan["id"],
        "url": body.get("url"),
        "session_id": body.get("id"),
        "message": "Checkout session created.",
    }


def build_portal(account: dict[str, Any], return_url: str) -> dict[str, Any]:
    """Create a Stripe Customer Portal session for managing a subscription."""

    customer_id = account.get("stripe_customer_id")
    if not customer_id:
        return {
            "ok": False,
            "error": "no_customer",
            "message": "This account has no Stripe customer yet. Start a paid plan first.",
        }
    if not _secret_key():
        return {
            "ok": False,
            "error": "billing_not_configured",
            "message": "Stripe is not configured on this deployment.",
        }

    body, error = _stripe_request(
        "POST",
        "/billing_portal/sessions",
        [("customer", customer_id), ("return_url", return_url)],
    )
    if error or body is None:
        return {"ok": False, "error": "stripe_error", "message": error}
    return {"ok": True, "url": body.get("url")}


# --------------------------------------------------------------------------- #
# Webhook verification
# --------------------------------------------------------------------------- #


def _parse_signature_header(signature: str | None) -> tuple[str, list[str]] | None:
    """Parse ``t=...,v1=...`` into a timestamp and every v1 signature.

    Stripe may send more than one v1 signature during a secret rotation. Keeping
    only the last one makes rotation fail for half the events, which is exactly
    the kind of bug that shows up at the worst possible moment.
    """

    if not signature:
        return None
    timestamp: str | None = None
    signatures: list[str] = []
    for item in signature.split(","):
        if "=" not in item:
            continue
        key, value = item.split("=", 1)
        key = key.strip()
        if key == "t":
            timestamp = value.strip()
        elif key == "v1":
            signatures.append(value.strip())
    if not timestamp or not signatures:
        return None
    return timestamp, signatures


def _verify_stripe_signature(
    payload: bytes, signature: str | None, secret: str | None = None
) -> bool:
    """Verify HMAC-SHA256 over ``f"{timestamp}.{raw_body}"``."""

    secret = secret if secret is not None else _webhook_secret()
    if not secret:
        return False

    parsed = _parse_signature_header(signature)
    if parsed is None:
        return False

    timestamp, signatures = parsed
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    if abs(time.time() - ts) > WEBHOOK_TOLERANCE_SECONDS:
        return False

    signed_payload = f"{ts}.".encode() + payload
    expected = hmac.new(
        secret.encode("utf-8"), signed_payload, hashlib.sha256
    ).hexdigest()
    return any(hmac.compare_digest(expected, sig) for sig in signatures)


# --------------------------------------------------------------------------- #
# Webhook application
# --------------------------------------------------------------------------- #


def _iso_from_unix(value: Any) -> str | None:
    try:
        if value in (None, ""):
            return None
        return datetime.fromtimestamp(int(value), timezone.utc).isoformat(timespec="seconds")
    except (TypeError, ValueError, OSError):
        return None


def _subscription_price(subscription: dict[str, Any]) -> str | None:
    items = subscription.get("items") or {}
    data = items.get("data") or []
    if data:
        return ((data[0].get("price") or {}).get("id")) or None
    return None


def _apply_checkout_completed(obj: dict[str, Any]) -> bool:
    metadata = obj.get("metadata") or {}
    account_id = obj.get("client_reference_id") or metadata.get("account_id")
    if not account_id or store.get_account(account_id) is None:
        return False

    plan_id = metadata.get("plan")
    if plan_id not in plans.PLANS:
        plan_id = "starter"

    customer_id = obj.get("customer")
    subscription_id = obj.get("subscription")
    if customer_id:
        store.set_stripe_customer(account_id, customer_id)
    store.upsert_subscription(
        account_id,
        plan=plan_id,
        status="active",
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id,
        cancel_at_period_end=False,
    )
    return True


def _apply_subscription_event(obj: dict[str, Any], *, deleted: bool = False) -> bool:
    customer_id = obj.get("customer")
    subscription_id = obj.get("id")

    subscription = (
        store.get_subscription_by_customer(customer_id)
        or store.get_subscription_by_stripe_id(subscription_id)
    )
    if subscription is None:
        return False

    account_id = subscription["account_id"]
    price_id = _subscription_price(obj)
    plan_id = plans.plan_for_price(price_id) or subscription.get("plan") or "free"
    status = "canceled" if deleted else (obj.get("status") or "active")
    period_end = _iso_from_unix(obj.get("current_period_end"))

    store.upsert_subscription(
        account_id,
        plan=plan_id,
        status=status,
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id,
        current_period_end=period_end,
        cancel_at_period_end=bool(obj.get("cancel_at_period_end")),
    )
    if customer_id:
        store.set_stripe_customer(account_id, customer_id)
    return True


def _apply_invoice_event(obj: dict[str, Any], *, paid: bool) -> bool:
    customer_id = obj.get("customer")
    subscription = store.get_subscription_by_customer(customer_id)
    if subscription is None:
        return False
    store.upsert_subscription(
        subscription["account_id"],
        plan=subscription.get("plan") or "free",
        status="active" if paid else "past_due",
        stripe_customer_id=customer_id,
    )
    return True


def _apply_event(event: dict[str, Any]) -> bool:
    event_type = event.get("type") or ""
    obj = (event.get("data") or {}).get("object") or {}

    if event_type in {
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
    }:
        return _apply_checkout_completed(obj)

    if event_type == "customer.subscription.created":
        return _apply_subscription_event(obj)
    if event_type == "customer.subscription.updated":
        return _apply_subscription_event(obj)
    if event_type == "customer.subscription.deleted":
        return _apply_subscription_event(obj, deleted=True)

    if event_type == "invoice.paid":
        return _apply_invoice_event(obj, paid=True)
    if event_type == "invoice.payment_failed":
        return _apply_invoice_event(obj, paid=False)

    # Unhandled event types are acknowledged so Stripe does not retry them
    # forever. They are still recorded for debugging.
    return False


def handle_webhook(payload: bytes | Any, signature: str | None) -> dict[str, Any]:
    """Verify, de-duplicate and apply a Stripe webhook event.

    ``payload`` must be the raw request body. Stripe signs the exact bytes sent
    over the wire, so parsing JSON first and re-serialising it breaks the
    signature.
    """

    if not _webhook_secret():
        return {
            "ok": False,
            "error": "webhook_not_configured",
            "message": "Stripe webhooks are not configured.",
            "received": True,
        }

    if not signature:
        return {
            "ok": False,
            "error": "missing_signature",
            "message": "Missing Stripe-Signature header.",
            "received": True,
        }

    raw = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")
    if not _verify_stripe_signature(raw, signature):
        return {
            "ok": False,
            "error": "invalid_signature",
            "message": "Invalid Stripe signature.",
            "received": True,
        }

    try:
        event = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return {
            "ok": False,
            "error": "invalid_payload",
            "message": "Webhook body is not valid JSON.",
            "received": True,
        }

    event_id = event.get("id") or ""
    event_type = event.get("type") or "unknown"

    if event_id and store.webhook_seen(event_id):
        return {
            "ok": True,
            "type": event_type,
            "duplicate": True,
            "message": "Event already processed.",
        }

    handled = False
    try:
        handled = _apply_event(event)
    finally:
        # Record the event even when it was not one we act on. A retry of an
        # unhandled event is still a retry.
        if event_id:
            store.mark_webhook(event_id, event_type)

    return {
        "ok": True,
        "type": event_type,
        "handled": handled,
        "message": "Webhook received and signature verified.",
    }
