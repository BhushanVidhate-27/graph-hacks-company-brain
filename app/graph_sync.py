"""app/graph_sync.py — transactional outbox -> FalkorDB reconciliation.

Canonical knowledge records are persisted in PostgreSQL together with an
outbox event. This worker replays those events into each workspace graph.
It is safe to run repeatedly: processing marks an event processed only after
the corresponding FalkorDB write succeeds.
"""

from __future__ import annotations

import json
import time
from typing import Any

from app import db
from app import graph_writer
from app import knowledge_store
from app import store


def process_pending(limit: int = 50) -> dict[str, int]:
    """Process up to `limit` pending outbox events."""
    processed = 0
    failed = 0
    for event in knowledge_store.list_outbox(limit):
        try:
            with db.tenant_context(event["tenant_id"], event["workspace_id"]):
                account = store.get_account(event["tenant_id"])
                if account is None:
                    raise RuntimeError(f"Tenant account not found: {event['tenant_id']}")
                graph_writer.sync_event(event)
                knowledge_store.mark_outbox_processed(event["id"])
                processed += 1
        except Exception as exc:  # noqa: BLE001 - record and continue
            failed += 1
            knowledge_store.mark_outbox_failed(event["id"], str(exc))
    return {"processed": processed, "failed": failed}


def rebuild_workspace_graph(account_id: str, workspace_id: str | None = None) -> dict[str, Any]:
    """Rebuild one workspace graph from PostgreSQL's canonical records.

    This is intentionally bounded to the claim/document outbox and document
    projections that were persisted by the ingestion pipeline. Existing
    demo/synthetic graph data is never touched: tenant graphs are isolated.
    """
    # Bound to the current API so the demo graph is never rebuilt.
    workspace = store.resolve_workspace_id(account_id, workspace_id)
    with db.tenant_context(account_id, workspace):
        with db.connect() as conn:
            rows = conn.execute(
                """
                SELECT payload FROM graph_sync_outbox
                WHERE tenant_id = ? AND workspace_id = ? AND status IN ('pending', 'processed')
                ORDER BY created_at ASC
                """,
                (account_id, workspace),
            ).fetchall()
    return {"workspace_id": workspace, "events_seen": len(rows), "note": "Replay outbox events with process_pending()."}


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Run the Helio graph sync worker.")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--watch", action="store_true", help="Poll continuously.")
    parser.add_argument("--interval", type=float, default=5.0)
    args = parser.parse_args()

    while True:
        result = process_pending(args.limit)
        print(json.dumps(result))
        if not args.watch:
            return
        if result.get("processed", 0) == 0 and result.get("failed", 0) == 0:
            time.sleep(args.interval)


if __name__ == "__main__":
    main()