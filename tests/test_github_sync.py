"""Lightweight tests for the persistent GitHub items store.

These tests exercise the SQLite layer directly so the repository does not depend
on a running GitHub token for the database behaviour.
"""

import os
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import github as gh  # noqa: E402

SAMPLE_ITEM = {
    "id": "1",
    "owner": "BhushanVidhate-27",
    "repo": "graph-hacks-company-brain",
    "number": 10,
    "title": "Sync the items",
    "state": "open",
    "user": {"login": "soham"},
    "labels": [{"name": "bug", "color": "d73a4a"}],
    "comments": 2,
    "created_at": "2026-10-01T00:00:00Z",
    "updated_at": "2026-10-26T12:00:00Z",
    "html_url": "https://github.com/BhushanVidhate-27/graph-hacks-company-brain/issues/10",
    "pull_request": False,
}


@pytest.fixture
def clean_db(tmp_path, monkeypatch):
    monkeypatch.setattr(gh, "_DB_PATH", tmp_path / "test-github-items.db")
    gh.init_db()
    yield
    if gh._DB_PATH.exists():
        gh._DB_PATH.unlink()


def test_upsert_and_list(clean_db):
    gh.upsert_item(SAMPLE_ITEM)
    rows = gh.list_items("BhushanVidhate-27", "graph-hacks-company-brain", "open")
    assert len(rows) == 1
    row = rows[0]
    assert row["id"] == SAMPLE_ITEM["id"]
    assert row["number"] == 10
    assert row["title"] == "Sync the items"
    assert row["user_login"] == "soham"
    assert row["pull_request"] == 0


def test_upsert_replaces_existing(clean_db):
    gh.upsert_item(SAMPLE_ITEM)
    changed = dict(SAMPLE_ITEM)
    changed["title"] = "Replaced title"
    gh.upsert_item(changed)
    rows = gh.list_items("BhushanVidhate-27", "graph-hacks-company-brain", "open")
    assert rows[0]["title"] == "Replaced title"


def test_sync_state_returns_same_shape(clean_db, monkeypatch):
    monkeypatch.setattr(gh, "GITHUB_TOKEN", "dummy")
    monkeypatch.setattr(gh, "GITHUB_OWNER", "BhushanVidhate-27")
    monkeypatch.setattr(gh, "GITHUB_REPO", "graph-hacks-company-brain")
    # Mock list_repo_items so sync_state can persist without hitting GitHub API.
    monkeypatch.setattr(gh, "list_repo_items", lambda state: {
        "owner": "BhushanVidhate-27",
        "repo": "graph-hacks-company-brain",
        "configured": True,
        "items": [SAMPLE_ITEM],
        "error": None,
    })
    result = gh.sync_state("open")
    assert result["configured"] is True
    assert isinstance(result["items"], list)
    rows = gh.list_items("BhushanVidhate-27", "graph-hacks-company-brain", "open")
    assert len(rows) == 1
    assert rows[0]["id"] == SAMPLE_ITEM["id"]
