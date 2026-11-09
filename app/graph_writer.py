"""app/graph_writer.py — FalkorDB projection writer.

PostgreSQL remains canonical. This writer projects outbox events into a
workspace graph, preserving source provenance on every node and edge so the
graph can be rebuilt from PostgreSQL if needed.
"""

from __future__ import annotations

import hashlib
from typing import Any

from app import graph as graph_service


ALLOWED_LABELS = {
    "Person",
    "Team",
    "Project",
    "Document",
    "Decision",
    "BusinessRule",
    "Concept",
    "Customer",
    "Service",
    "Claim",
    "Message",
}

ALLOWED_RELATIONSHIPS = {
    "MEMBER_OF",
    "WORKS_ON",
    "CREATED",
    "DEPENDS_ON",
    "SUPPORTS",
    "CONTRADICTS",
    "SUPERSEDES",
    "OWNED_BY",
    "HAS_DEPENDENT",
    "ON_CALL",
    "EVIDENCED_BY",
    "REPORTS_TO",
    "MENTIONS",
    "HAS_ROTATION",
    "USES",
    "ABOUT",
}

ENTITY_KEY_CANDIDATES = ("id", "name", "external_id")


def _provenance_hash(payload: dict[str, Any]) -> str:
    import json

    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def _sanitize(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    import json

    return json.dumps(value, default=str)


def _key_for(label: str, properties: dict[str, Any]) -> str:
    for key in ENTITY_KEY_CANDIDATES:
        value = properties.get(key)
        if value:
            return str(value)
    return properties.get("title") or label


def upsert_entity(
    g: Any,
    *,
    label: str,
    properties: dict[str, Any],
    tenant_id: str,
    workspace_id: str,
    source_document_id: str | None = None,
    source_url: str | None = None,
    provenance: str | None = None,
) -> dict[str, Any]:
    if label not in ALLOWED_LABELS:
        raise ValueError(f"Unsupported entity label: {label}")
    key_field = "id" if (label == "Decision" and properties.get("id")) else "name"
    key = str(properties.get(key_field) or _key_for(label, properties))
    props = {k: _sanitize(v) for k, v in dict(properties).items()}
    props["tenant_id"] = tenant_id
    props["workspace_id"] = workspace_id
    props["source_document_id"] = source_document_id or props.get("source_document_id") or ""
    props["source_url"] = source_url or props.get("source_url") or ""
    props["provenance_hash"] = provenance or _provenance_hash(props)
    cypher = f"MERGE (n:{label} {{{key_field}: $key}}) SET n += $props RETURN n.{key_field} AS key"
    return {"label": label, "key": key, "result": g.query(cypher, {"key": key, "props": props}).result_set}


def upsert_relationship(
    g: Any,
    *,
    from_label: str,
    from_key: str,
    relationship: str,
    to_label: str,
    to_key: str,
    tenant_id: str,
    workspace_id: str,
    properties: dict[str, Any] | None = None,
    source_document_id: str | None = None,
    source_url: str | None = None,
    provenance: str | None = None,
) -> dict[str, Any]:
    if relationship not in ALLOWED_RELATIONSHIPS:
        raise ValueError(f"Unsupported relationship: {relationship}")
    if from_label not in ALLOWED_LABELS or to_label not in ALLOWED_LABELS:
        raise ValueError(f"Unsupported entity label: {from_label}/{to_label}")

    def key_field(label: str) -> str:
        return "id" if label == "Decision" else "name"

    from_field = key_field(from_label)
    to_field = key_field(to_label)
    props = {k: _sanitize(v) for k, v in dict(properties or {}).items()}
    props["tenant_id"] = tenant_id
    props["workspace_id"] = workspace_id
    props["source_document_id"] = source_document_id or props.get("source_document_id") or ""
    props["source_url"] = source_url or props.get("source_url") or ""
    props["provenance_hash"] = provenance or _provenance_hash(props)
    cypher = (
        f"MATCH (a:{from_label} {{{from_field}: $from_key}}) "
        f"MATCH (b:{to_label} {{{to_field}: $to_key}}) "
        f"MERGE (a)-[r:{relationship}]->(b) SET r += $props RETURN a.{from_field} AS from, b.{to_field} AS to"
    )
    return {
        "relationship": relationship,
        "result": g.query(
            cypher,
            {"from_key": from_key, "to_key": to_key, "props": props},
        ).result_set,
    }


def sync_event(event: dict[str, Any]) -> dict[str, Any]:
    """Apply one transactional-outbox event to its workspace graph."""
    payload = event.get("payload") or {}
    tenant_id = event.get("tenant_id") or ""
    workspace_id = event.get("workspace_id") or tenant_id
    g = graph_service.select_graph_for_workspace(workspace_id)
    graph_service.ensure_indexes(g)

    entity = payload.get("entity") or payload.get("node") or {}
    relationship = payload.get("relationship") or {}

    result: dict[str, Any] = {"workspace_graph": graph_service.graph_name_for(tenant_id, workspace_id)}
    if entity:
        result["entity"] = upsert_entity(
            g,
            label=entity.get("label") or "Concept",
            properties=entity.get("properties") or {},
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            source_document_id=payload.get("source_document_id"),
            source_url=payload.get("source_url"),
            provenance=payload.get("provenance_hash"),
        )
    if relationship:
        result["relationship"] = upsert_relationship(
            g,
            from_label=relationship.get("from_label") or "Concept",
            from_key=relationship.get("from_key") or "",
            relationship=relationship.get("type") or "SUPPORTS",
            to_label=relationship.get("to_label") or "Concept",
            to_key=relationship.get("to_key") or "",
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            properties=relationship.get("properties") or {},
            source_document_id=payload.get("source_document_id"),
            source_url=payload.get("source_url"),
            provenance=payload.get("provenance_hash"),
        )
    return result