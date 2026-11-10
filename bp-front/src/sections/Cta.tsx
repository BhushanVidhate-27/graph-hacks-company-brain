import React from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Button, Eyebrow } from '../components/ui';

gsap.registerPlugin(useGSAP);

export const Cta: React.FC = () => {
  const root = React.useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.from(el.querySelectorAll('[data-cta-fade]'), {
        y: 30,
        autoAlpha: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 78%',
          once: true,
        },
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-hidden border-t border-line/50">
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(50% 60% at 50% 100%, rgba(255,91,58,0.16) 0%, rgba(255,91,58,0) 70%)',
      }}
    />
    <div className="relative mx-auto w-full max-w-6xl px-5 py-24 text-center md:px-8 md:py-32">
      <Eyebrow className="justify-center" data-cta-fade>Start with 50 free questions</Eyebrow>
      <h2 data-cta-fade className="mx-auto mt-5 max-w-3xl text-balance text-[clamp(2.2rem,5vw,3.8rem)] font-semibold leading-[1.04] tracking-[-0.03em]">
        Stop guessing who owns it.
      </h2>
      <p data-cta-fade className="mx-auto mt-5 max-w-xl text-lg text-fog">
        Connect a source, ask one question, and see the path. No card, no sales call.
      </p>
      <div data-cta-fade className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link to="/auth?plan=starter">
          <Button size="lg">Start free</Button>
        </Link>
        <Link to="/pricing">
          <Button size="lg" variant="outline">
            Compare plans
          </Button>
        </Link>
      </div>
    </div>
    </section>
  );
};
