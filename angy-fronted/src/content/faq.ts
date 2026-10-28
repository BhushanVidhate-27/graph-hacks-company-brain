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
      'Vector search checks semantic similarity between text chunks. It cannot tell that Priya left the company six months ago, cannot compute a three-hop dependency cascade, and treats superseded documents as equally valid. Helio traverses typed organizational edges with temporal properties, and uses text search only at the leaves.',
  },
  {
    id: 'faq2',
    question: 'How does Helio avoid inventing an owner when none exists?',
    answer:
      'The agent is bounded by graph query results. If a service such as config-service has no OWNED_BY edge, the agent receives an explicit empty set and returns: "The graph contains no OWNED_BY edge. No team owns it." When the graph has no answer, Helio says so instead of filling the gap with plausible prose.',
  },
  {
    id: 'faq3',
    question: 'How is the Priya Sharma volume-versus-recency trap resolved?',
    answer:
      'Priya Sharma has 14 commits on payments-gateway, the highest in the sample company. A naive ORDER BY count DESC returns her even though she left in April 2026. Helio returns volume and recency as two separate signals: Ravi Menon touched the service most recently on 2026-09-28; Priya has the most commits, but her last touch was 2026-04-15 and is flagged stale.',
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
      'A useful graph needs services, the teams that own them, the people on those teams, on-call rotations, dependency edges between services, and decision records with dates. Git history, GitHub issues and pull requests add recency signals. The public demo uses a synthetic company of 185 nodes; it is labelled as sample data throughout the product.',
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
