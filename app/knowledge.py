"""app/knowledge.py — document → proposal pipeline (upload, extract, ingest)."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from app import store

UPLOAD_DIR = Path(os.getenv("HELIO_UPLOAD_DIR", "data/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXT = {".pdf", ".txt", ".md", ".csv"}
MAX_BYTES = 20 * 1024 * 1024  # 20MB


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _extract_pdf(raw: bytes) -> str:
    from pypdf import PdfReader

    with open(UPLOAD_DIR / "__tmp_extract.pdf", "wb") as f:
        f.write(raw)
    try:
        reader = PdfReader(UPLOAD_DIR / "__tmp_extract.pdf")
        blocks = []
        for page in reader.pages:
            blocks.append(page.extract_text() or "")
        return "\n".join(blocks)
    finally:
        try:
            (UPLOAD_DIR / "__tmp_extract.pdf").unlink()
        except OSError:
            pass


def _extract_docx(raw: bytes) -> str:
    from docx import Document
    import io

    doc = Document(io.BytesIO(raw))
    return "\n".join(p.text for p in doc.paragraphs)


def _extract_csv(raw: bytes) -> str:
    try:
        return raw.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _chunk_lines(text: str, size: int = 500) -> list[str]:
    text = _clean_text(text)
    if not text:
        return []
    # Split on sentence-ish boundaries, then fall back to sliding word windows.
        # Keep chunks small enough to be useful as proposals.
    sentences = re.split(r"(?<=[.!?])\s+", text)
    out, buf = [], ""
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if len(buf) + len(s) + 1 <= size:
            buf = f"{buf} {s}".strip()
        else:
            if buf:
                out.append(buf)
            buf = s
    if buf:
        out.append(buf)
    return out[:40]


def ingest(account_id: str, filename: str, raw: bytes) -> dict[str, Any]:
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise ValueError("Unsupported file type. Allowed: PDF, TXT, MD, CSV.")
    if len(raw) > MAX_BYTES:
        raise ValueError("File too large (20MB max).")

    if ext == ".pdf":
        text = _extract_pdf(raw)
    elif ext in (".txt", ".md"):
        text = raw.decode("utf-8", errors="ignore")
    elif ext == ".csv":
        text = _extract_csv(raw)
    else:
        text = ""

    chunks = _chunk_lines(text)
    proposals = []
    for i, chunk in enumerate(chunks):
        if len(chunk) < 24:
            continue
        proposals.append(store.create_proposal(
            account_id, category="company" if i == 0 else "knowledge",
            text=chunk[:4000], evidence={"source": filename, "chunk": i + 1}, confidence=0.6,
        ))
    return {"filename": filename, "extracted_chars": len(text), "chunks": len(chunks), "proposals": len(proposals), "proposal_ids": [p["id"] for p in proposals]}
