"""Tests for monthly Razorpay subscriptions.

Everything runs against a temporary SQLite database and a stubbed Razorpay API,
so no network call or real key is involved.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

from app import db, plans, razorpay, store

PASSWORD = "correct-horse-battery"


def _ts(value: datetime) -> int:
    return int(value.timestamp())


@pytest.fixture()
def account(tmp_path, monkeypatch):
    monkeypatch.setenv("HELIO_DB_PATH", str(tmp_path / "helio-razorpay.db"))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("RAZORPAY_PLAN_CHECKOUT", raising=False)
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_subscriptions")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "test-secret")
    monkeypatch.setenv("RAZORPAY_PLAN_STARTER", "plan_starter_test")
    monkeypatch.setenv("RAZORPAY_PLAN_PROFESSIONAL", "plan_professional_test")
    monkeypatch.setenv("RAZORPAY_PRICE_STARTER", "1299")
    monkeypatch.setenv("RAZORPAY_PRICE_PROFESSIONAL", "4299")
    monkeypatch.setenv("RAZORPAY_CURRENCY", "INR")
    monkeypatch.delenv("RAZORPAY_INR_RATE", raising=False)
    db._SCHEMA_READY.clear()
    created = store.create_account_with_owner(
        account_name="Subscriptions Inc",
        email="owner@example.com",
        name="Owner",
        password_hash="x",
    )
    return created["account"]


def _event(name: str, entity: dict) -> bytes:
    return json.dumps({"event": name, "payload": {"subscription": {"entity": entity}}}).encode()


def _entity(status: str, *, current_end: datetime | None = None) -> dict:
    return {
        "id": "sub_test_1",
        "status": status,
        "plan_id": "plan_starter_test",
        "notes": {"account_id": "acct_placeholder", "plan": "starter"},
        "current_end": _ts(current_end) if current_end else None,
    }


def test_env_rupee_price_is_charged_in_paise(monkeypatch, account):
    """The old bug charged ₹12.99 for a ₹1,299 pack (env read as paise)."""

    assert razorpay._amount_for(plans.get_plan("starter")) == 129900
    assert razorpay.inr_amount(plans.get_plan("starter")) == 1299

    monkeypatch.setenv("RAZORPAY_PRICE_STARTER", "129900")
    assert razorpay.inr_amount(plans.get_plan("starter")) == 1299


def test_subscription_checkout_returns_hosted_url(monkeypatch, account):
    calls: list[tuple[str, str, dict]] = []

    def fake_request(method, path, data=None):
        calls.append((method, path, data or {}))
        return {"id": "sub_new_1", "short_url": "https://rzp.io/rzp/sub1", "status": "created"}, None

    monkeypatch.setattr(razorpay, "_request", fake_request)
    result = razorpay.build_order(
        plan_id="starter",
        account=account,
        user={"email": "owner@example.com", "name": "Owner"},
    )

    assert result["ok"] is True
    assert result["mode"] == "razorpay-subscription"
    assert result["url"] == "https://rzp.io/rzp/sub1"
    assert result["amount"] == 129900
    assert calls and calls[0][1] == "/subscriptions"
    assert calls[0][2]["plan_id"] == "plan_starter_test"

    row = store.get_payment_subscription("sub_new_1")
    assert row and row["account_id"] == account["id"] and row["plan_id"] == "starter"


def test_authenticated_then_charged_keeps_plan_active(account):
    end = datetime.now(timezone.utc) + timedelta(days=30)
    entity = _entity("authenticated", current_end=end)
    entity["notes"] = {"account_id": account["id"], "plan": "starter"}

    razorpay.handle_webhook(_event("subscription.authenticated", entity))
    sub = store.get_subscription(account["id"])
    assert sub["plan"] == "starter"
    assert sub["status"] == "active"

    next_end = end + timedelta(days=30)
    entity = _entity("active", current_end=next_end)
    entity["notes"] = {"account_id": account["id"], "plan": "starter"}
    razorpay.handle_webhook(_event("subscription.charged", entity))
    sub = store.get_subscription(account["id"])
    assert sub["plan"] == "starter"
    assert sub["current_period_end"] == next_end.isoformat(timespec="seconds")


def test_cancel_at_cycle_end_keeps_access_until_paid_period(account, monkeypatch):
    end = datetime.now(timezone.utc) + timedelta(days=12)
    entity = _entity("active", current_end=end)
    entity["notes"] = {"account_id": account["id"], "plan": "starter"}
    razorpay.handle_webhook(_event("subscription.authenticated", entity))

    def fake_cancel(method, path, data=None):
        assert method == "POST"
        assert path.endswith("/cancel")
        return {"id": "sub_test_1", "status": "cancelled", "current_end": _ts(end)}, None

    monkeypatch.setattr(razorpay, "_request", fake_cancel)
    result = razorpay.cancel_subscription(account, at_cycle_end=True)

    assert result["ok"] is True
    assert result["cancel_at_period_end"] is True
    sub = store.get_subscription(account["id"])
    assert sub["plan"] == "starter"
    assert bool(sub["cancel_at_period_end"]) is True


def test_cancelled_after_period_drops_to_free(account):
    end = datetime.now(timezone.utc) + timedelta(days=30)
    entity = _entity("active", current_end=end)
    entity["notes"] = {"account_id": account["id"], "plan": "starter"}
    razorpay.handle_webhook(_event("subscription.authenticated", entity))

    ended = datetime.now(timezone.utc) - timedelta(days=1)
    entity = _entity("cancelled", current_end=ended)
    entity["notes"] = {"account_id": account["id"], "plan": "starter"}
    razorpay.handle_webhook(_event("subscription.cancelled", entity))

    sub = store.get_subscription(account["id"])
    assert sub["plan"] == "free"
    assert sub["status"] == "active"


def test_halted_subscription_drops_to_free(account):
    end = datetime.now(timezone.utc) - timedelta(days=3)
    entity = _entity("halted", current_end=end)
    entity["notes"] = {"account_id": account["id"], "plan": "professional"}
    razorpay.handle_webhook(_event("subscription.halted", entity))

    sub = store.get_subscription(account["id"])
    assert sub["plan"] == "free"


def test_subscriptions_ready_needs_keys_and_both_plans(monkeypatch, account):
    assert razorpay.subscriptions_ready() is True
    monkeypatch.delenv("RAZORPAY_PLAN_PROFESSIONAL")
    assert razorpay.subscriptions_ready() is False
