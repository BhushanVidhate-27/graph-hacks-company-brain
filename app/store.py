"""app/store.py - durable commercial state for Helio.

Backed by Postgres when DATABASE_URL is set, otherwise SQLite (HELIO_DB_PATH,
default data/helio.db). Schema/migrations are handled by app.db.

Stores (all per account):
    - accounts / users / sessions
    - api keys (hashed)
    - subscriptions (the Stripe mirror / plan state)
    - usage events (metering)
    - webhook event ids (idempotency)
    - integrations / import runs (data source connections)

Everything is plain SQL with small helpers, no ORM, so the data model stays
obvious and cheap to run.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app import db, plans

DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "helio.db"
SESSION_COOKIE = "helio_session"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def db_path() -> Path:
    """SQLite file path (fallback backend). For Postgres, see db.database_url()."""
    return Path(os.getenv("HELIO_DB_PATH", str(DEFAULT_DB_PATH)))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(12)}"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _slugify(value: str) -> str:
    raw = "".join(ch.lower() if ch.isalnum() else "-" for ch in (value or ""))
    while "--" in raw:
        raw = raw.replace("--", "-")
    return raw.strip("-")[:48] or "workspace"


def connect(*, migrate: bool = True):
    return db.connect(migrate=migrate)


def row_to_dict(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    if isinstance(row, dict):
        return dict(row)
    return dict(row)


def _unique_slug(conn: Any, name: str) -> str:
    base = _slugify(name)
    slug = base
    n = 2
    while conn.execute("SELECT 1 FROM accounts WHERE slug = ?", (slug,)).fetchone():
        slug = f"{base}-{n}"
        n += 1
    return slug



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
        conn.execute(
            """
            INSERT INTO workspaces
                (id, tenant_id, account_id, name, is_default, graph_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
            """,
            (account_id, account_id, account_id, account_name, True, account_id, created, created),
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


def list_workspaces(account_id: str) -> list[dict[str, Any]]:
    """Return every workspace owned by an account, creating the default."""
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, tenant_id, account_id, name, is_default, graph_name,
                   created_at, updated_at
            FROM workspaces
            WHERE account_id = ?
            ORDER BY is_default DESC, created_at ASC
            """,
            (account_id,),
        ).fetchall()
        mine = [dict(row) for row in rows]
        if mine:
            return mine
        account = conn.execute(
            "SELECT id, name, created_at FROM accounts WHERE id = ?",
            (account_id,),
        ).fetchone()
        if account is None:
            return []
        created = now_iso()
        conn.execute(
            """
            INSERT INTO workspaces
                (id, tenant_id, account_id, name, is_default, graph_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
            """,
            (account_id, account_id, account_id, account.get("name") or "Workspace",
             True, account_id, account.get("created_at") or created, created),
        )
    return list_workspaces(account_id)


def get_default_workspace(account_id: str) -> dict[str, Any] | None:
    """Return the default workspace for an account.

    The current product model keeps one default workspace per account, so
    workspace_id usually equals account_id. Keeping this helper central lets
    graph naming and canonical storage call the same canonical resolver.
    """
    rows = list_workspaces(account_id)
    if not rows:
        return {"id": account_id}
    for row in rows:
        if row.get("is_default"):
            return row
    return rows[0]


def default_workspace_id(account_id: str) -> str:
    workspace = get_default_workspace(account_id)
    return str((workspace or {}).get("id") or account_id)


def get_workspace(account_id: str, workspace_id: str | None = None) -> dict[str, Any] | None:
    """Resolve a workspace for an account; default to the first workspace."""
    rows = list_workspaces(account_id)
    if not rows:
        return None
    if workspace_id:
        for row in rows:
            if row.get("id") == workspace_id:
                return row
        return None
    for row in rows:
        if row.get("is_default"):
            return row
    return rows[0]


def resolve_workspace_id(account_id: str, workspace_id: str | None = None) -> str:
    """Return a verified workspace ID for server-side graph/RLS context."""
    return str((get_workspace(account_id, workspace_id) or {}).get("id") or default_workspace_id(account_id))


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


def _is_instant_past(value: str | None) -> bool:
    if not value:
        return False
    try:
        instant = datetime.fromisoformat(value)
    except ValueError:
        return False
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    return instant <= datetime.now(timezone.utc)


def get_subscription(account_id: str) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM subscriptions WHERE account_id = ?", (account_id,)
        ).fetchone()
    if row is None:
        return _free_subscription(account_id)
    sub = dict(row)
    # Lazy trial expiry: a trialing subscription whose period has passed
    # falls back to free/active until Stripe/webhook state changes it.
    if sub.get("status") == "trialing" and _is_instant_past(sub.get("current_period_end")):
        now = now_iso()
        with connect() as conn:
            conn.execute(
                """
                UPDATE subscriptions
                SET plan = 'free', status = 'active', current_period_end = NULL,
                    cancel_at_period_end = 0, updated_at = ?
                WHERE account_id = ?
                """,
                (now, account_id),
            )
            fresh = conn.execute(
                "SELECT * FROM subscriptions WHERE account_id = ?", (account_id,)
            ).fetchone()
        return dict(fresh) if fresh else _free_subscription(account_id)
    return sub


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
        "cancel_at_period_end": bool(
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
# Razorpay subscriptions
# --------------------------------------------------------------------------- #
#
# Razorpay is the payment rail, so its subscription id is the durable handle
# between a hosted authorisation, recurring webhooks and this account. Keeping
# it in its own table means the Stripe columns above keep their original
# meaning and either rail can be retired without a destructive migration.


def upsert_payment_subscription(
    subscription_id: str,
    account_id: str,
    *,
    plan: str,
    status: str,
    current_end: str | None = None,
    cancel_at_period_end: bool | None = None,
) -> dict[str, Any]:
    existing = get_payment_subscription(subscription_id) or {}
    merged_end = current_end if current_end is not None else existing.get("current_end")
    merged_cancel = bool(
        cancel_at_period_end
        if cancel_at_period_end is not None
        else existing.get("cancel_at_period_end")
    )
    now = now_iso()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO payment_subscriptions
                (id, account_id, plan_id, status, current_end,
                 cancel_at_period_end, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                account_id = excluded.account_id,
                plan_id = excluded.plan_id,
                status = excluded.status,
                current_end = excluded.current_end,
                cancel_at_period_end = excluded.cancel_at_period_end,
                updated_at = excluded.updated_at
            """,
            (
                subscription_id,
                account_id,
                plan,
                status,
                merged_end,
                merged_cancel,
                now,
                now,
            ),
        )
    return get_payment_subscription(subscription_id) or {}


def get_payment_subscription(subscription_id: str) -> dict[str, Any] | None:
    if not subscription_id:
        return None
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM payment_subscriptions WHERE id = ?", (subscription_id,)
        ).fetchone()
    return row_to_dict(row)


def get_active_payment_subscription(account_id: str) -> dict[str, Any] | None:
    """Most recent Razorpay subscription for an account (any non-terminal state)."""

    with connect() as conn:
        row = conn.execute(
            """
            SELECT * FROM payment_subscriptions
            WHERE account_id = ? AND status IN ('created', 'authenticated', 'active', 'pending', 'paused')
            ORDER BY created_at DESC LIMIT 1
            """,
            (account_id,),
        ).fetchone()
    return row_to_dict(row)


def list_payment_subscriptions(account_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM payment_subscriptions WHERE account_id = ? ORDER BY created_at DESC",
            (account_id,),
        ).fetchall()
    return [dict(row) for row in rows]


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


# --------------------------------------------------------------------------- #
# Integrations and data imports
# --------------------------------------------------------------------------- #


def _parse_json(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def list_integrations(account_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, account_id, provider, name, status, config, last_sync_at,
                   last_error, created_at, updated_at
            FROM integrations
            WHERE account_id = ?
            ORDER BY created_at DESC
            """,
            (account_id,),
        ).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        item["config"] = _parse_json(item.get("config"), {})
        items.append(item)
    return items


def get_integration(account_id: str, integration_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id, account_id, provider, name, status, config, last_sync_at,
                   last_error, created_at, updated_at
            FROM integrations
            WHERE account_id = ? AND id = ?
            """,
            (account_id, integration_id),
        ).fetchone()
    if row is None:
        return None
    item = dict(row)
    item["config"] = _parse_json(item.get("config"), {})
    return item


def upsert_integration(
    account_id: str,
    *,
    integration_id: str | None = None,
    provider: str,
    name: str,
    status: str = "disconnected",
    config: dict[str, Any] | None = None,
    last_sync_at: str | None = None,
    last_error: str | None = None,
) -> dict[str, Any]:
    now = now_iso()
    config = config or {}
    with connect() as conn:
        if integration_id:
            existing = conn.execute(
                "SELECT id, config FROM integrations WHERE account_id = ? AND id = ?",
                (account_id, integration_id),
            ).fetchone()
            if existing is None:
                integration_id = None
            else:
                merged_config = _parse_json(existing["config"], {})
                merged_config.update(config)
                config = merged_config
        if not integration_id:
            integration_id = new_id("int")
            conn.execute(
                """
                INSERT INTO integrations
                    (id, account_id, provider, name, status, config, last_sync_at,
                     last_error, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    integration_id,
                    account_id,
                    provider,
                    name.strip()[:80] or provider,
                    status,
                    json.dumps(config),
                    last_sync_at,
                    last_error,
                    now,
                    now,
                ),
            )
        else:
            conn.execute(
                """
                UPDATE integrations
                SET provider = ?, name = ?, status = ?, config = ?,
                    last_sync_at = COALESCE(?, last_sync_at),
                    last_error = ?, updated_at = ?
                WHERE account_id = ? AND id = ?
                """,
                (
                    provider,
                    name.strip()[:80] or provider,
                    status,
                    json.dumps(config),
                    last_sync_at,
                    last_error,
                    now,
                    account_id,
                    integration_id,
                ),
            )
    return get_integration(account_id, integration_id) or {}


def delete_integration(account_id: str, integration_id: str) -> bool:
    with connect() as conn:
        cur = conn.execute(
            "DELETE FROM integrations WHERE account_id = ? AND id = ?",
            (account_id, integration_id),
        )
        return cur.rowcount > 0


def create_import_run(
    account_id: str,
    *,
    integration_id: str | None,
    provider: str,
    kind: str = "import",
    status: str = "queued",
    summary: dict[str, Any] | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    run_id = new_id("run")
    created = now_iso()
    finished = created if status in {"completed", "failed", "skipped"} else None
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO import_runs
                (id, account_id, integration_id, provider, kind, status, summary,
                 error, created_at, finished_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                account_id,
                integration_id,
                provider,
                kind,
                status,
                json.dumps(summary or {}),
                error,
                created,
                finished,
            ),
        )
    return get_import_run(account_id, run_id) or {}


def finish_import_run(
    account_id: str,
    run_id: str,
    *,
    status: str,
    summary: dict[str, Any] | None = None,
    error: str | None = None,
) -> dict[str, Any] | None:
    with connect() as conn:
        conn.execute(
            """
            UPDATE import_runs
            SET status = ?, summary = ?, error = ?, finished_at = ?
            WHERE account_id = ? AND id = ?
            """,
            (status, json.dumps(summary or {}), error, now_iso(), account_id, run_id),
        )
    return get_import_run(account_id, run_id)


def get_import_run(account_id: str, run_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id, account_id, integration_id, provider, kind, status, summary,
                   error, created_at, finished_at
            FROM import_runs
            WHERE account_id = ? AND id = ?
            """,
            (account_id, run_id),
        ).fetchone()
    if row is None:
        return None
    item = dict(row)
    item["summary"] = _parse_json(item.get("summary"), {})
    return item


def list_import_runs(account_id: str, limit: int = 20) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, account_id, integration_id, provider, kind, status, summary,
                   error, created_at, finished_at
            FROM import_runs
            WHERE account_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (account_id, max(1, min(limit, 100))),
        ).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        item["summary"] = _parse_json(item.get("summary"), {})
        items.append(item)
    return items


# --------------------------------------------------------------------------- #
# Onboarding progress (zero -> activated)
# --------------------------------------------------------------------------- #

ONBOARDING_STEP_DEFS = [
    {"id": "account_created", "title": "Create your workspace", "description": "Done — your Helio account and workspace are ready. Sign in any time with the same email and password."},
    {"id": "plan_activated", "title": "Confirm your plan", "description": "Stay on Free (50 questions/mo, no card) or start a 14-day trial of Starter/Professional. Go to Plans → Choose a pack. You can change or cancel anytime in Account → Manage billing."},
    {"id": "source_connected", "title": "Connect a data source", "description": "In the console, open Integrations and connect GitHub (Starter+), Slack, Jira or a CSV upload. Read-only access — Helio never writes back to your tools."},
    {"id": "import_completed", "title": "Run your first import", "description": "After connecting, press Run import on the source. Helio extracts ownership, dependencies and decisions into your graph and shows a provenance trail for every fact."},
    {"id": "first_question", "title": "Ask your first question", "description": "Open the Helio agent and ask: Who owns payments? What breaks if payments-gateway dies? Every answer shows the graph path — nodes, edges and dates. If it does not know, it says so."},
]


def _has_any_question(account_id: str) -> bool:
    with connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM usage_events WHERE account_id = ? AND kind = 'question' LIMIT 1",
            (account_id,),
        ).fetchone()
        return row is not None


def _has_completed_import(account_id: str) -> bool:
    with connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM import_runs WHERE account_id = ? AND status = 'completed' LIMIT 1",
            (account_id,),
        ).fetchone()
        return row is not None


def _has_connected_source(account_id: str) -> bool:
    with connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM integrations WHERE account_id = ? LIMIT 1",
            (account_id,),
        ).fetchone()
        return row is not None


def get_onboarding(account_id: str) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute(
            "SELECT account_id, steps, dismissed, completed_at, updated_at FROM onboarding_progress WHERE account_id = ?",
            (account_id,),
        ).fetchone()
    stored = _parse_json((row or {}).get("steps"), {}) if row else {}
    dismissed = bool((row or {}).get("dismissed")) if row else False

    sub = get_subscription(account_id) or {}
    plan_id = sub.get("plan") or "free"
    sub_status = sub.get("status") or "active"
    plan_activated = plan_id != "free" or sub_status in {"active", "trialing"} and bool(stored.get("plan_confirmed"))

    computed = {
        "account_created": True,
        "plan_activated": bool(plan_activated),
        "source_connected": _has_connected_source(account_id),
        "import_completed": _has_completed_import(account_id),
        "first_question": _has_any_question(account_id),
    }
    # explicit overrides (allow marking done, never force-false computed truths except plan_confirmed)
    merged: dict[str, bool] = {}
    for step in ONBOARDING_STEP_DEFS:
        sid = step["id"]
        explicit = stored.get(sid)
        if sid == "plan_activated":
            merged[sid] = bool(computed[sid] or explicit)
        else:
            merged[sid] = bool(computed[sid] or explicit)

    steps = []
    done = 0
    for step in ONBOARDING_STEP_DEFS:
        ok = bool(merged.get(step["id"]))
        if ok:
            done += 1
        steps.append({**step, "done": ok})
    total = len(steps)
    completed = done >= total

    # persist lightweight snapshot if missing/completed state changed
    now = now_iso()
    completed_at = (row or {}).get("completed_at") if row else None
    if completed and not completed_at:
        completed_at = now
    if not completed:
        completed_at = None
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO onboarding_progress (account_id, steps, dismissed, completed_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(account_id) DO UPDATE SET
                steps = excluded.steps,
                dismissed = onboarding_progress.dismissed,
                completed_at = excluded.completed_at,
                updated_at = excluded.updated_at
            """,
            (account_id, json.dumps(merged), bool(dismissed), completed_at, now),
        )

    return {
        "account_id": account_id,
        "steps": steps,
        "done_count": done,
        "total_count": total,
        "completed": completed,
        "dismissed": dismissed,
        "completed_at": completed_at,
        "updated_at": now,
    }


def update_onboarding(
    account_id: str,
    *,
    steps: dict[str, Any] | None = None,
    dismissed: bool | None = None,
    mark_complete: bool = False,
) -> dict[str, Any]:
    current = get_onboarding(account_id)
    # load stored raw
    with connect() as conn:
        row = conn.execute(
            "SELECT steps, dismissed FROM onboarding_progress WHERE account_id = ?",
            (account_id,),
        ).fetchone()
    stored = _parse_json((row or {}).get("steps"), {}) if row else {}
    if steps:
        for k, v in steps.items():
            if k in {s["id"] for s in ONBOARDING_STEP_DEFS} or k == "plan_confirmed":
                stored[k] = bool(v)
    if mark_complete:
        for sdef in ONBOARDING_STEP_DEFS:
            stored[sdef["id"]] = True
    new_dismissed = current["dismissed"] if dismissed is None else bool(dismissed)
    now = now_iso()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO onboarding_progress (account_id, steps, dismissed, completed_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(account_id) DO UPDATE SET
                steps = excluded.steps,
                dismissed = excluded.dismissed,
                updated_at = excluded.updated_at
            """,
            (account_id, json.dumps(stored), new_dismissed, None, now),
        )
    return get_onboarding(account_id)


# --------------------------------------------------------------------------- #
# Facts / Proposals (B1), members (B4), audit (B6)
# --------------------------------------------------------------------------- #


def _norm_evidence(ev: Any) -> dict[str, Any]:
    return ev if isinstance(ev, dict) else {"source": str(ev or "upload")}


def create_proposal(account_id: str, *, category: str, text: str, evidence: dict[str, Any] | None = None, confidence: float = 0.5) -> dict[str, Any]:
    pid = new_id("prop")
    now = now_iso()
    with connect() as conn:
        conn.execute(
            "INSERT INTO proposals (id, account_id, category, text, evidence, confidence, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (pid, account_id, (category or "general")[:40], (text or "")[:4000], json.dumps(_norm_evidence(evidence)), max(0.0, min(1.0, float(confidence))), "pending", now),
        )
    return get_proposal(account_id, pid) or {}


def list_proposals(account_id: str, status: str = "pending", limit: int = 50) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, account_id, category, text, evidence, confidence, status, created_at, reviewed_at, reviewed_by FROM proposals WHERE account_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
            (account_id, (status or "pending").lower(), max(1, min(limit, 200))),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["evidence"] = _parse_json(d.get("evidence"), {})
        out.append(d)
    return out


def get_proposal(account_id: str, pid: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT id, account_id, category, text, evidence, confidence, status, created_at, reviewed_at, reviewed_by FROM proposals WHERE account_id = ? AND id = ?",
            (account_id, pid),
        ).fetchone()
    if not row:
        return None
    d = dict(row)
    d["evidence"] = _parse_json(d.get("evidence"), {})
    return d


def review_proposal(account_id: str, pid: str, *, approve: bool, reviewer: str = "owner") -> dict[str, Any] | None:
    prop = get_proposal(account_id, pid)
    if not prop or prop.get("status") not in ("pending", "conflict"):
        return prop
    now = now_iso()
    new_status = "approved" if approve else "rejected"
    with connect() as conn:
        cur = conn.execute(
            "UPDATE proposals SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE account_id = ? AND id = ? AND status IN ('pending', 'conflict')",
            (new_status, now, reviewer, account_id, pid),
        )
        if approve and cur.rowcount == 1:
            conn.execute(
                "INSERT INTO facts (id, account_id, category, text, evidence, confidence, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (new_id("fact"), account_id, prop["category"], prop["text"], json.dumps(prop.get("evidence") or {}), prop.get("confidence", 1.0), "verified", now),
            )
    return get_proposal(account_id, pid)


def list_facts(account_id: str, limit: int = 50) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, account_id, category, text, evidence, confidence, status, created_at FROM facts WHERE account_id = ? ORDER BY created_at DESC LIMIT ?",
            (account_id, max(1, min(limit, 200))),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["evidence"] = _parse_json(d.get("evidence"), {})
        out.append(d)
    return out


def count_pending_invites(account_id: str) -> int:
    """Pending (unexpired) workspace invites — counts against the seat limit."""
    with connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM workspace_members WHERE account_id = ? AND expires_at > ?",
            (account_id, now_iso()),
        ).fetchone()
        return int(row["n"]) if row else 0


def invite_member(account_id: str, email: str, role: str = "reader") -> dict[str, Any]:
    role = role if role in {"admin", "validator", "contributor", "reader", "billing"} else "reader"
    mid, token = new_id("mem"), secrets.token_hex(16)
    import datetime as _dt
    exp = (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(days=7)).isoformat(timespec="seconds")
    with connect() as conn:
        conn.execute("INSERT INTO workspace_members (id, account_id, email, role, token, expires_at) VALUES (?, ?, ?, ?, ?, ?)", (mid, account_id, email.strip().lower()[:120], role, _hash_token(token), exp))
    # Return raw token once; store hash.
    return {"id": mid, "email": email.strip().lower(), "role": role, "invite_token": token, "expires_at": exp}


def audit(account_id: str, action: str, target: str = "", meta: dict[str, Any] | None = None, actor: str = "system") -> None:
    with connect() as conn:
        conn.execute("INSERT INTO audit_log (id, account_id, actor, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (new_id("aud"), account_id, actor, action[:40], target[:200], json.dumps(meta or {}), now_iso()))


def list_audit(account_id: str, limit: int = 20) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT id, account_id, actor, action, target, meta, created_at FROM audit_log WHERE account_id = ? ORDER BY created_at DESC LIMIT ?", (account_id, max(1, min(limit, 100)))).fetchall()
    return [dict(r) for r in rows]


def list_brains(account_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT id, account_id, kind, name, created_at FROM brains WHERE account_id = ? ORDER BY created_at DESC", (account_id,)).fetchall()
    return [dict(r) for r in rows]


def create_brain(account_id: str, kind: str, name: str) -> dict[str, Any]:
    kind = (kind or "company").lower()
    if kind not in {"personal", "company", "agent"}:
        kind = "company"
    bid = new_id("brain")
    now = now_iso()
    with connect() as conn:
        conn.execute("INSERT INTO brains (id, account_id, kind, name, created_at) VALUES (?, ?, ?, ?, ?)", (bid, account_id, kind, (name or kind.title())[:80], now))
    return {"id": bid, "account_id": account_id, "kind": kind, "name": name or kind.title(), "created_at": now}


def get_or_create_company_brain(account_id: str) -> dict[str, Any]:
    existing = [b for b in list_brains(account_id) if b["kind"] == "company"]
    if existing:
        return existing[0]
    return create_brain(account_id, "company", "Company brain")
