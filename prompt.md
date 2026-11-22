Build a complete frontend for **Helio**, a knowledge graph product for engineering organizations. Helio connects GitHub repos, on-call rotations, and decision records into one unified graph so every answer about ownership, blast radius, and history shows the verifiable path behind it.

## Core Product Concept

Helio is not a search tool or RAG system. It walks a structured graph of owners, services, and decisions. When there is no recorded owner, Helio says "no owner recorded" instead of inventing one. Every answer includes provenance: who owns it, what depends on it, and which decision set it that way.

Key differentiators:
- **Ownership from the graph**, not the loudest name. Derived from recent commits, on-call entries, and decision records. Stale records are flagged, not trusted.
- **Blast radius with hop counts.** Every downstream service is counted with its distance, so "what breaks" is a number you can put in an incident channel.
- **Decisions with dates.** When a doc and a decision disagree, Helio follows the decision and tells you which one it ignored.
- **Provenance on every answer.** Search returns documents. Helio returns a path.

Example interaction:
- Question: "Who owns payments-gateway?"
- Answer: "Ravi Menon owns payments-gateway right now. If it goes down, eight services break across three hops. Ownership moved on 15 Apr 2026, decided in D-21."
- Trail shown: Person (Ravi Menon, Platform rotation) -> OWNED_BY -> Service (payments-gateway, 8 dependents across 3 hops) -> DEPENDS_ON -> Decision (D-21, 15 Apr 2026, ownership moved from Priya Sharma) -> SUPERSEDES -> Decision (D-19)
- Note displayed: "Priya Sharma still has the most commits on the migration, but she left on 15 Apr 2026 -- so she is not the current answer."
- Metadata: "412 ms - 4 records read"

## Data Sources

GitHub and Slack ship as managed connectors. Linear, Notion, and CSV are imports. A webhook covers everything else. Jira is not native yet.

## Pages Required

### 1. Landing Page
Sections in order:
- **Hero**: Tagline "Know who owns it. Know what breaks. Know who to page." Subtext explaining Helio connects repos, on-call rotations and decision records into one graph. Two CTAs: "Start free" and "See pricing". Facts strip: "50 free questions / month", "No card required", "Cancel anytime". An interactive question input with example questions: "Who owns payments-gateway?", "What breaks if the ledger goes down?", "Where was the payments provider decided?". Sources strip showing: GitHub, Slack, Linear, Notion, CSV, Webhook.
- **Answer Frame**: Shows a mock answer card demonstrating provenance. Metrics: 8 dependents, 3 hops away, 1 stale owner. Three explanation points: (1) The owner, not the loudest name, (2) Blast radius with the hops, (3) Decisions with dates. Includes the full example answer trail described above.
- **Scene / One Graph**: Explains that every question is a path through the same graph. Three scroll-driven steps: Step 1 "Who owns payments-gateway?" -> "Ravi Menon, Platform rotation. Ownership moved on 15 Apr 2026, decided in D-21." Step 2 "What breaks if it goes down?" -> "Eight services break across three hops: ledger, settlement and webhook first." Step 3 "Where was that decided?" -> "D-19 on 6 May 2026 supersedes D-14. The evaluation doc still says Stripe-only." Legend: focused (accent), person (white), decision (peach), service (gray).
- **How It Works**: Three steps: (01) Connect the systems you already trust, (02) Ask in plain language, (03) Act on the trail.
- **Pricing** (inline section): Heading "Start free. Upgrade when the graph earns it." Subtext "Every paid plan starts with a 14-day trial. No card until you ask for one." Full pricing grid (see Pricing section below).
- **Trust / Promises**: Four cards: (1) "Your graph is yours" -- every account gets its own graph, no shared multi-tenant graph. Links to Privacy policy. (2) "Payments never touch us" -- Razorpay handles the card and mandate, Helio stores subscription status only. Links to Terms. (3) "Cancel and keep" -- cancel anytime, access runs to end of paid period, data stays readable. Links to Refunds. (4) "We say no" -- if the graph has no owner recorded, Helio says so instead of inventing one. Links to Ask the graph.
- **FAQ**: Six questions: How is this different from RAG? What does Helio connect to? Is my data isolated from other customers? What happens when I cancel? Do you offer refunds? Can I self-host? (Answers provided in FAQ section below.)
- **CTA**: "Stop guessing who owns it." Subtext "Connect a source, ask one question, and see the path. No card, no sales call." Two buttons: "Start free" and "Compare plans".

### 2. Pricing Page
Heading: "One graph. Four ways to pay for it." Subtext explains INR billing via Razorpay, 14-day trials, cancel anytime. Full pricing grid plus three reassurance cards: "14-day trial -- No card until you ask for one", "Cancel anytime -- Access until the end of the paid period", "7-day refund -- Email support within a week of your first charge".

### 3. Auth Page
Sign in / sign up flow. Accepts ?plan= query parameter to pre-select a plan after signup.

### 4. Account Page
Authenticated user dashboard. Manage subscription, view usage, cancel.

### 5. Agent Page
The "Ask the graph" interface. Accepts ?q= query parameter to pre-fill a question. Displays answers with full provenance trails.

### 6. Legal Pages
- Terms of Service
- Privacy Policy
- Refunds and Cancellation Policy

### 7. 404 Page

## Pricing Tiers

All prices in USD. Billed monthly. Cancel anytime.

| | Free | Starter | Professional | Enterprise |
|---|---|---|---|---|
| Price | $0 | $15/mo | $49/mo | Custom |
| Questions | 50/month | 1,000/month | 5,000/month | Unlimited |
| Seats | 1 | 3 | 10 | Unlimited |
| Graphs | 1 | 1 | Unlimited | Dedicated instance |
| API access | No | No | Yes | Yes |
| GitHub sync | No | Yes | Yes | Yes |
| Trial | -- | 14 days | 14 days | -- |
| Features | 50 questions/month, 1 knowledge graph, 1 seat, Provenance on every answer | 1,000 questions/month, 3 seats, GitHub issue and PR sync, 90-day staleness alerts, Email support | 5,000 questions/month, Unlimited graphs, 10 seats, API access and keys, Priority inference, Analytics and usage | Unlimited questions, Dedicated graph instance, SSO/RBAC, SLA-backed uptime |
| CTA | Start free | Start Starter | Start Professional | Talk to us |
| Highlighted | No | No | Yes ("Most chosen") | No |

Taglines:
- Free: "Evaluate the graph on a real company brain."
- Starter: "For one engineering team that needs answers it can defend."
- Professional: "For platform teams running many services and decisions."
- Enterprise: "A dedicated graph, SSO and an SLA."

## FAQ Answers

1. **How is this different from RAG?** RAG retrieves chunks and hopes the answer is in them. Helio walks a graph of owners, services and decisions, so it returns the path -- and says "no owner recorded" when there is none instead of inventing one.
2. **What does Helio connect to?** GitHub and Slack ship as managed connectors; Linear, Notion and CSV are imports; a webhook covers everything else. Jira is not native yet.
3. **Is my data isolated from other customers?** Yes. Every account gets its own graph. There is no shared multi-tenant graph, so one workspace can never read another workspace records.
4. **What happens when I cancel?** Your subscription keeps access until the end of the paid period, then the account drops to Free: 50 questions a month, one graph, one seat. Your data stays readable.
5. **Do you offer refunds?** If you cancel within 7 days of your first charge, email support@helio.runs-on.dev and we refund in full. Later cancellations stop the next renewal.
6. **Can I self-host?** Enterprise plans run a dedicated graph instance with SSO/RBAC and an SLA. Talk to us from the pricing page.

## Navigation

Links: Product, How it works, Pricing, Ask the graph, FAQ. Auth-aware: show "Sign in" / "Start free" when logged out, "Your account" when logged in.

## Footer

Three columns: Product (Pricing, Ask the graph, How it works, FAQ), Account (Sign in, Your account), Legal (Terms, Privacy, Refunds). Contact: support@helio.runs-on.dev. Copyright line. Billing note: "Prices in INR, billed monthly. Cancel anytime from your account."

## SEO Metadata

- Title: "Helio -- know who owns it, what breaks, who to page"
- Description: "Helio turns repos, on-call rotations and decision records into one knowledge graph, so every answer about ownership, blast radius and history shows the path behind it."
- Canonical: https://helio.runs-on.dev/
- OG image: https://helio.runs-on.dev/og/helio-home.png (1200x630)

## Technical Requirements

- React + TypeScript + Vite
- Client-side routing with lazy-loaded pages (Pricing, Auth, Account, Agent)
- Scroll-to-hash support for anchor links
- Responsive (mobile hamburger menu)
- Accessible (semantic HTML, focus management, keyboard navigation)
- No design system specified -- you have full creative freedom on visual design, layout, typography, color, animation, and component styling
