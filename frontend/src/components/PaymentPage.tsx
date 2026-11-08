import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { CadCrosshair } from './CadCrosshair';
import { HeronButton } from './HeronButton';
import { useAuth } from '../lib/auth';
import {
  ApiError,
  api,
  formatPrice,
  type BillingSetup,
  type Plan,
  type PlanId,
  type RazorpayOrderResponse,
} from '../lib/api';

interface PaymentPageProps {
  onSelectMode: (mode: 'account' | 'website') => void;
}

type RazorpayInstance = { open: () => void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

const loadRazorpay = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser'));
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Could not load the Razorpay checkout script.'));
      };
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
};

const messageFor = (error: unknown): string =>
  error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Something went wrong. Try again.';

/**
 * /pay — the dedicated Razorpay checkout for Helio packs.
 *
 * Signed-in visitors create a Razorpay Order and pay in the embedded modal;
 * visitors without an account are sent through signup with the pack attached.
 * The signature is verified server-side before a plan is activated, so the
 * browser never decides what was paid for.
 */
export const PaymentPage: React.FC<PaymentPageProps> = ({ onSelectMode }) => {
  const { me, loading, openAuth, refresh, checkout } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<BillingSetup | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestedPlan = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const value = new URLSearchParams(window.location.search).get('plan');
    return value === 'starter' || value === 'professional' ? (value as PlanId) : null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.plans
      .list()
      .then((data) => {
        if (cancelled) return;
        setPlans(data.plans);
        setBilling(data.billing);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the pack catalog. Refresh and try again.');
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const paidPacks = plans.filter((plan) => plan.id === 'starter' || plan.id === 'professional');
  const enterprise = plans.find((plan) => plan.id === 'enterprise');
  const apiCheckout = billing?.mode === 'razorpay';
  const interimPage = billing?.mode === 'razorpay-page';
  const configured = Boolean(billing?.configured);
  const localDemo = Boolean(billing?.local_billing);
  const priceWarning = apiCheckout && billing?.price_ready === false;

  const pay = async (plan: Plan) => {
    if (busy) return;
    setError(null);
    setNotice(null);

    if (!me?.authenticated) {
      openAuth('signup', plan.id);
      return;
    }

    setBusy(plan.id);
    try {
      if (!configured && localDemo) {
        const result = await checkout(plan.id);
        setNotice(result.message || `${plan.name} activated in local demo mode.`);
        await refresh();
        return;
      }

      const order: RazorpayOrderResponse = await api.razorpay.order(plan.id, false);
      if (order.upgraded) {
        setNotice(order.message || `${plan.name} is active.`);
        await refresh();
        return;
      }
      // Interim (no API keys): redirect to razorpay.me with a fixed amount.
      if (order.mode === 'razorpay-page' && order.url) {
        setNotice(order.message || `Redirecting to Razorpay (₹${order.amount ?? ''}, fixed)…`);
        window.location.assign(order.url);
        return;
      }
      if (!order.ok || !order.order_id || !order.key_id) {
        setError(order.message || 'Could not create the Razorpay order.');
        return;
      }

      await loadRazorpay();
      if (!window.Razorpay) throw new Error('Razorpay checkout did not load.');

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: order.name || 'Helio',
        description: order.description,
        prefill: order.prefill,
        notes: order.notes,
        theme: { color: '#e15c46' },
        modal: {
          ondismiss: () => setBusy(null),
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verified = await api.razorpay.verify(response);
            if (verified.ok) {
              setNotice(`Payment received — ${verified.plan_name || plan.name} is active.`);
              await refresh();
            } else {
              setError(verified.message || 'The payment could not be verified.');
            }
          } catch (verifyError) {
            setError(messageFor(verifyError));
          } finally {
            setBusy(null);
          }
        },
      });
      rzp.open();
    } catch (payError) {
      setError(messageFor(payError));
    } finally {
      setBusy((current) => (current === plan.id ? null : current));
    }
  };

  const startTrial = async (plan: Plan) => {
    if (busy) return;
    if (!me?.authenticated) {
      openAuth('signup', plan.id);
      return;
    }
    setBusy(`trial-${plan.id}`);
    setError(null);
    setNotice(null);
    try {
      const result = await api.razorpay.order(plan.id, true);
      if (result.ok) {
        setNotice(result.message || `${plan.name} trial started.`);
        await refresh();
      } else {
        setError(result.message || 'Could not start the trial.');
      }
    } catch (trialError) {
      setError(messageFor(trialError));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="relative w-full px-4 md:px-8 py-12 md:py-16 max-w-7xl mx-auto select-none">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#e15c46] font-bold">
            Checkout // Razorpay
          </div>
          <h1 className="mt-2 text-3xl md:text-5xl font-mono font-bold tracking-tight uppercase leading-none">
            Pick a pack, pay securely
          </h1>
          <p className="mt-3 max-w-2xl font-mono text-xs md:text-sm text-[#5c5c56] leading-relaxed">
            {apiCheckout
              ? 'Razorpay handles UPI, cards, netbanking and wallets. The plan is activated only after the server verifies Razorpay’s signature — the browser never decides what was paid for.'
              : 'Secure payments on Razorpay at a fixed pack price (₹). Pay with UPI, cards, netbanking or wallets — your plan is activated after we confirm the payment.'}
          </p>
        </div>
        <div className="cad-border bg-[#f4f4ec] px-4 py-3 font-mono text-[10px] text-[#5c5c56] flex items-center gap-2">
          <ShieldCheck className="size-4 text-[#e15c46]" />
          <span className="uppercase tracking-wider">
            {apiCheckout ? `Live · ${billing?.currency || 'INR'}` : localDemo ? 'Local demo billing' : 'Razorpay · fixed price'}
          </span>
        </div>
      </div>

      {loading && <div className="font-mono text-xs text-[#5c5c56] mb-4">Checking your session…</div>}

      {notice && (
        <div className="mb-5 cad-border border-[#e15c46]/50 bg-[#e15c46]/5 px-4 py-3 font-mono text-xs text-[#282828]">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-5 cad-border border-red-500/40 bg-red-500/5 px-4 py-3 font-mono text-xs text-red-300">
          {error}
        </div>
      )}

      {interimPage && !localDemo && (
        <div className="mb-6 cad-border bg-[#f4f4ec] px-4 py-4 font-mono text-[11px] text-[#5c5c56] leading-relaxed">
          <span className="font-bold uppercase text-[#282828]">Fixed-price checkout.</span>{' '}
          You’ll pay a fixed ₹ amount on{' '}
          <a href="https://razorpay.me/@helio" className="text-[#e15c46] hover:underline" target="_blank" rel="noreferrer">razorpay.me/@helio</a>.
          After paying, your plan is activated once we confirm the payment (usually within a few hours). Need it now? Email{' '}
          <a href="mailto:contact.helio.brain@gmail.com" className="text-[#e15c46] hover:underline">contact.helio.brain@gmail.com</a> with your receipt.
        </div>
      )}

      {priceWarning && (
        <div className="mb-6 cad-border bg-[#f4f4ec] px-4 py-4 font-mono text-[11px] text-[#5c5c56] leading-relaxed">
          <span className="font-bold uppercase text-[#282828]">Currency mismatch.</span> The packs are
          priced in USD. Set <code className="text-[#e15c46]">RAZORPAY_CURRENCY=USD</code> (international
          payments enabled) or <code className="text-[#e15c46]">RAZORPAY_INR_RATE</code> so an INR order
          is not charged as ₹15 for a $15 pack.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {(catalogLoading ? [] : paidPacks).map((plan) => {
          const current = me?.plan?.id === plan.id;
          const isBusy = busy === plan.id || busy === `trial-${plan.id}`;
          return (
            <motion.article
              key={plan.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={`relative cad-border p-6 md:p-8 flex flex-col justify-between ${
                plan.highlighted ? 'bg-[#282828] text-white' : 'bg-[#f4f4ec] text-[#282828]'
              }`}
            >
              <CadCrosshair position="tl" />
              <CadCrosshair position="br" />
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#e15c46] text-white font-mono text-[10px] font-bold px-3 py-1 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="size-3" /> Recommended
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="font-mono font-bold text-xl uppercase tracking-wider">{plan.name}</h2>
                  {current && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#e15c46]">
                      Current
                    </span>
                  )}
                </div>
                <div className="mt-4 font-mono text-4xl font-bold tracking-tight text-[#e15c46]">
                  {formatPrice(plan)}
                  <span className={`text-xs font-normal ${plan.highlighted ? 'text-white/50' : 'text-[#5c5c56]'}`}>
                    /mo
                  </span>
                </div>
                <div className={`mt-1 font-mono text-[10px] ${plan.highlighted ? 'text-white/60' : 'text-[#5c5c56]'}`}>
                  {plan.credits}
                </div>
                <p className={`mt-4 font-mono text-xs leading-relaxed cad-border-b pb-4 ${plan.highlighted ? 'text-white/70 border-white/20' : 'text-[#5c5c56] border-[#282828]/20'}`}>
                  {plan.tagline}
                </p>
                <ul className="mt-4 space-y-2.5 font-mono text-xs">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-[#e15c46]" />
                      <span className={plan.highlighted ? 'text-white/90' : 'text-[#282828]'}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-7 space-y-3">
                <HeronButton
                  variant={plan.highlighted ? 'brand' : 'outline'}
                  size="md"
                  className={`w-full justify-center ${isBusy ? 'pointer-events-none opacity-60' : ''}`}
                  onClick={() => {
                    if (isBusy) return;
                    void pay(plan);
                  }}
                >
                  {isBusy && busy === plan.id
                    ? 'Opening Razorpay…'
                    : me?.authenticated
                      ? `Pay ${formatPrice(plan)} on Razorpay`
                      : `Sign in to pay ${formatPrice(plan)}`}
                  <ArrowRight className="size-3.5" />
                </HeronButton>
                {interimPage && (
                  <div className={`font-mono text-[10px] text-center ${plan.highlighted ? 'text-white/50' : 'text-[#5c5c56]'}`}>
                    Fixed price · activated after confirmation
                  </div>
                )}
                {billing?.trial_enabled && !current && (
                  <button
                    type="button"
                    onClick={() => void startTrial(plan)}
                    disabled={isBusy}
                    className={`w-full font-mono text-[10px] uppercase tracking-wider underline-offset-4 hover:underline disabled:opacity-50 ${
                      plan.highlighted ? 'text-white/60' : 'text-[#5c5c56]'
                    }`}
                  >
                    {isBusy && busy === `trial-${plan.id}`
                      ? 'Starting trial…'
                      : `Or start ${plan.trial_days || billing?.trial_days || 14}-day free trial`}
                  </button>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>

      {!catalogLoading && paidPacks.length === 0 && (
        <div className="cad-border bg-[#f4f4ec] px-4 py-6 font-mono text-xs text-[#5c5c56]">
          The pack catalog is unavailable right now. Refresh, or open the account page to upgrade.
        </div>
      )}

      <div className="mt-6 cad-border bg-[#f4f4ec] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="font-mono text-[11px] text-[#5c5c56] leading-relaxed">
          <span className="font-bold uppercase text-[#282828]">Need a bigger pack?</span>{' '}
          {enterprise?.tagline || 'Enterprise adds a dedicated graph instance, SSO/RBAC and an SLA.'}
        </div>
        <a
          href="mailto:contact.helio.brain@gmail.com?subject=Helio%20Enterprise"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#e15c46] hover:underline shrink-0"
        >
          Talk to us <ArrowRight className="size-3.5" />
        </a>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] text-[#5c5c56]">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-3 text-[#e15c46]" /> {apiCheckout ? 'Signature verified server-side' : 'Secure payment on Razorpay'}
        </span>
        <span>UPI · Cards · Netbanking · Wallets</span>
        <span>Cancel anytime</span>
        <button
          type="button"
          onClick={() => onSelectMode('account')}
          className="uppercase tracking-wider text-[#e15c46] hover:underline"
        >
          Billing & invoices →
        </button>
        <button
          type="button"
          onClick={() => onSelectMode('website')}
          className="uppercase tracking-wider hover:text-[#e15c46]"
        >
          Back to site
        </button>
      </div>

      {requestedPlan && !notice && (
        <div className="sr-only" aria-live="polite">
          Selected pack: {requestedPlan}
        </div>
      )}
    </section>
  );
};

export default PaymentPage;
