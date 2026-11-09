"""app/knowledge_store.py — canonical knowledge persistence.

This module is the single writer for PostgreSQL-backed knowledge records.
FalkorDB is a rebuildable projection: every relevant mutation also writes a
transactional outbox row in the same DB transaction, so the graph can be
replayed/rebuilt without losing canonical records.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from app import db


def _vector_param(value: list[float] | None) -> Any:
    if value is None:
        return None
    if db.backend() == "postgres":
        return "[" + ",".join(f"{float(x):.8f}" for x in value) + "]"
    return json.dumps(value)


def new_id(prefix: str) -> str:
    return f"{prefix}_{hashlib.sha256((prefix + str(__import__('uuid').uuid4())).encode()).hexdigest()[:24]}"


def now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _json(value: Any) -> str:
    return json.dumps(value or {}, default=str)


def ensure_source(
    conn: Any,
    *,
    tenant_id: str,
    workspace_id: str,
    provider: str,
    source_name: str,
    external_id: str | None = None,
    source_url: str | None = None,
    provenance: dict[str, Any] | None = None,
) -> str:
    source_id = new_id("src")
    conn.execute(
        """
        INSERT INTO knowledge_sources
            (id, tenant_id, workspace_id, provider, external_id, source_name, source_url, provenance, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            source_id,
            tenant_id,
            workspace_id,
            provider or "upload",
            external_id,
            source_name or "",
            source_url,
            _json(provenance or {}),
            now_iso(),
            now_iso(),
        ),
    )
    return source_id


def upsert_document(
    conn: Any,
    *,
    tenant_id: str,
    workspace_id: str,
    document_id: str,
    title: str,
    content_hash: str,
    source_id: str | None = None,
    object_uri: str | None = None,
    provenance: dict[str, Any] | None = None,
) -> str:
    conn.execute(
        """
        INSERT INTO knowledge_documents
            (id, tenant_id, workspace_id, source_id, title, content_hash, object_uri, provenance, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            content_hash = excluded.content_hash,
            object_uri = excluded.object_uri,
            provenance = excluded.provenance,
            updated_at = excluded.updated_at
        """,
        (
            document_id,
            tenant_id,
            workspace_id,
            source_id,
            title or "",
            content_hash,
            object_uri,
            _json(provenance or {}),
            now_iso(),
            now_iso(),
        ),
    )
    return document_id


def insert_chunk(
    conn: Any,
    *,
    tenant_id: str,
    workspace_id: str,
    document_id: str,
    chunk_index: int,
    text: str,
    embedding: list[float] | None,
    chunk_hash: str,
    provenance: dict[str, Any] | None = None,
) -> str:
    chunk_id = new_id("chunk")
    conn.execute(
        """
        INSERT INTO document_chunks
            (id, tenant_id, workspace_id, document_id, chunk_index, text, embedding, embedding_model, chunk_hash, provenance, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'helio-hash-384', ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
        """,
        (
            chunk_id,
            tenant_id,
            workspace_id,
            document_id,
            int(chunk_index),
            text or "",
            _vector_param(embedding),
            chunk_hash,
            _json(provenance or {}),
            now_iso(),
        ),
    )
    return chunk_id


def insert_claim(
    conn: Any,
    *,
    tenant_id: str,
    workspace_id: str,
    document_id: str | None,
    chunk_id: str | None,
    subject_type: str,
    subject_id: str,
    subject_name: str,
    predicate: str,
    object_type: str,
    object_id: str,
    object_name: str,
    confidence: float = 1.0,
    status: str = "verified",
    provenance: dict[str, Any] | None = None,
) -> str:
    claim_id = new_id("claim")
    conn.execute(
        """
        INSERT INTO claims
            (id, tenant_id, workspace_id, document_id, chunk_id, subject_type, subject_id, subject_name,
             predicate, object_type, object_id, object_name, confidence, status, provenance, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            claim_id,
            tenant_id,
            workspace_id,
            document_id,
            chunk_id,
            subject_type,
            subject_id,
            subject_name,
            predicate,
            object_type,
            object_id,
            object_name,
            max(0.0, min(1.0, float(confidence))),
            status,
            _json(provenance or {}),
            now_iso(),
            now_iso(),
        ),
    )
    return claim_id


def insert_evidence_link(
    conn: Any,
    *,
    tenant_id: str,
    workspace_id: str,
    claim_id: str,
    document_id: str | None,
    chunk_id: str | None,
    edge_type: str = "EVIDENCED_BY",
    provenance: dict[str, Any] | None = None,
) -> str:
    link_id = new_id("evid")
    conn.execute(
        """
        INSERT INTO evidence_links
            (id, tenant_id, workspace_id, claim_id, document_id, chunk_id, edge_type, provenance, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            link_id,
            tenant_id,
            workspace_id,
            claim_id,
            document_id,
            chunk_id,
            edge_type,
            _json(provenance or {}),
            now_iso(),
        ),
    )
    return link_id


def create_approval(
    conn: Any,
    *,
    tenant_id: str,
    workspace_id: str,
    claim_id: str,
    reason: str,
    status: str = "pending",
) -> str:
    approval_id = new_id("appr")
    conn.execute(
        """
        INSERT INTO approvals
            (id, tenant_id, workspace_id, claim_id, status, reason, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            approval_id,
            tenant_id,
            workspace_id,
            claim_id,
            status,
            reason or "",
            now_iso(),
            now_iso(),
        ),
    )
    return approval_id


def upsert_decision(
    conn: Any,
    *,
    tenant_id: str,
    workspace_id: str,
    decision_id: str,
    title: str,
    summary: str,
    date: str | None = None,
    author: str | None = None,
    status: str = "active",
    document_id: str | None = None,
    provenance: dict[str, Any] | None = None,
) -> str:
    conn.execute(
        """
        INSERT INTO decisions
            (id, tenant_id, workspace_id, title, summary, date, author, status, document_id, provenance, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            summary = excluded.summary,
            date = excluded.date,
            author = excluded.author,
            status = excluded.status,
            document_id = excluded.document_id,
            provenance = excluded.provenance,
            updated_at = excluded.updated_at
        """,
        (
            decision_id,
            tenant_id,
            workspace_id,
            title or "",
            summary or "",
            date,
            author,
            status,
            document_id,
            _json(provenance or {}),
            now_iso(),
            now_iso(),
        ),
    )
    return decision_id


def create_job(
    conn: Any,
    *,
    tenant_id: str,
    workspace_id: str,
    source_kind: str,
    payload: dict[str, Any] | None = None,
    status: str = "queued",
    stage: str = "ingestion",
) -> str:
    job_id = new_id("job")
    conn.execute(
        """
        INSERT INTO ingestion_jobs
            (id, tenant_id, workspace_id, source_kind, status, stage, attempts, next_attempt_at, payload, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)
        """,
        (
            job_id,
            tenant_id,
            workspace_id,
            source_kind or "document",
            status,
            stage,
            _json(payload or {}),
            now_iso(),
            now_iso(),
        ),
    )
    return job_id


def create_outbox_event(
    conn: Any,
    *,
    tenant_id: str,
    workspace_id: str,
    entity_type: str,
    entity_id: str,
    operation: str = "upsert",
    payload: dict[str, Any] | None = None,
) -> str:
    event_id = new_id("outbox")
    conn.execute(
        """
        INSERT INTO graph_sync_outbox
            (id, tenant_id, workspace_id, entity_type, entity_id, operation, payload, status, attempts, next_attempt_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?)
        """,
        (
            event_id,
            tenant_id,
            workspace_id,
            entity_type,
            entity_id,
            operation,
            _json(payload or {}),
            now_iso(),
            now_iso(),
        ),
    )
    return event_id


def list_outbox(limit: int = 50) -> list[dict[str, Any]]:
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT id, tenant_id, workspace_id, entity_type, entity_id, operation,
                   payload, status, attempts, next_attempt_at, processed_at, error,
                   created_at, updated_at
            FROM graph_sync_outbox
            WHERE status = 'pending'
               OR (status = 'failed' AND (next_attempt_at IS NULL OR next_attempt_at <= ?))
            ORDER BY created_at ASC
            LIMIT ?
            """,
            (now_iso(), max(1, min(limit, 200))),
        ).fetchall()
    out = []
    for row in rows:
        item = dict(row)
        try:
            item["payload"] = json.loads(item.get("payload") or "{}")
        except Exception:
            item["payload"] = {}
        out.append(item)
    return out


def mark_outbox_processed(event_id: str) -> None:
    with db.connect() as conn:
        conn.execute(
            """
            UPDATE graph_sync_outbox
            SET status = 'processed', processed_at = ?, error = NULL, updated_at = ?
            WHERE id = ?
            """,
            (now_iso(), now_iso(), event_id),
        )


def mark_outbox_failed(event_id: str, error: str) -> None:
    with db.connect() as conn:
        row = conn.execute(
            "SELECT attempts FROM graph_sync_outbox WHERE id = ?",
            (event_id,),
        ).fetchone()
        attempts = int((row or {}).get("attempts") or 0) + 1
        conn.execute(
            """
            UPDATE graph_sync_outbox
            SET status = 'failed', attempts = ?, error = ?, next_attempt_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (attempts, error[:4000], now_iso(), now_iso(), event_id),
        )