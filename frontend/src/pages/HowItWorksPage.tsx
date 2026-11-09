import React from 'react';
import {
  CtaBand,
  CtaLink,
  FaqBlock,
  MarketingShell,
  PageHero,
  Prose,
  Section,
} from './MarketingChrome';

const STEPS = [
  {
    number: '01',
    title: 'Connect records',
    body: 'Import services, teams, people, dependencies, on-call rotations, decisions, and GitHub activity.',
  },
  {
    number: '02',
    title: 'Traverse relationships',
    body: 'Resolve the question using typed graph edges. Search helps locate entities; it does not invent relationships.',
    detail: 'Ownership uses OWNED_BY, impact uses HAS_DEPENDENT, history uses SUPERSEDES, and paging uses ON_CALL.',
  },
  {
    number: '03',
    title: 'Return the answer with evidence',
    body: 'Each answer includes the nodes, edges, and dates used. Recent activity and historical volume remain separate signals.',
  },
  {
    number: '04',
    title: 'Keep it checkable',
    body: 'Missing evidence is reported as missing. The trail, dates, and console make each answer easy to verify.',
  },
];

const WORKED_EXAMPLE = [
  {
    question: 'Who owns payments-gateway?',
    answer:
      'The Platform team owns it. The former payments lead has the most commits (14), but the last touch was 2026-04-15 and that person left in April. Decision D-21 (2026-04-15) named the Platform team as the accountable owner, and its on-call engineer committed on 2026-09-28. Ask the Platform rotation.',
  },
  {
    question: 'What breaks if it goes down?',
    answer:
      'Eight services sit downstream across three hops: checkout-api, dispute-service, mobile-bff, config-service, notifications, webhook-relay, fraud-scoring and recommendation. config-service has no owner and no on-call engineer recorded, so the cascade has a gap.',
  },
  {
    question: 'Why is there a second payment provider?',
    answer:
      'A March document says "single provider, Stripe." Decision D-19 (2026-05-06) established "dual provider, Adyen primary, Stripe fallback" and supersedes the earlier document. The graph shows the March doc as obsolete rather than presenting both as current.',
  },
];

const FAQS = [
  {
    question: 'Is Helio a search engine for documents?',
    answer:
      'No. Helio can point at documents, but its answers come from relationships: which team owns a service, which services depend on it, who is on call, and which decision superseded an older one. Text search is used at the leaves to resolve a name.',
  },
  {
    question: 'Does the language model answer from its own knowledge?',
    answer:
      'No. The model interprets the question and phrases the result. The facts come from the graph. If the traversal returns an empty set, the answer reports the gap.',
  },
  {
    question: 'How current is the graph?',
    answer:
      'It depends on the sources you connect. Git activity and GitHub issues update on sync. On-call rotations and decision records update when those systems change or are re-imported. Every answer shows the dates it relied on so staleness is visible.',
  },
  {
    question: 'Can we try Helio before connecting data?',
    answer:
      'Yes. You can explore the product and ask questions in the console before connecting your own sources.',
  },
];

export const HowItWorksPage: React.FC = () => (
  <MarketingShell>
    <PageHero
      eyebrow="How it works"
      title="Answers backed by graph evidence."
      lede="Helio connects the systems your team already uses, resolves questions as graph traversals, and returns each answer with its path and dates."
    >
      <CtaLink href="/agent">Try the agent</CtaLink>
      <CtaLink href="/learn/knowledge-graph-vs-rag" variant="outline">Graph vs RAG</CtaLink>
    </PageHero>

    <Section eyebrow="The loop" title="Four steps, each one checkable">
      <div className="mb-5 cad-border bg-[#f4f4ec] px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-[#282828] flex flex-wrap items-center gap-2" aria-label="Helio flow">
        <span className="text-[#e15c46] font-bold">Connect records</span>
        <span aria-hidden="true">→</span>
        <span>Resolve entities</span>
        <span aria-hidden="true">→</span>
        <span>Traverse relationships</span>
        <span aria-hidden="true">→</span>
        <span>Return answer + trail</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {STEPS.map((step) => (
          <div key={step.number} className="cad-border bg-[#f4f4ec] p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#e15c46] font-bold">
              {step.number}
            </div>
            <h3 className="mt-2 font-mono text-base md:text-lg font-bold uppercase text-[#282828]">
              {step.title}
            </h3>
            <p className="mt-3 font-mono text-xs md:text-sm text-[#5c5c56] leading-relaxed">
              {step.body}
            </p>
            {'detail' in step && step.detail ? (
              <details className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[#5c5c56]">
                <summary className="cursor-pointer text-[#e15c46]">Technical detail</summary>
                <p className="mt-2 leading-relaxed normal-case tracking-normal text-[#5c5c56]">{step.detail}</p>
              </details>
            ) : null}
          </div>
        ))}
      </div>
    </Section>

    <Section eyebrow="Example" title="Three questions, one service">
      <div className="mt-8 space-y-4 max-w-3xl">
        {WORKED_EXAMPLE.map((item, index) => (
          <details key={item.question} className="cad-border bg-[#f4f4ec] p-5" open={index === 0}>
            <summary className="cursor-pointer font-mono text-sm md:text-base font-bold text-[#282828]">
              {item.question}
            </summary>
            <p className="mt-2 font-mono text-xs md:text-sm text-[#5c5c56] leading-relaxed">{item.answer}</p>
          </details>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-4">
        <CtaLink href="/learn/who-owns-this-service" variant="outline" size="sm">
          Ownership guide
        </CtaLink>
        <CtaLink href="/learn/blast-radius-analysis" variant="outline" size="sm">
          Blast-radius guide
        </CtaLink>
      </div>
    </Section>

    <Section eyebrow="Boundaries" title="What Helio does not do">
      <Prose>
        <ul className="list-disc pl-5 space-y-2">
          <li>It does not monitor production, page an engineer or replace an incident tool. It answers who to page and what depends on what.</li>
          <li>It does not decide that a document is current just because it ranks well. A newer decision has to supersede it in the graph.</li>
          <li>It does not promise perfect answers. It promises that an answer can be checked, and that a missing edge is reported as missing.</li>
          <li>It does not require you to move every document. The graph holds relationships; the source systems stay where they are.</li>
        </ul>
      </Prose>
    </Section>

    <FaqBlock items={FAQS} title="How Helio works: common questions" id="how-it-works-faq" />

    <CtaBand
      title="Verify an answer you already know"
      body="Ask a question, open the trail, and confirm the path and dates behind the result."
    />
  </MarketingShell>
);
