import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { HeroBackdrop } from '../components/viz/HeroBackdrop';
import { Button, Eyebrow } from '../components/ui';

gsap.registerPlugin(useGSAP);

const LINES = [
  { text: 'Know who owns it.', accent: false },
  { text: 'Know what breaks.', accent: false },
  { text: 'Know who to page.', accent: true },
];

const FACTS = ['50 free questions / month', 'No card required', 'Cancel anytime'];

const SOURCES = ['GitHub', 'Slack', 'Linear', 'Notion', 'CSV', 'Webhook'];

const EXAMPLES = [
  'Who owns payments-gateway?',
  'What breaks if the ledger goes down?',
  'Where was the payments provider decided?',
];

export const Hero: React.FC = () => {
  const root = React.useRef<HTMLElement>(null);
  const glow = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [draft, setDraft] = React.useState('');

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const timeline = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1 } });

        timeline
          .from('[data-hero-fade="eyebrow"]', { y: 14, autoAlpha: 0, duration: 0.7 })
          .from('[data-hero-line]', { yPercent: 118, duration: 1.05, stagger: 0.08 }, '-=0.35')
          .from('[data-hero-fade="copy"]', { y: 18, autoAlpha: 0, duration: 0.8, stagger: 0.12 }, '-=0.55')
          .from('[data-hero-fade="ask"]', { y: 22, autoAlpha: 0, duration: 0.9 }, '-=0.5')
          .from('[data-hero-fade="strip"]', { autoAlpha: 0, duration: 0.9 }, '-=0.35');

        // A soft warm light that follows the pointer across the hero.
        const element = glow.current;
        const host = root.current;
        if (!element || !host) return;

        const xTo = gsap.quickTo(element, 'x', { duration: 0.7, ease: 'power3.out' });
        const yTo = gsap.quickTo(element, 'y', { duration: 0.7, ease: 'power3.out' });

        const onMove = (event: PointerEvent) => {
          const rect = host.getBoundingClientRect();
          xTo(event.clientX - rect.left);
          yTo(event.clientY - rect.top);
        };

        host.addEventListener('pointermove', onMove);
        return () => host.removeEventListener('pointermove', onMove);
      });
    },
    { scope: root },
  );

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    navigate(`/agent?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <section ref={root} className="relative flex min-h-svh flex-col overflow-hidden">
      <React.Suspense
        fallback={
          <div
            aria-hidden="true"
            className="absolute inset-0 mask-fade-b"
            style={{
              background:
                'radial-gradient(70% 50% at 74% 12%, rgba(255,91,58,0.18) 0%, rgba(255,91,58,0) 70%), #08080a',
            }}
          />
        }
      >
        <HeroBackdrop className="absolute inset-0 mask-fade-b" />
      </React.Suspense>
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 95% at 74% 8%, rgba(8,8,10,0.22) 0%, rgba(8,8,10,0.55) 55%, #08080a 98%)',
        }}
      />
      <div aria-hidden="true" className="grid-bg absolute inset-0 opacity-60" />
      <div ref={glow} aria-hidden="true" className="pointer-glow" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-12 px-5 pb-12 pt-32 md:px-8 md:pt-36">
        <div>
          <div data-hero-fade="eyebrow">
            <Eyebrow>Knowledge graph for engineering orgs</Eyebrow>
          </div>

          <h1 className="mt-6 text-balance text-[clamp(2.6rem,6.4vw,4.9rem)] font-semibold leading-[0.98] tracking-[-0.035em]">
            {LINES.map((line) => (
              <span key={line.text} className="block overflow-hidden pb-[0.08em]">
                <span data-hero-line className={`block ${line.accent ? 'text-accent' : ''}`}>
                  {line.text}
                </span>
              </span>
            ))}
          </h1>
        </div>

        <div className="grid items-end gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <p
              data-hero-fade="copy"
              className="max-w-xl text-lg leading-relaxed text-fog md:text-xl"
            >
              Helio connects repos, on-call rotations and decision records into one graph, so every
              answer about ownership, blast radius and history shows the path behind it.
            </p>

            <div data-hero-fade="copy" className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/auth?plan=starter">
                <Button size="lg">Start free</Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline">
                  See pricing
                </Button>
              </Link>
            </div>

            <div
              data-hero-fade="copy"
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-fog"
            >
              {FACTS.map((fact) => (
                <span key={fact}>{fact}</span>
              ))}
            </div>
          </div>

          <div data-hero-fade="ask" className="hidden lg:block">
            <div className="rounded-2xl border border-line bg-ink/55 p-5 backdrop-blur-md">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-fog">
                <span className="text-accent">/</span> ask the graph
              </p>
              <form
                className="mt-4 flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  ask(draft);
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Who owns payments-gateway?"
                  aria-label="Ask the graph a question"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-ink/80 px-3.5 py-3 text-[15px] text-paper placeholder:text-fog/70 focus:border-accent focus:outline-none"
                />
                <Button type="submit" disabled={!draft.trim()}>
                  Ask
                </Button>
              </form>
              <div className="mt-4 space-y-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => ask(example)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-fog transition-colors hover:bg-white/[0.04] hover:text-paper"
                  >
                    <span className="text-accent">→</span>
                    {example}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-3 text-center font-mono text-[11px] text-fog">
              No account needed for the first question.
            </p>
          </div>
        </div>
      </div>

      <div
        data-hero-fade="strip"
        className="relative border-t border-line/60 bg-ink/50 backdrop-blur-sm"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-5 py-4 font-mono text-xs uppercase tracking-[0.18em] text-fog md:px-8">
          <span className="text-accent">sources</span>
          {SOURCES.map((source) => (
            <span key={source}>{source}</span>
          ))}
        </div>
      </div>
    </section>
  );
};
