#!/usr/bin/env python3
"""Terminal client for Helio company brain.

Usage examples:
  python scripts/terminal_client.py init-account --email you@example.com --name "You" --workspace "My Brain" --password secret
  python scripts/terminal_client.py upload --account acct_xxx ./docs/notes.pdf
  python scripts/terminal_client.py ask --account acct_xxx "What does the document say about payments?"
  python scripts/terminal_client.py chat --account acct_xxx

Requires FalkorDB to be reachable for graph sync/projection and GROQ_API_KEY in .env for `ask/chat`.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

# Ensure repo root is importable when run as a script.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import agent, db, graph, graph_sync, knowledge, store


def _hash_password(password: str, salt: str | None = None) -> str:
    """Minimal password hash compatible with local dev (PBKDF2)."""
    salt_bytes = (salt or os.urandom(16).hex()).encode()
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, 200_000)
    return f"pbkdf2_sha256$200000${salt_bytes.decode()}${dk.hex()}"


def cmd_init_account(args: argparse.Namespace) -> int:
    db.ensure_schema()
    existing = store.get_user_by_email(args.email)
    if existing:
        print(json.dumps({
            "status": "exists",
            "account_id": existing.get("account_id"),
            "user_id": existing.get("id"),
            "email": existing.get("email"),
        }, indent=2))
        return 0
    result = store.create_account_with_owner(
        account_name=args.workspace,
        email=args.email,
        name=args.name,
        password_hash=_hash_password(args.password),
    )
    account = result.get("account") or {}
    workspace = store.get_default_workspace(account["id"]) if account.get("id") else None
    print(json.dumps({
        "status": "created",
        "account_id": account.get("id"),
        "workspace_id": (workspace or {}).get("id"),
        "user_id": (result.get("user") or {}).get("id"),
        "email": (result.get("user") or {}).get("email"),
    }, indent=2))
    return 0


def _set_context(account_id: str) -> str:
    workspace_id = store.resolve_workspace_id(account_id)
    db_token = db.set_current_tenant(account_id)
    db_ws_token = db.set_current_workspace(workspace_id)
    graph_acct = graph.set_current_account(account_id)
    graph_ws = graph.set_current_workspace(workspace_id)
    return json.dumps({
        "db_tenant_token": bool(db_token),
        "db_workspace_token": bool(db_ws_token),
        "graph_account_token": bool(graph_acct),
        "graph_workspace_token": bool(graph_ws),
    })


def cmd_upload(args: argparse.Namespace) -> int:
    path = Path(args.file).expanduser().resolve()
    if not path.exists() or not path.is_file():
        print(f"error: file not found: {path}", file=sys.stderr)
        return 2
    raw = path.read_bytes()

    db.ensure_schema()
    account = store.get_account(args.account)
    if not account:
        print(f"error: account not found: {args.account}", file=sys.stderr)
        return 2

    workspace_id = store.resolve_workspace_id(args.account)
    with db.tenant_context(args.account, workspace_id):
        ingest_result = knowledge.ingest(args.account, path.name, raw)

    sync_result = {"processed": 0, "failed": 0, "skipped": True, "reason": None}
    if args.no_sync:
        sync_result["reason"] = "--no-sync"
    else:
        try:
            # process_pending reads pending outbox rows globally; tenant context is set per event.
            sync_result = {"skipped": False, **graph_sync.process_pending(limit=args.sync_limit)}
        except Exception as exc:  # noqa: BLE001 - surface but don't hide ingest result
            sync_result = {"skipped": False, "processed": 0, "failed": 0, "error": f"{type(exc).__name__}: {exc}"}

    print(json.dumps({
        "status": "uploaded",
        "file": str(path),
        "account_id": args.account,
        "workspace_id": workspace_id,
        "ingest": ingest_result,
        "graph_sync": sync_result,
        "note": "Graph projection requires FalkorDB to be reachable. Ask uses retrieval+agent; GROQ_API_KEY required for LLM answers.",
    }, indent=2, default=str))
    return 0


def _format_retrieval_answer(question: str, results: list[dict]) -> str:
    if not results:
        return (
            "I could not find relevant content for that question in the uploaded documents "
            "for this workspace. Try rephrasing, or upload a document that contains the answer."
        )
    lines = ["Answer grounded in uploaded document content (retrieval-only mode):"]
    for i, item in enumerate(results[:5], 1):
        text = (item.get("text") or "").strip().replace("\n", " ")
        snippet = text[:500] + ("…" if len(text) > 500 else "")
        cite = item.get("citation") or {}
        doc = cite.get("document_id") or item.get("document_id") or "unknown-document"
        chunk = cite.get("chunk_index")
        where = f"doc={doc}" + (f", chunk={chunk}" if chunk is not None else "")
        lines.append(f"{i}. {snippet}")
        lines.append(f"   [source: {where}, score={item.get('score')}]")
    lines.append(
        "\nNote: GROQ_API_KEY is not configured, so this is a direct retrieval result (not a synthesized LLM answer)."
    )
    return "\n".join(lines)


def _run_question(account_id: str, question: str) -> dict:
    workspace_id = store.resolve_workspace_id(account_id)
    has_groq = bool(os.getenv("GROQ_API_KEY", "").strip() or os.getenv("GROQ_API_KEY_2", "").strip())

    # Bind tenant for graph tools and db-backed retrieval inside agent loop.
    with db.tenant_context(account_id, workspace_id):
        g_acct = graph.set_current_account(account_id)
        g_ws = graph.set_current_workspace(workspace_id)
        try:
            if has_groq:
                result = agent.run_agent(question)
            else:
                from app import retrieval
                search = retrieval.hybrid_search(account_id, question, workspace_id=workspace_id, limit=8)
                results = search.get("results", [])
                trail = [{
                    "type": "Document",
                    "name": (r.get("document_id") or r.get("chunk_id") or ""),
                    "detail": (r.get("text") or "")[:120],
                    "date": "",
                    "via_edge": "EVIDENCED_BY",
                } for r in results]
                result = {
                    "answer": _format_retrieval_answer(question, results),
                    "trail": trail,
                    "stale": [],
                    "mode": "retrieval_only",
                    "results": results,
                }
        finally:
            graph.reset_current_workspace(g_ws)
            graph.reset_current_account(g_acct)
    return result


def cmd_ask(args: argparse.Namespace) -> int:
    db.ensure_schema()
    if not store.get_account(args.account):
        print(f"error: account not found: {args.account}", file=sys.stderr)
        return 2
    result = _run_question(args.account, args.question)
    print(json.dumps(result, indent=2, default=str))
    return 0


def cmd_chat(args: argparse.Namespace) -> int:
    db.ensure_schema()
    if not store.get_account(args.account):
        print(f"error: account not found: {args.account}", file=sys.stderr)
        return 2
    print(f"Helio terminal client (account: {args.account})")
    print("Type a question, or /quit to exit.")
    while True:
        try:
            line = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if not line:
            continue
        if line in {"/quit", "/exit", ":q"}:
            return 0
        try:
            result = _run_question(args.account, line)
            answer = (result.get("answer") or "").strip()
            print(answer or json.dumps(result, indent=2, default=str))
            if args.show_meta:
                print("\n--- meta ---")
                print(json.dumps({
                    "trail_count": len(result.get("trail") or []),
                    "stale": result.get("stale") or [],
                }, indent=2, default=str))
                print("------------")
        except Exception as exc:  # noqa: BLE001 - keep REPL alive
            print(f"error: {type(exc).__name__}: {exc}", file=sys.stderr)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Helio terminal client (CLI)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("init-account", help="Create a local account/workspace")
    p_init.add_argument("--email", required=True)
    p_init.add_argument("--name", required=True)
    p_init.add_argument("--workspace", default="Helio Workspace")
    p_init.add_argument("--password", required=True)
    p_init.set_defaults(func=cmd_init_account)

    p_upload = sub.add_parser("upload", help="Upload a file, ingest, and sync graph outbox")
    p_upload.add_argument("--account", required=True, help="Account/tenant ID (acct_...)")
    p_upload.add_argument("file", help="Path to PDF/TXT/MD/CSV/DOCX file")
    p_upload.add_argument("--no-sync", action="store_true", help="Skip graph outbox processing")
    p_upload.add_argument("--sync-limit", type=int, default=200, help="Max outbox events to process")
    p_upload.set_defaults(func=cmd_upload)

    p_ask = sub.add_parser("ask", help="Ask a question (uses agent + graph/content tools)")
    p_ask.add_argument("--account", required=True, help="Account/tenant ID (acct_...)")
    p_ask.add_argument("question", help="Question to ask")
    p_ask.set_defaults(func=cmd_ask)

    p_chat = sub.add_parser("chat", help="Interactive REPL for questions")
    p_chat.add_argument("--account", required=True, help="Account/tenant ID (acct_...)")
    p_chat.add_argument("--show-meta", action="store_true", help="Show trail/stale counts after answers")
    p_chat.set_defaults(func=cmd_chat)

    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
