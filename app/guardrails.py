"""app/guardrails.py — Helios input/output guardrails (L5).

Lightweight, no new infra. Treats untrusted text as data, redacts PII,
enforces "no citation, no claim" by requiring a trail for factual answers.
"""

from __future__ import annotations

import re

_INJECTION_PATTERNS = [
    r"ignore (all )?(previous|prior|above) instructions",
    r"disregard (all )?(previous|prior) (instructions|rules)",
    r"system prompt",
    r"reveal (your )?(system|instructions)",
    r"show (everyone's|everyone) (salary|pay|compensation)",
    r"jailbreak",
    r"developer mode",
]

_PII_PATTERNS = [
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[SSN_REDACTED]"),
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "[EMAIL_REDACTED]"),
    (re.compile(r"\b(?:\d[ -]*?){13,19}\b"), "[CARD_REDACTED]"),
]


def input_verdict(question: str) -> tuple[bool, str]:
    """Return (blocked, reason). Block obvious injection/jailbreak attempts."""
    q = (question or "").strip()
    if len(q) > 800:
        return True, "input_too_long"
    low = q.lower()
    for pat in _INJECTION_PATTERNS:
        if re.search(pat, low):
            return True, "injection_detected"
    return False, "ok"


def redact_pii(text: str) -> tuple[str, bool]:
    out = text or ""
    hit = False
    for rx, repl in _PII_PATTERNS:
        new = rx.sub(repl, out)
        if new != out:
            hit = True
        out = new
    return out, hit


def citation_ok(answer: str, trail: list | None) -> bool:
    """Factual answers require at least one trail item (L5 output check)."""
    if not (answer or "").strip():
        return True  # empty frame (trail still loading) is fine
    if not trail:
        return False
    return True
