"""
app/main.py — the frozen HTTP contract: FastAPI + SSE.

Owner: Soham.  Rule 12: every line is explainable, so there is no extra
abstraction between the route and the stream.

The contract (soham.md §3, frozen — do NOT rename a field after 15:00 Day 1,
because Ujwal's renderer is already building against these exact keys):

    POST /ask  { question }  ->  SSE stream of { answer, trail[], stale[] }

        trail[] = [ { type, name, detail, date, via_edge }, ... ]
        stale[] = [ { type, name, reason, last_verified_at }, ... ]

    GET /health

Design rule for this file (soham.md §4, "S2"): EVERY mock lives behind ONE
function with ONE clearly marked fake branch.  When the real graph lands we
delete the fake branch and change nothing else.  Scattering mock literals
through the handlers is how you end up grepping at 22:00.

A FAILURE is not an exemption from the contract.  The status is committed to 200
before the stream body runs, so an exception would reach the browser as a closed
connection with no [DONE] -- a stuck spinner with no message.  Every failure is
therefore streamed as a normal {answer, trail, stale} frame followed by [DONE].
"""

from __future__ import annotations

import json
import logging
import os
import re
import sqlite3
from pathlib import Path
from typing import Any, Callable, Iterator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from app import auth as auth_service
from app import billing as billing_service
from app import github as github_service
from app import plans as plan_service
from app import store
from app import usage as usage_service
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

load_dotenv()

logger = logging.getLogger("helio.api")

# --------------------------------------------------------------------------- #
# The one switch that flips mocks -> real graph
# --------------------------------------------------------------------------- #
#
# USE_MOCK=1 (default)  -> read Ujwal's single fixture, mock/trail.json
# USE_MOCK=0            -> call app/agent.py, which calls app/graph.py
#
# Default stays 1 on purpose: the graph is Bhushan's and may be late, and the
# frontend must never be blocked on it (that is the whole point of S2).
USE_MOCK = os.getenv("USE_MOCK", "1") == "1"

# mock/ belongs to Ujwal.  We READ it, we never EDIT it (soham.md §4).  It is
# the executable spec: if this file and the contract disagree, this file wins at
# runtime and the bug lands on Ujwal's Saturday, so we follow the fixture's shape.
# MOCK_TRAIL_PATH lets a test point at a copy without touching the real fixture.
MOCK_PATH = Path(
    os.getenv(
        "MOCK_TRAIL_PATH",
        str(Path(__file__).resolve().parent.parent / "mock" / "trail.json"),
    )
)


# --------------------------------------------------------------------------- #
# Pydantic models — "take real data through pydantic models so the shapes
# cannot drift" (soham.md §15).  If a field is misspelled here, FastAPI errors
# loudly instead of silently shipping a broken key to the renderer.
# --------------------------------------------------------------------------- #


class Ask(BaseModel):
    """Request body for POST /ask."""

    question: str = Field(min_length=1, max_length=500)


class TrailItem(BaseModel):
    """One chip in the provenance trail.

    `via_edge` is the edge label BETWEEN chips.  It is what makes the trail a
    proof chain instead of decoration — never drop it (soham.md §3).
    """

    type: str
    name: str
    detail: str
    date: str
    via_edge: str


class StaleItem(BaseModel):
    """One ⚠ badge — a fact we can no longer trust."""

    type: str
    name: str
    reason: str
    last_verified_at: str


class Answer(BaseModel):
    """The complete payload.  Every SSE event carries ALL THREE keys, even when
    one of them is still empty, so the frontend never has to guess whether a
    missing key means 'not yet' or 'nothing found'."""

    answer: str
    trail: list[TrailItem]
    stale: list[StaleItem]


# --------------------------------------------------------------------------- #
# SaaS request models
# --------------------------------------------------------------------------- #


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=200)
    account_name: str | None = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=200)


class CheckoutRequest(BaseModel):
    plan: str = Field(min_length=2, max_length=40)
    success_url: str | None = Field(default=None, max_length=500)
    cancel_url: str | None = Field(default=None, max_length=500)


class ApiKeyRequest(BaseModel):
    name: str = Field(default="Default key", min_length=1, max_length=80)


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _valid_email(email: str) -> bool:
    return bool(_EMAIL_RE.match(email.strip()))


def _app_base_url(request: Request) -> str:
    """The public origin for Stripe redirects.

    Behind Render/Fly the request scheme is often http even though the browser
    used https, so an explicit env var wins. Falling back to request.base_url is
    correct for local development and tests.
    """

    configured = os.getenv("HELIO_APP_URL", "").rstrip("/")
    if configured:
        return configured
    return str(request.base_url).rstrip("/")



# --------------------------------------------------------------------------- #
# The single mock seam
# --------------------------------------------------------------------------- #


def _read_mock(question: str) -> dict[str, Any]:
    """Load Ujwal's fixture and build the frozen payload for `question`.

    Ujwal's fixture is the executable spec (soham.md §3), so we follow ITS shape
    rather than the one this file first guessed.  Cases live under "cases", and
    each case carries its own `question` to match on.  `answer` is an array of
    short strings so the frontend can test a token streamer; the fixture's own
    shape_notes say the backend joins it, so we join.

    Anything unexpected raises with the path in the message, because a silent
    fallback here would look like an empty graph and that is a different bug.
    """
    if not MOCK_PATH.exists():
        raise FileNotFoundError(
            f"{MOCK_PATH} is missing. That file is Ujwal's single shared fixture "
            "(mock/trail.json) and both the frontend and this fake branch read it. "
            "Ping Ujwal — do not create a second mock set."
        )

    data = json.loads(MOCK_PATH.read_text(encoding="utf-8"))
    return _to_payload(_select_case(data, question))


def _select_case(data: Any, question: str) -> dict[str, Any]:
    """Pick the fixture case for `question` (by question text, then by case id).

    We code to the fixture's actual shape.  If that shape changes we fail loudly
    instead of silently guessing a new one — a silent mismatch here would surface
    as an empty graph, which is a different bug with a different owner.
    """
    cases = data.get("cases") if isinstance(data, dict) else None
    if not isinstance(cases, dict):
        raise KeyError(
            f"{MOCK_PATH} has no 'cases' object. Ujwal's fixture changed shape — "
            "check with him rather than guessing the new one here."
        )

    for case in cases.values():  # match on the question text the case carries
        if isinstance(case, dict) and case.get("question") == question:
            return case
    if isinstance(cases.get(question), dict):  # ... or on a case id like "demo"
        return cases[question]

    # No case for this question. Say so plainly rather than borrowing another
    # case's answer — a confident off-topic answer is the bug we are avoiding.
    return {
        "answer": (
            "This is the mock API and mock/trail.json has no case for that "
            "question. Add one there (Ujwal owns the fixture) or ask one of the "
            "demo questions."
        ),
        "trail": [],
        "stale": [],
    }


def _to_payload(case: dict[str, Any]) -> dict[str, Any]:
    """Reshape one fixture case into the frozen payload.

    One real difference from the wire contract: the fixture stores `answer` as an
    array of short strings, and the contract says a string. The fixture's own
    shape_notes say the backend joins it, so we join.
    """
    answer = case.get("answer", "")
    if isinstance(answer, list):
        answer = "".join(str(part) for part in answer)
    return {
        "answer": answer,
        "trail": case.get("trail") or [],
        "stale": case.get("stale") or [],
    }


def answer_question(question: str) -> dict[str, Any]:
    """THE seam.  Mocks in, real graph out — one branch, one line to delete.

    soham.md §4 sketches this as `get_trail(question)`; it returns the whole
    frozen payload because that keeps exactly ONE fake branch in the file
    instead of one per field.
    """
    if USE_MOCK:
        # ------------------------------------------------------------------ #
        # FAKE BRANCH — delete this whole `if` at Gate 2.                     #
        # ------------------------------------------------------------------ #
        raw = _read_mock(question)
        payload = Answer.model_validate(raw)
        return payload.model_dump()
        # ------------------------------------------------------------------ #
        # END FAKE BRANCH                                                     #
        # ------------------------------------------------------------------ #

    # REAL BRANCH.  app/agent.py picks the tools and runs the traversals;
    # app/graph.py holds the only Cypher.  This file builds no query strings.
    from app.agent import run_agent

    return Answer.model_validate(run_agent(question)).model_dump()


# --------------------------------------------------------------------------- #
# SSE
# --------------------------------------------------------------------------- #
#
# THE ONE GOTCHA (soham.md §8):
#   Native EventSource is GET-only.  Our contract is POST /ask, so EventSource
#   does NOT work.  The client MUST use fetch() + response.body.getReader():
#
#       const res = await fetch("/ask", {
#         method: "POST",
#         headers: { "Content-Type": "application/json" },
#         body: JSON.stringify({ question }),
#       });
#       const reader = res.body.getReader();
#       // ... decode each chunk, split on "\n\n", JSON.parse the "data: " line.
#
#   If Ujwal builds against EventSource it works right up until Gate 2 and then
#   fails with no useful error.


def _sse(payload: dict[str, Any]) -> str:
    """Format one Server-Sent Event frame.

    The SSE wire format is `data: <line>\\n\\n`.  We JSON-encode the payload so
    newlines inside an answer can never break the framing.
    """
    return f"data: {json.dumps(payload, default=str)}\n\n"


def _is_missing_key(exc: Exception) -> bool:
    """True when the failure is 'no usable API key', so we can say so plainly.

    Matched on several markers rather than one exact sentence: the message is
    written by whichever layer raised (agent._clients, or a test double), and
    keying on a single string means a renamed variable silently degrades into
    the generic "the lookup failed (RuntimeError)" — which tells the operator
    nothing about the thing they actually need to fix.
    """
    msg = str(exc)
    return isinstance(exc, RuntimeError) and any(
        marker in msg
        for marker in ("No model API key", "GROQ_API_KEY")
    )


def _failure_frame(exc: Exception) -> dict[str, Any]:
    """Turn a server-side failure into a payload the frozen contract allows.

    The crucial detail: by the time the generator runs, Starlette has already
    sent the response headers, so the status is committed to 200 and the
    exception can no longer become a 500.  Letting it escape therefore gives the
    browser a *closed connection with no [DONE] and no message* -- the stuck
    spinner, which reads as a frontend bug and cannot be debugged from the
    client.  So a failure is sent as an ordinary frame, in the same
    {answer, trail, stale} shape, followed by [DONE].

    The message names the failure instead of inventing an answer -- the same
    honesty rule the agent loop applies to an empty tool result.
    """
    if isinstance(exc, RuntimeError) and _is_missing_key(exc):
        reason = "the server has no GROQ_API_KEY configured"
    else:
        reason = f"the lookup failed ({type(exc).__name__})"
    return {
        "answer": (
            f"I could not answer that: {reason}. "
            "Nothing above is a claim about the graph."
        ),
        "trail": [],
        "stale": [],
    }


def stream_answer(
    question: str, on_success: Callable[[], None] | None = None
) -> Iterator[str]:
    """Yield the trail first, then the answer.

    Order matters for the demo: the chips (trail + stale) render as soon as the
    first frame lands, so the UI shows its evidence before the prose arrives.
    Every frame keeps all three canonical keys.

    ``on_success`` runs only after the lookup produced a real result, so a failed
    question is not charged against a paid plan's monthly quota.
    """
    try:
        result = answer_question(question)
    except Exception as exc:  # noqa: BLE001 - the failure must reach the client
        # Log the whole traceback for whoever is on the deploy, and send a
        # well-formed frame so the UI can say something instead of hanging.
        logger.exception("answer_question failed for question=%r", question)
        yield _sse(_failure_frame(exc))
        yield "data: [DONE]\n\n"
        return

    if on_success is not None:
        try:
            on_success()
        except Exception:  # noqa: BLE001 - metering must not kill the answer
            logger.exception("usage recording failed")

    # Frame 1 — the evidence.  Answer is empty on purpose: nothing is claimed yet.
    yield _sse({"answer": "", "trail": result["trail"], "stale": result["stale"]})

    # Frame 2 — the prose, tied to the frame above.
    yield _sse(result)

    # Frame 3 — an explicit terminator.  The client should not have to infer
    # "done" from a closed socket, which is ambiguous with a dropped connection.
    yield "data: [DONE]\n\n"


# --------------------------------------------------------------------------- #
# App
# --------------------------------------------------------------------------- #

app = FastAPI(title="Helio company brain", version="0.1.0")

# CORS.
#
# A browser treats `localhost` and `127.0.0.1` as DIFFERENT origins, and every
# dev server prints whichever one you opened — so both must be allowed or the
# SSE stream is blocked with a bare "Failed to fetch" that reads as a server
# bug rather than an origin mismatch.
#
# Env-driven because the frontend now lives in a separate Next.js app that runs
# on 3000 (5173 was the old Vite port) and is deployed to its own domain. Hard-
# coding either port meant a new frontend origin silently broke the demo.
# Set CORS_ALLOW_ORIGINS to a comma-separated list to add the deployed site.
_DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://helio-front.onrender.com",
]
_EXTRA = [o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = _DEFAULT_ORIGINS + _EXTRA

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    """Liveness + which branch we are on.  Bhushan's deploy hits this."""
    if not USE_MOCK:
        from app import graph
        if not graph.db_health():
            from fastapi import HTTPException
            raise HTTPException(status_code=503, detail="database unavailable")
    return {"status": "ok", "mock": USE_MOCK}


@app.post("/ask")
def ask(req: Ask, request: Request) -> Any:
    """Frozen contract: POST /ask -> SSE stream of {answer, trail[], stale[]}.

    Authentication is optional by default so the public demo keeps working.
    Set ``HELIO_REQUIRE_AUTH=1`` to make every question require a session or API
    key. Anonymous visitors get a small per-day allowance; signed-in accounts
    are metered against their plan. The quota is checked BEFORE the stream
    starts, because an SSE response commits its status on the first byte.
    """

    identity = auth_service.resolve_identity(request)

    if identity is None and auth_service.presented_api_key(request):
        return JSONResponse(
            status_code=401,
            content={
                "error": "invalid_api_key",
                "message": "That API key is invalid or has been revoked.",
            },
        )

    if identity is None and usage_service.auth_required():
        return JSONResponse(
            status_code=401,
            content={
                "error": "auth_required",
                "message": "Sign in or create a free account to ask the graph.",
                "login_url": "/?auth=login",
            },
        )

    quota = usage_service.check(identity, request)
    if not quota["allowed"]:
        return JSONResponse(
            status_code=429,
            content={
                "error": "quota_exceeded",
                "message": quota["message"],
                "plan": quota["plan"],
                "used": quota["used"],
                "limit": quota["limit"],
                "upgrade_url": quota["upgrade_url"],
            },
        )

    if not USE_MOCK:
        from app import graph
        if not graph.db_health():
            from fastapi import HTTPException
            raise HTTPException(status_code=503, detail="database unavailable")

    def _meter() -> None:
        usage_service.record(identity, question=req.question)

    return StreamingResponse(
        stream_answer(req.question, on_success=_meter),
        media_type="text/event-stream",
        headers={
            # Proxies buffer a naive stream into one lump: it works on
            # localhost and dies behind a real proxy.  Without the second
            # header the demo works locally and breaks in production, and it
            # reads as a bug in this code (soham.md §8).
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# --------------------------------------------------------------------------- #
# SaaS: accounts, sessions and API keys
# --------------------------------------------------------------------------- #


@app.post("/api/auth/signup")
def signup(req: SignupRequest, request: Request, response: Response):
    """Create an account and its owner, then sign the owner in."""

    email = req.email.strip().lower()
    if not _valid_email(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    if store.get_user_by_email(email) is not None:
        raise HTTPException(
            status_code=409, detail="An account with that email already exists."
        )

    account_name = (req.account_name or f"{req.name.strip()}'s workspace").strip()
    try:
        created = store.create_account_with_owner(
            account_name=account_name,
            email=email,
            name=req.name,
            password_hash=auth_service.hash_password(req.password),
        )
    except sqlite3.IntegrityError:
        # A concurrent signup won the race. The message is the same as above so
        # an attacker cannot tell the two paths apart.
        raise HTTPException(
            status_code=409, detail="An account with that email already exists."
        )

    token = store.create_session(created["user"]["id"])
    auth_service.set_session_cookie(response, token, request)
    store.mark_login(created["user"]["id"])

    identity = auth_service.Identity(
        user=created["user"],
        account=created["account"],
        subscription=created["subscription"],
        via="session",
    )
    return auth_service.identity_payload(identity)


@app.post("/api/auth/login")
def login(req: LoginRequest, request: Request, response: Response):
    email = req.email.strip().lower()
    if not auth_service.login_allowed(request, email):
        raise HTTPException(
            status_code=429,
            detail="Too many sign-in attempts. Try again in a few minutes.",
        )

    user = auth_service.authenticate(email, req.password)
    if user is None:
        auth_service.note_login_failure(request, email)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    auth_service.clear_login_failures(request, email)
    store.mark_login(user["id"])
    token = store.create_session(user["id"])
    auth_service.set_session_cookie(response, token, request)

    identity = auth_service.identity_for_user(user, "session")
    if identity is None:
        raise HTTPException(status_code=401, detail="This account is unavailable.")
    return auth_service.identity_payload(identity)


@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    cookie = request.cookies.get(auth_service.SESSION_COOKIE)
    if cookie:
        store.delete_session(cookie)
    auth_service.clear_session_cookie(response)
    return {"ok": True}


@app.get("/api/auth/me")
def me(request: Request):
    """Return the signed-in identity, or an explicit anonymous response.

    The 200-with-authenticated:false shape is deliberate: a 401 here would make
    every landing-page load look like a console error in the browser.
    """

    identity = auth_service.resolve_identity(request)
    if identity is None:
        return {
            "authenticated": False,
            "plans": plan_service.public_plans(),
            "billing": billing_service.setup_details(),
        }
    payload = auth_service.identity_payload(identity)
    payload["plans"] = plan_service.public_plans()
    payload["billing"] = billing_service.setup_details()
    return payload


@app.get("/api/plans")
def plans_catalog():
    return {
        "plans": plan_service.public_plans(),
        "billing": billing_service.setup_details(),
    }


@app.get("/api/usage")
def usage_summary(request: Request):
    identity = auth_service.require_identity(request)
    return {
        "plan": identity.plan,
        "usage": store.usage_summary(identity.account["id"], identity.plan),
    }


@app.get("/api/keys")
def list_keys(request: Request):
    identity = auth_service.require_identity(request)
    return {"keys": store.list_api_keys(identity.account["id"])}


@app.post("/api/keys")
def create_key(req: ApiKeyRequest, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)

    if not plan_service.limit_for(identity.plan, "api_access"):
        raise HTTPException(
            status_code=403,
            detail="API access is available on the Professional plan and above.",
        )

    plaintext, record = store.create_api_key(
        identity.account["id"], identity.user["id"], req.name
    )
    return {
        "ok": True,
        "key": plaintext,
        "record": record,
        "message": "Copy this key now. It will not be shown again.",
    }


@app.delete("/api/keys/{key_id}")
def revoke_key(key_id: str, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    if not store.revoke_api_key(identity.account["id"], key_id):
        raise HTTPException(status_code=404, detail="API key not found.")
    return {"ok": True}



@app.get("/api/repo/settings")
def repo_settings():
    """Return the configured GitHub repository for the current process."""

    config = github_service.repo_config()
    return {
        "configured": config["configured"],
        "owner": config["owner"],
        "repo": config["repo"],
        "missing": config["missing"],
    }


@app.get("/api/repo/issues")
def repo_issues(state: str = "open"):
    """Return open (or requested) issues and pull requests for the connected repo."""

    items = github_service.sync_state(state)
    return {
        "owner": items["owner"],
        "repo": items["repo"],
        "configured": items["configured"],
        "state": state,
        "items": items["items"],
        "error": items.get("error"),
    }


@app.get("/api/repo/pulls")
def repo_pulls(state: str = "open"):
    """Return open (or requested) pull requests for the connected repo."""

    items = github_service.sync_state(state)
    return {
        "owner": items["owner"],
        "repo": items["repo"],
        "configured": items["configured"],
        "state": state,
        "items": items["items"],
        "error": items.get("error"),
    }


@app.get("/api/repo/items")
def repo_items(state: str = "open"):
    """Return issues and pull requests together for the connected repo."""

    return repo_issues(state)




@app.get("/api/billing/setup")
def billing_setup():
    """Publicly describe the Stripe setup for a SaaS operator."""

    return {"ok": True, **billing_service.setup_details()}


@app.get("/api/billing/me")
def billing_me(request: Request):
    identity = auth_service.require_identity(request)
    payload = auth_service.identity_payload(identity)
    payload["billing"] = billing_service.setup_details()
    return payload


@app.post("/api/billing/checkout")
def billing_checkout(req: CheckoutRequest, request: Request):
    """Create a Stripe Checkout Session for a paid plan.

    In local development (``STRIPE_MODE=local`` and
    ``HELIO_ALLOW_LOCAL_BILLING=1``) this upgrades the account immediately so
    the whole flow can be demonstrated without live keys.
    """

    identity = auth_service.require_identity(request)
    base = _app_base_url(request)
    result = billing_service.build_checkout(
        plan_id=req.plan,
        account=identity.account,
        user=identity.user,
        success_url=req.success_url or f"{base}/?checkout=success",
        cancel_url=req.cancel_url or f"{base}/?checkout=cancelled",
    )
    if not result.get("ok"):
        status = 503 if result.get("error") == "billing_not_configured" else 400
        return JSONResponse(status_code=status, content=result)
    return result


@app.post("/api/billing/portal")
def billing_portal(request: Request):
    identity = auth_service.require_identity(request)
    base = _app_base_url(request)
    result = billing_service.build_portal(identity.account, f"{base}/?billing=portal")
    if not result.get("ok"):
        return JSONResponse(status_code=400, content=result)
    return result


@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    """Stripe webhook. Verifies the Stripe-Signature header against
    STRIPE_WEBHOOK_SECRET before accepting the event.

    Reads the raw request body (not the parsed JSON) because Stripe signs
    the exact bytes sent over the wire.
    """

    body = await request.body()
    signature = request.headers.get("stripe-signature")
    result = billing_service.handle_webhook(body, signature)
    return JSONResponse(status_code=200 if result.get("ok") else 400, content=result)


if __name__ == "__main__":  # python -m app.main
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8080, reload=False)
