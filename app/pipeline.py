"""app/pipeline.py — asynchronous ingestion pipeline.

Pipeline stages:
  source ingestion -> parsing -> chunking -> embedding -> entity and
  relationship extraction -> deduplication -> conflict detection -> human
  review -> PostgreSQL persistence -> FalkorDB graph updates via outbox.

The API enqueues jobs; this module persists canonical documents/chunks and
writes transactional outbox events in the same DB transaction so graph
projection never diverges from PostgreSQL.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from typing import Any

from app import db
from app import knowledge_store
from app import store


VECTOR_DIM = 384
PIPELINE_STAGES = [
    "source_ingestion",
    "parsing",
    "chunking",
    "embedding",
    "extraction",
    "deduplication",
    "conflict_detection",
    "human_review",
    "postgres_persistence",
    "graph_updates",
]

ENTITY_MAP = {
    "person": "Person",
    "personnel": "Person",
    "employee": "Person",
    "team": "Team",
    "group": "Team",
    "project": "Project",
    "service": "Service",
    "document": "Document",
    "decision": "Decision",
    "customer": "Customer",
    "concept": "Concept",
}

RELATIONSHIP_MAP = {
    "member_of": "MEMBER_OF",
    "works_on": "WORKS_ON",
    "created": "CREATED",
    "depends_on": "DEPENDS_ON",
    "supports": "SUPPORTS",
    "contradicts": "CONTRADICTS",
    "supersedes": "SUPERSEDES",
    "owned_by": "OWNED_BY",
    "evidenced_by": "EVIDENCED_BY",
}


def adopt_chunk(text: str, size: int = 500) -> list[str]:
    """Split extracted text into compact, searchable chunks."""
    normalized = re.sub(r"\s+", " ", (text or "")).strip()
    if not normalized:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", normalized)
    out: list[str] = []
    buf = ""
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if len(buf) + len(sentence) + 1 <= size:
            buf = f"{buf} {sentence}".strip()
        else:
            if buf:
                out.append(buf)
            buf = sentence
    if buf:
        out.append(buf)
    return out


def embed_text(text: str, *, dim: int = VECTOR_DIM) -> list[float]:
    """Produce a deterministic local embedding.

    This is a signed hashing embedding. It is useful for pgvector retrieval
    without adding a heavyweight model dependency; a production embedding
    service can replace this function while keeping the same vector column.
    """
    vec = [0.0 for _ in range(dim)]
    tokens = re.findall(r"[a-z0-9_]+", (text or "").lower())
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        for i in range(4):
            idx = int.from_bytes(digest[i * 2 : i * 2 + 2], "little") % dim
            sign = 1.0 if (digest[i] & 1) else -1.0
            vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 8) for v in vec]


def _content_hash(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def _provenance(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {"source": str(value or "")}


def _find_conflict(conn: Any, tenant_id: str, workspace_id: str, claim: dict[str, Any]) -> dict[str, Any] | None:
    rows = conn.execute(
        """
        SELECT id, object_name, object_id, status
        FROM claims
        WHERE tenant_id = ? AND workspace_id = ? AND subject_name = ?
          AND predicate = ? AND object_name != ?
        ORDER BY updated_at DESC
        LIMIT 5
        """,
        (tenant_id, workspace_id, claim["subject_name"], claim["predicate"], claim["object_name"]),
    ).fetchall()
    return dict(rows[0]) if rows else None


def extract_claims(text: str, *, document_id: str, chunk_id: str) -> list[dict[str, Any]]:
    """Extract simple graph claims from a chunk.

    This deliberately handles the small, common relationship forms needed by
    the demo graph and provider records. Full entity resolution remains a
    model/LLM task; this function keeps the loop honest and deterministic.
    """
    claims: list[dict[str, Any]] = []
    pats = [
        (re.compile(r"([A-Za-z][A-Za-z ]+?) owns ([a-z0-9_-]+)", re.I), "Person", "Project", "OWNED_BY"),
        (re.compile(r"([a-z0-9_-]+) is owned by ([A-Za-z][A-Za-z ]+)", re.I), "Service", "Team", "OWNED_BY"),
        (re.compile(r"([A-Za-z][A-Za-z ]+?) is a member of ([A-Za-z][A-Za-z ]+)", re.I), "Person", "Team", "MEMBER_OF"),
        (re.compile(r"([a-z0-9_-]+) depends on ([a-z0-9_-]+)", re.I), "Service", "Service", "DEPENDS_ON"),
        (re.compile(r"(D-\d+) supersedes (D-\d+)", re.I), "Decision", "Decision", "SUPERSEDES"),
        (re.compile(r"([A-Za-z][A-Za-z ]+?) created ([a-z0-9_-]+)", re.I), "Person", "Project", "CREATED"),
    ]
    for pattern, subject_type, object_type, predicate in pats:
        for match in pattern.finditer(text or ""):
            subject_name = match.group(1).strip()
            object_name = match.group(2).strip()
            if not subject_name or not object_name:
                continue
            claims.append(
                {
                    "subject_type": subject_type,
                    "subject_id": subject_name,
                    "subject_name": subject_name,
                    "predicate": predicate,
                    "object_type": object_type,
                    "object_id": object_name,
                    "object_name": object_name,
                    "chunk_id": chunk_id,
                }
            )
    return claims


def persist_document(
    account_id: str,
    *,
    workspace_id: str | None = None,
    title: str = "",
    chunks: list[str],
    provenance: dict[str, Any] | None = None,
    source_kind: str = "document",
    source_id: str | None = None,
    source_url: str | None = None,
    object_uri: str | None = None,
    external_id: str | None = None,
    job_stage: str = "postgres_persistence",
) -> dict[str, Any]:
    """Persist a document, its chunks/claims, and one outbox event per chunk."""
    workspace = store.resolve_workspace_id(account_id, workspace_id)
    tenant_id = account_id
    content_hash = _content_hash("\n\n".join(chunks))
    document_id = knowledge_store.new_id("doc")

    with db.tenant_context(tenant_id, workspace):
        with db.connect() as conn:
            existing_source = conn.execute(
                """
                SELECT id FROM knowledge_sources
                WHERE tenant_id = ? AND workspace_id = ? AND external_id = ?
                LIMIT 1
                """,
                (tenant_id, workspace, external_id or ""),
            ).fetchone() if external_id else None
            source_record = existing_source["id"] if existing_source else knowledge_store.ensure_source(
                conn,
                tenant_id=tenant_id,
                workspace_id=workspace,
                provider=source_kind or "upload",
                source_name=title or "Document",
                external_id=external_id,
                source_url=source_url,
                provenance=provenance or {},
            )

            knowledge_store.upsert_document(
                conn,
                tenant_id=tenant_id,
                workspace_id=workspace,
                document_id=document_id,
                title=title or "Document",
                content_hash=content_hash,
                source_id=source_record,
                object_uri=object_uri,
                provenance=provenance or {},
            )

            chunk_results = []
            job_id = knowledge_store.create_job(
                conn,
                tenant_id=tenant_id,
                workspace_id=workspace,
                source_kind=source_kind or "document",
                payload={"document_id": document_id, "stage": job_stage},
                status="completed",
                stage=job_stage,
            )

            seen_hashes: set[str] = set()
            for index, chunk in enumerate(chunks):
                chunk_hash = _content_hash(chunk)
                duplicate = chunk_hash in seen_hashes
                seen_hashes.add(chunk_hash)
                embedding = embed_text(chunk)
                chunk_id = knowledge_store.insert_chunk(
                    conn,
                    tenant_id=tenant_id,
                    workspace_id=workspace,
                    document_id=document_id,
                    chunk_index=index,
                    text=chunk,
                    embedding=embedding,
                    chunk_hash=chunk_hash,
                    provenance=provenance or {},
                )
                outbox_event = knowledge_store.create_outbox_event(
                    conn,
                    tenant_id=tenant_id,
                    workspace_id=workspace,
                    entity_type="Document",
                    entity_id=document_id,
                    operation="upsert",
                    payload={
                        "entity": {
                            "label": "Document",
                            "properties": {
                                "id": document_id,
                                "name": title or "Document",
                                "title": title or "Document",
                                "content_hash": content_hash,
                                "object_uri": object_uri or "",
                            },
                        },
                        "source_document_id": document_id,
                        "source_url": source_url or "",
                        "provenance_hash": content_hash,
                    },
                )
                chunk_results.append(
                    {
                        "chunk_id": chunk_id,
                        "index": index,
                        "hash": chunk_hash,
                        "duplicate": duplicate,
                        "outbox_event_id": outbox_event,
                    }
                )

                for claim in extract_claims(chunk, document_id=document_id, chunk_id=chunk_id):
                    conflict = _find_conflict(conn, tenant_id, workspace, claim)
                    status = "pending_review" if conflict else "verified"
                    claim_id = knowledge_store.insert_claim(
                        conn,
                        tenant_id=tenant_id,
                        workspace_id=workspace,
                        document_id=document_id,
                        chunk_id=chunk_id,
                        subject_type=claim["subject_type"],
                        subject_id=claim["subject_id"],
                        subject_name=claim["subject_name"],
                        predicate=claim["predicate"],
                        object_type=claim["object_type"],
                        object_id=claim["object_id"],
                        object_name=claim["object_name"],
                        status=status,
                        provenance=provenance or {},
                    )
                    knowledge_store.insert_evidence_link(
                        conn,
                        tenant_id=tenant_id,
                        workspace_id=workspace,
                        claim_id=claim_id,
                        document_id=document_id,
                        chunk_id=chunk_id,
                        edge_type="EVIDENCED_BY",
                        provenance=provenance or {},
                    )
                    if conflict:
                        knowledge_store.create_approval(
                            conn,
                            tenant_id=tenant_id,
                            workspace_id=workspace,
                            claim_id=claim_id,
                            reason=f"Conflicts with claim {conflict['id']} ({conflict['object_name']}).",
                        )
                    knowledge_store.create_outbox_event(
                        conn,
                        tenant_id=tenant_id,
                        workspace_id=workspace,
                        entity_type="Claim",
                        entity_id=claim_id,
                        operation="upsert",
                        payload={
                            "entity": {
                                "label": "Claim",
                                "properties": {
                                    "id": claim_id,
                                    "name": claim["subject_name"],
                                    "subject_type": claim["subject_type"],
                                    "subject_name": claim["subject_name"],
                                    "predicate": claim["predicate"],
                                    "object_type": claim["object_type"],
                                    "object_name": claim["object_name"],
                                    "status": status,
                                },
                            },
                            "relationship": {
                                "from_label": claim["subject_type"],
                                "from_key": claim["subject_id"],
                                "type": claim["predicate"],
                                "to_label": claim["object_type"],
                                "to_key": claim["object_id"],
                            },
                            "source_document_id": document_id,
                            "source_url": source_url or "",
                            "provenance_hash": chunk_hash,
                        },
                    )

    return {
        "document_id": document_id,
        "workspace_id": workspace,
        "chunks": chunk_results,
        "chunk_count": len(chunk_results),
        "job_id": job_id,
        "stages": PIPELINE_STAGES,
    }


def persist_records(
    account_id: str,
    *,
    provider: str,
    records: list[dict[str, Any] | str],
    workspace_id: str | None = None,
    provenance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Normalize provider records and persist each as a canonical document."""
    workspace = store.resolve_workspace_id(account_id, workspace_id)
    out: list[dict[str, Any]] = []
    for index, record in enumerate(records):
        if isinstance(record, str):
            title = f"{provider} record {index + 1}"
            text = record
            external_id = None
            source_url = None
        elif isinstance(record, dict):
            title = str(record.get("title") or record.get("name") or f"{provider} record {index + 1}")
            text = str(record.get("text") or record.get("body") or record.get("summary") or json.dumps(record, default=str))
            external_id = record.get("id") or record.get("external_id")
            source_url = record.get("url") or record.get("source_url")
        else:
            continue
        chunks = adopt_chunk(text)
        if not chunks:
            continue
        out.append(
            persist_document(
                account_id,
                workspace_id=workspace,
                title=title,
                chunks=chunks,
                provenance={
                    **(provenance or {}),
                    "provider": provider,
                    "record_index": index,
                },
                source_kind=provider,
                external_id=str(external_id) if external_id else None,
                source_url=str(source_url) if source_url else None,
            )
        )
    return {"workspace_id": workspace, "documents": out, "documents_persisted": len(out)}