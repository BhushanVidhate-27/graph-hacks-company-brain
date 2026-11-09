"""app/retrieval.py — hybrid retrieval over canonical chunks.

Helio keeps canonical text, chunks, facts, claims, evidence, approvals and
decisions in PostgreSQL. This module adds pgvector similarity and lexical
filtering on top of those rows; graph traversal remains in app/graph.py and
is invoked by the agent loop. The results always include provenance and
source citations so retrieval never drops the evidence chain.
"""

from __future__ import annotations

import json
from typing import Any

from app import db
from app import pipeline
from app import store


def _vector_param(vec: list[float]) -> str:
    return "[" + ",".join(f"{float(x):.8f}" for x in vec) + "]"


def _parse_embedding(raw: Any) -> list[float] | None:
    if raw is None:
        return None
    if isinstance(raw, (list, tuple)):
        return [float(x) for x in raw]
    if isinstance(raw, str):
        text = raw.strip()
        if text.startswith("[") and text.endswith("]"):
            try:
                values = json.loads(text)
                return [float(x) for x in values]
            except Exception:
                return None
        try:
            return [float(x) for x in text.split(",") if x.strip()]
        except Exception:
            return None
    return None


def hybrid_search(
    account_id: str,
    question: str,
    *,
    workspace_id: str | None = None,
    limit: int = 8,
) -> dict[str, Any]:
    """Combine lexical and vector similarity with source citations.

    Postgres uses pgvector (`embedding <=> query`) when embeddings exist.
    SQLite falls back to in-memory cosine similarity. Lexical filtering is
    included in both paths so a hybrid result is useful even before the
    embedding service is configured.
    """
    workspace = store.resolve_workspace_id(account_id, workspace_id)
    q = (question or "").strip()
    if not q:
        return {"results": [], "workspace_id": workspace}

    with db.tenant_context(account_id, workspace):
        with db.connect() as conn:
            kind = db.backend()
            if kind == "postgres":
                qvec = _vector_param(pipeline.embed_text(q))
                rows = conn.execute(
                    """
                    SELECT c.id, c.text, c.chunk_index, c.embedding_model,
                           c.created_at, c.document_id, c.embedding, c.provenance,
                           (c.embedding <=> ?::vector) AS distance
                    FROM document_chunks c
                    WHERE c.tenant_id = ? AND c.workspace_id = ?
                    ORDER BY c.embedding <=> ?::vector
                    LIMIT 50
                    """,
                    (qvec, account_id, workspace, qvec),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT c.id, c.text, c.chunk_index, c.embedding_model,
                           c.created_at, c.document_id, c.embedding, c.provenance
                    FROM document_chunks c
                    WHERE c.tenant_id = ? AND c.workspace_id = ?
                    LIMIT 200
                    """,
                    (account_id, workspace),
                ).fetchall()

    q_vec = pipeline.embed_text(q)
    scored: list[dict[str, Any]] = []
    q_lower = q.lower()
    for row in rows:
        text = row.get("text") or ""
        vec = _parse_embedding(row.get("embedding"))
        sim = 0.0
        if vec is not None and len(vec) == len(q_vec):
            dot = sum(a * b for a, b in zip(vec, q_vec))
            norm_a = sum(a * a for a in vec) ** 0.5
            norm_b = sum(b * b for b in q_vec) ** 0.5
            sim = dot / (norm_a * norm_b) if norm_a and norm_b else 0.0
        lexical = sum(1 for token in q_lower.split() if token and token in text.lower())
        score = 0.72 * sim + 0.28 * min(1.0, lexical / 3.0)
        if score <= 0 and lexical == 0:
            continue
        scored.append(
            {
                "chunk_id": row.get("id"),
                "document_id": row.get("document_id"),
                "text": text,
                "chunk_index": row.get("chunk_index"),
                "embedding_model": row.get("embedding_model"),
                "score": round(score, 4),
                "vector_similarity": round(sim, 4),
                "lexical_hits": lexical,
                "citation": {
                    "chunk_id": row.get("id"),
                    "document_id": row.get("document_id"),
                    "chunk_index": row.get("chunk_index"),
                    "provenance": row.get("provenance") or {},
                },
            }
        )

    scored.sort(key=lambda item: item["score"], reverse=True)
    return {
        "results": scored[: max(1, min(limit, 50))],
        "workspace_id": workspace,
        "tenant_id": account_id,
        "hybrid": True,
        "vector_backend": "pgvector" if db.backend() == "postgres" else "in-memory",
    }