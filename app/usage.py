"""app/usage.py - quotas for the paid product and the public demo.

Two different limits, deliberately:

* An authenticated account is metered per calendar month against its plan.
  The count lives in SQLite with the account so it survives a restart.
* An anonymous visitor gets a small in-memory daily allowance. That keeps the
  landing-page demo working without turning the API into a free inference proxy.
  The counter resets when the process restarts; that is acceptable for a demo
  guard, and it is called out in the README.

The route checks the quota *before* the stream starts, because once an SSE
response has begun the status code is already committed to 200. Returning a
clean 429 before the first byte is the only way the browser can render an
upgrade prompt.
"""

from __future__ import annotations

import hashlib
import os
import threading
from datetime import date
from typing import Any

from app import auth, plans, store

_ANON_LOCK = threading.Lock()
_ANON_COUNTS: dict[str, tuple[str, int]] = {}


def auth_required() -> bool:
    return os.getenv("HELIO_REQUIRE_AUTH", "0") == "1"


def anonymous_daily_limit() -> int:
    try:
        return max(0, int(os.getenv("ANON_DAILY_LIMIT", "100")))
    except ValueError:
        return 100


def _client_key(request) -> str:
    """Hash the client address so the in-memory map holds no raw IPs."""

    host = request.client.host if request.client else "unknown"
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    # Only trust the forwarded header when explicitly configured; otherwise a
    # client could rotate the header and bypass the demo limit.
    if os.getenv("HELIO_TRUST_PROXY", "0") == "1" and forwarded:
        host = forwarded
    return hashlib.sha256(host.encode("utf-8")).hexdigest()[:20]


def _month_start_iso() -> str:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat(
        timespec="seconds"
    )


def check(identity: auth.Identity | None, request) -> dict[str, Any]:
    """Return ``{"allowed": bool, ...}`` for this request."""

    if identity is not None:
        plan_id = identity.plan
        limit = plans.limit_for(plan_id, "questions_per_month")
        used = store.count_usage(identity.account["id"], _month_start_iso())
        allowed = limit is None or used < int(limit)
        return {
            "allowed": allowed,
            "kind": "account",
            "plan": plan_id,
            "used": used,
            "limit": limit,
            "remaining": None if limit is None else max(0, int(limit) - used),
            "upgrade_url": "/#pricing-section",
            "message": (
                f"You have used {used} of {limit} questions on the "
                f"{plans.get_plan(plan_id)['name']} plan this month."
            ),
        }

    limit = anonymous_daily_limit()
    if limit == 0:
        return {
            "allowed": False,
            "kind": "anonymous",
            "plan": "free",
            "used": 0,
            "limit": 0,
            "remaining": 0,
            "upgrade_url": "/#pricing-section",
            "message": "The public demo is disabled. Create an account to ask the graph.",
        }

    key = _client_key(request)
    today = date.today().isoformat()
    with _ANON_LOCK:
        day, count = _ANON_COUNTS.get(key, (today, 0))
        if day != today:
            count = 0
        allowed = count < limit
        if allowed:
            _ANON_COUNTS[key] = (today, count + 1)
    return {
        "allowed": allowed,
        "kind": "anonymous",
        "plan": "free",
        "used": count + (1 if allowed else 0),
        "limit": limit,
        "remaining": max(0, limit - count - (1 if allowed else 0)),
        "upgrade_url": "/#pricing-section",
        "message": (
            "You have reached today's public demo limit. Create a free account "
            "to keep asking — it includes 50 questions every month."
        ),
    }


def record(identity: auth.Identity | None, *, question: str = "") -> None:
    """Record a successful answer. Anonymous usage is already counted in check()."""

    if identity is None:
        return
    store.record_usage(
        identity.account["id"],
        user_id=identity.user["id"],
        kind="question",
        meta={"chars": len(question)},
    )
