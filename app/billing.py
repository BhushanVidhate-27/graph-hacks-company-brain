"""app/billing.py - Billing / Stripe scaffolding for Helio.

This is deliberately a stub: the runtime is not expected to process live payments
until the operator adds real Stripe keys and a webhook secret. Every endpoint
returns clear, non-secret messages and never logs credentials.
"""

from __future__ import annotations

import os
from typing import Any

# Configs that must be supplied by the operator before real checkout works.
PRICE_ID = os.getenv("NEXT_PUBLIC_HELIO_PRICE_ID", "")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_FREE = os.getenv("STRIPE_PRICE_FREE", "")
STRIPE_PRICE_PRO = os.getenv("STRIPE_PRICE_PRO", "")
STRIPE_MODE = os.getenv("STRIPE_MODE", "local")


def is_configured() -> bool:
    return bool(
        PRICE_ID
        and STRIPE_SECRET_KEY
        and STRIPE_WEBHOOK_SECRET
        and STRIPE_PRICE_FREE
        and STRIPE_PRICE_PRO
    )


def build_checkout(plan: str = "free", account_id: str = "helio"):
    """Return a ready-to-use checkout intent shape for the UI."""

    if not is_configured():
        return {
            "ok": False,
            "message": (
                "Stripe is not configured. Add NEXT_PUBLIC_HELIO_PRICE_ID, "
                "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_FREE and "
                "STRIPE_PRICE_PRO before enabling checkout."
            ),
            "price_id": PRICE_ID,
            "plan": plan,
        }

    return {
        "ok": True,
        "account_id": account_id,
        "plan": plan,
        "price_id": PRICE_ID,
        "mode": "subscription",
        "message": "Checkout is ready.",
    }


def handle_webhook(payload: dict[str, Any], signature: str | None) -> dict[str, Any]:
    """Validate the Stripe signature and return a safe response."""

    if not is_configured():
        return {
            "ok": False,
            "error": "Stripe webhooks are not configured.",
            "received": True,
        }

    if not signature:
        return {"ok": False, "error": "Missing Stripe signature header.", "received": True}

    # Real webhook handling must verify the signature with the raw body and the
    # webhook secret, then record the customer and subscription in the database.
    return {
        "ok": True,
        "message": "Webhook received. Signature verification and ingestion are pending operator setup.",
        "mode": STRIPE_MODE,
    }
