import React from 'react';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { PlansGrid } from '../components/PlansGrid';
import { Eyebrow, Reveal } from '../components/ui';
import { Hero } from '../sections/Hero';
import { Proof } from '../sections/Proof';
import { How } from '../sections/How';
import { Faq } from '../sections/Faq';
import { Cta } from '../sections/Cta';

const Landing: React.FC = () => (
  <>
    <Nav />
    <main>
      <Hero />
      <Proof />
      <How />
      <section id="plans" className="border-t border-line/50">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <Reveal>
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-4 max-w-2xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.02em] md:text-5xl">
              Start free. Upgrade when the graph earns it.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-fog">
              Every paid plan starts with a 14-day trial. No card until you ask for one.
            </p>
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <PlansGrid compact />
          </Reveal>
        </div>
      </section>
      <Faq />
      <Cta />
    </main>
    <Footer />
  </>
);

export default Landing;
