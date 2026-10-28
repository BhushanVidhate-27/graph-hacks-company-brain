"""Tests for the SaaS layer: accounts, plans, quotas, API keys and webhooks.

These run entirely against the mock answer branch and a temporary SQLite file,
so they need no FalkorDB and no Stripe account.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time

import pytest
from fastapi.testclient import TestClient

from app import auth, main, plans, store, usage

PASSWORD = "correct-horse-battery"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("HELIO_DB_PATH", str(tmp_path / "helio-test.db"))
    monkeypatch.setenv("HELIO_TRUST_PROXY", "0")
    monkeypatch.delenv("HELIO_REQUIRE_AUTH", raising=False)
    monkeypatch.delenv("HELIO_ALLOW_LOCAL_BILLING", raising=False)
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    monkeypatch.delenv("STRIPE_PRICE_STARTER", raising=False)
    monkeypatch.delenv("STRIPE_PRICE_PROFESSIONAL", raising=False)
    store._SCHEMA_READY.clear()
    auth._FAILED_LOGINS.clear()
    usage._ANON_COUNTS.clear()
    monkeypatch.setattr(main, "USE_MOCK", True)
    return TestClient(main.app)


def _signup(client: TestClient, email: str = "ada@example.com") -> dict:
    response = client.post(
        "/api/auth/signup",
        json={
            "name": "Ada Lovelace",
            "email": email,
            "password": PASSWORD,
            "account_name": "Analytical Engines",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _stripe_signature(payload: bytes, secret: str, timestamp: int | None = None) -> str:
    ts = timestamp or int(time.time())
    digest = hmac.new(
        secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256
    ).hexdigest()
    return f"t={ts},v1={digest}"


# --------------------------------------------------------------------------- #
# Accounts and sessions
# --------------------------------------------------------------------------- #


def test_signup_creates_owner_session_and_free_plan(client):
    body = _signup(client)
    assert body["authenticated"] is True
    assert body["account"]["name"] == "Analytical Engines"
    assert body["plan"]["id"] == "free"
    assert body["usage"]["questions_limit"] == 50
    assert body["user"]["role"] == "owner"

    assert client.cookies.get(auth.SESSION_COOKIE)
    me = client.get("/api/auth/me").json()
    assert me["authenticated"] is True
    assert me["user"]["email"] == "ada@example.com"


def test_signup_rejects_duplicate_email(client):
    _signup(client)
    response = client.post(
        "/api/auth/signup",
        json={"name": "Grace", "email": "ADA@example.com", "password": PASSWORD},
    )
    assert response.status_code == 409


def test_login_and_logout(client):
    _signup(client)
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").json()["authenticated"] is False

    bad = client.post(
        "/api/auth/login",
        json={"email": "ada@example.com", "password": "wrong-password"},
    )
    assert bad.status_code == 401

    good = client.post(
        "/api/auth/login",
        json={"email": "ada@example.com", "password": PASSWORD},
    )
    assert good.status_code == 200
    assert good.json()["authenticated"] is True

    client.post("/api/auth/logout")
    assert client.cookies.get(auth.SESSION_COOKIE) in (None, "")


def test_login_throttles_repeated_failures(client):
    _signup(client)
    email = "ada@example.com"
    for _ in range(auth._LOGIN_MAX_FAILURES):
        client.post("/api/auth/login", json={"email": email, "password": "nope"})
    blocked = client.post(
        "/api/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert blocked.status_code == 429


# --------------------------------------------------------------------------- #
# Plans, checkout and quotas
# --------------------------------------------------------------------------- #


def test_plans_catalog_is_public_and_complete(client):
    body = client.get("/api/plans").json()
    ids = [plan["id"] for plan in body["plans"]]
    assert ids == ["free", "starter", "professional", "enterprise"]
    assert body["billing"]["configured"] is False


def test_checkout_without_stripe_is_a_clear_failure(client):
    _signup(client)
    response = client.post("/api/billing/checkout", json={"plan": "starter"})
    assert response.status_code == 503
    body = response.json()
    assert body["error"] == "billing_not_configured"
    assert "STRIPE_SECRET_KEY" in body["message"]


def test_local_billing_upgrades_and_unlocks_api_keys(client, monkeypatch):
    monkeypatch.setenv("STRIPE_MODE", "local")
    monkeypatch.setenv("HELIO_ALLOW_LOCAL_BILLING", "1")
    _signup(client)

    blocked = client.post("/api/keys", json={"name": "CI"})
    assert blocked.status_code == 403

    upgraded = client.post("/api/billing/checkout", json={"plan": "professional"})
    assert upgraded.status_code == 200
    assert upgraded.json()["upgraded"] is True

    created = client.post("/api/keys", json={"name": "CI"})
    assert created.status_code == 200
    key = created.json()["key"]
    assert key.startswith("helio_")

    listed = client.get("/api/keys").json()["keys"]
    assert len(listed) == 1
    assert listed[0]["name"] == "CI"
    assert "key" not in listed[0]

    # The key authenticates a different client with no cookie.
    api_client = TestClient(main.app)
    response = api_client.post(
        "/ask",
        headers={"Authorization": f"Bearer {key}"},
        json={"question": "Who should I ask about the payments service?"},
    )
    assert response.status_code == 200
    assert client.get("/api/usage").json()["usage"]["questions_used"] == 1

    revoked = client.delete(f"/api/keys/{listed[0]['id']}")
    assert revoked.status_code == 200
    denied = api_client.post(
        "/ask",
        headers={"Authorization": f"Bearer {key}"},
        json={"question": "Who should I ask about the payments service?"},
    )
    assert denied.status_code == 401


def test_free_plan_quota_returns_upgrade_prompt(client, monkeypatch):
    monkeypatch.setitem(plans.PLANS["free"]["limits"], "questions_per_month", 1)
    _signup(client)

    first = client.post(
        "/ask", json={"question": "Who should I ask about the payments service?"}
    )
    assert first.status_code == 200

    second = client.post(
        "/ask", json={"question": "Who should I ask about the payments service?"}
    )
    assert second.status_code == 429
    body = second.json()
    assert body["error"] == "quota_exceeded"
    assert body["plan"] == "free"
    assert body["used"] == 1
    assert body["limit"] == 1
    assert body["upgrade_url"].startswith("/#pricing")


def test_anonymous_demo_limit(client, monkeypatch):
    monkeypatch.setenv("ANON_DAILY_LIMIT", "1")
    usage._ANON_COUNTS.clear()

    first = client.post(
        "/ask", json={"question": "Who should I ask about the payments service?"}
    )
    assert first.status_code == 200
    second = client.post(
        "/ask", json={"question": "Who should I ask about the payments service?"}
    )
    assert second.status_code == 429
    assert "Create a free account" in second.json()["message"]


def test_require_auth_mode_rejects_anonymous(client, monkeypatch):
    monkeypatch.setenv("HELIO_REQUIRE_AUTH", "1")
    response = client.post(
        "/ask", json={"question": "Who should I ask about the payments service?"}
    )
    assert response.status_code == 401
    assert response.json()["error"] == "auth_required"


# --------------------------------------------------------------------------- #
# Stripe webhooks
# --------------------------------------------------------------------------- #


def _checkout_event(account_id: str) -> bytes:
    return json.dumps(
        {
            "id": "evt_test_checkout",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": account_id,
                    "metadata": {"plan": "starter"},
                    "customer": "cus_test",
                    "subscription": "sub_test",
                }
            },
        }
    ).encode()


def test_webhook_rejects_a_bad_signature(client, monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    response = client.post(
        "/api/stripe/webhook",
        content=b'{"id":"evt_x"}',
        headers={"stripe-signature": "t=1,v1=deadbeef"},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "invalid_signature"


def test_webhook_upgrades_plan_and_is_idempotent(client, monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    body = _signup(client)
    account_id = body["account"]["id"]
    payload = _checkout_event(account_id)
    signature = _stripe_signature(payload, "whsec_test")

    response = client.post(
        "/api/stripe/webhook",
        content=payload,
        headers={"stripe-signature": signature},
    )
    assert response.status_code == 200
    assert response.json()["handled"] is True

    subscription = store.get_subscription(account_id)
    assert subscription["plan"] == "starter"
    assert subscription["status"] == "active"
    assert subscription["stripe_customer_id"] == "cus_test"

    duplicate = client.post(
        "/api/stripe/webhook",
        content=payload,
        headers={"stripe-signature": signature},
    )
    assert duplicate.status_code == 200
    assert duplicate.json()["duplicate"] is True


def test_subscription_cancel_falls_back_to_free_quota(client, monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    body = _signup(client)
    account_id = body["account"]["id"]

    checkout = _checkout_event(account_id)
    client.post(
        "/api/stripe/webhook",
        content=checkout,
        headers={"stripe-signature": _stripe_signature(checkout, "whsec_test")},
    )

    cancelled = json.dumps(
        {
            "id": "evt_test_cancel",
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_test",
                    "customer": "cus_test",
                    "status": "canceled",
                }
            },
        }
    ).encode()
    response = client.post(
        "/api/stripe/webhook",
        content=cancelled,
        headers={"stripe-signature": _stripe_signature(cancelled, "whsec_test")},
    )
    assert response.status_code == 200

    me = client.get("/api/auth/me").json()
    assert me["plan"]["id"] == "free"
    assert me["subscription"]["status"] == "canceled"
