import React from 'react';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { PlansGrid } from '../components/PlansGrid';
import { Eyebrow, Reveal } from '../components/ui';

const PricingPage: React.FC = () => (
  <>
    <Nav />
    <main>
      <section className="mx-auto w-full max-w-6xl px-5 pb-16 pt-32 md:px-8 md:pt-40">
        <Reveal>
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-balance text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[1.03] tracking-[-0.03em]">
            One graph. Four ways to pay for it.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fog">
            Prices in INR, billed monthly through Razorpay. Every paid plan starts with a 14-day
            trial, and you can cancel from your account at any time — access runs to the end of
            the paid period.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-24 md:px-8">
        <PlansGrid />
        <Reveal delay={150}>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['14-day trial', 'No card until you ask for one.'],
              ['Cancel anytime', 'Access until the end of the paid period.'],
              ['7-day refund', 'Email support within a week of your first charge.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-line/70 bg-ink-soft p-4">
                <p className="font-medium tracking-tight">{title}</p>
                <p className="mt-1 text-sm text-fog">{body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>
    </main>
    <Footer />
  </>
);

export default PricingPage;
