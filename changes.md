# Competitor audit: Helio vs Company Brain vs Cognee → improvement plan

> Not a copy — research synthesis for upgrading Helio. Helio stays Cypher-graph-native (ownership / blast radius / provenance). Competitors' names/plans are reference only; do not ship their copy, logos, or pricing verbatim.

## 1. What the competitors do (per your research)

**Company Brain (company-brain.ai, early access, SaaS €89/€199):** shared knowledge base → verified facts → Muse/MCP to ChatGPT/Claude/Cursor. Onboarding: upload docs (PDF/DOCX/PPTX/TXT/MD/CSV, 20MB) → Claude extracts facts → review queue (verify/reject/conflicts) → MCP API key → invite team (workspace membership + company key, 7-day links). Roles: Owner/Admin/Validator/Contributor/Reader/Billing. Browse our workspace: Facts, Proposals, Evidence, Signals, Rules, Glossary, Review Queue, Brain Agents (Digest, Website Intel, Market Signal, Competitor Intel). Security: TLS 1.3, encryption at rest, RBAC, audit, token encryption, GDPR, EU hosting. Pricing per **company**, not per seat.

**Cognee (Topoteretes UG, Berlin, 2023 reg / 2024 product, seed €1.5M + $7.5M):** memory infrastructure — remember/recall/improve/forget API, knowledge graph + vectors, MCP/SDK/HTTP. Three entry paths: Personal Brain / Company Brain / Agent-Enterprise Brain. Cloud free: 1M tokens, 1 workspace, unlimited users/API. Standard usage-based ($1/M tokens + $5/workspace), Enterprise BYOC/SLA/bi-temporal/conflict/provenance. Integrations: Drive/Notion/Slack/GitHub/Linear/Jira/Confluence/Dropbox/CRM/DBs + agent integrations (Claude Code, Cursor, Codex, LangGraph, MCP clients). Dashboard: workspace → dataset → agent, dataset permissions, graph visualization, memory timeline.

## 2. Where Helio lags (backend + frontend)

| # | Lag | Evidence |
|---|---|---|
| **B1. Knowledge pipeline** | No upload → extract → **review queue** (Facts vs Proposals, verify/reject, conflicts, evidence). Our integrations only write `integrations` + `import_runs`; no `facts/proposals` store. | Competitors' core differentiator |
| **B2. Document ingest breadth** | We list CSV; no PDF/DOCX/PPTX/TXT/MD parsing, no 20MB flow, no sync cadence (Slack 2h/Notion 4h/CRM 6h). | CSV-only vs their 6 formats |
| **B3. MCP serving** | We *consume* GitHub/Slack APIs but **expose no MCP server**. Competitors sell MCP. | Cognee/Company Brain central |
| **B4. User management** | Owner-only; no Admin/Validator/Contributor/Reader/Billing, no 7-day invites, no company-key (no-account AI access). Single-user workspace. | Their 6 roles |
| **B5. Packaging (prices LOCKED)** | Keep current pricing exactly: Free $0 / Starter $15 / Professional $49 / Enterprise custom (questions/seats as in `app/plans.py`). No digest/MCP/Review Queue yet. Trial 14d — good. | Hold price, raise value per plan |
| **B6. RBAC/audit** | Account-scoped graph, API keys, usage — but no per-user ACL in retrieval, no audit log of reads/writes, no token exchange, no scope step-up. | PDF L4/L7 gaps remain |
| **B7. Brain agents** | No scheduled agents (digest, website watch, market signal). Manual import only. | Company Brain Agents |
| **B8. Graph explainability** | We *have* trail/stale + graph traversal (strong vs Cognee) — but no timeline view, no conflict view, no before/after memory viz. | Trail exists; timeline/conflicts missing |
| **F1. Onboarding-to-value** | WelcomeFlow is 3-step; competitors do profile → industry/size/role/use-case → sources → extraction → review → AI connect → invite. Ours skips company profile + review. | Captured in WelcomeFlow already — extend |
| **F2. Marketplace** | Marquee exists, but no marketplace page/detail per integration, no “AI connections” (ChatGPT/Claude/Cursor) vs “sources” distinction. | Frontend later |
| **F3. Dashboard IA** | Single `/console` page. Competitors: Overview / Facts / Review / Agents / Team / Settings / AI Connections tabs. | Frontend later |
| **F4. Proof** | ProofStrip (100%/50/SOC2) is thin vs their benchmarks, logos, testimonials, S&P report. | Frontend later |

## 3. Improvement plans (multiple, sequenced)

### Backend NOW (next 5 PRs, no frontend dependency)
1. **PR-B1 Facts & proposals store** — `facts`/`proposals` tables + `POST /api/knowledge/upload` (PDF/TXT/MD/CSV first) + `GET /proposals` queue + approve/reject + `GET /facts`. Evidence (source, confidence, status) per fact.
2. **PR-B2 Sync scheduler** — per-provider cadence config (Slack 2h, Notion 4h, CRM 6h stub), last-sync bookkeeping already in `integrations`; add run on interval.
3. **PR-B3 MCP server** — `POST /mcp` (JSON-RPC tools/list|call) exposing read-only graph tools with API-key auth + `aud` check. No token passthrough.
4. **PR-B4 Roles & invites** — `workspace_members` (role enum), 7-day invite tokens, company-key for AI tools.
5. **PR-B5 Agents (digest first)** — scheduled `digest` run summarizing new facts/changes; website-watch as second.
6. **PR-B6 Audit + ACL-in-retrieval** — append-only `audit_log` (actor, action, target, ts) + role filter on graph queries.

### Frontend LATER (after B1–B3 land)
- F1 onboarding extension: company profile (name/site/industry/size/founded/role/use-case) → sources → review-queue UI → AI connect → invite. Skip-friendly.
- F2 marketplace page + AI-connections page (ChatGPT/Claude/Cursor with Copy-snippet keys).
- F3 dashboard tabs: Overview / Facts / Review Queue / Agents / Team / Settings.
- F4 proof upgrade: real benchmark methodology page, logos/testimonials (only with permission), MCP docs.

### Pricing note — LOCKED (do not change)
Keep current pricing exactly: **Free $0 / Starter $15 / Professional $49 / Enterprise custom** (questions/seats as in `app/plans.py`). Do not re-price to per-company or usage-tokens. Compete on *approach*: better onboarding-to-value, review queue, MCP, roles, and proof — same price, more value per plan.

## 4. Non-goals
- No new vector-RAG engine; graph stays the source of truth.
- No copying competitor copy/logos/wording.
