import React from 'react';
import { PricingSection } from '../components/PricingSection';
import { MapleFall } from '../components/MapleFall';
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
      'Each agent answer counts as one question. Follow-ups count separately. Browsing the console does not use your allowance.',
  },
  {
    question: 'What happens at the monthly limit?',
    answer:
      'Questions pause until the next billing cycle or an upgrade. No automatic overage charges. Usage is visible in your account.',
  },
  {
    question: 'Are seats included?',
    answer:
      'Yes. Free includes 1 seat, Starter 3, Professional 10, and Enterprise unlimited.',
  },
  {
    question: 'Can I cancel or change plans?',
    answer:
      'Yes. Plans are monthly and can be changed from the billing portal. Paid features remain active until the end of the billing period after cancellation.',
  },
  {
    question: 'Can Helio be self-hosted?',
    answer:
      'Yes. Helio can run in your own environment with Docker. Enterprise includes a dedicated instance and onboarding support.',
  },
];

export const PricingPage: React.FC = () => (
  <MarketingShell>
    <div className="relative overflow-hidden">
      <MapleFall />
      <PageHero
        eyebrow="Pricing"
        title="Start free. Pay when the graph earns it."
        lede="Every plan includes the provenance trail, staleness signals, and honest negatives. Billed monthly in USD; annual billing saves ~17%."
      >
        <CtaLink href="/agent">Ask Helio</CtaLink>
        <CtaLink href="/how-it-works" variant="outline">See how it works</CtaLink>
      </PageHero>

      <PricingSection onSelectMode={() => { window.location.href = '/account'; }} />
    </div>

    <Section eyebrow="Included" title="Evidence on every plan">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          {
            title: 'The path behind every answer',
            body: 'Responses include the nodes, edges, and dates used. Missing evidence is reported explicitly.',
          },
          {
            title: 'Staleness signals',
            body: 'Fresh activity and historical signals are kept separate. Outdated ownership and records are flagged.',
          },
          {
            title: 'Seats included',
            body: 'Plans include 1, 3, 10, or unlimited seats.',
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
      title="Try Helio before you pay"
      body="Start free, ask an ownership or impact question, and inspect the trail behind the answer."
    />
  </MarketingShell>
);
