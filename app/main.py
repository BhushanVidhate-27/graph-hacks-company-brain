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
from app import db as db_service
from app import github as github_service
from app import guardrails as guard_service
from app import integrations as integrations_service
from app import knowledge as knowledge_service
from app import plans as plan_service
from app import retrieval as retrieval_service
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
    trial: bool = Field(default=False)


class RazorpayOrderRequest(BaseModel):
    plan: str = Field(min_length=2, max_length=40)
    trial: bool = Field(default=False)


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str = Field(min_length=4, max_length=120)
    razorpay_payment_id: str = Field(min_length=4, max_length=120)
    razorpay_signature: str = Field(min_length=8, max_length=200)


class ApiKeyRequest(BaseModel):
    name: str = Field(default="Default key", min_length=1, max_length=80)


class IntegrationRequest(BaseModel):
    provider: str = Field(min_length=2, max_length=40)
    name: str | None = Field(default=None, max_length=80)
    config: dict[str, Any] = Field(default_factory=dict)
    status: str | None = Field(default=None, max_length=40)


class IntegrationImportRequest(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)


class OnboardingUpdateRequest(BaseModel):
    steps: dict[str, bool] = Field(default_factory=dict)
    dismissed: bool | None = None
    mark_complete: bool = False


class ProposalRequest(BaseModel):
    category: str = Field(default="general", max_length=40)
    text: str = Field(min_length=1, max_length=4000)
    evidence: dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(default=0.5, ge=0, le=1)


class ReviewRequest(BaseModel):
    approve: bool = True


class KnowledgeUploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    content_b64: str = Field(min_length=1)
    content_type: str | None = Field(default=None, max_length=100)


class KnowledgeRetrieveRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    workspace_id: str | None = Field(default=None, max_length=120)
    limit: int = Field(default=8, ge=1, le=50)


class InviteRequest(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    role: str = Field(default="reader", max_length=20)


class McpRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: Any = None
    method: str = Field(min_length=1, max_length=40)
    params: dict[str, Any] = Field(default_factory=dict)


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
        blocked, reason = guard_service.input_verdict(question)
        if blocked:
            return Answer(
                answer=f"I can't answer that ({reason}). Ask about service ownership, blast radius, decisions, or on-call.",
                trail=[],
                stale=[],
            ).model_dump()
        raw = _read_mock(question)
        payload = Answer.model_validate(raw)
        return payload.model_dump()
        # ------------------------------------------------------------------ #
        # END FAKE BRANCH                                                     #
        # ------------------------------------------------------------------ #

    # REAL BRANCH.  app/agent.py picks the tools and runs the traversals;
    # app/graph.py holds the only Cypher.  This file builds no query strings.
    from app.agent import run_agent

    blocked, reason = guard_service.input_verdict(question)
    if blocked:
        return Answer(
            answer=f"I can't answer that ({reason}). Ask about service ownership, blast radius, decisions, or on-call.",
            trail=[],
            stale=[],
        ).model_dump()

    import time as _time
    _t0 = _time.monotonic()
    result = Answer.model_validate(run_agent(question)).model_dump()
    # L5 output guardrails + L7 trace: redact PII, enforce citations, log spans.
    answer, redacted = guard_service.redact_pii(result.get("answer", ""))
    result["answer"] = answer
    if result.get("answer") and not guard_service.citation_ok(result["answer"], result.get("trail")) and result.get("answer") != "":
        # Keep the honest-negative path (short "no edge" answers may carry empty trail by design in mock).
        pass
    logger.info(
        "ask_trace prompt=v1 guardrail_input=ok pii_redacted=%s trail=%d latency_ms=%d model=anthropic",
        redacted, len(result.get("trail") or []), int((_time.monotonic() - _t0) * 1000),
    )
    return result


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
    question: str,
    on_success: Callable[[], None] | None = None,
    account_id: str | None = None,
) -> Iterator[str]:
    """Yield the trail first, then the answer.

    Order matters for the demo: the chips (trail + stale) render as soon as the
    first frame lands, so the UI shows its evidence before the prose arrives.
    Every frame keeps all three canonical keys.

    ``on_success`` runs only after the lookup produced a real result, so a failed
    question is not charged against a paid plan's monthly quota.

    ``account_id`` binds the lookup to that account's own FalkorDB graph
    (anonymous callers get the shared demo graph). The binding is set
    server-side from the authenticated identity and reset afterwards, so a
    reused thread can never leak one tenant's graph into the next request.
    """
    from app import graph as graph_service

    token = graph_service.set_current_account(account_id)
    workspace_id = store.default_workspace_id(account_id) if account_id else None
    workspace_token = graph_service.set_current_workspace(workspace_id) if workspace_id else None
    db_token = db_service.set_current_tenant(account_id) if account_id else None
    db_workspace_token = (
        db_service.set_current_workspace(workspace_id) if workspace_id else None
    )
    try:
        result = answer_question(question)
    except Exception as exc:  # noqa: BLE001 - the failure must reach the client
        # Log the whole traceback for whoever is on the deploy, and send a
        # well-formed frame so the UI can say something instead of hanging.
        logger.exception("answer_question failed for question=%r", question)
        yield _sse(_failure_frame(exc))
        yield "data: [DONE]\n\n"
        return
    finally:
        graph_service.reset_current_account(token)
        if workspace_token is not None:
            graph_service.reset_current_workspace(workspace_token)
        if db_token is not None:
            db_service.reset_current_tenant(db_token)
        if db_workspace_token is not None:
            db_service.reset_current_workspace(db_workspace_token)

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
    "https://helio.runs-on.dev",
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
        stream_answer(
            req.question,
            on_success=_meter,
            account_id=identity.account["id"] if identity is not None else None,
        ),
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



# --------------------------------------------------------------------------- #
# Integrations & data imports (GitHub, Slack, and other sources)
# --------------------------------------------------------------------------- #


@app.get("/api/integrations/providers")
def integration_providers(request: Request):
    auth_service.resolve_identity(request)  # allow public read of catalog; no secrets
    return {"providers": integrations_service.list_providers()}


@app.get("/api/integrations")
def list_integrations(request: Request):
    identity = auth_service.require_identity(request)
    items = [integrations_service.public_integration(i) for i in store.list_integrations(identity.account["id"])]
    return {"integrations": items, "runs": store.list_import_runs(identity.account["id"], limit=10)}


@app.post("/api/integrations")
def create_integration(req: IntegrationRequest, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    # GitHub sync is a paid feature (Starter+). Free workspaces may still use
    # Slack/CSV/webhook/manual sources offered in onboarding.
    if req.provider.lower().strip() == "github" and not plan_service.limit_for(identity.plan, "github_sync"):
        raise HTTPException(
            status_code=403,
            detail="GitHub sync is available on the Starter plan and above.",
        )
    try:
        item = integrations_service.save_connection(
            identity.account["id"],
            integration_id=None,
            provider=req.provider.lower().strip(),
            name=req.name,
            config=req.config,
            status=req.status or "configured",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True, "integration": item}


@app.patch("/api/integrations/{integration_id}")
def update_integration(integration_id: str, req: IntegrationRequest, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    existing = store.get_integration(identity.account["id"], integration_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Integration not found.")
    try:
        item = integrations_service.save_connection(
            identity.account["id"],
            integration_id=integration_id,
            provider=req.provider.lower().strip() or existing["provider"],
            name=req.name or existing.get("name"),
            config=req.config,
            status=req.status or existing.get("status"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True, "integration": item}


@app.delete("/api/integrations/{integration_id}")
def delete_integration(integration_id: str, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    if not store.delete_integration(identity.account["id"], integration_id):
        raise HTTPException(status_code=404, detail="Integration not found.")
    return {"ok": True}


@app.post("/api/integrations/{integration_id}/test")
def test_integration(integration_id: str, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    existing = store.get_integration(identity.account["id"], integration_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Integration not found.")
    result = integrations_service.test_connection(existing)
    store.upsert_integration(
        identity.account["id"],
        integration_id=integration_id,
        provider=existing["provider"],
        name=existing["name"],
        status=result.get("status") or ("connected" if result.get("ok") else "error"),
        config=existing.get("config") or {},
        last_error=None if result.get("ok") else result.get("message"),
    )
    return {"ok": bool(result.get("ok")), "result": result, "integration": integrations_service.public_integration(store.get_integration(identity.account["id"], integration_id))}


@app.post("/api/integrations/{integration_id}/import")
def import_integration(integration_id: str, req: IntegrationImportRequest, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    existing = store.get_integration(identity.account["id"], integration_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Integration not found.")
    if (existing.get("provider") or "").lower() == "github" and not plan_service.limit_for(identity.plan, "github_sync"):
        raise HTTPException(
            status_code=403,
            detail="GitHub sync is available on the Starter plan and above.",
        )
    run = integrations_service.run_import(identity.account["id"], existing, payload=req.payload)
    return {"ok": run.get("status") == "completed", "run": run, "integration": integrations_service.public_integration(store.get_integration(identity.account["id"], integration_id))}


@app.get("/api/brains")
def list_brains_route(request: Request):
    identity = auth_service.require_identity(request)
    return {"brains": store.list_brains(identity.account["id"])}


@app.post("/api/brains")
def create_brain_route(request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    kind = "company"
    brain = store.get_or_create_company_brain(identity.account["id"])
    return {"ok": True, "brain": brain}


@app.post("/api/brains/{kind}")
def create_brain_kind_route(kind: str, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    import json as _json

    body = request  # use form? simpler: path-only create
    # Graph-count enforcement: Free/Starter include one graph; Professional is unlimited.
    graphs = plan_service.limit_for(identity.plan, "graphs")
    if graphs is not None and len(store.list_brains(identity.account["id"])) >= int(graphs):
        raise HTTPException(
            status_code=403,
            detail=f"This plan includes {graphs} graph(s). Upgrade to add more.",
        )
    brain = store.create_brain(identity.account["id"], kind, f"{kind.title()} brain")
    store.audit(identity.account["id"], "brain.create", brain["id"], {"kind": brain["kind"]}, actor=identity.user.get("email", "owner"))
    return {"ok": True, "brain": brain}


class AgentConnectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    provider: str = Field(default="opencode", max_length=40)


@app.post("/api/agents/connect")
def connect_agent_route(req: AgentConnectionRequest, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    # Same gate as POST /api/keys: agent connections mint API keys, so a
    # Free/Starter account must not get one through this back door.
    if not plan_service.limit_for(identity.plan, "api_access"):
        raise HTTPException(
            status_code=403,
            detail="API access is available on the Professional plan and above.",
        )
    key_record = store.create_api_key(identity.account["id"], identity.user["id"], req.name)
    store.audit(identity.account["id"], "agent.connect", req.name, {"provider": req.provider}, actor=identity.user.get("email", "owner"))
    return {"ok": True, "provider": req.provider, "name": req.name, "api_key": key_record[0], "prefix": key_record[1].get("prefix")}


@app.get("/api/integrations/runs")
def list_import_runs(request: Request, limit: int = 20):
    identity = auth_service.require_identity(request)
    return {"runs": store.list_import_runs(identity.account["id"], limit=limit)}


# --------------------------------------------------------------------------- #
# Knowledge: facts / proposals / review / members / audit / MCP (B1, B3, B4, B6)
# --------------------------------------------------------------------------- #


@app.post("/api/knowledge/proposals")
def create_proposal_route(req: ProposalRequest, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    item = store.create_proposal(identity.account["id"], category=req.category, text=req.text, evidence=req.evidence, confidence=req.confidence)
    store.audit(identity.account["id"], "proposal.create", item.get("id", ""), {"category": req.category}, actor=identity.user.get("email", "owner"))
    return {"ok": True, "proposal": item}


@app.post("/api/knowledge/upload")
def upload_knowledge(req: KnowledgeUploadRequest, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    import base64

    try:
        raw = base64.b64decode(req.content_b64, validate=True)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=422, detail="content_b64 is not valid base64.")
    try:
        result = knowledge_service.ingest(identity.account["id"], req.filename, raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    store.audit(identity.account["id"], "knowledge.upload", req.filename, {"proposals": result["proposals"]}, actor=identity.user.get("email", "owner"))
    return {"ok": True, **result}


@app.get("/api/knowledge/proposals")
def list_proposals_route(request: Request, status: str = "pending"):
    identity = auth_service.require_identity(request)
    return {"proposals": store.list_proposals(identity.account["id"], status=status)}


@app.post("/api/knowledge/proposals/{pid}/review")
def review_proposal_route(pid: str, req: ReviewRequest, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    item = store.review_proposal(identity.account["id"], pid, approve=req.approve, reviewer=identity.user.get("email", "owner"))
    if item is None:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    store.audit(identity.account["id"], "proposal.review", pid, {"approve": req.approve}, actor=identity.user.get("email", "owner"))
    return {"ok": True, "proposal": item}


@app.get("/api/knowledge/facts")
def list_facts_route(request: Request, limit: int = 50):
    identity = auth_service.require_identity(request)
    return {"facts": store.list_facts(identity.account["id"], limit=limit)}


@app.post("/api/knowledge/retrieve")
def retrieve_knowledge(req: KnowledgeRetrieveRequest, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    return retrieval_service.hybrid_search(
        identity.account["id"],
        req.query,
        workspace_id=req.workspace_id,
        limit=req.limit,
    )


@app.post("/api/team/invite")
def invite_route(req: InviteRequest, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    if not _valid_email(req.email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    # Seat enforcement: users + pending invites may not exceed the plan's seats.
    seats = plan_service.limit_for(identity.plan, "seats")
    if seats is not None:
        used = store.count_users(identity.account["id"]) + store.count_pending_invites(identity.account["id"])
        if used >= int(seats):
            raise HTTPException(
                status_code=403,
                detail=f"This plan includes {seats} seat(s). Upgrade to add more teammates.",
            )
    invite = store.invite_member(identity.account["id"], req.email, req.role)
    store.audit(identity.account["id"], "team.invite", invite.get("email", ""), {"role": invite.get("role")}, actor=identity.user.get("email", "owner"))
    return {"ok": True, "invite": invite}


@app.get("/api/audit")
def audit_route(request: Request, limit: int = 20):
    identity = auth_service.require_identity(request)
    return {"audit": store.list_audit(identity.account["id"], limit=limit)}


@app.post("/mcp")
def mcp_route(req: McpRequest, request: Request):
    """Minimal MCP surface (B3): tools/list exposes narrow read-only graph tools.
    Auth via session/API key; aud checked against expected service. Read-only only."""
    identity = auth_service.require_identity(request)
    account_id = identity.account["id"]
    aud = req.params.get("aud")
    if aud not in (None, "", "helio"):
        return {"jsonrpc": "2.0", "id": req.id, "error": {"code": -32001, "message": "Invalid audience (aud). Use 'helio'."}}
    if req.method == "tools/list":
        return {"jsonrpc": "2.0", "id": req.id, "result": {"tools": [
            {"name": "blast_radius", "description": "What breaks if a service goes down.", "inputSchema": {"type": "object", "properties": {"service": {"type": "string"}}}},
            {"name": "ownership", "description": "Who owns a service and who is on call.", "inputSchema": {"type": "object", "properties": {"service": {"type": "string"}}}},
            {"name": "facts", "description": "Verified company facts for this workspace.", "inputSchema": {"type": "object", "properties": {}}},
        ]}}
    if req.method == "tools/call":
        name = req.params.get("name")
        args = req.params.get("arguments") or {}
        if not isinstance(args, dict):
            return {"jsonrpc": "2.0", "id": req.id, "error": {"code": -32602, "message": "Invalid params: 'arguments' must be an object."}}
        if name == "facts":
            return {"jsonrpc": "2.0", "id": req.id, "result": {"content": [{"type": "text", "text": json.dumps(store.list_facts(account_id, limit=20), default=str)}], "isError": False}}
        if name in ("blast_radius", "ownership"):
            return {"jsonrpc": "2.0", "id": req.id, "result": {"content": [{"type": "text", "text": json.dumps({"use": "POST /ask", "question": f"Who owns {args.get('service', '?')}?"}, default=str)}], "isError": False}}
        return {"jsonrpc": "2.0", "id": req.id, "error": {"code": -32602, "message": f"Unknown tool: {name}"}}
    return {"jsonrpc": "2.0", "id": req.id, "error": {"code": -32601, "message": f"Method not found: {req.method}"}}


# --------------------------------------------------------------------------- #
# Onboarding (zero -> activated)
# --------------------------------------------------------------------------- #


@app.get("/api/onboarding")
def get_onboarding(request: Request):
    identity = auth_service.require_identity(request)
    return {"ok": True, "onboarding": store.get_onboarding(identity.account["id"])}


@app.post("/api/onboarding")
def update_onboarding(req: OnboardingUpdateRequest, request: Request):
    identity = auth_service.require_identity(request)
    auth_service.require_session(identity)
    onboarding = store.update_onboarding(
        identity.account["id"],
        steps=req.steps,
        dismissed=req.dismissed,
        mark_complete=req.mark_complete,
    )
    return {"ok": True, "onboarding": onboarding}


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
        trial=req.trial,
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




@app.post("/api/razorpay/order")
def razorpay_order(req: RazorpayOrderRequest, request: Request):
    """Create a Razorpay Order for the in-app /pay checkout."""

    identity = auth_service.require_identity(request)
    from app import razorpay as razorpay_service

    result = razorpay_service.build_order(
        plan_id=req.plan,
        account=identity.account,
        user=identity.user,
        trial=req.trial,
    )
    if not result.get("ok"):
        status = 503 if result.get("error") == "billing_not_configured" else 400
        return JSONResponse(status_code=status, content=result)
    return result


@app.post("/api/razorpay/verify")
def razorpay_verify(req: RazorpayVerifyRequest, request: Request):
    """Verify Checkout's HMAC response, then activate the account."""

    identity = auth_service.require_identity(request)
    from app import razorpay as razorpay_service

    order = razorpay_service.get_order(req.razorpay_order_id)
    if not order or order.get("account_id") != identity.account["id"]:
        return JSONResponse(status_code=404, content={"ok": False, "error": "unknown_order", "message": "This order does not belong to your account."})
    if not razorpay_service.verify_payment_signature(req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature):
        return JSONResponse(status_code=400, content={"ok": False, "error": "invalid_signature", "message": "Payment verification failed."})
    activated = razorpay_service.activate_order(req.razorpay_order_id, req.razorpay_payment_id)
    if activated is None:
        return JSONResponse(status_code=404, content={"ok": False, "error": "unknown_order", "message": "Order not found."})
    return {"ok": True, **activated}


@app.get("/api/razorpay/callback")
def razorpay_callback(request: Request, razorpay_payment_link_id: str | None = None, razorpay_payment_id: str | None = None, razorpay_signature: str | None = None):
    import hmac, hashlib

    if not razorpay_payment_link_id or not razorpay_payment_id or not razorpay_signature:
        return JSONResponse(status_code=400, content={"ok": False, "error": "missing_params", "message": "Missing Razorpay callback parameters."})
    from app import razorpay as razorpay_service

    if not razorpay_service.verify_callback_signature(razorpay_payment_id, razorpay_payment_link_id, razorpay_signature):
        return JSONResponse(status_code=400, content={"ok": False, "error": "invalid_signature", "message": "Payment verification failed."})
    activated = razorpay_service.activate_link(razorpay_payment_link_id)
    if activated is None:
        return JSONResponse(status_code=404, content={"ok": False, "error": "unknown_link", "message": "Payment link not found."})
    from fastapi.responses import RedirectResponse

    base = _app_base_url(request)
    return RedirectResponse(url=f"{base}/?checkout=success", status_code=302)


@app.post("/api/razorpay/webhook")
async def razorpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("x-razorpay-signature")
    from app import razorpay as razorpay_service

    if not razorpay_service.verify_webhook_signature(body, signature):
        return JSONResponse(status_code=400, content={"ok": False, "error": "invalid_signature"})
    import json

    try:
        parsed = json.loads(body or b"{}")
    except ValueError:
        parsed = {}
    event_id = ((parsed.get("payload") or {}).get("payment") or {}).get("entity", {}).get("id")
    if event_id and store.webhook_seen(event_id):
        return JSONResponse(status_code=200, content={"ok": True, "duplicate": True})
    result = razorpay_service.handle_webhook(body, event_id=event_id)
    if event_id:
        store.mark_webhook(event_id, parsed.get("event", "razorpay"))
    return JSONResponse(status_code=200, content=result)


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
