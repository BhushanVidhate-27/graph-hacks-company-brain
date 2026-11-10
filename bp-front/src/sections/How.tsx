import React from 'react';
import { Eyebrow, Reveal, Section } from '../components/ui';

const STEPS = [
  {
    step: '01',
    title: 'Connect the systems you already trust',
    body: 'GitHub and Slack connectors, Linear and Notion imports, plus CSV and a webhook for everything else. One workspace, one graph.',
  },
  {
    step: '02',
    title: 'Ask in plain language',
    body: 'Who owns payments? What breaks if the ledger goes down? Where was that decided? No query language, no schema to learn.',
  },
  {
    step: '03',
    title: 'Act on the trail',
    body: 'Copy the owner, the dependents and the decision into the incident channel. Every answer links back to the records it came from.',
  },
];

export const How: React.FC = () => (
  <Section id="how" className="border-t border-line/50">
    <Reveal>
      <Eyebrow>How it works</Eyebrow>
      <h2 className="mt-4 max-w-2xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.02em] md:text-5xl">
        From four sources to one answer.
      </h2>
    </Reveal>

    <div className="mt-12 grid gap-4 md:grid-cols-3">
      {STEPS.map((item, index) => (
        <Reveal key={item.step} delay={index * 90}>
          <div className="h-full rounded-2xl border border-line bg-ink-soft p-6">
            <span className="font-mono text-sm text-accent">{item.step}</span>
            <h3 className="mt-4 text-xl font-semibold tracking-tight">{item.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-fog">{item.body}</p>
          </div>
        </Reveal>
      ))}
    </div>

    <Reveal delay={200} className="mt-10">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line/60 pt-6 font-mono text-xs text-fog">
        <span>GitHub · Connector</span>
        <span>Slack · Connector</span>
        <span>Linear · Import</span>
        <span>Notion · Import</span>
        <span>CSV · Import</span>
        <span>Webhook · Import</span>
      </div>
    </Reveal>
  </Section>
);
