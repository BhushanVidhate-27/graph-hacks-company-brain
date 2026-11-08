import type { Article } from './articles';

/**
 * The service-ownership cluster.
 *
 * Four pages answer four different searches around the same topic: the broad
 * definition, the procedure for finding an owner, the checklist for keeping
 * ownership current, and the buyer's view of the tools. They link to each
 * other so a reader can move between them, while each page keeps a distinct
 * intent and title.
 */
export const OWNERSHIP_ARTICLES: Article[] = [
  {
    slug: 'service-ownership',
    path: '/learn/service-ownership',
    eyebrow: 'Learn · Ownership',
    h1: 'Service ownership: a practical guide',
    answer:
      'Service ownership is the team accountable for a service today. A useful ownership system records the team, the escalation path, the dependencies and the decisions that changed them, with dates so each answer can be checked.',
    sections: [
      {
        heading: 'Ownership is accountability, not code volume',
        paragraphs: [
          'A service owner is the team that answers for the service in production: the team that fixes it, accepts the operational risk and decides who is paged. That is different from code ownership, which describes who reviews changes in a repository. A team can own a service while another team owns most of its code, and a person can have hundreds of commits without being accountable for the service today.',
          'The distinction matters when ownership changes. A handover is a decision with a date, not a silent edit to a wiki table. Keeping the previous owner as history lets an engineer see why an answer changed instead of wondering whether the record is current.',
        ],
      },
      {
        heading: 'Four questions an ownership system must answer',
        paragraphs: [
          'An engineer usually arrives with one of four questions, and a useful system answers all of them from the same records:',
        ],
        bullets: [
          'Who owns this service today, and who is the escalation path?',
          'Who is on call now, and how is that different from ownership?',
          'What breaks if this service fails, and which of those services are unowned?',
          'Why did ownership change, and when was the current edge last verified?',
        ],
      },
      {
        heading: 'What belongs in the record',
        paragraphs: [
          'At minimum, record the service, the accountable team, a named escalation contact, the start date of the current ownership edge and the last verification date. Add the on-call rotation, the upstream and downstream dependencies, and links to the decisions that changed any of those facts.',
          'Dates are not decoration. They let a reader judge whether an answer is current and let a monthly review find edges that have gone stale. An ownership record without a date is a claim without a timestamp.',
        ],
        links: [
          { href: '/learn/who-owns-this-service', label: 'Who owns this service?' },
          { href: '/learn/find-service-owner', label: 'How to find a service owner' },
        ],
      },
      {
        heading: 'Keeping the record current',
        paragraphs: [
          'Ownership drifts when people change teams, services split, or a temporary owner becomes permanent. Review unowned services monthly, re-verify ownership edges every 90 days, and create a dated decision whenever a handover happens.',
          'The goal is not a perfect org chart. It is an answer an engineer can act on at 2am, with enough evidence to know whether to trust it.',
        ],
        links: [
          { href: '/learn/service-ownership-checklist', label: 'Service ownership checklist' },
          { href: '/learn/service-ownership-on-call', label: 'Ownership and on-call tracking' },
        ],
      },
    ],
    example: {
      title: 'Worked example: one question, four records',
      paragraphs: [
        'Question: "Who owns payments-gateway, who gets paged, what breaks if it fails, and why did the owner change?" The graph returns the Platform team as owner, the current Platform on-call as the active responder, eight downstream services across three hops, and Decision D-21 as the handover from the previous owner.',
        'Each part of the answer has a source and a date. If the handover was reversed last week, the graph is wrong until the record is updated, but the date on the edge makes that visible instead of hiding it.',
      ],
    },
    faqs: [
      {
        question: 'What is service ownership?',
        answer:
          'The team accountable for a service in production today. It includes fixing incidents, accepting operational risk and deciding who is paged. A person can be the escalation contact without being the owner.',
      },
      {
        question: 'Who owns a service when nobody claims it?',
        answer:
          'Treat it as a gap, not an answer. Assign a provisional owner, record the date and the reason, and put the service on the next ownership review. Do not let a model or a wiki page invent a team.',
      },
      {
        question: 'How is ownership different from on-call?',
        answer:
          'Ownership is long-lived accountability for the service. On-call is the person or rotation paged right now. They often overlap, but a service can have an owner with no rotation, or a rotation that includes engineers from other teams.',
      },
    ],
    related: [
      { href: '/learn/who-owns-this-service', label: 'Who owns this service?' },
      { href: '/learn/find-service-owner', label: 'How to find the owner of a microservice' },
      { href: '/learn/service-ownership-checklist', label: 'Service ownership checklist' },
      { href: '/learn/service-ownership-tools', label: 'Service ownership tools' },
    ],
  },
  {
    slug: 'find-service-owner',
    path: '/learn/find-service-owner',
    eyebrow: 'Learn · Ownership',
    h1: 'How to find the owner of a microservice',
    answer:
      'Start with the service catalog’s ownership edge, then verify it against the last code touch, the active on-call rotation and the decision that last changed ownership. The top committer is a signal, not the answer.',
    sections: [
      {
        heading: 'Start with the accountable team, not a person',
        paragraphs: [
          'The first place to look is the service catalog or ownership graph, not a repository. The catalog should name the team accountable for the service today, the date the edge started and the last time someone verified it. If the catalog names a person, treat that as an escalation contact and find the team behind it.',
          'A team survives job changes. A person-only owner goes stale the week they leave, and the record usually keeps looking authoritative until an incident proves otherwise.',
        ],
      },
      {
        heading: 'Verify the answer with three signals',
        paragraphs: [
          'A catalog entry can be wrong, so check it against signals that are harder to fake:',
        ],
        bullets: [
          'Last touch: the most recent commit or pull request on the service, not the highest commit count.',
          'On-call: the rotation that would page someone now, and whether that rotation belongs to the owning team.',
          'Decision history: the dated decision that last changed ownership, including who approved it.',
        ],
        links: [
          { href: '/learn/who-owns-this-service', label: 'The four-signal ownership check' },
        ],
      },
      {
        heading: 'A CODEOWNERS file is not an ownership record',
        paragraphs: [
          'CODEOWNERS tells a code host who should review a change. It does not say who is accountable for the running service, who is paged, or what happens when the repository is archived. It is a useful review signal and a poor answer to "who owns this?" on its own.',
          'The same applies to a team alias in a README. It can route a question, but it does not carry a date, a handover or an escalation path. Use it as a starting point, then confirm the operational owner.',
        ],
      },
      {
        heading: 'When the catalog returns nothing',
        paragraphs: [
          'The most useful answer is sometimes "no owner is recorded". That is a finding, not a failure. Name a provisional owner, record the date and the reason, and add the service to the next review. A plausible guess hides the gap; an empty result makes it actionable.',
          'If the service is critical, treat the gap as an incident waiting to happen. The provisional owner should confirm they can receive a page before the next on-call shift.',
        ],
        links: [
          { href: '/learn/service-ownership-checklist', label: 'Checklist for closing ownership gaps' },
        ],
      },
    ],
    example: {
      title: 'Worked example: payments-gateway',
      paragraphs: [
        'The catalog says the Platform team owns payments-gateway. The last commit is from the Platform on-call engineer on 2026-09-28, the active on-call rotation belongs to Platform, and Decision D-21 (2026-04-15) records the handover to Platform.',
        'A commit-count query returns the former payments lead first with 14 commits, but that last touch is 2026-04-15 and the person left in April. The evidence points to Platform; the volume signal points at someone who is no longer there. That is why the four signals are checked together.',
      ],
    },
    faqs: [
      {
        question: 'Should service ownership belong to a person or a team?',
        answer:
          'A team, with a named escalation contact. Teams survive individual job changes; a person-only owner goes stale when they leave.',
      },
      {
        question: 'Where should the ownership record live?',
        answer:
          'In a service catalog or graph that carries dates and relationships, not only in a wiki page or a README. The record should be queryable and link to the decisions that changed it.',
      },
      {
        question: 'What if two teams both claim the service?',
        answer:
          'Record one accountable owner and any consulted teams separately. A real conflict is a decision to make, not a graph query to average.',
      },
    ],
    related: [
      { href: '/learn/service-ownership', label: 'Service ownership: the practical guide' },
      { href: '/learn/who-owns-this-service', label: 'Who owns this service?' },
      { href: '/learn/service-ownership-on-call', label: 'Ownership and on-call tracking' },
      { href: '/learn/service-ownership-tools', label: 'Service ownership tools' },
    ],
  },
  {
    slug: 'service-ownership-checklist',
    path: '/learn/service-ownership-checklist',
    eyebrow: 'Learn · Ownership',
    h1: 'Service ownership checklist',
    answer:
      'A service is owned only when four things are true: a current team is named, an escalation path is active, the last handover is a dated decision, and the record is reviewed on a schedule.',
    sections: [
      {
        heading: 'The four non-negotiables',
        paragraphs: [
          'Most ownership programs fail because they stop at a name in a table. A name is necessary but not sufficient. Use these four checks for every service:',
        ],
        bullets: [
          'A current team is named as accountable, with a start date for the edge.',
          'An escalation path exists: a person or rotation that can be paged today.',
          'The last handover is a dated decision, not a silent edit.',
          'The record has a verification date and a review cadence.',
        ],
      },
      {
        heading: 'The monthly review',
        paragraphs: [
          'A short monthly review catches the drift that a quarterly audit misses. Filter for four things: services with no owner, ownership edges not verified in 90 days, services whose on-call rotation points at a different team, and owners who have left the company.',
          'Keep the output small. A list of ten services with a named provisional owner and a review date is more useful than a 60-page report that nobody reads.',
        ],
      },
      {
        heading: 'What a complete record contains',
        paragraphs: [
          'For each service, record the accountable team, an escalation contact, the start date of the current edge, the last verification date, the on-call rotation and the dependencies that matter for impact. Link the decisions that changed ownership, and keep the previous owner as history.',
          'This is enough to answer who owns it, who is paged, what breaks and why it changed without opening five tools. More fields are fine if they are maintained; a field nobody updates is worse than no field at all.',
        ],
        links: [
          { href: '/learn/find-service-owner', label: 'How to find a service owner' },
          { href: '/learn/service-ownership', label: 'Service ownership guide' },
        ],
      },
      {
        heading: 'Common failure modes',
        paragraphs: [
          'The same four failures show up in most companies: the owner is a team alias that nobody monitors, the record lives only in a README, CODEOWNERS is treated as operational ownership, and handovers overwrite history instead of adding a dated edge.',
          'Each failure has the same cure: make the record queryable, dated and linked to a decision. The point is not process for its own sake. It is that an engineer can check the answer instead of trusting a stale page.',
        ],
      },
    ],
    example: {
      title: 'Worked example: the quarterly review',
      paragraphs: [
        'The review finds config-service with no OWNED_BY edge and no on-call engineer, payments-gateway with a current Platform owner and a verified on-call, and a service whose owner left two months ago. The first and third go on the action list; the second is marked verified with today’s date.',
        'Two weeks later the list is empty except for the provisional owner on config-service. The measure is not how many fields the catalog has; it is how many services would give an engineer a dead end today.',
      ],
    },
    faqs: [
      {
        question: 'How often should service ownership be reviewed?',
        answer:
          'Review unowned services monthly and re-verify ownership edges every 90 days. A handover should create a dated decision immediately, not wait for the review.',
      },
      {
        question: 'Does every service need an on-call rotation?',
        answer:
          'No, but every service needs an escalation path. A low-risk internal tool can point at the owning team during business hours; a payment path needs a rotation that can be paged at 2am.',
      },
      {
        question: 'What is ownership coverage?',
        answer:
          'The share of services with a current owner, an active escalation path and a verified ownership edge. Report it with the list of exceptions, not as a single percentage.',
      },
    ],
    related: [
      { href: '/learn/service-ownership', label: 'Service ownership: the practical guide' },
      { href: '/learn/find-service-owner', label: 'How to find the owner of a microservice' },
      { href: '/learn/who-owns-this-service', label: 'Who owns this service?' },
      { href: '/learn/service-ownership-tools', label: 'Service ownership tools' },
    ],
  },
  {
    slug: 'service-ownership-tools',
    path: '/learn/service-ownership-tools',
    eyebrow: 'Learn · Ownership',
    h1: 'Service ownership tools: what to look for',
    answer:
      'The right tool records ownership as a dated relationship, not a text field. Look for a service catalog, dependency edges, on-call integration, decision history and an API that returns the path behind each answer.',
    sections: [
      {
        heading: 'A text field is not an ownership system',
        paragraphs: [
          'A wiki table with an "owner" column looks like an ownership system until someone changes teams. It has no dates, no relationships and no way to answer what breaks when the service fails. The first question in a demo should be "what happens when this field is wrong?"',
          'An ownership system needs to represent the service, the team, the on-call rotation, the dependencies and the decisions as separate records that link to each other. That is what makes the answer checkable.',
        ],
      },
      {
        heading: 'Five capabilities that matter',
        paragraphs: [
          'Most catalogs claim to solve ownership. These are the capabilities that separate a useful record from a prettier spreadsheet:',
        ],
        bullets: [
          'A service catalog with a current owner and a start date for the edge.',
          'Dependency edges, including direction and whether the call is synchronous or asynchronous.',
          'On-call integration, so ownership and the current pager are different facts but visible together.',
          'Decision history, so a handover has an author, a date and a reason.',
          'An API that returns the records behind an answer, not just a generated sentence.',
        ],
        links: [
          { href: '/learn/service-ownership-checklist', label: 'The ownership checklist' },
        ],
      },
      {
        heading: 'Build versus buy',
        paragraphs: [
          'A small team can start with a service catalog it already has: import the services, add the owner and the on-call rotation, and record the first handover as a decision. The hard part is not the schema; it is keeping the edges current.',
          'Buy or build should depend on whether you need graph traversal. If the question is only "who owns this service?", a catalog with dates may be enough. If the question is "what breaks if this fails, and who owns every service in the path?", relationships are the product, not a nice-to-have.',
        ],
      },
      {
        heading: 'Demo questions that expose weak tools',
        paragraphs: [
          'Ask the vendor to show an unowned service. A tool that invents an owner or shows a blank page has not solved the problem. Ask how a handover is recorded, what happens to the previous owner, and how a stale dependency edge is flagged.',
          'Finally, ask for the evidence behind one answer. If the tool can show the edge, the date and the decision, it can be audited. If it can only produce a confident paragraph, it is a search box with better typography.',
        ],
        links: [
          { href: '/learn/knowledge-graph-vs-rag', label: 'Knowledge graph vs RAG' },
        ],
      },
    ],
    example: {
      title: 'Worked example: three tools, one question',
      paragraphs: [
        'A wiki table returns "Platform" with no date. A service catalog returns the Platform team and an on-call rotation, but cannot show what depends on payments-gateway. A graph returns the owner, the on-call, eight downstream services and Decision D-21 in one traversal.',
        'The difference is not the interface. It is whether the answer carries the relationships and dates needed to check it. The graph can also return config-service as unowned, which is the finding that changes the incident plan.',
      ],
    },
    faqs: [
      {
        question: 'Do we need a graph database for service ownership?',
        answer:
          'Not necessarily. You need relationships and dates. A relational schema can model them; a graph is a good fit when the main questions are multi-hop dependency and ownership paths.',
      },
      {
        question: 'Can we start with our existing service catalog?',
        answer:
          'Yes. Import the services and owners, add the missing on-call and dependency edges, and record handovers as dated decisions. The catalog is a source, not the whole system.',
      },
      {
        question: 'What is the main buying criterion?',
        answer:
          'Whether the tool can say "no owner is recorded" honestly and show the evidence for every answer. A tool that always produces a plausible answer is unsafe for incident response.',
      },
    ],
    related: [
      { href: '/learn/service-ownership', label: 'Service ownership: the practical guide' },
      { href: '/learn/service-ownership-checklist', label: 'Service ownership checklist' },
      { href: '/learn/find-service-owner', label: 'How to find the owner of a microservice' },
      { href: '/pricing', label: 'Helio pricing' },
    ],
  },
];
