import React from 'react';
import { Eyebrow, Section } from '../components/ui';

const STEPS = [
  {
    step: '01',
    title: 'Connect the systems you already trust',
    body: 'GitHub and Slack ship as managed connectors; Linear, Notion and CSV are imports; a webhook covers everything else. One workspace, one graph.',
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

export const How: React.FC = () => {
  const root = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    import('gsap').then(({ default: gsap }) => {
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);

        gsap.from(el.querySelectorAll('[data-how-card]'), {
          y: 40,
          autoAlpha: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 75%',
            once: true,
          },
        });
      });
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <Section ref={root} id="how" className="border-t border-line/50">
      <Eyebrow>How it works</Eyebrow>
      <h2 className="mt-4 max-w-2xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.02em] md:text-5xl">
        From four sources to one answer.
      </h2>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map((item) => (
          <div key={item.step} data-how-card className="hover-lift h-full rounded-2xl border border-line bg-ink-soft p-6" style={{ opacity: 0 }}>
            <span className="font-mono text-sm text-accent">{item.step}</span>
            <h3 className="mt-4 text-xl font-semibold tracking-tight">{item.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-fog">{item.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
};
