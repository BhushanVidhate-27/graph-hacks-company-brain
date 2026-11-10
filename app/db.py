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

import contextvars
import os
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

DEFAULT_SQLITE_PATH = Path(__file__).resolve().parents[1] / "data" / "helio.db"
_SCHEMA_READY: set[str] = set()

# Server-side tenancy context. This is deliberately a ContextVar, not a global:
# the value is derived from the authenticated account and is never accepted
# from model output or request parameters.
_CURRENT_TENANT: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "helio_current_tenant", default=None
)
_CURRENT_WORKSPACE: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "helio_current_workspace", default=None
)


def set_current_tenant(tenant_id: str | None):
    """Bind this request/thread to a tenant for Postgres RLS context."""
    return _CURRENT_TENANT.set(tenant_id or None)


def reset_current_tenant(token) -> None:
    _CURRENT_TENANT.reset(token)


def get_current_tenant() -> str | None:
    return _CURRENT_TENANT.get()


def set_current_workspace(workspace_id: str | None):
    """Bind this request/thread to a workspace for Postgres RLS context."""
    return _CURRENT_WORKSPACE.set(workspace_id or None)


def reset_current_workspace(token) -> None:
    _CURRENT_WORKSPACE.reset(token)


def get_current_workspace() -> str | None:
    return _CURRENT_WORKSPACE.get()


@contextmanager
def tenant_context(tenant_id: str | None, workspace_id: str | None = None):
    """Temporarily bind this thread to server-derived tenant/workspace IDs."""
    tenant_token = set_current_tenant(tenant_id)
    workspace_token = set_current_workspace(workspace_id or tenant_id)
    try:
        yield
    finally:
        reset_current_workspace(workspace_token)
        reset_current_tenant(tenant_token)


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
    tenant_id = get_current_tenant() or ""
    workspace_id = get_current_workspace() or ""
    try:
        conn.execute(
            "SELECT set_config('app.current_tenant', %s, false), set_config('app.current_workspace', %s, false)",
            (tenant_id, workspace_id),
        )
    except Exception:
        # A failure to set advisory session variables must not block normal
        # CRUD; RLS is only enforced on the tenant-owned knowledge tables.
        pass
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

CREATE TABLE IF NOT EXISTS payment_links (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    created_at TEXT NOT NULL,
    paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_links_account ON payment_links(account_id);
CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    payment_id TEXT,
    created_at TEXT NOT NULL,
    paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_account ON payment_orders(account_id);
CREATE TABLE IF NOT EXISTS payment_subscriptions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    current_end TEXT,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_account ON payment_subscriptions(account_id);
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

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 1,
    graph_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspaces_account ON workspaces(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant ON workspaces(tenant_id, created_at);

INSERT INTO workspaces (id, tenant_id, account_id, name, is_default, graph_name, created_at, updated_at)
SELECT a.id, a.id, a.id, a.name, 1, a.id, a.created_at, a.created_at
FROM accounts a
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.account_id = a.id);

CREATE TABLE IF NOT EXISTS knowledge_sources (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'upload',
    external_id TEXT,
    source_name TEXT NOT NULL DEFAULT '',
    source_url TEXT,
    provenance TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_scope
    ON knowledge_sources(tenant_id, workspace_id, created_at);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    source_id TEXT REFERENCES knowledge_sources(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL DEFAULT '',
    object_uri TEXT,
    provenance TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_scope
    ON knowledge_documents(tenant_id, workspace_id, created_at);

CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    document_id TEXT REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL DEFAULT '',
    embedding TEXT,
    embedding_model TEXT NOT NULL DEFAULT 'helio-hash-384',
    chunk_hash TEXT NOT NULL DEFAULT '',
    provenance TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_document_chunks_scope
    ON document_chunks(tenant_id, workspace_id, document_id, chunk_index);

CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    document_id TEXT REFERENCES knowledge_documents(id) ON DELETE SET NULL,
    chunk_id TEXT REFERENCES document_chunks(id) ON DELETE SET NULL,
    subject_type TEXT NOT NULL DEFAULT '',
    subject_id TEXT NOT NULL DEFAULT '',
    subject_name TEXT NOT NULL DEFAULT '',
    predicate TEXT NOT NULL DEFAULT '',
    object_type TEXT NOT NULL DEFAULT '',
    object_id TEXT NOT NULL DEFAULT '',
    object_name TEXT NOT NULL DEFAULT '',
    confidence REAL NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'verified',
    provenance TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_claims_scope
    ON claims(tenant_id, workspace_id, subject_name, predicate, object_name);

CREATE TABLE IF NOT EXISTS evidence_links (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    claim_id TEXT REFERENCES claims(id) ON DELETE CASCADE,
    document_id TEXT REFERENCES knowledge_documents(id) ON DELETE SET NULL,
    chunk_id TEXT REFERENCES document_chunks(id) ON DELETE SET NULL,
    edge_type TEXT NOT NULL DEFAULT 'EVIDENCED_BY',
    provenance TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_links_claim
    ON evidence_links(tenant_id, workspace_id, claim_id);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    claim_id TEXT REFERENCES claims(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reason TEXT NOT NULL DEFAULT '',
    decided_by TEXT,
    decided_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_approvals_scope
    ON approvals(tenant_id, workspace_id, status, created_at);

CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    date TEXT,
    author TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    document_id TEXT REFERENCES knowledge_documents(id) ON DELETE SET NULL,
    provenance TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decisions_scope
    ON decisions(tenant_id, workspace_id, date);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    source_kind TEXT NOT NULL DEFAULT 'document',
    status TEXT NOT NULL DEFAULT 'queued',
    stage TEXT NOT NULL DEFAULT 'ingestion',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    payload TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_scope
    ON ingestion_jobs(tenant_id, workspace_id, status, created_at);

CREATE TABLE IF NOT EXISTS graph_sync_outbox (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    operation TEXT NOT NULL DEFAULT 'upsert',
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    processed_at TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_graph_sync_outbox_scope
    ON graph_sync_outbox(tenant_id, workspace_id, status, next_attempt_at, created_at);
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


CREATE TABLE IF NOT EXISTS payment_links (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    created_at TEXT NOT NULL,
    paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_links_account ON payment_links(account_id);
CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    payment_id TEXT,
    created_at TEXT NOT NULL,
    paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_account ON payment_orders(account_id);
CREATE TABLE IF NOT EXISTS payment_subscriptions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    current_end TEXT,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_account ON payment_subscriptions(account_id);
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

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT TRUE,
    graph_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspaces_account ON workspaces(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant ON workspaces(tenant_id, created_at);

INSERT INTO workspaces (id, tenant_id, account_id, name, is_default, graph_name, created_at, updated_at)
SELECT a.id, a.id, a.id, a.name, TRUE, a.id, a.created_at, a.created_at
FROM accounts a
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.account_id = a.id);

CREATE TABLE IF NOT EXISTS knowledge_sources (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'upload',
    external_id TEXT,
    source_name TEXT NOT NULL DEFAULT '',
    source_url TEXT,
    provenance TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_scope
    ON knowledge_sources(tenant_id, workspace_id, created_at);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    source_id TEXT REFERENCES knowledge_sources(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL DEFAULT '',
    object_uri TEXT,
    provenance TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_scope
    ON knowledge_documents(tenant_id, workspace_id, created_at);

CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    document_id TEXT REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL DEFAULT '',
    embedding vector(1536),
    embedding_model TEXT NOT NULL DEFAULT 'helio-hash-384',
    chunk_hash TEXT NOT NULL DEFAULT '',
    provenance TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_document_chunks_scope
    ON document_chunks(tenant_id, workspace_id, document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
    ON document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    document_id TEXT REFERENCES knowledge_documents(id) ON DELETE SET NULL,
    chunk_id TEXT REFERENCES document_chunks(id) ON DELETE SET NULL,
    subject_type TEXT NOT NULL DEFAULT '',
    subject_id TEXT NOT NULL DEFAULT '',
    subject_name TEXT NOT NULL DEFAULT '',
    predicate TEXT NOT NULL DEFAULT '',
    object_type TEXT NOT NULL DEFAULT '',
    object_id TEXT NOT NULL DEFAULT '',
    object_name TEXT NOT NULL DEFAULT '',
    confidence REAL NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'verified',
    provenance TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_claims_scope
    ON claims(tenant_id, workspace_id, subject_name, predicate, object_name);

CREATE TABLE IF NOT EXISTS evidence_links (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    claim_id TEXT REFERENCES claims(id) ON DELETE CASCADE,
    document_id TEXT REFERENCES knowledge_documents(id) ON DELETE SET NULL,
    chunk_id TEXT REFERENCES document_chunks(id) ON DELETE SET NULL,
    edge_type TEXT NOT NULL DEFAULT 'EVIDENCED_BY',
    provenance TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_links_claim
    ON evidence_links(tenant_id, workspace_id, claim_id);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    claim_id TEXT REFERENCES claims(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reason TEXT NOT NULL DEFAULT '',
    decided_by TEXT,
    decided_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_approvals_scope
    ON approvals(tenant_id, workspace_id, status, created_at);

CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    date TEXT,
    author TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    document_id TEXT REFERENCES knowledge_documents(id) ON DELETE SET NULL,
    provenance TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decisions_scope
    ON decisions(tenant_id, workspace_id, date);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    source_kind TEXT NOT NULL DEFAULT 'document',
    status TEXT NOT NULL DEFAULT 'queued',
    stage TEXT NOT NULL DEFAULT 'ingestion',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    payload TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_scope
    ON ingestion_jobs(tenant_id, workspace_id, status, created_at);

CREATE TABLE IF NOT EXISTS graph_sync_outbox (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    operation TEXT NOT NULL DEFAULT 'upsert',
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    processed_at TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_graph_sync_outbox_scope
    ON graph_sync_outbox(tenant_id, workspace_id, status, next_attempt_at, created_at);

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


    """CREATE TABLE IF NOT EXISTS payment_links (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'created',
        created_at TEXT NOT NULL,
        paid_at TEXT
    )""",
    "CREATE INDEX IF NOT EXISTS idx_payment_links_account ON payment_links(account_id)",

    """CREATE TABLE IF NOT EXISTS payment_orders (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'created',
        payment_id TEXT,
        created_at TEXT NOT NULL,
        paid_at TEXT
    )""",
    "CREATE INDEX IF NOT EXISTS idx_payment_orders_account ON payment_orders(account_id)",

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


    """CREATE TABLE IF NOT EXISTS payment_links (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'created',
        created_at TEXT NOT NULL,
        paid_at TEXT
    )""",
    "CREATE INDEX IF NOT EXISTS idx_payment_links_account ON payment_links(account_id)",

    """CREATE TABLE IF NOT EXISTS payment_orders (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'created',
        payment_id TEXT,
        created_at TEXT NOT NULL,
        paid_at TEXT
    )""",
    "CREATE INDEX IF NOT EXISTS idx_payment_orders_account ON payment_orders(account_id)",

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


RLS_POLICIES_POSTGRES = [
    "ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE claims ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE evidence_links ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE approvals ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE decisions ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE graph_sync_outbox ENABLE ROW LEVEL SECURITY",
    "DROP POLICY IF EXISTS helio_tenant_isolation ON workspaces",
    "DROP POLICY IF EXISTS helio_tenant_isolation ON knowledge_sources",
    "DROP POLICY IF EXISTS helio_tenant_isolation ON knowledge_documents",
    "DROP POLICY IF EXISTS helio_tenant_isolation ON document_chunks",
    "DROP POLICY IF EXISTS helio_tenant_isolation ON claims",
    "DROP POLICY IF EXISTS helio_tenant_isolation ON evidence_links",
    "DROP POLICY IF EXISTS helio_tenant_isolation ON approvals",
    "DROP POLICY IF EXISTS helio_tenant_isolation ON decisions",
    "DROP POLICY IF EXISTS helio_tenant_isolation ON ingestion_jobs",
    "DROP POLICY IF EXISTS helio_tenant_isolation ON graph_sync_outbox",
    "CREATE POLICY helio_tenant_isolation ON workspaces FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant', true))",
    "CREATE POLICY helio_tenant_isolation ON knowledge_sources FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant', true))",
    "CREATE POLICY helio_tenant_isolation ON knowledge_documents FOR ALL USING (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true))",
    "CREATE POLICY helio_tenant_isolation ON document_chunks FOR ALL USING (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true))",
    "CREATE POLICY helio_tenant_isolation ON claims FOR ALL USING (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true))",
    "CREATE POLICY helio_tenant_isolation ON evidence_links FOR ALL USING (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true))",
    "CREATE POLICY helio_tenant_isolation ON approvals FOR ALL USING (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true))",
    "CREATE POLICY helio_tenant_isolation ON decisions FOR ALL USING (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true))",
    "CREATE POLICY helio_tenant_isolation ON ingestion_jobs FOR ALL USING (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true))",
    "CREATE POLICY helio_tenant_isolation ON graph_sync_outbox FOR ALL USING (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant', true) AND workspace_id = current_setting('app.current_workspace', true))",
]


def _apply_rls(conn: ConnectionWrapper) -> None:
    if backend() != "postgres":
        return
    for stmt in RLS_POLICIES_POSTGRES:
        try:
            conn.execute(stmt)
        except Exception:
            # Best-effort rollout: some Postgres-compatible offerings do not
            # expose every feature this deployment uses.
            pass


def _apply_schema(conn: ConnectionWrapper, kind: str) -> None:
    if kind == "postgres":
        try:
            conn.execute(
                "DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS vector; EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;"
            )
        except Exception:
            # If the extension cannot be created here, pgvector must be enabled
            # by the operator before this app can use the vector index.
            conn.rollback()
    schema = POSTGRES_SCHEMA if kind == "postgres" else SQLITE_SCHEMA
    migrations = MIGRATIONS_POSTGRES if kind == "postgres" else MIGRATIONS_SQLITE
    conn.executescript(schema)
    for stmt in migrations:
        try:
            conn.execute(stmt)
        except Exception:
            # Best-effort for idempotent migrations on existing DBs.
            pass
    if kind == "postgres":
        _apply_rls(conn)
