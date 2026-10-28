"""app/auth.py - accounts, sessions, API keys and the request identity.

Security choices, and why they are small on purpose:

* Passwords use ``hashlib.scrypt`` from the standard library. No third-party
  crypto dependency, no home-grown hash. The parameters are stored alongside the
  hash so they can be raised later without invalidating existing users.
* Session tokens are random, sent as an HttpOnly SameSite=Lax cookie, and only
  their SHA-256 hash is stored. A leaked database therefore does not leak live
  sessions.
* API keys are shown once at creation and stored hashed. They authenticate with
  ``Authorization: Bearer helio_...`` or ``X-API-Key``.
* This is an MVP identity layer, not a replacement for SSO. Enterprise SSO is
  listed on the Enterprise plan for that reason.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, Request, Response

from app import store

SESSION_COOKIE = "helio_session"
SESSION_DAYS = 30

# Login throttling is in-memory on purpose: it protects a single process from a
# trivial password spray without adding a Redis dependency. A multi-replica
# deployment should move this to the shared store.
_FAILED_LOGINS: dict[str, list[float]] = {}
_LOGIN_WINDOW_SECONDS = 15 * 60
_LOGIN_MAX_FAILURES = 8


# --------------------------------------------------------------------------- #
# Passwords
# --------------------------------------------------------------------------- #


def hash_password(password: str) -> str:
    """Hash a password with scrypt and a per-user random salt."""

    salt = secrets.token_bytes(16)
    n, r, p = 2**14, 8, 1
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=n,
        r=r,
        p=p,
        dklen=32,
        maxmem=64 * 1024 * 1024,
    )
    return "$".join(
        [
            "scrypt",
            str(n),
            str(r),
            str(p),
            base64.urlsafe_b64encode(salt).decode("ascii"),
            base64.urlsafe_b64encode(digest).decode("ascii"),
        ]
    )


def verify_password(password: str, stored: str) -> bool:
    """Constant-time verification of a stored scrypt hash."""

    try:
        algorithm, n, r, p, salt_b64, digest_b64 = stored.split("$")
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
        expected = base64.urlsafe_b64decode(digest_b64.encode("ascii"))
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
            maxmem=64 * 1024 * 1024,
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# --------------------------------------------------------------------------- #
# Login throttling
# --------------------------------------------------------------------------- #


def _throttle_key(request: Request, email: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}:{email.lower().strip()}"


def login_allowed(request: Request, email: str) -> bool:
    key = _throttle_key(request, email)
    now = time.time()
    attempts = [t for t in _FAILED_LOGINS.get(key, []) if now - t < _LOGIN_WINDOW_SECONDS]
    _FAILED_LOGINS[key] = attempts
    return len(attempts) < _LOGIN_MAX_FAILURES


def note_login_failure(request: Request, email: str) -> None:
    key = _throttle_key(request, email)
    _FAILED_LOGINS.setdefault(key, []).append(time.time())


def clear_login_failures(request: Request, email: str) -> None:
    _FAILED_LOGINS.pop(_throttle_key(request, email), None)


# --------------------------------------------------------------------------- #
# Identity
# --------------------------------------------------------------------------- #


@dataclass
class Identity:
    user: dict[str, Any]
    account: dict[str, Any]
    subscription: dict[str, Any]
    via: str  # "session" | "api_key"

    @property
    def plan(self) -> str:
        """The plan that should be enforced right now.

        A canceled or past-due subscription falls back to free for quota
        purposes while the billing page still shows the raw status.
        """

        if self.subscription.get("status") in {"active", "trialing"}:
            return self.subscription.get("plan") or "free"
        return "free"


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization") or ""
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    api_key = request.headers.get("x-api-key")
    return api_key.strip() if api_key else None


def presented_api_key(request: Request) -> bool:
    """True when the caller attempted key auth, even if the key was invalid."""

    return bool(_bearer_token(request))


def identity_for_user(user: dict[str, Any], via: str) -> Identity | None:
    account = store.get_account(user["account_id"])
    if account is None:
        return None
    return Identity(
        user=user,
        account=account,
        subscription=store.get_subscription(account["id"]),
        via=via,
    )


def resolve_identity(request: Request) -> Identity | None:
    """Return the caller's identity from an API key or a session cookie."""

    token = _bearer_token(request)
    if token:
        found = store.find_api_key(token)
        if found and found.get("user"):
            return identity_for_user(found["user"], "api_key")
        # A bearer token that is not a valid API key is an authentication
        # failure, not an anonymous request. Returning None here lets the
        # caller decide whether anonymous access is allowed.
        return None

    cookie = request.cookies.get(SESSION_COOKIE)
    if cookie:
        session = store.get_session(cookie)
        if session and session.get("user"):
            return identity_for_user(session["user"], "session")
    return None


def require_identity(request: Request) -> Identity:
    identity = resolve_identity(request)
    if identity is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return identity


def require_session(identity: Identity) -> Identity:
    """API keys may ask questions; they may not mint more API keys."""

    if identity.via != "session":
        raise HTTPException(
            status_code=403,
            detail="This action requires a signed-in session, not an API key.",
        )
    return identity


def identity_payload(identity: Identity, *, include_usage: bool = True) -> dict[str, Any]:
    from app import plans

    plan_id = identity.plan
    payload: dict[str, Any] = {
        "authenticated": True,
        "user": identity.user,
        "account": identity.account,
        "subscription": {
            **identity.subscription,
            "effective_plan": plan_id,
        },
        "plan": plans.get_plan(plan_id),
    }
    if include_usage:
        payload["usage"] = store.usage_summary(identity.account["id"], plan_id)
    return payload


# --------------------------------------------------------------------------- #
# Cookies
# --------------------------------------------------------------------------- #


def cookie_secure(request: Request) -> bool:
    """Use Secure cookies behind Render/Fly TLS termination as well as locally."""

    override = os.getenv("HELIO_COOKIE_SECURE")
    if override is not None:
        return override == "1"
    forwarded = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip()
    return forwarded == "https" or request.url.scheme == "https"


def set_session_cookie(response: Response, token: str, request: Request) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=cookie_secure(request),
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


# --------------------------------------------------------------------------- #
# Account creation / login
# --------------------------------------------------------------------------- #


def authenticate(email: str, password: str) -> dict[str, Any] | None:
    user = store.get_user_by_email(email)
    if user is None:
        # Run a dummy hash so a missing account and a wrong password take the
        # same amount of time. This is not perfect, but it removes the easiest
        # account-enumeration signal.
        verify_password(password, hash_password("not-a-real-password"))
        return None
    if not verify_password(password, user.get("password_hash", "")):
        return None
    return user
