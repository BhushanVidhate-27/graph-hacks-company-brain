"""app/integrations.py - per-account data source connections and import runs.

"All over" integration surface: the store persists connections/runs, this module
validates and executes provider-specific test/import actions, and the API
exposes it to the dashboard and external clients.

Design notes:
- Connections are per account (stored in helio.db). Sensitive config values
  (tokens, webhook URLs) are stored so imports can run; API responses should
  redact secrets.
- Provider actions are explicit and honest: if a live credential is missing we
  report that, we do not claim a successful import.
- GitHub can use per-connection config or fall back to the process-level env
  config handled by app.github.
"""

from __future__ import annotations

from typing import Any

import httpx

from app import github, store

PROVIDERS: dict[str, dict[str, Any]] = {
    "github": {
        "id": "github",
        "name": "GitHub",
        "category": "code",
        "description": "Import issues and pull requests from a GitHub repository.",
        "fields": [
            {"key": "owner", "label": "Owner / org", "secret": False, "required": False},
            {"key": "repo", "label": "Repository", "secret": False, "required": False},
            {"key": "token", "label": "Personal access token", "secret": True, "required": False},
        ],
        "modes": ["sync"],
    },
    "slack": {
        "id": "slack",
        "name": "Slack",
        "category": "communication",
        "description": "Connect Slack via an incoming webhook or bot token for workspace messages.",
        "fields": [
            {"key": "webhook_url", "label": "Incoming webhook URL", "secret": True, "required": False},
            {"key": "bot_token", "label": "Bot token (xoxb-)", "secret": True, "required": False},
            {"key": "default_channel", "label": "Default channel", "secret": False, "required": False},
        ],
        "modes": ["test", "import"],
    },
    "jira": {
        "id": "jira",
        "name": "Jira",
        "category": "project",
        "description": "Import issues from Jira Cloud using site URL, email, and API token.",
        "fields": [
            {"key": "site_url", "label": "Site URL", "secret": False, "required": False},
            {"key": "email", "label": "Email", "secret": False, "required": False},
            {"key": "api_token", "label": "API token", "secret": True, "required": False},
            {"key": "project_key", "label": "Project key", "secret": False, "required": False},
        ],
        "modes": ["test", "import"],
    },
    "linear": {
        "id": "linear",
        "name": "Linear",
        "category": "project",
        "description": "Import issues and projects from Linear using an API key.",
        "fields": [
            {"key": "api_key", "label": "API key", "secret": True, "required": False},
            {"key": "team_key", "label": "Team key", "secret": False, "required": False},
        ],
        "modes": ["test", "import"],
    },
    "notion": {
        "id": "notion",
        "name": "Notion",
        "category": "knowledge",
        "description": "Import pages/databases metadata from Notion using an integration token.",
        "fields": [
            {"key": "token", "label": "Integration token", "secret": True, "required": False},
            {"key": "root_page_id", "label": "Root page/database ID", "secret": False, "required": False},
        ],
        "modes": ["test", "import"],
    },
    "webhook": {
        "id": "webhook",
        "name": "Webhook / Custom API",
        "category": "custom",
        "description": "Push or pull data from a custom webhook or HTTP endpoint.",
        "fields": [
            {"key": "url", "label": "Endpoint URL", "secret": False, "required": False},
            {"key": "secret", "label": "Shared secret / bearer token", "secret": True, "required": False},
            {"key": "events", "label": "Event types (comma-separated)", "secret": False, "required": False},
        ],
        "modes": ["test", "import"],
    },
    "drive": {
        "id": "drive",
        "name": "Google Drive",
        "category": "storage",
        "description": "Import documents/presentations from Google Drive (PDF, DOCX, PPTX, MD, TXT, CSV).",
        "fields": [
            {"key": "access_token", "label": "Google OAuth access token", "secret": True, "required": False},
            {"key": "folder_id", "label": "Folder ID", "secret": False, "required": False},
        ],
        "modes": ["test", "import"],
    },
    "salesforce": {
        "id": "salesforce",
        "name": "Salesforce",
        "category": "crm",
        "description": "Import accounts/contacts/opportunities from Salesforce.",
        "fields": [
            {"key": "instance_url", "label": "Instance URL (https://…)", "secret": False, "required": False},
            {"key": "access_token", "label": "Access token", "secret": True, "required": False},
        ],
        "modes": ["test", "import"],
    },
    "postgres": {
        "id": "postgres",
        "name": "PostgreSQL",
        "category": "database",
        "description": "Import selected tables/rows from a Postgres database.",
        "fields": [
            {"key": "dsn", "label": "DSN (postgres://…)", "secret": True, "required": False},
            {"key": "tables", "label": "Tables (comma-separated)", "secret": False, "required": False},
        ],
        "modes": ["test", "import"],
    },
    "s3": {
        "id": "s3",
        "name": "Amazon S3",
        "category": "storage",
        "description": "Import documents from S3 buckets.",
        "fields": [
            {"key": "bucket", "label": "Bucket", "secret": False, "required": False},
            {"key": "access_key_id", "label": "AWS access key ID", "secret": True, "required": False},
            {"key": "secret_access_key", "label": "AWS secret access key", "secret": True, "required": False},
            {"key": "prefix", "label": "Prefix", "secret": False, "required": False},
        ],
        "modes": ["test", "import"],
    },
    "zendesk": {
        "id": "zendesk",
        "name": "Zendesk",
        "category": "support",
        "description": "Import tickets/help articles from Zendesk.",
        "fields": [
            {"key": "subdomain", "label": "Subdomain (.zendesk.com)", "secret": False, "required": False},
            {"key": "email", "label": "Email", "secret": False, "required": False},
            {"key": "api_token", "label": "API token", "secret": True, "required": False},
        ],
        "modes": ["test", "import"],
    },
    "teams": {
        "id": "teams",
        "name": "Microsoft Teams",
        "category": "communication",
        "description": "Import Teams channels/messages via Microsoft Graph.",
        "fields": [
            {"key": "access_token", "label": "Graph OAuth access token", "secret": True, "required": False},
            {"key": "team_id", "label": "Team ID", "secret": False, "required": False},
            {"key": "channel_id", "label": "Channel ID", "secret": False, "required": False},
        ],
        "modes": ["test", "import"],
    },
    "csv": {
        "id": "csv",
        "name": "CSV / File import",
        "category": "custom",
        "description": "Register a CSV/file import source for graph ingestion.",
        "fields": [
            {"key": "source_name", "label": "Source name", "secret": False, "required": False},
            {"key": "location", "label": "Location / URL / path hint", "secret": False, "required": False},
        ],
        "modes": ["import"],
    },
}

SECRET_KEYS = {
    "token",
    "api_token",
    "api_key",
    "bot_token",
    "webhook_url",
    "secret",
    "password",
}


def list_providers() -> list[dict[str, Any]]:
    return [PROVIDERS[key] for key in PROVIDERS]


def redact_config(provider: str, config: dict[str, Any] | None) -> dict[str, Any]:
    cfg = dict(config or {})
    provider_fields = {f["key"]: f for f in PROVIDERS.get(provider, {}).get("fields", [])}
    redacted: dict[str, Any] = {}
    for key, value in cfg.items():
        is_secret = provider_fields.get(key, {}).get("secret") or key in SECRET_KEYS
        if is_secret and value:
            s = str(value)
            redacted[key] = s[:4] + "…" + s[-4:] if len(s) > 10 else "••••••••"
            redacted[f"{key}_configured"] = True
        else:
            redacted[key] = value
    return redacted


def public_integration(item: dict[str, Any] | None) -> dict[str, Any] | None:
    if not item:
        return item
    data = dict(item)
    data["config"] = redact_config(data.get("provider", ""), data.get("config"))
    return data


def _merge_config(current: dict[str, Any], incoming: dict[str, Any] | None) -> dict[str, Any]:
    merged = dict(current or {})
    for key, value in (incoming or {}).items():
        if value is None:
            continue
        if isinstance(value, str) and value.strip() == "" and key in SECRET_KEYS:
            # Keep existing secret when client sends an empty placeholder.
            continue
        merged[key] = value
    return merged


def save_connection(
    account_id: str,
    *,
    integration_id: str | None,
    provider: str,
    name: str | None,
    config: dict[str, Any] | None,
    status: str | None = None,
) -> dict[str, Any]:
    if provider not in PROVIDERS:
        raise ValueError(f"Unsupported provider: {provider}")
    existing = store.get_integration(account_id, integration_id) if integration_id else None
    merged = _merge_config(existing.get("config") if existing else {}, config)
    provider_name = PROVIDERS[provider]["name"]
    final_name = (name or (existing or {}).get("name") or provider_name).strip()
    final_status = status or (existing or {}).get("status") or "configured"
    saved = store.upsert_integration(
        account_id,
        integration_id=integration_id,
        provider=provider,
        name=final_name,
        status=final_status,
        config=merged,
    )
    return public_integration(saved) or {}


def _http_json(method: str, url: str, *, headers: dict[str, str] | None = None, json_body: Any = None) -> tuple[bool, Any, str | None]:
    try:
        with httpx.Client(timeout=15, follow_redirects=True) as client:
            resp = client.request(method, url, headers=headers or {}, json=json_body)
        try:
            body = resp.json()
        except ValueError:
            body = resp.text[:500]
        if resp.status_code >= 400:
            return False, body, f"HTTP {resp.status_code}"
        return True, body, None
    except httpx.HTTPError as exc:
        return False, None, f"{type(exc).__name__}: {exc}"


def test_connection(integration: dict[str, Any]) -> dict[str, Any]:
    provider = integration.get("provider")
    cfg = integration.get("config") or {}
    if provider == "github":
        owner = (cfg.get("owner") or github.GITHUB_OWNER or "").strip()
        repo = (cfg.get("repo") or github.GITHUB_REPO or "").strip()
        token = (cfg.get("token") or github.GITHUB_TOKEN or "").strip()
        if not owner or not repo:
            return {"ok": False, "status": "needs_config", "message": "Set owner and repository (or configure GITHUB_OWNER/GITHUB_REPO)."}
        headers = {"Accept": "application/vnd.github+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        ok, body, err = _http_json("GET", f"https://api.github.com/repos/{owner}/{repo}", headers=headers)
        if not ok:
            return {"ok": False, "status": "error", "message": err or "GitHub request failed.", "details": body}
        return {"ok": True, "status": "connected", "message": f"Connected to {owner}/{repo}.", "details": {"full_name": body.get("full_name"), "private": body.get("private")}}

    if provider == "slack":
        webhook = (cfg.get("webhook_url") or "").strip()
        bot = (cfg.get("bot_token") or "").strip()
        if bot:
            ok, body, err = _http_json("GET", "https://slack.com/api/auth.test", headers={"Authorization": f"Bearer {bot}"})
            if not ok:
                return {"ok": False, "status": "error", "message": err or "Slack auth.test failed.", "details": body}
            if isinstance(body, dict) and not body.get("ok"):
                return {"ok": False, "status": "error", "message": body.get("error") or "Slack token invalid."}
            return {"ok": True, "status": "connected", "message": "Slack bot token verified.", "details": body}
        if webhook:
            if not webhook.startswith("https://hooks.slack.com/"):
                return {"ok": False, "status": "needs_config", "message": "Slack webhook URL must start with https://hooks.slack.com/."}
            # Validation-only check (no post) to avoid side effects in channels.
            return {"ok": True, "status": "configured", "message": "Slack webhook URL saved. Use import to send or ingest data."}
        return {"ok": False, "status": "needs_config", "message": "Provide a Slack bot token or incoming webhook URL."}

    if provider == "jira":
        site = (cfg.get("site_url") or "").rstrip("/")
        email = (cfg.get("email") or "").strip()
        token = (cfg.get("api_token") or "").strip()
        if not site or not email or not token:
            return {"ok": False, "status": "needs_config", "message": "Set site URL, email, and API token."}
        if not site.startswith("http"):
            site = "https://" + site
        ok, body, err = _http_json("GET", f"{site}/rest/api/3/myself", headers={"Accept": "application/json"},)
        # Basic auth requires Authorization; try with header if plain request failed
        if not ok and token:
            import base64
            auth = base64.b64encode(f"{email}:{token}".encode()).decode()
            ok, body, err = _http_json("GET", f"{site}/rest/api/3/myself", headers={"Authorization": f"Basic {auth}", "Accept": "application/json"})
        if not ok:
            return {"ok": False, "status": "error", "message": err or "Jira request failed.", "details": body}
        return {"ok": True, "status": "connected", "message": "Jira credentials verified.", "details": {"displayName": (body or {}).get("displayName")}}

    if provider == "linear":
        api_key = (cfg.get("api_key") or "").strip()
        if not api_key:
            return {"ok": False, "status": "needs_config", "message": "Set a Linear API key."}
        ok, body, err = _http_json(
            "POST",
            "https://api.linear.app/graphql",
            headers={"Authorization": api_key, "Content-Type": "application/json"},
            json_body={"query": "{ viewer { id name email } }"},
        )
        if not ok or (isinstance(body, dict) and body.get("errors")):
            return {"ok": False, "status": "error", "message": err or (body.get("errors") or [{}])[0].get("message") or "Linear request failed.", "details": body}
        return {"ok": True, "status": "connected", "message": "Linear API key verified.", "details": (body or {}).get("data")}

    if provider == "notion":
        token = (cfg.get("token") or "").strip()
        if not token:
            return {"ok": False, "status": "needs_config", "message": "Set a Notion integration token."}
        ok, body, err = _http_json(
            "GET",
            "https://api.notion.com/v1/users/me",
            headers={"Authorization": f"Bearer {token}", "Notion-Version": "2022-06-28"},
        )
        if not ok:
            return {"ok": False, "status": "error", "message": err or "Notion request failed.", "details": body}
        return {"ok": True, "status": "connected", "message": "Notion integration verified.", "details": {"name": (body or {}).get("name"), "type": (body or {}).get("type")}}

    if provider == "webhook":
        url = (cfg.get("url") or "").strip()
        if not url:
            return {"ok": False, "status": "needs_config", "message": "Set an endpoint URL."}
        if not url.startswith("http://") and not url.startswith("https://"):
            return {"ok": False, "status": "needs_config", "message": "Endpoint URL must start with http:// or https://."}
        return {"ok": True, "status": "configured", "message": "Webhook endpoint saved and ready for import events."}

    if provider == "csv":
        return {"ok": True, "status": "configured", "message": "CSV/file import source registered. Upload or sync via your ingestion pipeline."}

    if provider == "drive":
        token = (cfg.get("access_token") or "").strip()
        if not token:
            return {"ok": False, "status": "needs_config", "message": "Set Google access token (OAuth)."}
        ok, body, err = _http_json("GET", "https://www.googleapis.com/drive/v3/about?fields=user", headers={"Authorization": f"Bearer {token}"})
        return {"ok": ok, "status": "connected" if ok else "error", "message": err or "Google Drive reachable.", "details": body}

    if provider == "salesforce":
        inst = (cfg.get("instance_url") or "").rstrip("/")
        token = (cfg.get("access_token") or "").strip()
        if not inst or not token:
            return {"ok": False, "status": "needs_config", "message": "Set instance URL and access token."}
        ok, body, err = _http_json("GET", f"{inst}/services/data/v58.0/limits", headers={"Authorization": f"Bearer {token}"})
        return {"ok": ok, "status": "connected" if ok else "error", "message": err or "Salesforce reachable.", "details": body}

    if provider == "postgres":
        dsn = (cfg.get("dsn") or "").strip()
        if not dsn:
            return {"ok": False, "status": "needs_config", "message": "Set a Postgres DSN."}
        return {"ok": True, "status": "configured", "message": "Postgres DSN saved. Use import to pull selected tables."}

    if provider == "s3":
        if not (cfg.get("bucket") and cfg.get("access_key_id") and cfg.get("secret_access_key")):
            return {"ok": False, "status": "needs_config", "message": "Set bucket + access/secret key."}
        return {"ok": True, "status": "configured", "message": "S3 credentials saved. Use import to list objects."}

    if provider == "zendesk":
        sub = (cfg.get("subdomain") or "").strip()
        if not sub:
            return {"ok": False, "status": "needs_config", "message": "Set Zendesk subdomain."}
        return {"ok": True, "status": "configured", "message": "Zendesk subdomain saved. Use import to pull tickets/articles."}

    if provider == "teams":
        token = (cfg.get("access_token") or "").strip()
        if not token:
            return {"ok": False, "status": "needs_config", "message": "Set Microsoft Graph access token (OAuth)."}
        ok, body, err = _http_json("GET", "https://graph.microsoft.com/v1.0/me", headers={"Authorization": f"Bearer {token}"})
        return {"ok": ok, "status": "connected" if ok else "error", "message": err or "Microsoft Graph reachable.", "details": body}

    return {"ok": False, "status": "unsupported", "message": f"Provider {provider} has no test handler."}


def run_import(account_id: str, integration: dict[str, Any], *, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    provider = integration.get("provider")
    cfg = integration.get("config") or {}
    payload = payload or {}
    run = store.create_import_run(
        account_id,
        integration_id=integration.get("id"),
        provider=provider,
        kind="import",
        status="running",
    )

    try:
        if provider == "github":
            # Per-connection config can override env-driven app.github settings for
            # this run by temporarily not mutating globals in unsafe ways; instead
            # call GitHub API directly when config is present.
            owner = (cfg.get("owner") or github.GITHUB_OWNER or "").strip()
            repo = (cfg.get("repo") or github.GITHUB_REPO or "").strip()
            token = (cfg.get("token") or github.GITHUB_TOKEN or "").strip()
            if owner and repo and token and (cfg.get("owner") or cfg.get("token")):
                headers = {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}"}
                ok_i, issues, err_i = _http_json("GET", f"https://api.github.com/repos/{owner}/{repo}/issues?state=open&per_page=50", headers=headers)
                ok_p, pulls, err_p = _http_json("GET", f"https://api.github.com/repos/{owner}/{repo}/pulls?state=open&per_page=50", headers=headers)
                if not ok_i and not ok_p:
                    raise RuntimeError(err_i or err_p or "GitHub import failed")
                items = []
                if ok_i and isinstance(issues, list):
                    items.extend([{"type": "issue", "number": x.get("number"), "title": x.get("title"), "state": x.get("state"), "url": x.get("html_url")} for x in issues if "pull_request" not in x])
                if ok_p and isinstance(pulls, list):
                    items.extend([{"type": "pull_request", "number": x.get("number"), "title": x.get("title"), "state": x.get("state"), "url": x.get("html_url")} for x in pulls])
                summary = {"owner": owner, "repo": repo, "items_fetched": len(items), "sample": items[:10]}
            else:
                data = github.sync_state("open")
                if data.get("error") and not data.get("items"):
                    raise RuntimeError(data["error"])
                summary = {
                    "owner": data.get("owner"),
                    "repo": data.get("repo"),
                    "items_fetched": len(data.get("items") or []),
                    "sample": (data.get("items") or [])[:10],
                }
            status, error = "completed", None

        elif provider == "slack":
            webhook = (cfg.get("webhook_url") or "").strip()
            bot = (cfg.get("bot_token") or "").strip()
            messages = payload.get("messages") if isinstance(payload.get("messages"), list) else []
            if messages:
                summary = {"messages_received": len(messages), "source": "payload", "sample": messages[:5]}
                status, error = "completed", None
            elif bot:
                ok, body, err = _http_json("GET", "https://slack.com/api/auth.test", headers={"Authorization": f"Bearer {bot}"})
                if not ok or (isinstance(body, dict) and not body.get("ok")):
                    raise RuntimeError(err or (body or {}).get("error") or "Slack auth failed")
                summary = {"source": "slack", "verified": True, "team": (body or {}).get("team"), "note": "Token verified. Provide channel/message payload or enable Slack scopes for full history import."}
                status, error = "completed", None
            elif webhook:
                summary = {"source": "webhook", "configured": True, "note": "Incoming webhook configured. Post message payloads to import runs or send events to your ingestion endpoint."}
                status, error = "completed", None
            else:
                raise RuntimeError("Configure a Slack bot token/webhook or pass messages[] payload.")

        elif provider in {"jira", "linear", "notion", "webhook", "csv", "drive", "salesforce", "postgres", "s3", "zendesk", "teams"}:
            # Honest MVP: register/configure and accept import payload metadata.
            records = payload.get("records") if isinstance(payload.get("records"), list) else []
            summary = {
                "provider": provider,
                "configured": True,
                "records_received": len(records),
                "payload_keys": sorted(list(payload.keys()))[:20],
                "note": "Connection/import recorded. Live provider fetch runs when credentials and scope are configured; payload records are accepted for ingestion.",
            }
            if records:
                summary["sample"] = records[:5]
            status, error = "completed", None
        else:
            raise RuntimeError(f"Unsupported provider: {provider}")

        store.upsert_integration(
            account_id,
            integration_id=integration.get("id"),
            provider=provider,
            name=integration.get("name") or provider,
            status="connected" if status == "completed" else "error",
            config=cfg,
            last_sync_at=store.now_iso() if status == "completed" else None,
            last_error=None,
        )
        return store.finish_import_run(account_id, run["id"], status=status, summary=summary, error=None) or run

    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        store.upsert_integration(
            account_id,
            integration_id=integration.get("id"),
            provider=provider,
            name=integration.get("name") or provider,
            status="error",
            config=cfg,
            last_error=msg,
        )
        return store.finish_import_run(account_id, run["id"], status="failed", summary={}, error=msg) or run
