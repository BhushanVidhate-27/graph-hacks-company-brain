import React from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LensCard } from '../components/viz/LensCard';
import { Eyebrow } from '../components/ui';

gsap.registerPlugin(useGSAP, ScrollTrigger);

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

export const AnswerFrame: React.FC = () => {
  const root = React.useRef<HTMLDivElement>(null);
  const counter = React.useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const element = counter.current;
      if (!element) return;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const state = { value: 0 };
        gsap.to(state, {
          value: 8,
          duration: 1.1,
          ease: 'power2.out',
          onUpdate: () => {
            element.textContent = String(Math.round(state.value));
          },
          scrollTrigger: {
            trigger: root.current,
            start: 'top 78%',
            once: true,
          },
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="border-t border-line/50">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <Eyebrow>Provenance on every answer</Eyebrow>
          <h2 className="mt-4 text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.02em] md:text-5xl">
            An answer is only useful if you can defend it.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-fog">
            Search returns documents. Helio returns a path: who owns it, what depends on it, and
            which decision set it that way.
          </p>

          <dl className="mt-8 grid grid-cols-3 gap-4 border-y border-line/70 py-5">
            {[
              { value: '8', label: 'dependents', isCounter: true },
              { value: '3', label: 'hops away' },
              { value: '1', label: 'stale owner' },
            ].map((metric) => (
              <div key={metric.label}>
                <dt className="sr-only">{metric.label}</dt>
                <dd>
                  <span
                    ref={metric.isCounter ? counter : undefined}
                    className="block text-3xl font-semibold tracking-tight"
                  >
                    {metric.isCounter ? '8' : metric.value}
                  </span>
                  <span className="mt-1 block text-xs text-fog">{metric.label}</span>
                </dd>
              </div>
            ))}
          </dl>

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
        </div>

        <div className="lg:pt-4">
          <LensCard hint="drag the lens">
            <div className="flex flex-wrap items-center gap-2 pr-28 font-mono text-xs uppercase tracking-[0.16em] text-fog">
              <span className="text-accent">/ask</span>
              <span>who owns payments-gateway?</span>
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
                    <p className="mt-1 text-sm font-medium text-paper">{item.name}</p>
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

            <p className="mt-4 font-mono text-[11px] text-fog">412 ms · 4 records read</p>
          </LensCard>
        </div>
      </div>
    </section>
  );
};
