"""app/plans.py - the single source of truth for Helio's SaaS plans.

Everything that needs to know what a plan costs, what it includes, or how many
questions it allows reads this module. The marketing site fetches the same
catalog from ``GET /api/plans`` so a price change cannot drift between the
landing page and the billing backend.

Plan IDs are stable. Stripe price IDs are resolved from the environment at call
time, not import time, so a test or a local checkout can point at a different
price without reloading the process.
"""

from __future__ import annotations

import os
from typing import Any

# --------------------------------------------------------------------------- #
# Catalog
# --------------------------------------------------------------------------- #
#
# `questions_per_month=None` means unlimited. `seats=None` and `graphs=None`
# mean unlimited too. Keeping the limits in one dict means the quota check, the
# pricing table and the account dashboard all read the same numbers.

PLANS: dict[str, dict[str, Any]] = {
    "free": {
        "id": "free",
        "name": "Free",
        "tagline": "Evaluate the graph on a real company brain, no card required.",
        "price_monthly": 0,
        "price_yearly": 0,
        "currency": "usd",
        "credits": "50 questions / month",
        "cta": "Start free",
        "highlighted": False,
        "limits": {
            "questions_per_month": 50,
            "seats": 1,
            "graphs": 1,
            "api_access": False,
            "github_sync": False,
            "analytics": False,
            "priority_inference": False,
        },
        "features": [
            "50 questions / month",
            "1 knowledge graph",
            "1 seat",
            "Provenance trail on every answer",
            "Ground-truth benchmark",
            "Community support",
        ],
    },
    "starter": {
        "id": "starter",
        "name": "Starter",
        "tagline": "For one engineering team that needs answers it can defend.",
        "price_monthly": 15,
        "price_yearly": 150,
        "currency": "usd",
        "credits": "1,000 questions / month",
        "cta": "Start Starter",
        "highlighted": False,
        "limits": {
            "questions_per_month": 1000,
            "seats": 3,
            "graphs": 1,
            "api_access": False,
            "github_sync": True,
            "analytics": False,
            "priority_inference": False,
        },
        "features": [
            "1,000 questions / month",
            "1 knowledge graph",
            "3 seats",
            "GitHub issue & PR sync",
            "90-day staleness alerts",
            "Email support",
        ],
    },
    "professional": {
        "id": "professional",
        "name": "Professional",
        "tagline": "For platform teams running multiple services and decisions.",
        "price_monthly": 49,
        "price_yearly": 490,
        "currency": "usd",
        "credits": "5,000 questions / month",
        "cta": "Start Professional",
        "highlighted": True,
        "limits": {
            "questions_per_month": 5000,
            "seats": 10,
            "graphs": None,
            "api_access": True,
            "github_sync": True,
            "analytics": True,
            "priority_inference": True,
        },
        "features": [
            "5,000 questions / month",
            "Unlimited knowledge graphs",
            "10 seats",
            "API access & keys",
            "Priority inference",
            "Analytics & usage dashboard",
            "Slack support",
        ],
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise",
        "tagline": "For security-sensitive organisations with their own graph.",
        "price_monthly": None,
        "price_yearly": None,
        "currency": "usd",
        "credits": "Custom volume",
        "cta": "Talk to us",
        "highlighted": False,
        "limits": {
            "questions_per_month": None,
            "seats": None,
            "graphs": None,
            "api_access": True,
            "github_sync": True,
            "analytics": True,
            "priority_inference": True,
        },
        "features": [
            "Unlimited questions",
            "Unlimited graphs & seats",
            "Dedicated FalkorDB instance",
            "SSO / RBAC",
            "SLA-backed uptime",
            "White-glove onboarding",
        ],
    },
}

PAID_PLANS = ("starter", "professional")


def get_plan(plan_id: str | None) -> dict[str, Any]:
    """Return a plan by id, falling back to free rather than raising.

    A stale subscription row should degrade to the free plan, not 500 the
    account page. The caller can still see ``subscription.plan`` to know what
    Stripe thinks it sold.
    """

    return PLANS.get((plan_id or "free").lower(), PLANS["free"])


def public_plans() -> list[dict[str, Any]]:
    """Return the catalog in the shape the frontend renders."""

    return [PLANS[key] for key in ("free", "starter", "professional", "enterprise")]


def limit_for(plan_id: str | None, key: str) -> Any:
    return get_plan(plan_id)["limits"].get(key)


def is_paid(plan_id: str | None) -> bool:
    return (plan_id or "").lower() in PAID_PLANS


# --------------------------------------------------------------------------- #
# Stripe price mapping
# --------------------------------------------------------------------------- #
#
# The env names are the contract. `STRIPE_PRICE_PRO` is kept as a fallback for
# deployments configured before the catalog was split into Starter and
# Professional; a new deployment should use the explicit names.


def price_id_for(plan_id: str) -> str:
    plan = (plan_id or "").lower()
    if plan == "starter":
        return os.getenv("STRIPE_PRICE_STARTER", "")
    if plan == "professional":
        return os.getenv("STRIPE_PRICE_PROFESSIONAL", "") or os.getenv("STRIPE_PRICE_PRO", "")
    return ""


def plan_for_price(price_id: str | None) -> str | None:
    """Map a Stripe price back to a plan id.

    Checked in the same order as the catalog. An unknown price returns None so
    the webhook can keep the existing plan instead of guessing a tier.
    """

    if not price_id:
        return None
    for plan_id in PAID_PLANS:
        if price_id_for(plan_id) == price_id:
            return plan_id
    return None


def billing_configured() -> bool:
    """True when a paid checkout can actually be created."""

    return bool(
        os.getenv("STRIPE_SECRET_KEY")
        and os.getenv("STRIPE_WEBHOOK_SECRET")
        and any(price_id_for(plan_id) for plan_id in PAID_PLANS)
    )
