import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { HeronButton } from './HeronButton';
import { CadCrosshair } from './CadCrosshair';
import { Reveal } from './motion/Reveal';
import { Check, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import {
  ApiError,
  api,
  formatPrice,
  type BillingSetup,
  type Plan,
} from '../lib/api';
import { ViewMode } from '../types';

interface PricingSectionProps {
  onSelectMode: (mode: ViewMode) => void;
}

/**
 * Local fallback mirrors app/plans.py. The live catalog is fetched from
 * GET /api/plans; the fallback exists so the marketing page still renders its
 * prices if the API is down cold. It is not the source of truth: a price change
 * belongs in the Python catalog.
 */
const FALLBACK_PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Evaluate the graph on a real company brain, no card required.',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'usd',
    credits: '50 questions / month',
    cta: 'Start free',
    highlighted: false,
    limits: {
      questions_per_month: 50,
      seats: 1,
      graphs: 1,
      api_access: false,
      github_sync: false,
      analytics: false,
      priority_inference: false,
    },
    features: [
      '50 questions / month',
      '1 knowledge graph',
      '1 seat',
      'Provenance trail on every answer',
      'Cypher-verified answers',
      'Community support',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For one engineering team that needs answers it can defend.',
    price_monthly: 15,
    price_yearly: 150,
    currency: 'usd',
    credits: '1,000 questions / month',
    cta: 'Start Starter',
    highlighted: false,
    limits: {
      questions_per_month: 1000,
      seats: 3,
      graphs: 1,
      api_access: false,
      github_sync: true,
      analytics: false,
      priority_inference: false,
    },
    features: [
      '1,000 questions / month',
      '1 knowledge graph',
      '3 seats',
      'GitHub issue & PR sync',
      '90-day staleness alerts',
      'Email support',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'For platform teams running multiple services and decisions.',
    price_monthly: 49,
    price_yearly: 490,
    currency: 'usd',
    credits: '5,000 questions / month',
    cta: 'Start Professional',
    highlighted: true,
    limits: {
      questions_per_month: 5000,
      seats: 10,
      graphs: null,
      api_access: true,
      github_sync: true,
      analytics: true,
      priority_inference: true,
    },
    features: [
      '5,000 questions / month',
      'Unlimited knowledge graphs',
      '10 seats',
      'API access & keys',
      'Priority inference',
      'Analytics & usage dashboard',
      'Slack support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For security-sensitive organisations with their own graph.',
    price_monthly: null,
    price_yearly: null,
    currency: 'usd',
    credits: 'Custom volume',
    cta: 'Talk to us',
    highlighted: false,
    limits: {
      questions_per_month: null,
      seats: null,
      graphs: null,
      api_access: true,
      github_sync: true,
      analytics: true,
      priority_inference: true,
    },
    features: [
      'Unlimited questions',
      'Unlimited graphs & seats',
      'Dedicated graph instance',
      'SSO / RBAC',
      'SLA-backed uptime',
      'White-glove onboarding',
    ],
  },
];

export const PricingSection: React.FC<PricingSectionProps> = ({ onSelectMode }) => {
  const { me, openAuth, checkout } = useAuth();
  const [catalog, setCatalog] = useState<Plan[]>(FALLBACK_PLANS);
  const [billing, setBilling] = useState<BillingSetup | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.plans
      .list()
      .then((data) => {
        if (cancelled) return;
        if (data.plans?.length) setCatalog(data.plans);
        setBilling(data.billing);
      })
      .catch(() => {
        /* fallback catalog keeps the section usable */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const plans = useMemo(
    () => (me?.plans?.length ? me.plans : catalog),
    [me?.plans, catalog],
  );
  const currentPlanId = me?.authenticated ? me?.plan?.id : undefined;
  const checkoutConfigured = Boolean(billing?.configured || billing?.local_billing);

  const handleSelect = async (target: Plan) => {
    setError(null);
    setNotice(null);

    if (target.id === 'enterprise') {
      window.location.href =
        'mailto:contact.helio.brain@gmail.com?subject=Helio%20Enterprise%20enquiry';
      return;
    }

    if (!me?.authenticated) {
      openAuth('signup', target.id);
      return;
    }

    if (target.id === currentPlanId || target.id === 'free') {
      onSelectMode('account');
      return;
    }

    if (billing && !checkoutConfigured) {
      setNotice('Paid plans are invoiced by email right now — opening your mail app.');
      window.location.href =
        `mailto:contact.helio.brain@gmail.com?subject=Helio%20${encodeURIComponent(target.name)}%20plan`;
      return;
    }

    setBusy(target.id);
    try {
      const result = await checkout(target.id);
      if (result.upgraded) {
        setNotice(result.message || `You are now on the ${target.name} plan.`);
      } else if (result.url) {
        setNotice('Redirecting to secure checkout…');
      } else {
        setNotice(result.message || 'Checkout session created.');
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not start checkout.',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      id="pricing-section"
      className="relative w-full py-16 md:py-24 px-4 md:px-8 max-w-7xl mx-auto select-none"
    >
      {/* Header */}
      <Reveal>
        <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="text-3xl md:text-5xl font-mono font-bold tracking-tight text-[#282828] uppercase leading-tight mb-4">
          Priced for the team that needs the answer
        </h2>
        <p className="text-sm font-mono text-[#5c5c56] max-w-2xl mx-auto leading-relaxed">
          Start free. Upgrade when the graph becomes part of how your team works.
          Every plan includes the provenance trail, staleness flags and honest
          negatives — the parts that make an answer checkable.
        </p>

        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 bg-[#f4f4ec] cad-border px-4 py-2 font-mono text-[10px] text-[#282828]">
          <span className="w-2 h-2 rounded-full bg-[#e15c46] animate-pulse" />
          <span className="font-bold uppercase">Billing:</span>
          <span className="text-[#5c5c56]">USD, billed monthly · cancel anytime</span>
          <span className="text-[#5c5c56]">· Annual saves ~17%</span>
        </div>

        {billing && !checkoutConfigured && (
          <div className="mt-4 max-w-2xl mx-auto cad-border border-[#282828]/20 bg-[#f4f4ec] px-4 py-2 font-mono text-[10px] text-[#5c5c56] flex items-center justify-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#e15c46] flex-shrink-0" />
            Paid plans are invoiced by email for now — upgrade in one click and we&rsquo;ll follow up
            with the invoice.
          </div>
        )}

        {notice && (
          <div className="mt-4 max-w-2xl mx-auto cad-border border-emerald-700/40 bg-emerald-50 px-4 py-2 font-mono text-[10px] text-emerald-800">
            {notice}
          </div>
        )}
        {error && (
          <div className="mt-4 max-w-2xl mx-auto cad-border border-[#e15c46] bg-[#e15c46]/10 px-4 py-2 font-mono text-[10px] text-[#a33b2b]">
            {error}
          </div>
        )}
        </div>
      </Reveal>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {plans.map((plan, index) => {
          const isCurrent = plan.id === currentPlanId;
          const isBusy = busy === plan.id;
          return (
            <Reveal key={plan.id} delay={index * 0.07} className="h-full">
              <div
                className={`h-full cad-border p-6 flex flex-col justify-between relative transition-all duration-300 hover:-translate-y-1 ${
                  plan.highlighted
                    ? 'bg-[#282828] text-white shadow-2xl scale-[1.02]'
                    : 'bg-[#f4f4ec] text-[#282828]'
                }`}
              >
                <CadCrosshair position="tl" />
                <CadCrosshair position="tr" />
                <CadCrosshair position="bl" />
                <CadCrosshair position="br" />

                {plan.highlighted && (
                  <>
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      aria-hidden="true"
                    >
                      <motion.rect
                        x="1"
                        y="1"
                        width="calc(100% - 2px)"
                        height="calc(100% - 2px)"
                        fill="none"
                        stroke="#e15c46"
                        strokeWidth="2"
                        pathLength={100}
                        strokeDasharray="16 84"
                        initial={{ strokeDashoffset: 0 }}
                        animate={{ strokeDashoffset: -100 }}
                        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                      />
                    </svg>
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#e15c46] text-white font-mono text-[10px] font-bold px-3 py-1 uppercase tracking-wider shadow-lg flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>RECOMMENDED</span>
                    </div>
                  </>
                )}

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-mono font-bold text-xl uppercase tracking-wider">
                    {plan.name}
                  </h3>
                  {isCurrent && (
                    <span
                      className={`font-mono text-[9px] px-2 py-0.5 cad-border uppercase ${
                        plan.highlighted
                          ? 'border-white/30 text-white/80'
                          : 'border-[#e15c46] text-[#e15c46]'
                      }`}
                    >
                      Current
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <div className="font-mono text-3xl font-bold tracking-tight text-[#e15c46]">
                    {formatPrice(plan)}
                    {plan.price_monthly !== null && plan.price_monthly > 0 && (
                      <span
                        className={`text-xs font-normal ${
                          plan.highlighted ? 'text-white/50' : 'text-[#5c5c56]'
                        }`}
                      >
                        /mo
                      </span>
                    )}
                  </div>
                  <div
                    className={`font-mono text-[10px] mt-1 ${
                      plan.highlighted ? 'text-white/60' : 'text-[#5c5c56]'
                    }`}
                  >
                    {plan.price_monthly === 0
                      ? 'Free forever · no card'
                      : plan.price_monthly === null
                        ? 'Custom · annual or monthly'
                        : `$${plan.price_yearly}/year (save ~17%)`}
                  </div>
                  <div
                    className={`font-mono text-xs mt-2 ${
                      plan.highlighted ? 'text-white/80 font-bold' : 'text-[#282828] font-bold'
                    }`}
                  >
                    {plan.credits}
                  </div>
                </div>

                <p
                  className={`font-mono text-xs leading-relaxed mb-6 cad-border-b pb-4 ${
                    plan.highlighted ? 'text-white/70 border-white/20' : 'text-[#5c5c56] border-[#282828]/20'
                  }`}
                >
                  {plan.tagline}
                </p>

                {/* Features List */}
                <div className="space-y-3 font-mono text-xs mb-8">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5">
                      <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#e15c46]" />
                      <span className={plan.highlighted ? 'text-white/90' : 'text-[#282828]'}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <HeronButton
                variant={plan.highlighted ? 'brand' : 'outline'}
                className="w-full justify-center"
                onClick={() => void handleSelect(plan)}
              >
                {isBusy
                  ? 'Starting…'
                  : isCurrent
                    ? 'Current plan'
                    : plan.id === 'enterprise'
                      ? 'Talk to us'
                      : plan.cta}
              </HeronButton>
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* Pricing rationale */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'Seats are included',
            body: 'Each plan includes its seat allowance — 1, 3 or 10. You pay for the questions your team asks, not for inviting a reviewer to read a trail.',
          },
          {
            title: 'Open-source core',
            body: 'The graph, Cypher and agent loop are open source. Self-host them for free; the paid plans pay for the managed surface.',
          },
          {
            title: 'Cancel from the portal',
            body: 'Stripe Customer Portal handles plan changes, payment methods and cancellation. No retention call required.',
          },
        ].map((item, index) => (
          <Reveal key={item.title} delay={index * 0.05} y={12}>
            <div className="bg-[#f4f4ec] cad-border p-4">
              <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#282828] mb-1.5">
                {item.title}
              </div>
              <p className="font-mono text-[10px] leading-relaxed text-[#5c5c56]">{item.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-8 text-center font-mono text-[11px] text-[#5c5c56]">
        All plans include Cypher-verified answers on a dedicated graph engine, with streaming answers
      </div>
    </section>
  );
};
