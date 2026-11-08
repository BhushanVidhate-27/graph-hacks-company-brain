#!/usr/bin/env python3
"""Apply Helio app-state schema migrations (SQLite fallback or Postgres via DATABASE_URL)."""

from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app import db  # noqa: E402


def main() -> int:
    kind = db.backend()
    target = db.database_url() if kind == "postgres" else str(db.sqlite_path())
    db.ensure_schema()
    print(f"migrations ok: backend={kind} target={target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
