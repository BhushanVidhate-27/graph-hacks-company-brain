import React from 'react';
import { FAQ_ITEMS } from '../content/faq';
import {
  CtaBand,
  CtaLink,
  FaqBlock,
  MarketingShell,
  PageHero,
  Prose,
  Section,
} from './MarketingChrome';

export const FaqPage: React.FC = () => (
  <MarketingShell>
    <PageHero
      eyebrow="FAQ"
      title="Questions about ownership, impact and evidence."
      lede="Answers to common questions about Helio, pricing, security, and integrations."
    >
      <CtaLink href="/agent">Open the console</CtaLink>
      <CtaLink href="/security" variant="outline">Security details</CtaLink>
    </PageHero>

    <FaqBlock items={FAQ_ITEMS} title="Helio FAQ" id="faq" />

    <Section eyebrow="Go deeper" title="Read the long version">
      <Prose>
        <p>
          The FAQ is the short version. These guides walk through the same problems with a worked
          example: <a href="/learn/who-owns-this-service" className="text-[#e15c46] underline">finding a service owner</a>,{' '}
          <a href="/learn/blast-radius-analysis" className="text-[#e15c46] underline">blast-radius analysis</a>,{' '}
          <a href="/learn/knowledge-graph-vs-rag" className="text-[#e15c46] underline">graph search versus RAG</a>,{' '}
          <a href="/learn/service-ownership-on-call" className="text-[#e15c46] underline">ownership and on-call</a>, and{' '}
          <a href="/learn/stale-documentation" className="text-[#e15c46] underline">detecting stale documentation</a>.
        </p>
        <p>
          Pricing is on the <a href="/pricing" className="text-[#e15c46] underline">pricing page</a>. If you want to
          see how the graph is built, start with <a href="/how-it-works" className="text-[#e15c46] underline">how Helio works</a>.
        </p>
      </Prose>
    </Section>

    <CtaBand
      title="Still deciding?"
      body="Ask a question in the console and review the evidence trail behind the answer."
    />
  </MarketingShell>
);
