import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { Button, Card, Eyebrow } from '../components/ui';
import { useAuth } from '../lib/auth';
import { ApiError, displayPrice, fallbackPrice, type PlanId } from '../lib/api';
import { cn } from '../lib/utils';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

const inputClass =
  'w-full rounded-xl border border-line bg-ink px-3.5 py-3 text-[15px] text-paper placeholder:text-fog/70 transition-colors focus:border-accent';

export const AuthPage: React.FC = () => {
  const { me, loading, login, signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedPlan = (params.get('plan') ?? 'free') as PlanId;

  const [mode, setMode] = React.useState<'login' | 'signup'>('signup');
  const [name, setName] = React.useState('');
  const [accountName, setAccountName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showReset, setShowReset] = React.useState(false);

  React.useEffect(() => {
    if (me?.authenticated) {
      const plan = params.get('plan');
      navigate(plan ? `/account?plan=${plan}` : '/account', { replace: true });
    }
  }, [me?.authenticated, navigate, params]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    if (mode === 'signup' && password.length < 8) {
      setError('Use at least 8 characters for your password.');
      setBusy(false);
      return;
    }

    try {
      if (mode === 'signup') {
        await signup({
          name: name.trim() || email.split('@')[0],
          email: email.trim(),
          password,
          account_name: accountName.trim() || undefined,
        });
      } else {
        await login(email.trim(), password);
      }
      const plan = params.get('plan');
      navigate(plan ? `/account?plan=${plan}` : '/account', { replace: true });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Something went wrong. Check the API is running and try again.',
      );
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="font-mono text-sm text-fog">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto grid min-h-svh w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-32 md:px-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <Eyebrow>Your workspace</Eyebrow>
          <h1 className="mt-4 text-balance text-[clamp(2.2rem,4.5vw,3.6rem)] font-semibold leading-[1.04] tracking-[-0.03em]">
            {mode === 'signup' ? 'Start with 50 free questions.' : 'Welcome back.'}
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-fog">
            One account, one graph, one seat on the Free plan. Upgrade when the graph proves
            itself — the trial needs no card.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-fog">
            <span>No card for 14 days</span>
            <span>Cancel anytime</span>
            <span>Your graph stays yours</span>
          </div>
        </div>

        <Card className="p-6 md:p-8">
          {requestedPlan !== 'free' && (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/[0.08] px-4 py-3">
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
                {PLAN_LABEL[requestedPlan] ?? requestedPlan} selected
              </span>
              <span className="text-sm text-fog">
                {me?.plans.find((plan) => plan.id === requestedPlan)
                  ? displayPrice(
                      me.plans.find((plan) => plan.id === requestedPlan)!,
                      me.billing,
                    )
                  : fallbackPrice(requestedPlan)}
                / month after trial
              </span>
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 rounded-full border border-line p-1">
            {(['signup', 'login'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setError(null);
                }}
                className={cn(
                  'h-10 rounded-full text-sm font-medium transition-colors',
                  mode === item ? 'bg-paper text-ink' : 'text-fog hover:text-paper',
                )}
              >
                {item === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm text-fog">
                    Your name
                  </label>
                  <input
                    id="name"
                    className={inputClass}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ada Okafor"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="accountName" className="mb-1.5 block text-sm text-fog">
                    Workspace name <span className="text-fog/70">(optional)</span>
                  </label>
                  <input
                    id="accountName"
                    className={inputClass}
                    value={accountName}
                    onChange={(event) => setAccountName(event.target.value)}
                    placeholder="Platform team"
                    autoComplete="organization"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm text-fog">
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                className={inputClass}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ada@company.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm text-fog">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className={inputClass}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'signup' ? '8+ characters' : 'Your password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm text-paper">
                {error}
              </p>
            )}

            <Button type="submit" block size="lg" disabled={busy}>
              {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setShowReset((value) => !value)}
              className="text-fog underline decoration-line underline-offset-4 transition-colors hover:text-paper"
            >
              Forgot your password?
            </button>
            <span className="font-mono text-xs text-fog">scrypt hashed · session cookie</span>
          </div>

          {showReset && (
            <p className="mt-4 rounded-lg border border-line bg-ink px-3 py-2.5 text-sm leading-relaxed text-fog">
              Password resets are handled by a person right now. Email{' '}
              <a
                href="mailto:support@helio.runs-on.dev"
                className="text-paper underline decoration-accent underline-offset-4"
              >
                support@helio.runs-on.dev
              </a>{' '}
              from your account address and we'll reset it within one business day.
            </p>
          )}
        </Card>
      </main>
      <Footer />
    </>
  );
};

export default AuthPage;
