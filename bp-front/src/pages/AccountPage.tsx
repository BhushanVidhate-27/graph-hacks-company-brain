import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { Button, Card, Eyebrow } from '../components/ui';
import { useAuth } from '../lib/auth';
import {
  ApiError,
  api,
  displayPrice,
  formatDate,
  type ApiKeyRecord,
  type PlanId,
} from '../lib/api';
import { cn } from '../lib/utils';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay checkout failed to load.'));
    document.head.appendChild(script);
  });
}

export const AccountPage: React.FC = () => {
  const { me, loading, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedPlan = params.get('plan') as PlanId | null;

  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [newKeyName, setNewKeyName] = React.useState('');
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null);
  const [keys, setKeys] = React.useState<ApiKeyRecord[]>([]);
  const apiAccess =
    (me?.plan ?? me?.plans.find((item) => item.id === 'free'))?.limits.api_access ?? false;

  const loadKeys = React.useCallback(() => {
    if (!apiAccess) return;
    api.keys
      .list()
      .then((data) => setKeys(data.keys))
      .catch(() => setKeys([]));
  }, [apiAccess]);

  React.useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  React.useEffect(() => {
    if (!loading && !me?.authenticated) navigate('/auth', { replace: true });
  }, [loading, me?.authenticated, navigate]);

  if (loading || !me?.authenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="font-mono text-sm text-fog">Loading your account…</p>
      </div>
    );
  }

  const subscription = me.subscription;
  const plan = me.plan ?? me.plans.find((item) => item.id === 'free');
  const hasActivePlan = subscription?.status === 'active' || subscription?.status === 'trialing';
  const usage = me.usage;

  const startSubscription = async (planId: PlanId) => {
    if (busy) return;
    setBusy(planId);
    setError(null);
    setNotice(null);
    try {
      const order = await api.razorpay.order(planId, false);
      if (order.upgraded) {
        setNotice(order.message || 'That plan is already active.');
        await refresh();
        return;
      }
      // Hosted subscription authorisation page or a fixed-amount payment link.
      if (order.url) {
        setNotice(order.message || 'Redirecting to Razorpay…');
        window.location.assign(order.url);
        return;
      }
      if (!order.ok || !order.order_id || !order.key_id) {
        setError(order.message || 'Could not create the Razorpay order.');
        return;
      }

      await loadRazorpay();
      if (!window.Razorpay) throw new Error('Razorpay checkout did not load.');

      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: order.name || 'Helio',
        description: order.description,
        prefill: order.prefill,
        notes: order.notes,
        theme: { color: '#ff5b3a' },
        modal: { ondismiss: () => setBusy(null) },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verified = await api.razorpay.verify(response);
            setNotice(verified.message || `Payment received — ${verified.plan_name ?? 'your plan'} is active.`);
            await refresh();
          } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : 'Could not verify the payment.');
          } finally {
            setBusy(null);
          }
        },
      });
      checkout.open();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checkout failed.');
      setBusy(null);
    }
  };

  const cancelAtPeriodEnd = async () => {
    if (busy) return;
    setBusy('cancel');
    setError(null);
    try {
      const result = await api.razorpay.cancel(undefined, true);
      setNotice(
        result.current_period_end
          ? `Cancelled. Access runs to ${formatDate(result.current_period_end)}.`
          : result.message || 'Subscription cancelled.',
      );
      setConfirmCancel(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not cancel the subscription.');
    } finally {
      setBusy(null);
    }
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setBusy('key');
    setError(null);
    try {
      const result = await api.keys.create(newKeyName.trim());
      setRevealedKey(result.key);
      setNewKeyName('');
      await loadKeys();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not create the key.');
    } finally {
      setBusy(null);
    }
  };

  const revokeKey = async (id: string) => {
    setBusy(`revoke:${id}`);
    setError(null);
    try {
      await api.keys.revoke(id);
      await loadKeys();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not revoke the key.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-28 md:px-8 md:pt-36">
        <Eyebrow>Account</Eyebrow>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.02em] md:text-5xl">
              {me.account?.name ?? 'Your workspace'}
            </h1>
            <p className="mt-2 text-fog">{me.user?.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            Sign out
          </Button>
        </div>

        {(notice || error) && (
          <div
            role="status"
            className={cn(
              'mt-6 rounded-xl border px-4 py-3 text-sm',
              error
                ? 'border-accent/40 bg-accent/10 text-paper'
                : 'border-mint/40 bg-mint/10 text-paper',
            )}
          >
            {error ?? notice}
          </div>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{plan?.name ?? 'Free'}</h2>
                <p className="mt-1 text-sm text-fog">{plan?.credits}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-semibold tracking-tight">
                  {plan ? displayPrice(plan, me.billing) : 'Free'}
                </p>
                <p className="text-xs text-fog">
                  {plan && plan.price_monthly ? 'per month, INR' : 'free forever'}
                </p>
              </div>
            </div>

            {hasActivePlan && (
              <div className="mt-5 rounded-xl border border-line bg-ink px-4 py-3 text-sm text-fog">
                <p>
                  Status:{' '}
                  <span className="text-mint">{subscription?.status ?? 'active'}</span>
                  {subscription?.cancel_at_period_end && ' · cancels at period end'}
                </p>
                {subscription?.current_period_end && (
                  <p className="mt-1">
                    Paid through {formatDate(subscription.current_period_end)}
                  </p>
                )}
              </div>
            )}

            {!hasActivePlan && requestedPlan && requestedPlan !== 'free' && (
              <div className="mt-6">
                <Button
                  size="lg"
                  block
                  disabled={busy !== null}
                  onClick={() => startSubscription(requestedPlan)}
                >
                  {busy === requestedPlan
                    ? 'Opening Razorpay…'
                    : `Start ${
                        me.plans.find((item) => item.id === requestedPlan)?.name ?? requestedPlan
                      } · 14-day free trial`}
                </Button>
                <p className="mt-2.5 text-center text-xs text-fog">
                  Razorpay handles the payment. No card details touch Helio.
                </p>
              </div>
            )}

            {!hasActivePlan && (!requestedPlan || requestedPlan === 'free') && (
              <div className="mt-6 flex flex-wrap gap-2">
                {me.plans
                  .filter((item) => item.id !== 'free')
                  .map((item) => (
                    <Button
                      key={item.id}
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => startSubscription(item.id)}
                    >
                      Upgrade to {item.name}
                    </Button>
                  ))}
              </div>
            )}

            {hasActivePlan && !subscription?.cancel_at_period_end && (
              <div className="mt-6 border-t border-line/70 pt-5">
                {confirmCancel ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-fog">Cancel at the end of the paid period?</p>
                    <Button variant="outline" size="sm" disabled={busy !== null} onClick={cancelAtPeriodEnd}>
                      Yes, cancel
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>
                      Keep plan
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    className="text-sm text-fog underline decoration-line underline-offset-4 transition-colors hover:text-accent"
                  >
                    Cancel subscription
                  </button>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold tracking-tight">This month</h2>
            {usage ? (
              <>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tracking-tight">
                    {usage.questions_used}
                  </span>
                  <span className="text-fog">
                    / {usage.questions_limit ?? '∞'} questions
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-line/70">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${Math.min(100, usage.percent_used ?? 0)}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-fog">
                  {usage.questions_remaining ?? '∞'} left · resets{' '}
                  {formatDate(usage.period_end)}
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-fog">Usage is not available yet.</p>
            )}
          </Card>
        </div>

        {apiAccess && (
          <Card className="mt-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">API keys</h2>
                <p className="mt-1 text-sm text-fog">
                  Send the key as <span className="font-mono text-paper">x-api-key</span> on
                  inference requests.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  value={newKeyName}
                  onChange={(event) => setNewKeyName(event.target.value)}
                  placeholder="Key name"
                  className="h-10 rounded-lg border border-line bg-ink px-3 text-sm text-paper placeholder:text-fog/70 focus:border-accent"
                />
                <Button variant="outline" size="sm" disabled={busy !== null || !newKeyName.trim()} onClick={createKey}>
                  Create key
                </Button>
              </div>
            </div>

            {revealedKey && (
              <div className="mt-4 rounded-xl border border-mint/40 bg-mint/10 px-4 py-3">
                <p className="text-sm text-paper">
                  Copy it now — it is shown once. <span className="font-mono">{revealedKey}</span>
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs text-mint underline underline-offset-4"
                  onClick={() => {
                    navigator.clipboard?.writeText(revealedKey).catch(() => undefined);
                    setRevealedKey(null);
                  }}
                >
                  Copy and dismiss
                </button>
              </div>
            )}

            {keys.length > 0 && (
              <ul className="mt-4 divide-y divide-line/60 border-t border-line/60">
                {keys.map((key) => (
                  <li key={key.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="text-paper">{key.name}</span>
                    <span className="font-mono text-xs text-fog">{key.prefix}…</span>
                    <button
                      type="button"
                      onClick={() => revokeKey(key.id)}
                      disabled={busy !== null}
                      className="text-xs text-fog underline decoration-line underline-offset-4 hover:text-accent"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </main>
      <Footer />
    </>
  );
};

export default AccountPage;
