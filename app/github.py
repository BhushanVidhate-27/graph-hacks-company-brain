"""app/github.py - GitHub issues and pull requests integration for Helio.

The rest of Helio answers questions about an internal company graph. This module
covers the external side: it turns a connected GitHub repository into the same
issue / pull-request objects the company brain can reason over.

Design notes
------------
* The module is defensive: if PyGithub is not installed, or no token/repo is
  configured, API calls fail cleanly instead of crashing the server.
* Everything is scoped to one GitHub owner + repository. Each item is shaped as
  a JSON object with a small, explicit surface so the rest of the system can
  consume it without knowing GitHub implementation details.
* The service does not persist long-term state here; it is a read path that
  returns current issues and pull requests for the connected repository.
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

try:  # Optional dependency - used only when the integration is enabled.
    from github import Github
except ImportError:  # pragma: no cover
    Github = None

__all__ = [
    "GITHUB_TOKEN",
    "GITHUB_OWNER",
    "GITHUB_REPO",
    "github_client",
    "list_repo_items",
    "repo_config",
]

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN") or None
GITHUB_OWNER = os.getenv("GITHUB_OWNER") or ""
GITHUB_REPO = os.getenv("GITHUB_REPO") or os.getenv("GITHUB_REPOSITORY") or ""


class _MissingConfig(Exception):
    """Raised when the required GitHub integration variables are missing."""


def _missing_env(required: list[str]) -> list[str]:
    return [name for name in required if not os.getenv(name)]


def repo_config() -> dict[str, Any]:
    """Return the resolved GitHub integration config and any missing fields."""

    missing = _missing_env(["GITHUB_OWNER", "GITHUB_REPO"])
    return {
        "owner": GITHUB_OWNER,
        "repo": GITHUB_REPO,
        "token": GITHUB_TOKEN,
        "configured": bool(GITHUB_OWNER and GITHUB_REPO and GITHUB_TOKEN),
        "missing": missing or None,
    }


def github_client():
    """Return a configured PyGithub client, or None when unsupported."""

    if Github is None:
        return None
    if not GITHUB_TOKEN:
        return None
    try:
        return Github(GITHUB_TOKEN)
    except Exception:
        return None


def _repo():
    client = github_client()
    if client is None:
        return None
    try:
        return client.get_repo(f"{GITHUB_OWNER}/{GITHUB_REPO}")
    except Exception:
        return None


def _serialise_issue(issue: Any, is_pull: bool) -> dict[str, Any]:
    return {
        "id": str(issue.id),
        "number": issue.number,
        "title": issue.title,
        "state": issue.state,
        "user": {"login": issue.user.login} if getattr(issue, "user", None) else None,
        "labels": [{"name": label.name, "color": label.color} for label in issue.labels],
        "comments": issue.comments,
        "created_at": issue.created_at.isoformat() if issue.created_at else None,
        "updated_at": issue.updated_at.isoformat() if issue.updated_at else None,
        "html_url": issue.html_url,
        "pull_request": is_pull,
    }


def list_repo_items(state: str = "open") -> dict[str, Any]:
    """Return the current issues/pulls for the connected GitHub repository."""

    repo = _repo()
    if repo is None:
        return {
            "owner": GITHUB_OWNER,
            "repo": GITHUB_REPO,
            "configured": bool(GITHUB_OWNER and GITHUB_REPO and GITHUB_TOKEN),
            "items": [],
            "error": "GitHub repository was not configured or PyGithub is unavailable.",
        }

    items: list[dict[str, Any]] = []
    for issue in repo.get_issues(state=state):
        items.append(_serialise_issue(issue, is_pull=False))
    for pull in repo.get_pulls(state=state):
        items.append(_serialise_issue(pull, is_pull=True))

__all__ = [
    "GITHUB_TOKEN",
    "GITHUB_OWNER",
    "GITHUB_REPO",
    "github_client",
    "list_repo_items",
    "repo_config",
    "init_db",
    "sync_state",
    "list_items",
]

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_DB_PATH = _DATA_DIR / "github_items.db"


def init_db() -> None:
    """Create the GitHub items table if it does not exist yet."""

    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(_DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS github_items (
                id TEXT PRIMARY KEY,
                owner TEXT NOT NULL,
                repo TEXT NOT NULL,
                number INTEGER NOT NULL,
                title TEXT NOT NULL,
                state TEXT NOT NULL,
                user_login TEXT,
                labels TEXT NOT NULL DEFAULT '[]',
                comments INTEGER NOT NULL DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                html_url TEXT,
                pull_request INTEGER NOT NULL
            )
            """
        )


def upsert_item(item: dict[str, Any]) -> None:
    """Insert or replace a single item in the persistent store."""

    init_db()
    with sqlite3.connect(_DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO github_items
            (id, owner, repo, number, title, state, user_login, labels, comments,
             created_at, updated_at, html_url, pull_request)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                owner=excluded.owner,
                repo=excluded.repo,
                number=excluded.number,
                title=excluded.title,
                state=excluded.state,
                user_login=excluded.user_login,
                labels=excluded.labels,
                comments=excluded.comments,
                created_at=excluded.created_at,
                updated_at=excluded.updated_at,
                html_url=excluded.html_url,
                pull_request=excluded.pull_request
            """,
            (
                item.get("id"),
                item.get("owner", ""),
                item.get("repo", ""),
                item.get("number"),
                item.get("title", ""),
                item.get("state", ""),
                (item.get("user") or {}).get("login") if isinstance(item.get("user"), dict) else None,
                json.dumps(item.get("labels", [])),
                item.get("comments") or 0,
                item.get("created_at"),
                item.get("updated_at"),
                item.get("html_url"),
                1 if item.get("pull_request") else 0,
            ),
        )


def upsert_items(items: list[dict[str, Any]]) -> None:
    """Insert or replace many items, used by sync_state."""

    for item in items:
        upsert_item(item)


def list_items(owner: str, repo: str, state: str = "open") -> list[sqlite3.Row]:
    """Return synced GitHub items from the persistent store."""

    init_db()
    with sqlite3.connect(_DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        return conn.execute(
            """
            SELECT id, owner, repo, number, title, state, user_login, labels,
                   comments, created_at, updated_at, html_url, pull_request
            FROM github_items
            WHERE owner = ? AND repo = ? AND state = ?
            ORDER BY updated_at DESC
            """,
            (owner, repo, state),
        ).fetchall()


def sync_state(state: str = "open") -> dict[str, Any]:
    """Fetch the live GitHub items and persist them, then return the same shape
    as `list_repo_items`."""

    data = list_repo_items(state)
    if data.get("configured"):
        upsert_items(data.get("items", []))
    return data
    return {"owner": GITHUB_OWNER, "repo": GITHUB_REPO, "items": items}
