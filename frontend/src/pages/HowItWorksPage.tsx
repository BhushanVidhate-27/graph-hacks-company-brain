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
    title: 'Connect your sources',
    body: 'Helio ingests services, owning teams, people, dependency edges, on-call rotations, and decision records. GitHub metadata adds recency signals.',
  },
  {
    number: '02',
    title: 'Resolve the question as a graph traversal',
    body: 'Questions map to typed relationships: ownership (OWNED_BY), impact (HAS_DEPENDENT), history (SUPERSEDES), and paging (ON_CALL). Search is used to locate entities, not to invent relationships.',
  },
  {
    number: '03',
    title: 'Return the answer with its evidence',
    body: 'The response carries the nodes, edges and dates it used. Volume and recency are separate signals, so the person with the most commits is not automatically the owner. If an edge is missing, the answer says the graph has no record instead of filling the gap.',
  },
  {
    number: '04',
    title: 'Let a person check it',
    body: 'Every claim can be opened in the trail or the graph console. That is the difference between a plausible paragraph and an answer a team can defend during an incident or a postmortem.',
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
          </div>
        ))}
      </div>
    </Section>

    <Section eyebrow="Example" title="Three questions, one service">
      <div className="mt-8 space-y-4 max-w-3xl">
        {WORKED_EXAMPLE.map((item) => (
          <div key={item.question} className="cad-border bg-[#f4f4ec] p-5">
            <h3 className="font-mono text-sm md:text-base font-bold text-[#282828]">{item.question}</h3>
            <p className="mt-2 font-mono text-xs md:text-sm text-[#5c5c56] leading-relaxed">{item.answer}</p>
          </div>
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
