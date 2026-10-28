# Helio — Website Copy

Every user-facing string on the site, organized by screen and in reading order.
Dynamic values are shown as `{placeholders}`. Alternate states (auth, error, mobile,
simulators) are included so nothing lives only in the source.

**Live site:** http://localhost:5174/
**Source:** `angy-fronted/`

---

## Contents

1. [Document metadata](#1-document-metadata)
2. [Global chrome](#2-global-chrome)
3. [Landing page](#3-landing-page)
   - [3.1 Hero](#31-hero)
   - [3.2 Pixel reveal band](#32-pixel-reveal-band)
   - [3.3 Dependency plot](#33-dependency-plot)
   - [3.4 Blast Radius Inspector](#34-blast-radius-inspector)
   - [3.5 The 4 Traps](#35-the-4-traps)
   - [3.6 Proof 04 — Honest Negative](#36-proof-04--honest-negative)
   - [3.7 One graph, two lenses](#37-one-graph-two-lenses)
   - [3.8 How it works](#38-how-it-works)
   - [3.9 Roles](#39-roles)
   - [3.10 Pricing](#310-pricing)
   - [3.11 FAQ](#311-faq)
   - [3.12 Footer](#312-footer)
4. [Cypher Agent screen](#4-cypher-agent-screen)
5. [Graph Console screen](#5-graph-console-screen)
6. [Device Preview screen](#6-device-preview-screen)
7. [Auth screen](#7-auth-screen)
8. [Account screen](#8-account-screen)
9. [Transient and accessibility text](#9-transient-and-accessibility-text)

---

## 1. Document metadata

**Title**

> Helio — The Company Brain for Engineering Teams

**Meta description**

> Ask who knows about payments-gateway, what breaks if it goes down, where was that decided, and how current is that answer — in one traversal, with the graph path shown.

---

## 2. Global chrome

### 2.1 Cursor readout

Follows the pointer beside the plus mark:

> X `{x}` / Y `{y}` PX

### 2.2 Navbar — signed out

**Wordmark:** HELIO

**Primary navigation**

- EXPLORE
- BLAST RADIUS INSPECTOR
- THE 4 TRAPS
- HOW IT WORKS
- PLANS
- FAQS

**Right side**

- SIGN IN
- START FREE

**Session loading state**

> Checking session…

### 2.3 Navbar — signed in

- ACCOUNT
- QUERY AGENT

### 2.4 Explore dropdown

| Item | Description |
|---|---|
| FULL WEBSITE | Product overview |
| HELIO CYPHER AGENT | Natural language graph traversal |
| GRAPH CONSOLE | Topology, on-call & blast radius |
| DEVICE PREVIEW | Desktop, tablet & mobile frames |

### 2.5 Mobile drawer

- BLAST RADIUS INSPECTOR
- HELIO CYPHER AGENT
- GRAPH CONSOLE
- THE 4 TRAPS
- HOW IT WORKS
- PLANS
- FAQS
- ACCOUNT & BILLING *(signed in)*
- SIGN IN *(signed out)*
- START FREE *(signed out)*

---

## 3. Landing page

### 3.1 Hero

**Headline**

> KNOW WHAT BREAKS.
> BEFORE IT DIES.
> IN ONE TRAVERSAL.

The third line is coral.

**Body**

> Existing enterprise search answers **"where is the doc about X."** Helio answers **who knows about X, what breaks if it goes down, where was that decided, and how current is that answer** — in one deterministic Cypher traversal, with the complete path shown. Text search is used only at the leaves.

**Buttons**

- ASK HELIO AGENT
- INSPECT BLAST RADIUS
- GRAPH CONSOLE

**Capability card**

- **BLAST RADIUS TRAVERSAL** — Walks dependency edges to find every downstream service, owning team and on-call engineer.
- **EXPERTISE VOLUME VS RECENCY** — Ranks who actually knows a system by contribution volume and recency — not job title.
- **SUPERSEDES PROVENANCE** — Follows decision edges so newer decisions override stale docs, with the full chain shown.
- **HONEST NEGATIVES** — When the graph has no answer, Helio says so instead of inventing one.

**Card footer**

**Sub-bar**

> **ONE GRAPH:** Ownership · Dependencies · Decisions · On-call

> INTERACTIVE BLAST RADIUS ↓

---

### 3.2 Pixel reveal band

**Header**

- FLAT SEARCH VS. GRAPH TRAVERSAL — ONE FRAME
- ↻ REPLAY

**Footer**

- LEFT: STALE / TRAPPED · RIGHT: VERIFIED PATH
- DRAG TO PAN *(mobile)*

---

### 3.3 Dependency plot

**Header**

- ONE QUERY · EIGHT SERVICES · THREE HOPS
- ↻ REPLAY
- DRAG TO PAN *(mobile)*

**Plot labels**

- ROOT
- HOP 1
- HOP 2
- HOP 3

**Node names**

- payments-gateway
- checkout-api
- ledger-service
- ledger-core
- fraud-engine
- subscription-worker
- notification-worker
- dispute-service
- reconciliation-worker

**Readout**

> PATH: **payments-gateway → ledger-service → notification-worker → reconciliation-worker**

> 8 DOWNSTREAM · 3 HOPS · **0 INVENTED**

---

### 3.4 Blast Radius Inspector

**Section heading**

> CLICK & DRAG TO CONTRAST
> FLAT SEARCH VS. GRAPH TRAVERSAL

**Legend**

- FLAT KEYWORD SEARCH (STALE / TRAPPED)
- HELIO GRAPH QUERY

**Graph layer labels**

- VERIFIED GRAPH TRAVERSAL
- VERIFIED
- 3-HOP TRAVERSAL
- GRAPH ENGINE

**Left (trap) layer**

- NAIVE FLAT SEARCH // TRAPS & STALE DOCUMENTS
- ⚠️ NAIVE RANK TRAP 01:
  > "Priya Sharma has 14 commits on payments-gateway. Returns Priya as #1 expert (she left 6 months ago)."
- ⚠️ CONTRADICTION TRAP 02:
  > "March document found: 'Single provider, Stripe.' Misses Decision D-19 completely."
- ⚠️ HALLUCINATION TRAP 03:
  > "Asked who owns config-service: LLM invents an owner rather than admitting no edge exists."
- NO EDGE RELATIONS

**Drag hint**

> ◄ DRAG TO REVEAL HOW GRAPH SOLVES THE TRAPS ►

**Details panel**

- NODE TRAVERSAL DETAILS
- OWNER:
- ON-CALL:
- DOWNSTREAM BLAST RADIUS: `{n}` IMPACTED
- CYPHER QUERY EXECUTED:
- **VERIFIED**
- Tabs: 01 / 02 / 03 / 04

#### Node 01 — payments-gateway

- **Category:** critical-path
- **Tier:** Tier 1 (Critical)
- **Owner:** Platform Team
- **On-call:** Ravi Menon (Active)
- **Blast radius:** checkout-api, ledger-service, fraud-engine, subscription-worker
- **Summary:** Priya Sharma has 14 commits (departed April 2026, stale). Ravi Menon committed recently (2026-09-28). Ask Ravi Menon. 4 downstream services will fail if this goes down.
- **Citation:** Fact 01 & Fact 08: Volume trap vs recency resolved.

#### Node 02 — config-service

- **Category:** unowned
- **Tier:** Tier 2 (Internal)
- **Owner:** NO TEAM OWNS THIS SERVICE
- **On-call:** No rotation assigned
- **Blast radius:** auth-service, user-profile-service
- **Summary:** The graph contains no OWNED_BY edge for config-service. Helio explicitly reports no owner exists, refusing to hallucinate an owner.
- **Citation:** Fact 04: The failure test. Confident honest negative.

#### Node 03 — decision-d19

- **Category:** provenance
- **Tier:** Architecture Decision Record
- **Owner:** Architecture Review Board
- **On-call:** Elena Vasquez (Author)
- **Blast radius:** payments-gateway, stripe-connector, adyen-vault
- **Summary:** March docs claimed single-provider Stripe. Decision D-19 (2026-05-06) established dual-provider: Adyen primary, Stripe fallback. Helio surfaces this superseding path.
- **Citation:** Fact 09: Contradiction resolution via SUPERSEDES edge.

#### Node 04 — ledger-service

- **Category:** stale-edge
- **Tier:** Tier 1 (Financial Core)
- **Owner:** Ledger Team
- **On-call:** Diego Alvarez (This Week)
- **Blast radius:** audit-pipeline, reconciliation-worker
- **Summary:** Ravi Menon and Diego Alvarez are both on rotation. Diego is on call this week. Priya Sharma is on no rotation at all.
- **Citation:** Fact 11: Rotation membership vs active weekly on-call.

---

### 3.5 The 4 Traps

**Heading**

> ENTERPRISE SEARCH TELLS YOU WHERE DOCUMENTS LIVE, NOT WHAT IS TRUE.

**Intro**

> A hallucinated ownership chain looks exactly like a correct one because both are plausible prose. Helio replaces probabilistic guessing with deterministic Cypher traversals over real organizational edges.

**Card 01**

- Label: VOLUME TRAP
- Index: [01]
- Title: PRIYA SHARMA LEFT IN APRIL
- Body: Priya has 14 commits on payments-gateway — the most. A single 'ORDER BY count DESC' returns her, technically correct on volume but wrong on recency. Helio returns both signals: Ask Ravi Menon.

**Card 02**

- Label: CONTRADICTION
- Index: [02]
- Title: STRIPE VS. ADYEN DECISION CONFLICT
- Body: A March doc says 'single provider, Stripe.' May Decision D-19 says 'dual provider, Adyen primary, Stripe fallback.' Without a SUPERSEDES edge, search engines present stale docs as current truth.

**Card 03**

- Label: BLAST RADIUS
- Index: [03]
- Title: CASCADING MIDNIGHT FAILURES
- Body: When a core service degrades, text search cannot trace downstream blast radius. Helio walks HAS_DEPENDENT edges to identify exact hop depth, owning teams, and on-call engineers.

**Card 04**

- Label: HALLUCINATION
- Index: [04]
- Title: INVENTS OWNERS WHEN NONE EXIST
- Body: An LLM asked 'who owns config-service?' invents a plausible team. Helio traverses the graph, detects no OWNED_BY edge, and states with confidence: 'No team owns it.' Truth, not an apology.

---

### 3.6 Proof 04 — Honest Negative

**Panel header**

- PROOF 04
- HONEST NEGATIVE
- ↻ RUN AGAIN

**Headline**

> THE ANSWER THAT
> ISN'T THERE.

**Body**

> Five of the twenty demo questions have no answer in the graph. A model that invents a plausible team produces the same shaped sentence as one that knows. Helio returns the missing edge as the result.

**Comparison block**

> A CHATBOT WOULD WRITE — **INVENTED**
> "Platform Team owns config-service."

> HELIO RETURNS
> **No team owns it.**
> 0 rows · OWNED_BY: null

**Canvas labels**

- QUERY 04 · RETURN t.name
- GRAPH
- config-service
- :Service
- ∅
- NO EDGE
- ? t:Team
- not in graph

**Cypher block**

```
MATCH (s:Service {name:'config-service'})
  -[:OWNED_BY]->(t:Team)
RETURN t.name
```

- ROWS
- 0
- // t.name = null

---

### 3.7 One graph, two lenses

**Heading**

> ONE GRAPH. TWO POWERFUL LENSES.

**Card 01**

- Eyebrow: [01] CYPHER AGENT
- Meta: NATURAL LANGUAGE → GRAPH
- Title: HELIO NATURAL LANGUAGE AGENT
- Body: Ask complex organizational questions in plain English. Helio maps your intent into Cypher queries, traverses graph edges, and returns verified paths with zero hallucination.
- Bullets:
  - Translates questions into multi-hop Cypher queries automatically
  - Displays full path chips: Person → CONTRIBUTED_TO → Service
  - Answers unowned nodes cleanly: "The graph contains no OWNED_BY edge"
- Button: LAUNCH AGENT SIMULATOR

**Card 02**

- Eyebrow: [02] GRAPH EXPLORER
- Meta: TOPOLOGY & METRICS
- Title: HELIO GRAPH CONSOLE
- Body: Visual overview of your entire engineering topology. Inspect service tiers, live on-call rotation assignments, staleness indicators, and blast radius cascade depth in real time.
- Bullets:
  - Interactive blast radius impact simulator across your service graph
  - Weekly on-call rotation tracking across every team
  - Automated 90-day staleness decay detection across documentation
- Button: LAUNCH CONSOLE SIMULATOR

---

### 3.8 How it works

**Heading**

> BUILT ON GRAPH TOPOLOGY, NOT GUESSWORK.

**Intro**

> An LLM asked "is this answer correct?" is circular. Helio anchors the agent to a deterministic graph database and grounds every answer in the edges that actually exist.

**01 — GRAPH INGESTION**

> Structured nodes & typed edges in the graph engine

Persons, Teams, Projects, Services, Decisions, and Documents loaded with pre-indexed Cypher properties.

**02 — MULTI-HOP CYPHER**

> Deterministic traversal instead of fuzzy search

Follows HAS_DEPENDENT and OWNED_BY paths to discover exact ripple effects and on-call escalation routes.

**03 — TEMPORAL DECAY**

> Separates historical volume from recent activity

Checks edge validity dates so departed engineers are never recommended, even if they had the most commits.

**04 — DETERMINISTIC HONESTY**

> Explicit negatives with zero hallucination

When an edge does not exist, Helio returns a confident negative instead of inventing one.

---

### 3.9 Roles

**Heading**

> ONE SOURCE OF TRUTH FOR THE ENTIRE ENGINEERING ORGANIZATION

Each card carries the label **STAKEHOLDER**.

| Num | Role | Description |
|---|---|---|
| [01] | INCIDENT COMMANDERS | Trace blast radius and find the active on-call engineer in 3 seconds flat during outages. |
| [02] | STAFF ARCHITECTS | Follow SUPERSEDES chains to ensure deprecated architectural decisions are retired. |
| [03] | ENGINEERING DIRECTORS | Audit unowned services (like config-service) and eliminate structural blindspots. |
| [04] | SITE RELIABILITY ENGINEERS | Map multi-hop cascade dependencies before releasing core infrastructure changes. |
| [05] | NEW HIRES & DEVELOPERS | Discover who actually maintains a codebase recently, bypassing stale Confluence wikis. |
| [06] | PLATFORM LEADS | Keep service tiers and SLA contracts compliant across distributed engineering teams. |
| [07] | SECURITY AUDITORS | Visualize exact blast radius when a critical dependency requires emergency patching. |
| [08] | PRODUCT MANAGERS | Map cross-team service ownership to eliminate organizational blockers. |

---

### 3.10 Pricing

**Heading**

> PRICED FOR THE TEAM THAT NEEDS THE ANSWER

**Intro**

> Start free. Upgrade when the graph becomes part of how your team works. Every plan includes the provenance trail, staleness flags and honest negatives — the parts that make an answer checkable.

**Billing strip**

> **BILLING:** USD, billed monthly · cancel anytime · Annual saves ~17%

**Conditional notices**

- Checkout is not configured on this deployment. Start free, or email us for a manual invoice.
- Local billing mode: upgrades apply instantly for development.

**Plan actions / states**

- Starting…
- Current plan
- Current
- Talk to us

#### Free

- **Tagline:** Evaluate the graph on a real company brain, no card required.
- **Price:** $0
- **Price note:** Free forever · no card
- **Credits:** 50 questions / month
- **Features:**
  - 50 questions / month
  - 1 knowledge graph
  - 1 seat
  - Provenance trail on every answer
  - Cypher-verified answers
  - Community support
- **CTA:** Start free

#### Starter

- **Tagline:** For one engineering team that needs answers it can defend.
- **Price:** $15/mo
- **Price note:** $150/year (save ~17%)
- **Credits:** 1,000 questions / month
- **Features:**
  - 1,000 questions / month
  - 1 knowledge graph
  - 3 seats
  - GitHub issue & PR sync
  - 90-day staleness alerts
  - Email support
- **CTA:** Start Starter

#### Professional — RECOMMENDED

- **Tagline:** For platform teams running multiple services and decisions.
- **Price:** $49/mo
- **Price note:** $490/year (save ~17%)
- **Credits:** 5,000 questions / month
- **Features:**
  - 5,000 questions / month
  - Unlimited knowledge graphs
  - 10 seats
  - API access & keys
  - Priority inference
  - Analytics & usage dashboard
  - Slack support
- **CTA:** Start Professional

#### Enterprise

- **Tagline:** For security-sensitive organisations with their own graph.
- **Price:** Custom
- **Price note:** Custom · annual or monthly
- **Credits:** Custom volume
- **Features:**
  - Unlimited questions
  - Unlimited graphs & seats
  - Dedicated graph instance
  - SSO / RBAC
  - SLA-backed uptime
  - White-glove onboarding
- **CTA:** Talk to us

**Rationale**

- **No per-seat surprise** — Every plan includes seats. You pay for the questions your team actually asks, not for inviting a reviewer to read a trail.
- **Open-source core** — The graph, Cypher and agent loop are open source. Self-host them for free; the paid plans pay for the managed surface.
- **Cancel from the portal** — Stripe Customer Portal handles plan changes, payment methods and cancellation. No retention call required.

**Footnote**

> All plans include Cypher-verified answers on a dedicated graph engine, with streaming answers

---

### 3.11 FAQ

**Heading**

> GOT QUESTIONS? WE'VE GOT VERIFIED ANSWERS.

**[01] Why is a graph traversal better than vector search or RAG?**

> Vector search checks semantic similarity between text chunks. It cannot tell if Priya left the company 6 months ago, cannot compute a 3-hop dependency cascade, and treats superseded docs as equally valid. Helio traverses real organizational edges with temporal properties, using text search only at the leaves.

**[02] How does Helio prevent the LLM from hallucinating ownership?**

> The agent is strictly bounded by Cypher query results. If a service like config-service has no OWNED_BY edge in the graph, the agent receives an explicit empty set and returns: "The graph contains no OWNED_BY edge. No team owns it." When the graph has no answer, Helio says so instead of inventing one.

**[03] How is the Priya Sharma volume vs. recency trap resolved?**

> Priya Sharma has 14 commits on payments-gateway — the highest in the company. A naive ORDER BY count DESC returns her, even though she left in April. Helio returns volume and recency as two distinct signals: "Ravi Menon has worked on it most recently (2026-09-28). Priya Sharma has the most commits (14), but her last touch was 2026-04-15 and is flagged as stale. Ask Ravi Menon."

**[04] How are conflicting decisions handled (Stripe vs. Adyen)?**

> Helio models architectural decisions with SUPERSEDES edges. A March doc says "single provider, Stripe." Decision D-19 (2026-05-06) established "dual provider, Adyen primary, Stripe fallback." Because D-19 supersedes the earlier doc, the graph proves the March document is obsolete.

**[05] Which graph database powers Helio and how is it deployed?**

> Helio runs on a property graph (Cypher query language). The entire system runs as a single deployment with synthetic seed generation, automated schema indexing, and one API entrypoint.

---

### 3.12 Footer

**Brand**

> HELIO

> Helio is an organizational knowledge graph engine built as a knowledge graph. Answering who knows what, what breaks if it dies, and where decisions were made — with complete Cypher provenance and zero hallucination.

**Contact**

> **CONTACT & INQUIRIES:**
> contact.helio.brain@gmail.com

**INTERFACES**

- Cypher Agent
- Graph Console
- Blast Radius Map
- The 4 Failure Traps

**GRAPH SCHEMA**

- HAS_DEPENDENT
- SUPERSEDES
- OWNED_BY
- ON_CALL
- CONTRIBUTED_TO

**OPEN SOURCE**

> The graph, Cypher layer and agent loop are open source. Self-host the core, or use the managed product.

> GITHUB REPOSITORY ↗

**Bottom bar**

> © 2026 HELIO. ALL RIGHTS RESERVED.
> contact.helio.brain@gmail.com

---

## 4. Cypher Agent screen

### 4.1 Telemetry banner

- HELIO CYPHER AGENT
- Helio Agent
- LIVE CLOUD API
- OFFLINE VERIFIER
- `{ping}` ms *(live latency, when available)*

**Tooltips**

- Queries the live graph backend
- Deterministic instant offline verification engine
- Refresh backend connection
- Export session proof chain JSON
- Clear transcript

### 4.2 Default transcript

**HELIO GRAPH BRAIN** — `live` — `[15:00:00]`

> ⚡ Helio Autonomous Knowledge Graph Agent initialized.
> Connected to the Helio graph engine.
> Loaded topology: 120 Persons, 20 Services, 5 Teams, 40 Decisions, 22 Dependencies.
>
> Ask any question regarding ownership, blast radius, on-call paging, or ADR provenance, or choose a verification query below.

**ENGINEER (PROMPT)** — `[15:00:15]`

> Who owns payments-gateway today, what breaks if it dies, and who gets paged?

**HELIO GRAPH BRAIN** — `live` — `(840ms)` — `[15:00:18]`

> The Platform team owns payments-gateway today. While Priya Sharma authored the original service (14 commits), ownership was formally transferred to Ravi Menon in Decision D-21 (2026-04-15, authored by Elena Vasquez).
>
> Blast radius: 8 services cascade across 3 hops (checkout-api, dispute-service, mobile-bff, config-service, notifications, webhook-relay, fraud-scoring, recommendation).
>
> ⚠️ Incident Alert: config-service has NO OWNER and NO ON-CALL engineer. Page Ravi Menon for payments-gateway.

Provenance chips: Platform · D-21 · Ravi Menon · config-service

Stale warning: Priya Sharma — Historical owner touch older than 90 days (2026-04-15) — Verified: 2026-04-15

### 4.3 Message-level UI

**Quick states**

- Streaming graph traversal evidence...
- Querying graph topology & executing multi-hop traversal...
- Transcript reset. Agent connected to the Helio Knowledge Graph engine.

**Honest-negative callout**

> **RULE 03: HONEST NEGATIVE ASSERTION**
> Verified absence of edge in the graph. The agent refused to hallucinate an owner, team, or SLA.

**Stale evidence**

> **EVIDENCE INTEGRITY WARNING:**
> [{type}] {name}: {reason}
> Verified: {date}

**Provenance trail**

> PROVENANCE TRAIL ({n} ENTITIES):
> Contract: soham.md §3

**Cypher block**

> CYPHER QUERY (OPEN CYPHER SUBSET):
> COPY CYPHER / COPIED

**Input**

> Ask Helio (e.g. 'Who owns payments-gateway today?' or 'What breaks if it dies?')...

**Limits / auth errors**

- Sign in or create a free account to keep asking the graph.
- You have reached your plan limit. Upgrade to keep asking.

### 4.4 Verification Library

**Filter labels**

- All
- Ownership
- Blast Radius
- Recency Trap
- Decisions & ADRs
- Honest Negatives
- On-Call / Parity

Each question chip is prefixed `#01:` through `#20:`.

#### 01 · Ownership
**Who owns payments-gateway today?**

> The Platform team owns payments-gateway. Decision D-21 (2026-04-15, authored by Elena Vasquez) reassigned ownership to Ravi Menon. Priya Sharma owned it previously until that handover.

#### 02 · Ownership
**Who owns ledger-core?**

> The Ledger team owns ledger-core, led by Ana Duarte. Ana has worked extensively across both payments and ledger core architecture.

#### 03 · Ownership
**Who owns fraud-scoring?**

> The Risk team owns fraud-scoring, with Diego Alvarez as the engineering owner and on-call specialist.

#### 04 · Honest Negatives
**Does every service have an owner?**

> No. Of the 20 services in the graph, 19 have a team owner, but config-service has no :OWNED_BY edge. Mei Lin contributes to it, but nobody owns it. This is a structural unowned service.

#### 05 · Blast Radius
**What breaks if payments-gateway dies?**

> If payments-gateway goes down, 8 services cascade-fail across 3 hops:
>
> • Depth 1 (Direct dependents): checkout-api, dispute-service, mobile-bff, config-service, notifications, webhook-relay
> • Depth 2: fraud-scoring (cascades from checkout-api)
> • Depth 3: recommendation (cascades from fraud-scoring)
>
> Critical vulnerability: config-service is a direct dependent with NO OWNER and NO ON-CALL rotation.

#### 06 · Blast Radius
**Which of those are owned by a different team?**

> Six dependent services are owned by teams outside Platform (the owner of payments-gateway):
>
> • Payments Team: checkout-api, mobile-bff, dispute-service
> • Growth Team: notifications, recommendation
> • Risk Team: fraud-scoring
>
> Plus config-service, which has NO team owner at all — a critical cross-organizational dependency risk.

#### 07 · Blast Radius
**Which dependent has no contributor in 90 days?**

> notifications — owned by the Growth team, exactly one hop from payments-gateway. Nobody has touched or contributed to it since 2026-05-02 (>90 days). This represents a severe single-point-of-failure bus-factor risk during an incident.

#### 08 · Expertise vs Recency
**Who has the most commits on payments-gateway?**

> Priya Sharma has the most historical commits (14 commits), but her last contribution was on 2026-04-15 and is flagged as stale (>90 days). In contrast, Ravi Menon has 5 commits with recent activity on 2026-09-01 and holds active ownership.

#### 09 · Expertise vs Recency
**Who should I ask about the payments service?**

> Ravi Menon. While Priya Sharma authored the early architecture, Ravi Menon is the current Platform Lead and active owner under Decision D-21 with recent commits in September 2026.

#### 10 · Expertise vs Recency
**Who has worked on both payments and ledger?**

> Ana Duarte. She holds cross-domain expertise across both systems: she contributed to early payments-gateway architecture and is currently the Team Lead for ledger-core.

#### 11 · Org & On-Call
**Who is on call for Ledger this week?**

> Diego Alvarez is ON_CALL this week for the Ledger rotation. Ravi Menon is also on the rotation schedule, but not on call this week.

#### 12 · Decisions & ADRs
**Where was the payments migration decided?**

> Decision D-14 ('Migrate to Single Provider Stripe', dated 2026-03-20, authored by Elena Vasquez). Note: D-14 was later superseded by Decision D-19.

#### 13 · Decisions & ADRs
**Is D-14 still the current decision?**

> No. Decision D-14 is SUPERSEDED. Decision D-19 (dated 2026-05-06, authored by Elena Vasquez) superseded D-14, establishing a dual-provider architecture: Adyen primary, Stripe fallback.

#### 14 · Decisions & ADRs
**Who holds decision authority for payments and ledger?**

> Elena Vasquez (VP of Engineering). She authored and signed off on Decisions D-14, D-19, and D-21 governing payments and ledger architecture.

#### 15 · Decisions & ADRs
**Is the provider evaluation document still accurate?**

> No. The document 'payments-provider-eval-v3.md' (dated 2026-03-18) is stale (>90 days) and was superseded by Decision D-19. Its conclusion advocating a single provider (Stripe) is no longer valid.

#### 16 · Honest Negatives
**Who owns config-service?**

> The graph contains no OWNED_BY edge for config-service. Mei Lin has contributed to it, but no team or individual is recorded as its owner. Rule 3: This is an honest absence, not missing data.

#### 17 · Honest Negatives
**What did checkout decide about pricing?**

> The graph contains no decisions whose summary mentions pricing. No pricing ADR or architectural decision exists in the graph.

#### 18 · Org & On-Call
**Which services have zero dependents?**

> Two services in the topology have zero downstream dependents: admin-bff and settlement-batch. These services can be modified, refactored, or taken offline without risk of cascade failures.

#### 19 · Honest Negatives
**What team is Aisha Khan on now?**

> Aisha Khan is no longer on any team; she departed Helio on 2026-06-30. Her previous role was on the Payments team. The graph correctly records the departure rather than an active assignment.

#### 20 · Honest Negatives
**What is the SLA for dispute-service?**

> The graph contains no contracted SLA entry for dispute-service. Unlike Tier 1 financial services which record explicit 99.99% SLAs, dispute-service has no SLA property defined in the graph.

**Unmatched-question fallback**

> Traversed the graph for "{question}". The entity has 0 conflicting ADRs and active telemetry recorded in the Helio Knowledge Graph.

Every library answer also renders its executed Cypher query, a provenance trail of entity chips, and — where applicable — a stale-evidence warning.

---

## 5. Graph Console screen

**Header**

- KNOWLEDGE GRAPH // CONSOLE
- HELIO COMPANY BRAIN TOPOLOGY
- EXPORT CYPHER GRAPH / EXPORTED CYPHER DUMP

**KPI cards**

| Label | Value | Note |
|---|---|---|
| Total Graph Nodes | 2400+ | ● 120 Persons · 20 Services · 5 Teams |
| Answer Accuracy | 100% | Grounded in verified graph edges |
| Unowned Services (Honest Negatives) | 1 | config-service (No OWNED_BY) |
| Decisions Provenance | 40 ADRs | D-19 supersedes March doc |

**Table**

- MICROSERVICES DIRECTORY (:SERVICE NODES)
- Filters: All · Platform · Ledger · Payments · Risk
- Columns: Service Name · Owning Team · Tier · On-Call Person · Blast Radius · Freshness · Graph Diagnostic

| Service | Team | Tier | On-call | Blast radius | Freshness | Diagnostic |
|---|---|---|---|---|---|---|
| payments-gateway | Platform | Tier 1 | Ravi Menon | 4 hops | Fresh (2026-09-28) | Priya Sharma (14 commits) departed. Ravi Menon active. |
| ledger-service | Ledger | Tier 1 | Diego Alvarez | 2 hops | Fresh (2026-10-14) | Diego Alvarez on-call this week (Ravi also on rotation). |
| checkout-api | Payments | Tier 1 | Mei Lin | 3 hops | Fresh (2026-10-02) | Directly cascades if payments-gateway dies. |
| config-service | UNOWNED (NULL) | Tier 2 | None | 2 hops | Stale (>120 days) | Fact 04: The failure test. No OWNED_BY edge exists in graph. |
| dispute-service | Risk | Tier 2 | Aisha Rao | 1 hop | Expiring (valid_to 2026-06-30) | SLA property missing in CSV schema. |
| fraud-engine | Risk | Tier 1 | Carlos Ruiz | 3 hops | Fresh (2026-10-11) | Dependent on payments-gateway stream. |

---

## 6. Device Preview screen

- SIMULATED VIEWPORT:
- Apple iPhone 15 Pro (390 x 844 px)
- Apple iPad Air (820 x 1180 px)
- Desktop UltraWide Display (1440 x 900 px)

**Tooltips**

- Desktop 1440px
- Tablet 820px
- Mobile 390px

---

## 7. Auth screen

**Back link**

> ← Back to site

### 7.1 Sign up

**Eyebrow:** ACCOUNT // CREATE WORKSPACE
**Headline:** GIVE YOUR TEAM A MEMORY
**Intro:**

> Create a free workspace. Every answer comes with the graph path that produced it, so a claim can be checked instead of trusted.

**Selected-plan banner:** Selected plan: `{name}` · `{price}`/mo — Clear

**Fields**

- Your name — placeholder: Ada Lovelace
- Company / workspace (optional) — placeholder: Analytical Engines
- Work email — placeholder: you@company.com
- Password (8+ characters) — placeholder: ••••••••

**Submit:** Create free account / Creating workspace…
**Switch:** Already have an account? Sign in

**Helper**

> Passwords are hashed with scrypt. Sessions are HttpOnly cookies. No card is required for the free plan.

### 7.2 Sign in

**Eyebrow:** ACCOUNT // SIGN IN
**Headline:** WELCOME BACK
**Intro:**

> Sign in to see your plan, usage and API keys. Your graph answers are metered against the same account.

**Fields**

- Work email
- Password

**Submit:** Sign in / Signing in…
**Switch:** New here? Create a free account

**Errors**

- Use at least 8 characters for your password.
- Something went wrong. Try again.

### 7.3 Value panel

**WHAT YOU GET**

- Every answer carries its graph path — nodes, edges and dates.
- Staleness is first-class: departed people and superseded docs are flagged, not buried.
- Honest negatives: when the graph has no owner, Helio says so.
- Free plan includes 50 questions a month. Upgrade only when the team adopts it.

**NO LOCK-IN**

> The core is open source. Export your data, self-host the graph, or cancel from the billing portal at any time.

> Sign in to an existing workspace →

---

## 8. Account screen

### 8.1 Loading

> LOADING ACCOUNT…

### 8.2 Signed out

> **SIGN IN REQUIRED**
> The account console shows plan, usage and API keys. Sign in or create a free workspace.
> BACK TO SITE

### 8.3 Header

> ACCOUNT // CONTROL PLANE
> **{account name}**
> Signed in as **{email}** · {role}

Actions: QUERY AGENT · SIGN OUT

### 8.4 Current plan card

- CURRENT PLAN
- {plan name} *(defaults to Free)*
- Custom pricing / No card required / `{price}` / month
- **Status:** {subscription status} *(defaults to active)*
- Ends / Renews `{date}`
- Questions this month — `{used}` / `{limit|∞}`
- `{remaining}` remaining · resets `{date}`
- Unlimited questions on this plan.
- MANAGE BILLING / OPENING…
- UPGRADE / CHANGE PLAN
- COMPARE PLANS

### 8.5 Billing card

> **BILLING**

States:

- **Stripe connected** — Mode: {mode}
- **Local billing mode** — Upgrades apply immediately for development. Set real Stripe keys before launch.
- **Checkout not configured** — This deployment has no Stripe keys. You can still use the free plan; contact us for a paid invoice.

### 8.6 Repository sync card

> **REPOSITORY SYNC**

States:

- `{owner}/{repo}` — OPEN REPOSITORY ↗
- **Not connected** — Set GITHUB_OWNER, GITHUB_REPO and GITHUB_TOKEN on the deployment to sync issues and pull requests.

### 8.7 Plan options

> PLAN OPTIONS
> **MOVE UP WHEN THE TEAM DOES**

Each card shows:

- Plan name
- RECOMMENDED *(highlighted plan)*
- `{price}`/mo
- `{credits}`
- TALK TO US *(enterprise)*
- STARTING… / DOWNGRADE / CHOOSE {PLAN NAME}

### 8.8 API keys

> API ACCESS
> **KEYS FOR THE GRAPH API**
> Professional plan and above *(insufficient plan)*

**Locked state**

> API keys let your own services ask the graph without a browser session. Upgrade to Professional to unlock them.
> UNLOCK API ACCESS

**Unlocked state**

- Input placeholder: Key name (e.g. CI, Grafana, local script)
- CREATE KEY
- **COPY THIS KEY NOW — IT IS SHOWN ONCE**
- COPY / COPIED
- Use it as `Authorization: Bearer <key>` against `POST /ask`.
- Loading keys…
- No keys yet. Create one for each service that needs access.
- `{prefix}`… · created `{date}` · last used `{date}` / never used
- REVOKE
- Example: `curl -X POST {API_URL}/ask -H "Authorization: Bearer helio_…" -H "Content-Type: application/json" -d '{"question":"Who owns ledger-core?"}'`

**Key errors**

- Could not create the key.
- Could not revoke the key.
- Revoke "{name}"? Applications using it will stop working.

**Billing errors**

- Could not start checkout.
- Could not open the billing portal.
- You are now on the {name} plan.
- Checkout session created.
- Redirecting to secure checkout…

### 8.9 Footer

> ✦ Need more seats or a dedicated graph? **Talk to us**
> VIEW PRICING →

---

## 9. Transient and accessibility text

### 9.1 Page-transition node labels

Visible briefly during the graph page transition:

- SITE
- AGENT
- CONSOLE
- ACCOUNT

### 9.2 Arrow / swipe navigation

Left and right arrow keys or horizontal swipes move between SITE → AGENT → CONSOLE → ACCOUNT. No visible copy.

### 9.3 ARIA labels

- “Split view of the Helio inspector: stale flat keyword search on the left, verified graph traversal on the right.”
- “Dependency traversal from payments-gateway: eight downstream services across three hops, with the route to reconciliation-worker highlighted.”

### 9.4 Dynamic values used throughout

`{x}`, `{y}` (cursor position) · `{ping}` · `{ms}` · `{timestamp}` · `{n}` (entity count) · `{plan}`, `{price}`, `{credits}`, `{date}`, `{email}`, `{role}`, `{used}`, `{limit}`, `{remaining}`, `{question}`, `{type}`, `{name}`, `{reason}`, `{key prefix}` · Stripe mode · subscription status.

---

*End of copy deck.*
