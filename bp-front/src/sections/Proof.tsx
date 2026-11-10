import React from 'react';
import { LensCard } from '../components/viz/LensCard';
import { Eyebrow, Reveal, Section } from '../components/ui';

const TRAIL = [
  {
    type: 'Person',
    name: 'Ravi Menon',
    detail: 'Current owner of payments-gateway · Platform rotation',
    edge: 'OWNED_BY',
  },
  {
    type: 'Service',
    name: 'payments-gateway',
    detail: '8 dependents across 3 hops',
    edge: 'DEPENDS_ON',
  },
  {
    type: 'Decision',
    name: 'D-21',
    detail: '15 Apr 2026 · ownership moved from Priya Sharma',
    edge: 'SUPERSEDES',
  },
];

const POINTS = [
  {
    title: 'The owner, not the loudest name',
    body: 'Ownership comes from the graph: recent commits, on-call entries and decision records, with stale records flagged instead of trusted.',
  },
  {
    title: 'Blast radius with the hops',
    body: 'Every downstream service is counted with its hop distance, so "what breaks" is a number you can put in an incident channel.',
  },
  {
    title: 'Decisions with dates',
    body: 'When a doc and a decision disagree, Helio follows the decision and tells you which one it ignored.',
  },
];

export const Proof: React.FC = () => (
  <Section id="product" className="border-t border-line/50">
    <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
      <Reveal>
        <Eyebrow>Provenance on every answer</Eyebrow>
        <h2 className="mt-4 text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.02em] md:text-5xl">
          An answer is only useful if you can defend it.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-fog">
          Search returns documents. Helio returns a path: who owns it, what depends on it, and
          which decision set it that way.
        </p>
        <div className="mt-8 space-y-6">
          {POINTS.map((point, index) => (
            <div key={point.title} className="flex gap-4">
              <span className="mt-1 font-mono text-xs text-accent">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="font-semibold tracking-tight">{point.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-fog">{point.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={120} className="lg:pt-16">
        <LensCard>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-fog">
              Example answer · demo workspace
            </span>
            <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-fog">
              412 ms
            </span>
          </div>

          <p className="mt-5 text-xl font-medium leading-snug tracking-tight">
            Ravi Menon owns payments-gateway right now. If it goes down, eight services break
            across three hops. Ownership moved on 15 Apr 2026, decided in D-21.
          </p>

          <div className="mt-6 space-y-3">
            {TRAIL.map((item) => (
              <div
                key={item.name}
                className="flex items-start justify-between gap-3 rounded-xl border border-line/70 bg-ink/60 px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                    {item.type}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-paper">{item.name}</p>
                  <p className="mt-0.5 text-xs text-fog">{item.detail}</p>
                </div>
                <span className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-fog">
                  {item.edge}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-4 rounded-lg border border-line/70 bg-ink/40 px-3 py-2.5 text-xs leading-relaxed text-fog">
            Priya Sharma still has the most commits on the migration, but she left on 15 Apr 2026 —
            so she is not the current answer.
          </p>
        </LensCard>
      </Reveal>
    </div>
  </Section>
);
