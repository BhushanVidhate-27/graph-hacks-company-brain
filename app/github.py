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

import os
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

    return {"owner": GITHUB_OWNER, "repo": GITHUB_REPO, "items": items}
