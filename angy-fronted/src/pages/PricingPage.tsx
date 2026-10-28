import React from 'react';
import { PricingSection } from '../components/PricingSection';
import {
  CtaBand,
  CtaLink,
  FaqBlock,
  MarketingShell,
  PageHero,
  Section,
} from './MarketingChrome';

const PRICING_FAQS = [
  {
    question: 'What counts as a question?',
    answer:
      'One answer from the Helio agent counts as one question. Asking a follow-up in the same thread counts as another answer. Browsing the graph console or reading the demo does not use the allowance.',
  },
  {
    question: 'What happens when we hit the monthly limit?',
    answer:
      'Questions pause until the next month or until you move to a larger plan. Helio does not charge an automatic overage fee. The account page shows usage against the limit.',
  },
  {
    question: 'Are seats really included?',
    answer:
      'Yes. Free includes one seat, Starter three, Professional ten, and Enterprise unlimited seats. A seat is a person who can sign in; there is no separate per-viewer charge for reading an answer trail.',
  },
  {
    question: 'Can we cancel or change plans?',
    answer:
      'Yes. Plans are monthly and can be changed from the billing portal. Cancelling keeps the free plan available; the paid features stop at the end of the paid period.',
  },
  {
    question: 'Is there a self-hosted option?',
    answer:
      'The repository includes a Docker setup for the graph, API and frontend, so the system can run inside your own network. Enterprise covers a dedicated graph instance and onboarding help.',
  },
];

export const PricingPage: React.FC = () => (
  <MarketingShell>
    <PageHero
      eyebrow="Pricing"
      title="Start free. Pay when the graph earns it."
      lede="Every plan includes the provenance trail, staleness flags and honest negatives. Prices are monthly in USD; annual billing saves roughly 17%."
    >
      <CtaLink href="/agent">Ask Helio</CtaLink>
      <CtaLink href="/how-it-works" variant="outline">See how it works</CtaLink>
    </PageHero>

    <PricingSection onSelectMode={() => { window.location.href = '/account'; }} />

    <Section eyebrow="What is included" title="The same evidence on every plan">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          {
            title: 'The path, not just the answer',
            body: 'Each response lists the nodes, edges and dates it used. If an edge is missing, the answer says so.',
          },
          {
            title: 'Staleness is a first-class signal',
            body: 'A commit from 2025 and a commit from last week are not treated as equal evidence. Old ownership is flagged, not hidden.',
          },
          {
            title: 'Seats are included',
            body: 'Plans include 1, 3, 10 or unlimited seats. Reviewers can read a trail without buying another seat.',
          },
        ].map((item) => (
          <div key={item.title} className="cad-border bg-[#f4f4ec] p-6">
            <h3 className="font-mono text-sm font-bold uppercase text-[#282828]">{item.title}</h3>
            <p className="mt-3 font-mono text-xs text-[#5c5c56] leading-relaxed">{item.body}</p>
          </div>
        ))}
      </div>
    </Section>

    <FaqBlock items={PRICING_FAQS} title="Pricing questions" id="pricing-faq" />

    <CtaBand
      title="Try it on the sample company"
      body="The public demo runs on a synthetic 185-node company. Ask an ownership question, then open the trail and check the answer yourself."
    />
  </MarketingShell>
);
