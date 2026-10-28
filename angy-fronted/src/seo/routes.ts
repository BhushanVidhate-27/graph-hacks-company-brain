import { SITE_URL, absoluteUrl, type RouteSeo } from './site';

const LAST_MODIFIED = '2026-10-28';

const route = (data: Omit<RouteSeo, 'lastmod'>): RouteSeo => ({
  ...data,
  lastmod: LAST_MODIFIED,
});

/**
 * Every indexable marketing route. The prerender script writes one HTML file
 * per entry and generates sitemap.xml from this list. App routes are defined
 * separately in src/seo/appRoutes.ts and are never listed here.
 */
export const MARKETING_ROUTES: RouteSeo[] = [
  route({
    path: '/',
    title: 'Helio: Service Ownership & Blast Radius Knowledge Graph',
    description:
      'Helio connects repos, on-call schedules and decision records into one graph, so every answer about ownership, blast radius and history shows the path behind it.',
    eyebrow: 'Company brain',
    ogImage: '/og/helio-home.png',
    priority: 1,
    changeFrequency: 'weekly',
  }),
  route({
    path: '/pricing',
    title: 'Helio Pricing: Free, Starter, Professional, Enterprise',
    description:
      'Start free, then $15/month for one team or $49/month for platform teams. Seats, question limits and the provenance trail are included on every plan.',
    eyebrow: 'Pricing',
    ogImage: '/og/helio-pricing.png',
    priority: 0.9,
    changeFrequency: 'monthly',
  }),
  route({
    path: '/how-it-works',
    title: 'How Helio Works: Graph Traversal for Engineering Teams',
    description:
      'See how Helio turns services, people, decisions and on-call schedules into a graph, then answers ownership and blast-radius questions with a verifiable path.',
    eyebrow: 'How it works',
    ogImage: '/og/helio-how-it-works.png',
    priority: 0.8,
    changeFrequency: 'monthly',
  }),
  route({
    path: '/security',
    title: 'Helio Security: Read-Only Access and Self-Hosting Options',
    description:
      'How Helio handles access, data and deployment: read-only repository sync, bounded graph answers, a self-hostable core and self-hosting options.',
    eyebrow: 'Security',
    ogImage: '/og/helio-security.png',
    priority: 0.7,
    changeFrequency: 'monthly',
  }),
  route({
    path: '/faq',
    title: 'Helio FAQ: Ownership, Blast Radius and Graph Search',
    description:
      'Answers to common questions about Helio: ownership, blast radius, on-call, graph search versus RAG, pricing and what happens when the graph has no answer.',
    eyebrow: 'FAQ',
    ogImage: '/og/helio-faq.png',
    priority: 0.7,
    changeFrequency: 'monthly',
  }),
  route({
    path: '/integrations',
    title: 'Helio Integrations: GitHub, On-Call and Decision Records',
    description:
      'Connect GitHub issues and pull requests, load on-call rotations and decision records, and query the same graph through the read-only Helio API.',
    eyebrow: 'Integrations',
    ogImage: '/og/helio-integrations.png',
    priority: 0.7,
    changeFrequency: 'monthly',
  }),
  route({
    path: '/learn',
    title: 'Helio Learn: Engineering Ownership and Dependency Guides',
    description:
      'Practical guides for engineering teams on service ownership, blast-radius analysis, on-call tracking, stale documentation and knowledge graphs versus RAG.',
    eyebrow: 'Learn',
    ogImage: '/og/helio-learn.png',
    priority: 0.6,
    changeFrequency: 'weekly',
  }),
  route({
    path: '/learn/who-owns-this-service',
    title: 'Who Owns This Service? A Practical Ownership Check',
    description:
      'A repeatable way to find who owns a service today: check the graph, the last commit, the on-call rotation and the decision record that changed ownership.',
    eyebrow: 'Learn · Ownership',
    ogImage: '/og/helio-who-owns-this-service.png',
    priority: 0.6,
    changeFrequency: 'monthly',
  }),
  route({
    path: '/learn/blast-radius-analysis',
    title: 'Blast Radius Analysis for Microservices: A Practical Guide',
    description:
      'How to map what breaks when a service fails: dependency direction, hop depth, shared infrastructure and the on-call owner for each downstream service.',
    eyebrow: 'Learn · Blast radius',
    ogImage: '/og/helio-blast-radius.png',
    priority: 0.6,
    changeFrequency: 'monthly',
  }),
  route({
    path: '/learn/knowledge-graph-vs-rag',
    title: 'Engineering Knowledge Graph vs RAG: Key Differences',
    description:
      'RAG retrieves similar text; a knowledge graph traverses typed relationships. Here is when each one gives a trustworthy answer about ownership and impact.',
    eyebrow: 'Learn · Graph vs RAG',
    ogImage: '/og/helio-graph-vs-rag.png',
    priority: 0.6,
    changeFrequency: 'monthly',
  }),
  route({
    path: '/learn/service-ownership-on-call',
    title: 'On-Call and Service Ownership Tracking That Stays Current',
    description:
      'Ownership drifts when people change teams. A practical model for keeping service owners, rotations and escalation paths current without another spreadsheet.',
    eyebrow: 'Learn · On-call',
    ogImage: '/og/helio-on-call.png',
    priority: 0.6,
    changeFrequency: 'monthly',
  }),
  route({
    path: '/learn/stale-documentation',
    title: 'How to Detect Stale Documentation in Engineering Teams',
    description:
      'Stale docs look identical to current ones. Use timestamps, supersession edges and last-touched code to flag documentation that no longer matches reality.',
    eyebrow: 'Learn · Stale docs',
    ogImage: '/og/helio-stale-docs.png',
    priority: 0.6,
    changeFrequency: 'monthly',
  }),
];

export const ROUTES_BY_PATH = new Map(MARKETING_ROUTES.map((item) => [item.path, item]));

export const SITEMAP_PATHS = MARKETING_ROUTES.filter((item) => item.path !== '/');

export const canonicalFor = (path: string) => absoluteUrl(path);

export const ogImageUrl = (image: string) => `${SITE_URL}${image}`;
