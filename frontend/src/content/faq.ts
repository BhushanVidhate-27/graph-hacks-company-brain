import type { FAQItem } from '../types';

/**
 * FAQ copy shared by the home page, /faq and the FAQPage structured data.
 * Keep questions and answers identical everywhere: JSON-LD must match what a
 * visitor can read on the page.
 */
export const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'faq1',
    question: 'Why is a graph traversal better than vector search or RAG?',
    answer:
      'Vector search checks semantic similarity between text chunks. It cannot tell that the top committer left the company six months ago, cannot compute a three-hop dependency cascade, and treats superseded documents as equally valid. Helio traverses typed organizational edges with temporal properties, and uses text search only at the leaves.',
  },
  {
    id: 'faq2',
    question: 'How does Helio avoid inventing an owner when none exists?',
    answer:
      'The agent is bounded by graph query results. If a service such as config-service has no OWNED_BY edge, the agent receives an explicit empty set and returns: "The graph contains no OWNED_BY edge. No team owns it." When the graph has no answer, Helio says so instead of filling the gap with plausible prose.',
  },
  {
    id: 'faq3',
    question: 'How is the volume-versus-recency trap resolved?',
    answer:
      'Helio keeps volume and recency as separate signals. A person with the most historical commits is not returned as the current owner if a newer handover or more recent ownership signal exists. Stale activity is flagged with dates.',
  },
  {
    id: 'faq4',
    question: 'How are conflicting decisions handled, such as Stripe versus Adyen?',
    answer:
      'Helio models architectural decisions with SUPERSEDES edges. A March document says "single provider, Stripe." Decision D-19 (2026-05-06) established "dual provider, Adyen primary, Stripe fallback." Because D-19 supersedes the earlier document, the graph shows that the March document is obsolete instead of presenting both as current.',
  },
  {
    id: 'faq5',
    question: 'What data does Helio need to answer questions?',
    answer:
      'Helio works best with services, owning teams, people, on-call rotations, dependency relationships, and decision records with dates. Source-control and issue metadata can add recency signals.',
  },
  {
    id: 'faq6',
    question: 'Does Helio train a model on our data?',
    answer:
      'No. Helio does not train models on customer data. The graph is the source of truth, and the language model is used to interpret the question and phrase the answer. You can run the graph and API in your own environment if you need the data to stay there.',
  },
  {
    id: 'faq7',
    question: 'How much does Helio cost?',
    answer:
      'The Free plan includes 50 questions per month and one seat. Starter is $15 per month with 1,000 questions and three seats. Professional is $49 per month with 5,000 questions and ten seats. Enterprise pricing is custom and includes a dedicated graph instance. Every plan includes the provenance trail.',
  },
  {
    id: 'faq8',
    question: 'Can we self-host Helio?',
    answer:
      'Yes. The repository ships a Docker setup for the graph, API and frontend, so the same system can run inside your own network. The managed plans exist for teams that would rather not operate it themselves.',
  },
];

export const HOME_FAQS = FAQ_ITEMS;
