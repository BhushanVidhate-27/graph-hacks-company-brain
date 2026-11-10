import React from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SCENE_STEPS } from '../components/viz/sceneData';
import { Eyebrow } from '../components/ui';
import { useReducedMotion } from '../lib/utils';

gsap.registerPlugin(useGSAP, ScrollTrigger);

// The 3D engine only loads when the scene scrolls into view.
const SceneCanvas = React.lazy(() =>
  import('../components/viz/SceneGraph').then((module) => ({ default: module.SceneCanvas })),
);

export const Scene: React.FC = () => {
  const root = React.useRef<HTMLElement>(null);
  const blocks = React.useRef<Array<HTMLDivElement | null>>([]);
  const reduced = useReducedMotion();

  // GSAP writes straight into this object; the render loop reads it every
  // frame. No React state, so scrolling never triggers a re-render.
  const sceneState = React.useRef({ rotation: 0.4, step: 0 });

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.6,
          },
        });

        timeline.to(sceneState.current, { rotation: Math.PI * 1.15, ease: 'none', duration: 3 }, 0);
        timeline.to(sceneState.current, { step: 1, ease: 'none', duration: 1 }, 1);
        timeline.to(sceneState.current, { step: 2, ease: 'none', duration: 1 }, 2);
        timeline.to('[data-scene-progress]', { scaleX: 1, ease: 'none', duration: 3 }, 0);

        for (let index = 1; index < SCENE_STEPS.length; index += 1) {
          const incoming = blocks.current[index];
          const outgoing = blocks.current[index - 1];
          if (!incoming || !outgoing) continue;
          timeline
            .to(incoming, { autoAlpha: 1, y: 0, duration: 0.35 }, index)
            .to(outgoing, { autoAlpha: 0, y: -18, duration: 0.35 }, index);
        }
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className={`relative border-t border-line/50 ${reduced ? '' : 'h-[280vh]'}`}
    >
      <div
        className={`grid items-center gap-10 px-5 py-24 md:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 ${
          reduced ? '' : 'sticky top-0 h-screen'
        }`}
      >
        <div>
          <Eyebrow>One graph</Eyebrow>
          <h2 className="mt-4 text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.02em] md:text-5xl">
            Every question is a path through the same graph.
          </h2>

          <div className="relative mt-10 h-[210px]">
            {SCENE_STEPS.map((step, index) => (
              <div
                key={step.question}
                ref={(element) => {
                  blocks.current[index] = element;
                }}
                className="absolute inset-0"
                style={
                  index === 0 || reduced
                    ? undefined
                    : { opacity: 0, transform: 'translateY(16px)' }
                }
              >
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
                  question {index + 1}
                </p>
                <p className="mt-3 text-2xl font-medium tracking-tight md:text-3xl">
                  {step.question}
                </p>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-fog">{step.answer}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 h-px w-full max-w-sm bg-line">
            <div data-scene-progress className="h-px w-full origin-left scale-x-0 bg-accent" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-fog">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              focused
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-paper" />
              person
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#f0b58f]" />
              decision
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#4a4a55]" />
              service
            </span>
          </div>
        </div>

        <div className="relative h-[320px] overflow-hidden rounded-2xl border border-line/70 bg-ink-soft/60 md:h-[480px]">
          <React.Suspense fallback={null}>
            <SceneCanvas state={sceneState} />
          </React.Suspense>
        </div>
      </div>
    </section>
  );
};
