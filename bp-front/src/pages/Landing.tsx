import React from 'react';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { PlansGrid } from '../components/PlansGrid';
import { Head } from '../components/Head';
import { Eyebrow } from '../components/ui';
import { Hero } from '../sections/Hero';
import { AnswerFrame } from '../sections/AnswerFrame';
import { Scene } from '../sections/Scene';
import { How } from '../sections/How';
import { Trust } from '../sections/Trust';
import { Faq } from '../sections/Faq';
import { Cta } from '../sections/Cta';
import { organizationJsonLd, softwareJsonLd } from '../lib/seo';

const Landing: React.FC = () => (
  <>
    <Head
      title="Helio: know who owns it, what breaks, who to page"
      description="Helio connects repos, on-call rotations and decision records into one knowledge graph, so every answer about ownership, blast radius and history shows the path behind it."
      path="/"
      jsonLd={[organizationJsonLd, softwareJsonLd]}
    />
    <Nav />
    <main>
      <Hero />
      <AnswerFrame />
      <Scene />
      <How />

      <section id="plans" className="border-t border-line/50">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-4 max-w-2xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.02em] md:text-5xl">
            Start free. Upgrade when the graph earns it.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-fog">
            Every paid plan starts with a 14-day trial. No card until you ask for one.
          </p>
          <div className="mt-10">
            <PlansGrid />
          </div>
        </div>
      </section>

      <Trust />
      <Faq />
      <Cta />
    </main>
    <Footer />
  </>
);

export default Landing;
