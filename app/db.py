"""app/db.py - database backend for Helio app state.

Supports Postgres (DATABASE_URL) for production and SQLite (HELIO_DB_PATH) as a
local/dev fallback. This module normalizes the small dialect differences used by
app.store so the rest of the app can keep a simple `with db.connect()` pattern.

Dialect notes
-------------
- Placeholders: store code uses `?` (sqlite style). For Postgres we translate to
  `%s`.
- `INSERT OR IGNORE` is translated to `INSERT ... ON CONFLICT DO NOTHING` for
  Postgres (used for webhook idempotency).
- Schema/migrations are applied per backend. SQLite uses WAL/PRAGMAs;
  Postgres uses standard DDL.
- Rows are returned as dict-like mappings on both backends.
"""

from __future__ import annotations

import os
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

DEFAULT_SQLITE_PATH = Path(__file__).resolve().parents[1] / "data" / "helio.db"
_SCHEMA_READY: set[str] = set()


def database_url() -> str:
    return (os.getenv("DATABASE_URL") or "").strip()


def backend() -> str:
    url = database_url()
    if url.startswith("postgres://") or url.startswith("postgresql://"):
        return "postgres"
    return "sqlite"


def sqlite_path() -> Path:
    return Path(os.getenv("HELIO_DB_PATH", str(DEFAULT_SQLITE_PATH)))


def _translate_sql(sql: str) -> str:
    if backend() != "postgres":
        return sql
    # `?` placeholders -> `%s`. Safe for our SQL (no literal '?' / JSON ops here).
    out = sql.replace("?", "%s")
    # SQLite idempotent insert form used by webhook_events.
    out = re.sub(r"\bINSERT\s+OR\s+IGNORE\s+INTO\b", "INSERT INTO", out, flags=re.I)
    if "INSERT INTO webhook_events" in out and "ON CONFLICT" not in out.upper():
        out = out.rstrip().rstrip(";") + " ON CONFLICT (id) DO NOTHING"
    return out


class CursorWrapper:
    def __init__(self, cursor: Any):
        self._cursor = cursor

    @property
    def rowcount(self) -> int:
        return int(getattr(self._cursor, "rowcount", 0) or 0)

    @property
    def lastrowid(self) -> Any:
        return getattr(self._cursor, "lastrowid", None)

    def fetchone(self) -> dict[str, Any] | None:
        row = self._cursor.fetchone()
        if row is None:
            return None
        if isinstance(row, dict):
            return row
        try:
            return dict(row)
        except Exception:
            return {"value": row}

    def fetchall(self) -> list[dict[str, Any]]:
        rows = self._cursor.fetchall() or []
        out: list[dict[str, Any]] = []
        for row in rows:
            if isinstance(row, dict):
                out.append(row)
            else:
                try:
                    out.append(dict(row))
                except Exception:
                    out.append({"value": row})
        return out


class ConnectionWrapper:
    def __init__(self, conn: Any, kind: str):
        self._conn = conn
        self.kind = kind

    def execute(self, sql: str, params: Any = ()) -> CursorWrapper:
        cur = self._conn.execute(_translate_sql(sql), params)
        return CursorWrapper(cur)

    def executemany(self, sql: str, seq: Any) -> CursorWrapper:
        cur = self._conn.executemany(_translate_sql(sql), seq)
        return CursorWrapper(cur)

    def executescript(self, sql: str) -> None:
        if self.kind == "sqlite":
            self._conn.executescript(sql)
            return
        # Postgres: run statements individually.
        cur = self._conn.cursor()
        for stmt in _split_sql(sql):
            if stmt.strip():
                cur.execute(stmt)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass

    def __enter__(self) -> "ConnectionWrapper":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        try:
            if exc_type:
                self.rollback()
            else:
                self.commit()
        finally:
            self.close()
        return False


def _split_sql(sql: str) -> list[str]:
    # Simple splitter for our schema files (no dollar-quoted functions/procs).
    parts: list[str] = []
    buff: list[str] = []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--") or not stripped:
            buff.append(line)
            continue
        buff.append(line)
        if stripped.endswith(";"):
            parts.append("\n".join(buff))
            buff = []
    if buff:
        parts.append("\n".join(buff))
    return parts


def _connect_sqlite() -> ConnectionWrapper:
    path = sqlite_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return ConnectionWrapper(conn, "sqlite")


def _connect_postgres() -> ConnectionWrapper:
    try:
        import psycopg
        from psycopg.rows import dict_row
    except Exception as exc:  # pragma: no cover - dependency/runtime guard
        raise RuntimeError(
            "DATABASE_URL is set to Postgres but psycopg is not installed. "
            "Add/install psycopg[binary]."
        ) from exc
    url = database_url().replace("postgres://", "postgresql://", 1)
    conn = psycopg.connect(url, row_factory=dict_row, autocommit=False)
    return ConnectionWrapper(conn, "postgres")


@contextmanager
def connect(*, migrate: bool = True) -> Iterator[ConnectionWrapper]:
    kind = backend()
    conn = _connect_postgres() if kind == "postgres" else _connect_sqlite()
    try:
        if migrate:
            ensure_schema(conn)
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# Schema / migrations
# --------------------------------------------------------------------------- #

SQLITE_SCHEMA = r"""
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

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    config TEXT NOT NULL DEFAULT '{}',
    last_sync_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integrations_account
    ON integrations(account_id, created_at);

CREATE TABLE IF NOT EXISTS import_runs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    integration_id TEXT REFERENCES integrations(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'import',
    status TEXT NOT NULL DEFAULT 'queued',
    summary TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_import_runs_account
    ON import_runs(account_id, created_at);

CREATE TABLE IF NOT EXISTS onboarding_progress (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    steps TEXT NOT NULL DEFAULT '{}',
    dismissed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    updated_at TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS brains (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brains_account ON brains(account_id);

CREATE TABLE IF NOT EXISTS sync_cadence (
    integration_id TEXT PRIMARY KEY REFERENCES integrations(id) ON DELETE CASCADE,
    interval_hours REAL NOT NULL DEFAULT 6.0,
    next_run_at TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS facts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'general',
    text TEXT NOT NULL,
    evidence TEXT NOT NULL DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'verified',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_facts_account ON facts(account_id, created_at);

CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'general',
    text TEXT NOT NULL,
    evidence TEXT NOT NULL DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 0.5,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    reviewed_at TEXT,
    reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_proposals_account ON proposals(account_id, status, created_at);

CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'reader',
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_members_account ON workspace_members(account_id, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    actor TEXT NOT NULL DEFAULT 'system',
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    meta TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_account ON audit_log(account_id, created_at);
"""

POSTGRES_SCHEMA = r"""
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
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_events (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    config TEXT NOT NULL DEFAULT '{}',
    last_sync_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integrations_account
    ON integrations(account_id, created_at);

CREATE TABLE IF NOT EXISTS import_runs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    integration_id TEXT REFERENCES integrations(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'import',
    status TEXT NOT NULL DEFAULT 'queued',
    summary TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_import_runs_account
    ON import_runs(account_id, created_at);

CREATE TABLE IF NOT EXISTS onboarding_progress (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    steps TEXT NOT NULL DEFAULT '{}',
    dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS facts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'general',
    text TEXT NOT NULL,
    evidence TEXT NOT NULL DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'verified',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_facts_account ON facts(account_id, created_at);

CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'general',
    text TEXT NOT NULL,
    evidence TEXT NOT NULL DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 0.5,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    reviewed_at TEXT,
    reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_proposals_account ON proposals(account_id, status, created_at);

CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'reader',
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_members_account ON workspace_members(account_id, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    actor TEXT NOT NULL DEFAULT 'system',
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    meta TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_account ON audit_log(account_id, created_at);


CREATE TABLE IF NOT EXISTS brains (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brains_account ON brains(account_id);

CREATE TABLE IF NOT EXISTS sync_cadence (
    integration_id TEXT PRIMARY KEY REFERENCES integrations(id) ON DELETE CASCADE,
    interval_hours REAL NOT NULL DEFAULT 6.0,
    next_run_at TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

"""

MIGRATIONS_SQLITE = [
    """CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'disconnected',
        config TEXT NOT NULL DEFAULT '{}',
        last_sync_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_integrations_account ON integrations(account_id, created_at)",
    """CREATE TABLE IF NOT EXISTS import_runs (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        integration_id TEXT REFERENCES integrations(id) ON DELETE SET NULL,
        provider TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'import',
        status TEXT NOT NULL DEFAULT 'queued',
        summary TEXT NOT NULL DEFAULT '{}',
        error TEXT,
        created_at TEXT NOT NULL,
        finished_at TEXT
    )""",
    "CREATE INDEX IF NOT EXISTS idx_import_runs_account ON import_runs(account_id, created_at)",
    """CREATE TABLE IF NOT EXISTS onboarding_progress (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        steps TEXT NOT NULL DEFAULT '{}',
        dismissed INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        updated_at TEXT NOT NULL
    )""",

    """CREATE TABLE IF NOT EXISTS facts (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'general',
        text TEXT NOT NULL,
        evidence TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 1.0,
        status TEXT NOT NULL DEFAULT 'verified',
        created_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_facts_account ON facts(account_id, created_at)",
    """CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'general',
        text TEXT NOT NULL,
        evidence TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 0.5,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        reviewed_by TEXT
    )""",
    "CREATE INDEX IF NOT EXISTS idx_proposals_account ON proposals(account_id, status, created_at)",
    """CREATE TABLE IF NOT EXISTS workspace_members (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'reader',
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        accepted_at TEXT,
        created_at TEXT NOT NULL DEFAULT ''
    )""",
    "CREATE INDEX IF NOT EXISTS idx_members_account ON workspace_members(account_id, created_at)",
    """CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        actor TEXT NOT NULL DEFAULT 'system',
        action TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT '',
        meta TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_audit_account ON audit_log(account_id, created_at)",


    """CREATE TABLE IF NOT EXISTS brains (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_brains_account ON brains(account_id)",
    """CREATE TABLE IF NOT EXISTS sync_cadence (
        integration_id TEXT PRIMARY KEY REFERENCES integrations(id) ON DELETE CASCADE,
        interval_hours REAL NOT NULL DEFAULT 6.0,
        next_run_at TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
    )""",

]

MIGRATIONS_POSTGRES = [
    """CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'disconnected',
        config TEXT NOT NULL DEFAULT '{}',
        last_sync_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_integrations_account ON integrations(account_id, created_at)",
    """CREATE TABLE IF NOT EXISTS import_runs (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        integration_id TEXT REFERENCES integrations(id) ON DELETE SET NULL,
        provider TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'import',
        status TEXT NOT NULL DEFAULT 'queued',
        summary TEXT NOT NULL DEFAULT '{}',
        error TEXT,
        created_at TEXT NOT NULL,
        finished_at TEXT
    )""",
    "CREATE INDEX IF NOT EXISTS idx_import_runs_account ON import_runs(account_id, created_at)",
    """CREATE TABLE IF NOT EXISTS onboarding_progress (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        steps TEXT NOT NULL DEFAULT '{}',
        dismissed BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at TEXT,
        updated_at TEXT NOT NULL
    )""",

    """CREATE TABLE IF NOT EXISTS facts (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'general',
        text TEXT NOT NULL,
        evidence TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 1.0,
        status TEXT NOT NULL DEFAULT 'verified',
        created_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_facts_account ON facts(account_id, created_at)",
    """CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'general',
        text TEXT NOT NULL,
        evidence TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 0.5,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        reviewed_by TEXT
    )""",
    "CREATE INDEX IF NOT EXISTS idx_proposals_account ON proposals(account_id, status, created_at)",
    """CREATE TABLE IF NOT EXISTS workspace_members (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'reader',
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        accepted_at TEXT,
        created_at TEXT NOT NULL DEFAULT ''
    )""",
    "CREATE INDEX IF NOT EXISTS idx_members_account ON workspace_members(account_id, created_at)",
    """CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        actor TEXT NOT NULL DEFAULT 'system',
        action TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT '',
        meta TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_audit_account ON audit_log(account_id, created_at)",


    """CREATE TABLE IF NOT EXISTS brains (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_brains_account ON brains(account_id)",
    """CREATE TABLE IF NOT EXISTS sync_cadence (
        integration_id TEXT PRIMARY KEY REFERENCES integrations(id) ON DELETE CASCADE,
        interval_hours REAL NOT NULL DEFAULT 6.0,
        next_run_at TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
    )""",

]


def ensure_schema(conn: ConnectionWrapper | None = None) -> None:
    kind = backend()
    key = f"{kind}:{database_url() or sqlite_path().resolve()}"
    if key in _SCHEMA_READY:
        return
    if conn is not None:
        _apply_schema(conn, kind)
        _SCHEMA_READY.add(key)
        return
    with connect(migrate=False) as c:
        _apply_schema(c, kind)
    _SCHEMA_READY.add(key)


def _apply_schema(conn: ConnectionWrapper, kind: str) -> None:
    schema = POSTGRES_SCHEMA if kind == "postgres" else SQLITE_SCHEMA
    migrations = MIGRATIONS_POSTGRES if kind == "postgres" else MIGRATIONS_SQLITE
    conn.executescript(schema)
    for stmt in migrations:
        try:
            conn.execute(stmt)
        except Exception:
            # Best-effort for idempotent migrations on existing DBs.
            pass
