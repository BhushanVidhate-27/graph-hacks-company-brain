import React from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow } from '../components/ui';

const PROMISES = [
  {
    title: 'Your graph is yours',
    body: 'Every account gets its own graph. No shared multi-tenant graph, so one workspace can never read another workspace’s records.',
    link: { to: '/privacy', label: 'Privacy policy' },
  },
  {
    title: 'Payments never touch us',
    body: 'Razorpay handles the card and the mandate. Helio stores a subscription status, never card details.',
    link: { to: '/terms', label: 'Terms of service' },
  },
  {
    title: 'Cancel and keep',
    body: 'Cancel from your account at any time. Paid access runs to the end of the period you paid for, and your data stays readable.',
    link: { to: '/refunds', label: 'Refunds & cancellation' },
  },
  {
    title: 'We say no',
    body: 'If the graph has no owner recorded, Helio says so instead of inventing one. A wrong owner is worse than no answer.',
    link: { to: '/agent', label: 'Ask the graph' },
  },
];

export const Trust: React.FC = () => {
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

        gsap.from(el.querySelectorAll('[data-trust-card]'), {
          y: 36,
          autoAlpha: 0,
          duration: 0.75,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 72%',
            once: true,
          },
        });
      });
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <section ref={root} className="border-t border-line/50">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <Eyebrow>What we promise</Eyebrow>
        <h2 className="mt-4 max-w-2xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.02em] md:text-5xl">
          Four things you can hold us to.
        </h2>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {PROMISES.map((promise) => (
            <div
              key={promise.title}
              data-trust-card
              className="hover-lift rounded-2xl border border-line bg-ink-soft p-6"
              style={{ opacity: 0 }}
            >
              <h3 className="text-xl font-semibold tracking-tight">{promise.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-fog">{promise.body}</p>
              <Link
                to={promise.link.to}
                className="mt-5 inline-flex items-center gap-1.5 text-sm text-paper underline decoration-accent decoration-2 underline-offset-4 transition-colors hover:text-accent"
              >
                {promise.link.label}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
