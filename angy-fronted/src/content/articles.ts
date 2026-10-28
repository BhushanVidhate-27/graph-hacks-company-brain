import { OWNERSHIP_ARTICLES } from './ownership-articles';

export interface ArticleSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  /** Inline links rendered after the section's paragraphs and bullets. */
  links?: { href: string; label: string }[];
}

export interface Article {
  slug: string;
  path: string;
  eyebrow: string;
  h1: string;
  /** Direct answer, rendered as the first paragraph. */
  answer: string;
  sections: ArticleSection[];
  example: { title: string; paragraphs: string[] };
  faqs: { question: string; answer: string }[];
  related: { href: string; label: string }[];
}

const BASE_ARTICLES: Article[] = [
  {
    slug: 'who-owns-this-service',
    path: '/learn/who-owns-this-service',
    eyebrow: 'Learn · Ownership',
    h1: 'Who owns this service?',
    answer:
      'Ownership is the team accountable for a service today, not the person with the most commits. Check four things in order: the current OWNED_BY edge, the last commit date, the active on-call rotation, and the decision that last changed ownership.',
    sections: [
      {
        heading: 'Why the top committer is often the wrong answer',
        paragraphs: [
          'A commit count is a history of attention, not a statement of accountability. The person who wrote the most code may have changed teams, left the company, or handed the service over a year ago. A query ordered by commit count returns a confident, checkable-looking answer that is wrong.',
          'The sample company makes the failure concrete. Priya Sharma has 14 commits on payments-gateway, the highest count in the company. She left in April 2026. Ravi Menon committed on 2026-09-28, and Decision D-21 named him the accountable owner. The right answer is Ravi, even though the volume signal points at Priya.',
        ],
      },
      {
        heading: 'The four-signal check',
        paragraphs: [
          'A useful ownership answer combines signals instead of trusting one. Run them in this order:',
        ],
        bullets: [
          'Current ownership: the OWNED_BY edge from the service to a team, with its validity dates.',
          'Recency: the last commit or pull request touch, not the total count.',
          'On-call: who is paged now, which is a different fact from who owns the service.',
          'Decision history: the last decision that changed ownership, with a date and an author.',
        ],
      },
      {
        heading: 'When the graph has no owner',
        paragraphs: [
          'The most valuable ownership answer is sometimes "nobody". config-service in the sample graph has no OWNED_BY edge and no on-call engineer recorded. A language model asked the same question will often invent a plausible platform team. A graph query returns an empty set, and the answer can state the gap.',
          'That is not a failure of the tool. It is the difference between a system that reports the state of its records and one that produces prose that sounds like a record.',
        ],
      },
      {
        heading: 'Keeping ownership current',
        paragraphs: [
          'Ownership drifts when people change teams. The cheap fix is to make the change visible: record the handover as a decision with a date, keep the previous owner as history rather than deleting it, and flag an ownership edge that has not been verified in 90 days.',
          'A monthly review of unowned services and stale ownership edges is enough for most small companies. The goal is not a perfect org chart; it is an answer an engineer can act on at 2am.',
        ],
      },
    ],
    example: {
      title: 'Worked example: payments-gateway',
      paragraphs: [
        'Question: "Who owns payments-gateway today, and who gets paged?" The graph returns the Platform team as owner, Decision D-21 (2026-04-15) as the handover, and Ravi Menon as the active on-call. It also returns Priya Sharma with a stale flag: 14 commits, last touch 2026-04-15.',
        'The answer is checkable. Open the trail and each claim has an edge and a date. If the handover was reversed last week, the graph is wrong until the record is updated — but the date on the edge makes that visible instead of hiding it.',
      ],
    },
    faqs: [
      {
        question: 'Should ownership belong to a person or a team?',
        answer:
          'A team, with a named accountable person for escalation. Teams survive individual job changes; a person-only owner goes stale the week they leave.',
      },
      {
        question: 'How often should ownership be reviewed?',
        answer:
          'Review unowned services monthly and re-verify ownership edges every 90 days. A handover should create a dated decision immediately, not wait for the review.',
      },
      {
        question: 'What if two teams both claim a service?',
        answer:
          'Record one accountable owner and any consulted teams separately. If the conflict is real, it is a decision to make, not a graph query to average.',
      },
    ],
    related: [
      { href: '/learn/service-ownership', label: 'Service ownership: the practical guide' },
      { href: '/learn/find-service-owner', label: 'How to find a service owner' },
      { href: '/learn/service-ownership-checklist', label: 'Service ownership checklist' },
      { href: '/learn/service-ownership-on-call', label: 'Ownership and on-call tracking' },
    ],
  },
  {
    slug: 'blast-radius-analysis',
    path: '/learn/blast-radius-analysis',
    eyebrow: 'Learn · Blast radius',
    h1: 'Blast radius analysis for microservices',
    answer:
      'A blast radius is the set of services that fail or degrade when one service fails. Map it by following dependency edges in one direction, then group the results by hop depth and add the owning team and on-call engineer for every service you reach.',
    sections: [
      {
        heading: 'Direction is the first decision',
        paragraphs: [
          'A dependency graph contains two different questions. "What do I need to work?" follows dependencies upstream. "What breaks if I fail?" follows dependents downstream. Mixing the two produces a diagram that looks like a blast radius but answers neither question.',
          'For incident response, the downstream set is the useful one. If payments-gateway fails, the services that call it are affected. The services it calls are a separate dependency problem.',
        ],
      },
      {
        heading: 'Hop depth changes the response',
        paragraphs: [
          'A direct dependent fails immediately. A service two hops away may degrade or may absorb the failure with a queue. Three hops away is often a monitoring concern rather than an incident. Grouping by depth lets an on-call engineer decide where to look first instead of reading a flat list of 40 names.',
          'In the sample company, payments-gateway has eight downstream services across three hops. The direct set includes checkout-api, dispute-service, mobile-bff, config-service, notifications and webhook-relay. fraud-scoring and recommendation appear at the next hops.',
        ],
      },
      {
        heading: 'The edge with no owner',
        paragraphs: [
          'A cascade is only actionable if each node has an owner. The sample cascade contains config-service, which has no OWNED_BY edge and no on-call engineer. That is more important than the total count: one unowned service can turn a contained failure into a long incident.',
          'Blast-radius reports should carry ownership coverage as a first-class number. "Eight services, one unowned" is a better summary than "eight services".',
        ],
      },
      {
        heading: 'Keep the map honest',
        paragraphs: [
          'Dependency edges age. A service that was synchronous last quarter may be behind a queue now. Record how each edge was discovered, when it was last verified, and whether it is synchronous or asynchronous. An unverified edge is a hypothesis, and the report should say so.',
          'The cheapest validation is an incident review: compare the services that actually degraded with the set the graph predicted. Add the missing edge and correct the stale one while the details are fresh.',
        ],
      },
    ],
    example: {
      title: 'Worked example: the payments cascade',
      paragraphs: [
        'Question: "What breaks if payments-gateway goes down?" The graph returns eight services across three hops, with the owning team and on-call for each. It flags config-service as unowned and notification-worker as a two-hop dependency through checkout-api.',
        'The answer is not a list of every service in the company. It is a bounded, dated traversal that an engineer can compare with the incident channel. If the channel shows a service that is not in the set, the graph has a missing edge.',
      ],
    },
    faqs: [
      {
        question: 'How many hops should a blast radius include?',
        answer:
          'Start with three. Direct dependents are the incident; two hops are the likely degradation; three hops is usually a watch list. Include more only if the architecture has long synchronous chains.',
      },
      {
        question: 'Do asynchronous dependencies count?',
        answer:
          'Yes, but label them. A queue changes the failure mode: the consumer may lag rather than fail. The edge should record whether it is synchronous, asynchronous or batch.',
      },
      {
        question: 'What is the most useful blast-radius metric?',
        answer:
          'Ownership coverage. A small cascade with one unowned service is harder to run than a larger cascade where every service has an owner and an on-call.',
      },
    ],
    related: [
      { href: '/learn/who-owns-this-service', label: 'Who owns this service?' },
      { href: '/learn/service-ownership-on-call', label: 'Ownership and on-call tracking' },
      { href: '/agent', label: 'Try the blast-radius demo' },
    ],
  },
  {
    slug: 'knowledge-graph-vs-rag',
    path: '/learn/knowledge-graph-vs-rag',
    eyebrow: 'Learn · Graph vs RAG',
    h1: 'Engineering knowledge graph vs RAG',
    answer:
      'RAG retrieves text chunks that look similar to a question. A knowledge graph traverses typed relationships between records. Use RAG for "find the document about X" and a graph for "who owns X, what depends on it, and which decision replaced the old one".',
    sections: [
      {
        heading: 'What RAG is good at',
        paragraphs: [
          'Retrieval-augmented generation is a strong fit for unstructured text. If the answer lives in a runbook, a design document or a support thread, semantic search can find the relevant passage and a model can summarize it. The unit of retrieval is a chunk of text, and similarity is the ranking signal.',
          'That works because the question is also about text. "How do I rotate the Stripe key?" is answered by a procedure. The retriever does not need to know who owns the service or when the procedure changed.',
        ],
      },
      {
        heading: 'Where text similarity breaks',
        paragraphs: [
          'Ownership, impact and history are not similarity problems. The answer depends on a relationship and a date. Three failures show up repeatedly:',
        ],
        bullets: [
          'A departed engineer still ranks highest because their commits are the most similar to the service name.',
          'A superseded document ranks alongside the decision that replaced it, because both mention the same providers.',
          'A three-hop dependency cascade is not present in any single chunk, so retrieval cannot assemble it reliably.',
        ],
      },
      {
        heading: 'The hybrid that works',
        paragraphs: [
          'Use the graph for structure and text search at the leaves. The graph resolves the entity, follows the typed edge, and applies the date. Text search finds the document that the graph then marks as current or superseded.',
          'This is the model Helio uses. The language model interprets the question and phrases the response, but it does not choose the owner. The traversal returns the owner, or returns nothing.',
        ],
      },
      {
        heading: 'A simple decision rule',
        paragraphs: [
          'If the answer is a passage, use RAG. If the answer is a relationship, a count or a date, use a graph. If the answer needs both, retrieve the passage but resolve the entity and the date in the graph first.',
          'The rule is not anti-RAG. It is about choosing the representation that matches the question instead of forcing every question through a text index.',
        ],
      },
    ],
    example: {
      title: 'Worked example: Stripe or Adyen?',
      paragraphs: [
        'A March document says "single provider, Stripe." Decision D-19 (2026-05-06) says "dual provider, Adyen primary, Stripe fallback" and supersedes the earlier document. A text retriever returns both passages because both are about payment providers.',
        'A graph query follows the SUPERSEDES edge and returns D-19 as current, with the March document marked obsolete. The answer can still quote both, but it does not present them as equally valid.',
      ],
    },
    faqs: [
      {
        question: 'Can a knowledge graph replace a document search tool?',
        answer:
          'No. Most of the detail stays in documents. The graph resolves entities and relationships; text search finds the passage. They solve different parts of the question.',
      },
      {
        question: 'Does a graph need an LLM?',
        answer:
          'No. A graph query can answer ownership and impact without a model. The model makes the interface conversational and phrases the result; it does not replace the traversal.',
      },
      {
        question: 'Is RAG cheaper to start?',
        answer:
          'Usually, because it needs a text index rather than a maintained graph. The cost moves to accuracy: someone has to check whether the retrieved passage is still current.',
      },
    ],
    related: [
      { href: '/learn/stale-documentation', label: 'Detecting stale documentation' },
      { href: '/how-it-works', label: 'How Helio works' },
      { href: '/pricing', label: 'Helio pricing' },
    ],
  },
  {
    slug: 'service-ownership-on-call',
    path: '/learn/service-ownership-on-call',
    eyebrow: 'Learn · On-call',
    h1: 'On-call and service ownership tracking',
    answer:
      'Track ownership and on-call as two separate facts with dates. A person can be on a rotation without being the accountable owner, and an owner can be offline. The useful answer names both, then gives the escalation path.',
    sections: [
      {
        heading: 'Two questions that look like one',
        paragraphs: [
          '"Who owns this service?" and "who is on call right now?" are different. Ownership is accountability for the service over time. On-call is who will be paged in the next hour. A team lead can own a service and not be in the rotation; a rotation member can be on call for a service another team owns.',
          'When the two are collapsed into one field, the answer is wrong half the time. The owner is unavailable, or the on-call engineer is a contractor who cannot make a product decision.',
        ],
      },
      {
        heading: 'Model the rotation, not just the person',
        paragraphs: [
          'A rotation is a schedule with membership and a current slot. The active on-call is a time-bounded fact derived from that schedule. Recording only "on-call: Ravi" goes stale the moment the rotation changes.',
          'In the sample graph, rotation membership and the active weekly on-call are separate edges. The distinction is deliberate: it lets the answer say "Ravi is on call this week" rather than "Ravi is the owner forever".',
        ],
      },
      {
        heading: 'Ownership changes need a record',
        paragraphs: [
          'A handover in a chat message is not a record. Write it as a decision with a date, the previous owner, the new owner and the reason. Then the graph can show both the current state and the history without pretending the old owner never existed.',
          'This is also how you avoid the departed-engineer trap. Priya Sharma remains in the history with 14 commits. Decision D-21 marks the handover. Ravi Menon is current. Nobody has to delete Priya to make the answer correct.',
        ],
      },
      {
        heading: 'The escalation path is part of the answer',
        paragraphs: [
          'During an incident, the first name is not always enough. The answer should include the owning team, the active on-call, and the next escalation if the service is unowned or the rotation has a gap.',
          'A missing on-call edge is as important as a missing owner. config-service has neither in the sample company. The answer states that plainly, which is more useful than a plausible name.',
        ],
      },
    ],
    example: {
      title: 'Worked example: two services, two answers',
      paragraphs: [
        'payments-gateway: owned by the Platform team, active on-call Ravi Menon. dispute-service: owned by Payments, on-call Aisha Rao, with an SLA that expires on 2026-06-30. The second answer includes an expiry warning because the record has a valid_to date.',
        'Both answers carry dates. If the rotation changed this morning and the graph was not synced, the date shows the lag instead of hiding it.',
      ],
    },
    faqs: [
      {
        question: 'Should on-call be stored in the graph or the paging tool?',
        answer:
          'The paging tool remains the source of truth for paging. The graph stores a dated copy for answering questions and spotting gaps. A sync keeps the copy current.',
      },
      {
        question: 'How do we handle a service with no on-call?',
        answer:
          'Report it as a gap and provide the owning team as the fallback. Do not invent a name. The gap is the finding.',
      },
      {
        question: 'How often should rotations sync?',
        answer:
          'At least daily, and immediately after a swap. A weekly rotation with no sync can be wrong for six days out of seven.',
      },
    ],
    related: [
      { href: '/learn/service-ownership', label: 'Service ownership: the practical guide' },
      { href: '/learn/service-ownership-checklist', label: 'Service ownership checklist' },
      { href: '/learn/who-owns-this-service', label: 'Who owns this service?' },
      { href: '/integrations', label: 'Integrations' },
    ],
  },
  {
    slug: 'stale-documentation',
    path: '/learn/stale-documentation',
    eyebrow: 'Learn · Stale docs',
    h1: 'How to detect stale documentation',
    answer:
      'A document is stale when the system it describes has changed since the document was last verified. Detect it with three signals: a validity date, a supersession edge to a newer decision, and the last time the related code or configuration changed.',
    sections: [
      {
        heading: 'Last edited is not last verified',
        paragraphs: [
          'A typo fix updates the edit date without confirming the content. A document can be edited last week and still describe a provider you removed last year. The date you need is the last time someone checked the claim, not the last time the file changed.',
          'Record a verification date separately, and let it expire. Ninety days is a reasonable default for architecture notes; security procedures may need thirty.',
        ],
      },
      {
        heading: 'Supersession is a relationship',
        paragraphs: [
          'The cleanest stale signal is a newer decision that explicitly replaces an older document. D-19 supersedes the March Stripe document. The March document is not deleted; it is marked obsolete, with an edge to its replacement.',
          'This preserves history and prevents the older document from being retrieved as current. A reader who lands on it sees the replacement instead of a dead end.',
        ],
      },
      {
        heading: 'Code touch is a weak but useful signal',
        paragraphs: [
          'If the payment provider configuration changed six times since the runbook was verified, the runbook deserves a review. Code touch does not prove the document is wrong, but it is a cheap way to rank documents for review.',
          'Combine it with ownership: the team that owns the service is the team that can verify the document. An unowned service with stale docs is a double gap.',
        ],
      },
      {
        heading: 'What to do with a stale document',
        paragraphs: [
          'Do not delete it. Mark it stale, link the replacement if one exists, and assign a verification owner. A stale document with a clear warning is more useful than a 404, especially during an incident.',
          'Then close the loop. When the owner verifies it, update the verification date. The next review is scheduled from that date, not from the last typo fix.',
        ],
      },
    ],
    example: {
      title: 'Worked example: the March provider doc',
      paragraphs: [
        'A March document says "single provider, Stripe." Decision D-19 (2026-05-06) establishes "dual provider, Adyen primary, Stripe fallback." The graph returns D-19 as current and the March document as superseded, with the edge and both dates.',
        'If there were no D-19, the document would still be flagged for review because the payment configuration changed after its verification date. The warning is weaker than a supersession edge, but it still prevents silent drift.',
      ],
    },
    faqs: [
      {
        question: 'How long should a document stay verified?',
        answer:
          'Ninety days is a sensible default for architecture and ownership notes. Security and incident procedures should be reviewed more often, and any change to the related system should trigger a review.',
      },
      {
        question: 'Should stale documents be deleted?',
        answer:
          'Usually not. Mark them stale and link the replacement. Deleting removes the history and creates dead links from old tickets and postmortems.',
      },
      {
        question: 'Who should verify a document?',
        answer:
          'The team that owns the system it describes. If nobody owns the system, that is the more urgent finding.',
      },
    ],
    related: [
      { href: '/learn/knowledge-graph-vs-rag', label: 'Knowledge graph vs RAG' },
      { href: '/learn/who-owns-this-service', label: 'Who owns this service?' },
      { href: '/security', label: 'Security and data handling' },
    ],
  },
];

export const ARTICLES: Article[] = [...OWNERSHIP_ARTICLES, ...BASE_ARTICLES];

export const ARTICLE_BY_PATH = new Map(ARTICLES.map((article) => [article.path, article]));
