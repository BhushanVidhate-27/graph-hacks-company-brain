"""app/store.py - SQLite persistence for the Helio SaaS layer.

The reasoning engine does not need a database: FalkorDB holds the company graph
and the agent reads it. This module stores the *commercial* state around that
engine - accounts, users, sessions, API keys, subscriptions and usage.

Why SQLite: it is in the standard library, it is a single file, and it is enough
for a single-instance MVP. It is deliberately isolated behind this module so a
move to Postgres is a rewrite of one file, not of the API. The production note in
README.md is explicit: SQLite is single-writer and is not suitable for multiple
API replicas.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "helio.db"

# One schema check per resolved path per process. Tests monkeypatch
# HELIO_DB_PATH, so a module-level boolean would miss the second database.
_SCHEMA_READY: set[str] = set()

SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    stripe_customer_id TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TEXT NOT NULL,
    last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_end TEXT,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    user_id TEXT,
    kind TEXT NOT NULL DEFAULT 'question',
    created_at TEXT NOT NULL,
    meta TEXT
);

CREATE INDEX IF NOT EXISTS idx_usage_account_time
    ON usage_events(account_id, created_at);

CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #


def db_path() -> Path:
    """Resolve the database path at call time.

    Resolving at import time makes tests share one database and makes a
    container's volume mount impossible to change without rebuilding the image.
    """

    return Path(os.getenv("HELIO_DB_PATH", str(DEFAULT_DB_PATH)))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:48] or "workspace"


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    key = str(path.resolve())
    if key not in _SCHEMA_READY:
        conn.executescript(SCHEMA)
        _SCHEMA_READY.add(key)
    return conn


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


# --------------------------------------------------------------------------- #
# Accounts and users
# --------------------------------------------------------------------------- #


def _unique_slug(conn: sqlite3.Connection, name: str) -> str:
    base = _slugify(name)
    candidate = base
    suffix = 2
    while conn.execute("SELECT 1 FROM accounts WHERE slug = ?", (candidate,)).fetchone():
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def create_account_with_owner(
    *,
    account_name: str,
    email: str,
    name: str,
    password_hash: str,
) -> dict[str, Any]:
    """Create an account, its owner user, and a free subscription atomically."""

    account_id = new_id("acct")
    user_id = new_id("usr")
    created = now_iso()

    with connect() as conn:
        slug = _unique_slug(conn, account_name)
        conn.execute(
            "INSERT INTO accounts (id, name, slug, created_at) VALUES (?, ?, ?, ?)",
            (account_id, account_name, slug, created),
        )
        conn.execute(
            """
            INSERT INTO users
                (id, account_id, email, name, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, ?, 'owner', ?)
            """,
            (user_id, account_id, email.lower().strip(), name.strip(), password_hash, created),
        )
        conn.execute(
            """
            INSERT INTO subscriptions
                (account_id, plan, status, updated_at)
            VALUES (?, 'free', 'active', ?)
            """,
            (account_id, created),
        )

    return {
        "account": get_account(account_id),
        "user": get_user(user_id),
        "subscription": get_subscription(account_id),
    }


def get_account(account_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        return row_to_dict(
            conn.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
        )


def get_account_by_customer(customer_id: str) -> dict[str, Any] | None:
    if not customer_id:
        return None
    with connect() as conn:
        return row_to_dict(
            conn.execute(
                "SELECT * FROM accounts WHERE stripe_customer_id = ?", (customer_id,)
            ).fetchone()
        )


def set_stripe_customer(account_id: str, customer_id: str) -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE accounts SET stripe_customer_id = ? WHERE id = ?",
            (customer_id, account_id),
        )


def get_user(user_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        return row_to_dict(
            conn.execute(
                """
                SELECT id, account_id, email, name, role, created_at, last_login_at
                FROM users WHERE id = ?
                """,
                (user_id,),
            ).fetchone()
        )


def get_user_by_email(email: str) -> dict[str, Any] | None:
    """Return the user including the password hash. Never send this to a client."""

    with connect() as conn:
        return row_to_dict(
            conn.execute(
                "SELECT * FROM users WHERE email = ?", (email.lower().strip(),)
            ).fetchone()
        )


def mark_login(user_id: str) -> None:
    with connect() as conn:
        conn.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now_iso(), user_id))


def count_users(account_id: str) -> int:
    with connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM users WHERE account_id = ?", (account_id,)
        ).fetchone()
        return int(row["n"]) if row else 0


# --------------------------------------------------------------------------- #
# Sessions
# --------------------------------------------------------------------------- #


def create_session(user_id: str, days: int = 30) -> str:
    token = secrets.token_urlsafe(32)
    created = datetime.now(timezone.utc)
    expires = created + timedelta(days=days)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                _hash_token(token),
                user_id,
                created.isoformat(timespec="seconds"),
                expires.isoformat(timespec="seconds"),
                created.isoformat(timespec="seconds"),
            ),
        )
    return token


def get_session(token: str) -> dict[str, Any] | None:
    if not token:
        return None
    token_hash = _hash_token(token)
    with connect() as conn:
        row = conn.execute(
            """
            SELECT s.token_hash, s.expires_at, u.id AS user_id
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ?
            """,
            (token_hash,),
        ).fetchone()
        if row is None:
            return None
        if row["expires_at"] < now_iso():
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
            return None
        conn.execute(
            "UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?",
            (now_iso(), token_hash),
        )
    return {"user": get_user(row["user_id"]), "token_hash": token_hash}


def delete_session(token: str) -> None:
    if not token:
        return
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))


def delete_user_sessions(user_id: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))


# --------------------------------------------------------------------------- #
# API keys
# --------------------------------------------------------------------------- #


def create_api_key(account_id: str, user_id: str, name: str) -> tuple[str, dict[str, Any]]:
    key_id = new_id("key")
    secret = secrets.token_urlsafe(24)
    plaintext = f"helio_{secret}"
    prefix = plaintext[:14]
    created = now_iso()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO api_keys
                (id, account_id, user_id, name, prefix, key_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (key_id, account_id, user_id, name.strip()[:80] or "Default key",
             prefix, _hash_token(plaintext), created),
        )
        row = conn.execute(
            """
            SELECT id, name, prefix, created_at, last_used_at, revoked_at
            FROM api_keys WHERE id = ?
            """,
            (key_id,),
        ).fetchone()
    return plaintext, dict(row)


def list_api_keys(account_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, name, prefix, created_at, last_used_at, revoked_at
            FROM api_keys
            WHERE account_id = ?
            ORDER BY created_at DESC
            """,
            (account_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def revoke_api_key(account_id: str, key_id: str) -> bool:
    with connect() as conn:
        cur = conn.execute(
            """
            UPDATE api_keys SET revoked_at = ?
            WHERE id = ? AND account_id = ? AND revoked_at IS NULL
            """,
            (now_iso(), key_id, account_id),
        )
        return cur.rowcount > 0


def find_api_key(token: str) -> dict[str, Any] | None:
    if not token:
        return None
    with connect() as conn:
        row = conn.execute(
            """
            SELECT k.id AS key_id, k.account_id, k.user_id, k.name
            FROM api_keys k
            WHERE k.key_hash = ? AND k.revoked_at IS NULL
            """,
            (_hash_token(token),),
        ).fetchone()
        if row is None:
            return None
        conn.execute(
            "UPDATE api_keys SET last_used_at = ? WHERE id = ?",
            (now_iso(), row["key_id"]),
        )
        user = conn.execute(
            """
            SELECT id, account_id, email, name, role, created_at, last_login_at
            FROM users WHERE id = ?
            """,
            (row["user_id"],),
        ).fetchone()
    return {"key": dict(row), "user": row_to_dict(user)}


# --------------------------------------------------------------------------- #
# Subscriptions
# --------------------------------------------------------------------------- #


def _free_subscription(account_id: str) -> dict[str, Any]:
    return {
        "account_id": account_id,
        "plan": "free",
        "status": "active",
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "current_period_end": None,
        "cancel_at_period_end": 0,
        "updated_at": None,
    }


def get_subscription(account_id: str) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM subscriptions WHERE account_id = ?", (account_id,)
        ).fetchone()
    return dict(row) if row else _free_subscription(account_id)


def get_subscription_by_customer(customer_id: str) -> dict[str, Any] | None:
    if not customer_id:
        return None
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM subscriptions WHERE stripe_customer_id = ?", (customer_id,)
        ).fetchone()
    return dict(row) if row else None


def get_subscription_by_stripe_id(subscription_id: str) -> dict[str, Any] | None:
    if not subscription_id:
        return None
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM subscriptions WHERE stripe_subscription_id = ?",
            (subscription_id,),
        ).fetchone()
    return dict(row) if row else None


def upsert_subscription(
    account_id: str,
    *,
    plan: str,
    status: str,
    stripe_customer_id: str | None = None,
    stripe_subscription_id: str | None = None,
    current_period_end: str | None = None,
    cancel_at_period_end: bool | None = None,
) -> dict[str, Any]:
    """Write subscription state without wiping fields a webhook did not send."""

    existing = get_subscription(account_id)
    merged = {
        "plan": plan or existing.get("plan") or "free",
        "status": status or existing.get("status") or "active",
        "stripe_customer_id": stripe_customer_id
        if stripe_customer_id is not None
        else existing.get("stripe_customer_id"),
        "stripe_subscription_id": stripe_subscription_id
        if stripe_subscription_id is not None
        else existing.get("stripe_subscription_id"),
        "current_period_end": current_period_end
        if current_period_end is not None
        else existing.get("current_period_end"),
        "cancel_at_period_end": int(
            cancel_at_period_end
            if cancel_at_period_end is not None
            else bool(existing.get("cancel_at_period_end"))
        ),
    }
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO subscriptions
                (account_id, plan, status, stripe_customer_id,
                 stripe_subscription_id, current_period_end,
                 cancel_at_period_end, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(account_id) DO UPDATE SET
                plan = excluded.plan,
                status = excluded.status,
                stripe_customer_id = excluded.stripe_customer_id,
                stripe_subscription_id = excluded.stripe_subscription_id,
                current_period_end = excluded.current_period_end,
                cancel_at_period_end = excluded.cancel_at_period_end,
                updated_at = excluded.updated_at
            """,
            (
                account_id,
                merged["plan"],
                merged["status"],
                merged["stripe_customer_id"],
                merged["stripe_subscription_id"],
                merged["current_period_end"],
                merged["cancel_at_period_end"],
                now_iso(),
            ),
        )
    return get_subscription(account_id)


# --------------------------------------------------------------------------- #
# Usage
# --------------------------------------------------------------------------- #


def record_usage(
    account_id: str,
    *,
    user_id: str | None = None,
    kind: str = "question",
    meta: dict[str, Any] | None = None,
) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO usage_events (account_id, user_id, kind, created_at, meta)
            VALUES (?, ?, ?, ?, ?)
            """,
            (account_id, user_id, kind, now_iso(), json.dumps(meta or {})),
        )


def count_usage(account_id: str, since_iso: str, kind: str = "question") -> int:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS n FROM usage_events
            WHERE account_id = ? AND kind = ? AND created_at >= ?
            """,
            (account_id, kind, since_iso),
        ).fetchone()
    return int(row["n"]) if row else 0


def usage_summary(account_id: str, plan_id: str) -> dict[str, Any]:
    """Return the current calendar-month usage against the plan limit."""

    now = datetime.now(timezone.utc)
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if period_start.month == 12:
        period_end = period_start.replace(year=period_start.year + 1, month=1)
    else:
        period_end = period_start.replace(month=period_start.month + 1)

    from app import plans  # local import keeps store usable without the catalog

    limit = plans.limit_for(plan_id, "questions_per_month")
    used = count_usage(account_id, period_start.isoformat(timespec="seconds"))
    remaining = None if limit is None else max(0, int(limit) - used)
    percent = None if not limit else min(100, round(used / int(limit) * 100, 1))

    return {
        "questions_used": used,
        "questions_limit": limit,
        "questions_remaining": remaining,
        "percent_used": percent,
        "period_start": period_start.date().isoformat(),
        "period_end": period_end.date().isoformat(),
    }


# --------------------------------------------------------------------------- #
# Webhook idempotency
# --------------------------------------------------------------------------- #


def webhook_seen(event_id: str) -> bool:
    if not event_id:
        return False
    with connect() as conn:
        return (
            conn.execute(
                "SELECT 1 FROM webhook_events WHERE id = ?", (event_id,)
            ).fetchone()
            is not None
        )


def mark_webhook(event_id: str, event_type: str) -> None:
    if not event_id:
        return
    with connect() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO webhook_events (id, type, created_at) VALUES (?, ?, ?)",
            (event_id, event_type, now_iso()),
        )
