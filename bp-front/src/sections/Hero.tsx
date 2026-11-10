import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button, Eyebrow } from '../components/ui';

// The two WebGL layers are the heavy part of the hero. Loading them after the
// shell means the headline paints immediately and the visual fades in behind it.
const HeroBackdrop = React.lazy(() =>
  import('../components/viz/HeroBackdrop').then((module) => ({ default: module.HeroBackdrop })),
);
const GraphOrb = React.lazy(() =>
  import('../components/viz/GraphOrb').then((module) => ({ default: module.GraphOrb })),
);

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: 0.12 * index, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export const Hero: React.FC = () => (
  <section className="relative overflow-hidden">
    <React.Suspense
      fallback={
        <div
          aria-hidden="true"
          className="absolute inset-0 mask-fade-b"
          style={{
            background:
              'radial-gradient(60% 50% at 70% 20%, rgba(255,91,58,0.22) 0%, rgba(255,91,58,0) 70%), #08080a',
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
    <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-32 md:px-8 md:pt-40 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28">
      <div>
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
          <Eyebrow>Knowledge graph for engineering orgs</Eyebrow>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="mt-5 text-balance text-[clamp(2.6rem,6vw,4.4rem)] font-semibold leading-[1.02] tracking-[-0.03em]"
        >
          Know who owns it.
          <br />
          Know what breaks.
          <br />
          <span className="text-accent">Know who to page.</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={2}
          className="mt-6 max-w-xl text-lg leading-relaxed text-fog"
        >
          Helio connects repos, on-call rotations and decision records into one graph, so every
          answer about ownership, blast radius and history shows the path behind it.
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <Link to="/auth?plan=starter">
            <Button size="lg">Start free</Button>
          </Link>
          <Link to="/pricing">
            <Button size="lg" variant="outline">
              See pricing
            </Button>
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={4}
          className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-fog"
        >
          <span>50 free questions / month</span>
          <span>No card required</span>
          <span>Cancel anytime</span>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <div className="rounded-3xl border border-line/70 bg-ink/40 p-3 backdrop-blur-sm">
          <div className="relative h-[380px] overflow-hidden rounded-2xl md:h-[460px]">
            <React.Suspense fallback={null}>
              <GraphOrb className="absolute inset-0" />
            </React.Suspense>
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-fog">
                ownership · dependents · decisions
              </span>
              <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-fog">
                sample graph
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-ink/90 to-transparent px-4 pb-4 pt-10">
              <div>
                <p className="font-mono text-xs text-fog">payments-gateway</p>
                <p className="mt-1 text-sm font-medium text-paper">
                  8 dependents · 3 hops · Platform rotation
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-[11px] text-accent">
                D-21
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);
