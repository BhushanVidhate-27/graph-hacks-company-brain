import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  GitBranch,
  KeyRound,
  Link2,
  Loader2,
  MessageSquare,
  PlugZap,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import { CadCrosshair } from './CadCrosshair';
import { HeronButton } from './HeronButton';
import { AnimatedNumber } from './motion/AnimatedNumber';
import { WelcomeFlow } from './WelcomeFlow';
import { useAuth } from '../lib/auth';
import {
  api,
  formatDate,
  formatPrice,
  type ImportRun,
  type Integration,
  type IntegrationProvider,
  type Onboarding,
} from '../lib/api';

type Props = {
  onSelectMode?: (mode: 'website' | 'chat-widget' | 'pricing') => void;
};

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  github: <GitBranch className="w-4 h-4" />,
  slack: <MessageSquare className="w-4 h-4" />,
  jira: <Workflow className="w-4 h-4" />,
  linear: <Workflow className="w-4 h-4" />,
  notion: <FileSpreadsheet className="w-4 h-4" />,
  webhook: <Link2 className="w-4 h-4" />,
  csv: <FileSpreadsheet className="w-4 h-4" />,
};

function statusTone(status?: string | null) {
  if (status === 'connected' || status === 'completed' || status === 'active') return 'text-emerald-700 border-emerald-700/30 bg-emerald-50';
  if (status === 'error' || status === 'failed') return 'text-[#a33b2b] border-[#e15c46]/40 bg-[#e15c46]/10';
  if (status === 'running' || status === 'queued') return 'text-amber-700 border-amber-600/30 bg-amber-50';
  return 'text-[#5c5c56] border-[#282828]/20 bg-[#ecece4]';
}

function defaultConfig(provider?: IntegrationProvider | null): Record<string, any> {
  const cfg: Record<string, any> = {};
  for (const field of provider?.fields || []) cfg[field.key] = '';
  return cfg;
}

export const DashboardSimulator: React.FC<Props> = ({ onSelectMode }) => {
  const { me, loading, openAuth, refresh } = useAuth();
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState('github');
  const [config, setConfig] = useState<Record<string, any>>({});
  const [connName, setConnName] = useState('');
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const authenticated = Boolean(me?.authenticated);
  const plan = me?.plan;
  const usage = me?.usage;
  const subscription = me?.subscription;
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) || providers[0] || null,
    [providers, selectedProviderId],
  );

  useEffect(() => {
    try {
      const flag = sessionStorage.getItem('helio_checkout');
      if (flag) {
        sessionStorage.removeItem('helio_checkout');
        setPurchaseNotice(
          flag === 'success'
            ? 'Purchase complete. Your workspace is active — connect your data sources below to start importing context into Helio.'
            : 'Checkout was cancelled. Your current plan is unchanged.',
        );
        if (flag === 'success') setWelcomeOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!selectedProvider) return;
    // Reset the draft when the provider changes so stale keys/names from the
    // previous source are never posted.
    setConfig(defaultConfig(selectedProvider));
    setConnName(`${selectedProvider.name} connection`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProviderId]);

  const load = useCallback(async () => {
    setLoadingData(true);
    try {
      const [provRes, intRes, obRes] = await Promise.all([
        api.integrations.providers(),
        authenticated ? api.integrations.list() : Promise.resolve({ integrations: [], runs: [] }),
        authenticated ? api.onboarding.get().catch(() => null) : Promise.resolve(null),
      ]);
      setProviders(provRes.providers || []);
      setIntegrations(intRes.integrations || []);
      setRuns(intRes.runs || []);
      if (obRes?.onboarding) setOnboarding(obRes.onboarding);
      if (!selectedProviderId && provRes.providers?.[0]) setSelectedProviderId(provRes.providers[0].id);
    } catch (e: any) {
      setMessage({ kind: 'error', text: e?.message || 'Could not load dashboard data.' });
    } finally {
      setLoadingData(false);
    }
  }, [authenticated, selectedProviderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!authenticated || !onboarding) return;
    // First sign-in / first invoice: guided welcome beats Cognee's static flow.
    if (!onboarding.dismissed && !onboarding.completed && onboarding.done_count <= 1) {
      const seen = sessionStorage.getItem('helio_welcome_seen');
      if (!seen) setWelcomeOpen(true);
    }
  }, [authenticated, onboarding]);

  const withBusy = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
    } catch (e: any) {
      setMessage({ kind: 'error', text: e?.message || 'Something went wrong.' });
    } finally {
      setBusy(null);
    }
  };

  const dismissOnboarding = async () => {
    await withBusy('onboarding:dismiss', async () => {
      const res = await api.onboarding.update({ dismissed: true });
      setOnboarding(res.onboarding);
    });
  };

  const confirmPlanStep = async () => {
    await withBusy('onboarding:plan', async () => {
      const res = await api.onboarding.update({ steps: { plan_activated: true, plan_confirmed: true } });
      setOnboarding(res.onboarding);
    });
  };

  const runOnboardingAction = (stepId: string) => {
    if (stepId === 'account_created') return;
    if (stepId === 'plan_activated') window.dispatchEvent(new CustomEvent('helio:navigate', { detail: 'account' }));
    if (stepId === 'source_connected') document.getElementById('connect-source')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (stepId === 'import_completed') document.getElementById('connect-source')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (stepId === 'first_question') onSelectMode?.('chat-widget');
  };

  const connectSource = async () => {
    if (!selectedProvider) return;
    await withBusy('connect', async () => {
      const res = await api.integrations.create({
        provider: selectedProvider.id,
        name: connName || selectedProvider.name,
        config,
      });
      setMessage({ kind: 'ok', text: `${res.integration.name} saved. You can test it or run an import.` });
      setConfig(defaultConfig(selectedProvider));
      await load();
    });
  };

  const runAction = async (integration: Integration, action: 'test' | 'import') => {
    await withBusy(`${action}:${integration.id}`, async () => {
      if (action === 'test') {
        const res = await api.integrations.test(integration.id);
        setMessage({
          kind: res.ok ? 'ok' : 'error',
          text: res.result?.message || (res.ok ? 'Connection verified.' : 'Connection test failed.'),
        });
      } else {
        const res = await api.integrations.runImport(integration.id);
        setMessage({
          kind: res.ok ? 'ok' : 'error',
          text: res.ok
            ? `Import completed (${res.run?.summary?.items_fetched ?? res.run?.summary?.records_received ?? res.run?.summary?.messages_received ?? 0} items).`
            : res.run?.error || 'Import finished with issues.',
        });
      }
      await load();
      await refresh();
    });
  };

  const used = usage?.questions_used ?? 0;
  const limit = usage?.questions_limit ?? null;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 4;

  return (
    <div className="max-w-7xl mx-auto my-8 p-4 md:p-8 select-none">
      {purchaseNotice && (
        <div className="mb-6 cad-border bg-[#282828] text-white p-5 relative">
          <CadCrosshair position="tl" />
          <CadCrosshair position="tr" />
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#e15c46] flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#e15c46] font-bold mb-1">Workspace ready</div>
              <div className="font-mono text-sm md:text-base font-bold uppercase">Purchase / plan status updated</div>
              <p className="font-mono text-xs text-white/70 mt-1 leading-relaxed">{purchaseNotice}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#282828] text-white p-6 cad-border mb-8">
        <div>
          <div className="flex items-center gap-2 text-[#e15c46] font-mono text-xs font-bold uppercase tracking-widest mb-1">
            <Database className="w-4 h-4" />
            <span>DASHBOARD // WORKSPACE</span>
            {authenticated && (
              <span className={`px-1.5 py-0.5 border text-[9px] tracking-widest ${subscription?.status === 'trialing' ? 'border-[#e15c46] text-[#e15c46]' : 'border-white/25 text-white/70'}`}>
                {subscription?.status === 'trialing' ? 'trial' : subscription?.status || 'active'}
                {subscription?.status === 'trialing' && subscription?.current_period_end ? ` · ends ${formatDate(subscription.current_period_end)}` : ''}
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-mono font-bold uppercase tracking-tight">
            {authenticated ? `${me?.account?.name || 'Workspace'} overview` : 'Helio workspace dashboard'}
          </h1>
          <p className="font-mono text-[11px] text-white/60 mt-1">
            {authenticated
              ? `Signed in as ${me?.user?.email} · ${plan?.name || 'Free'} plan`
              : 'Sign in after purchase to manage your plan, usage, and data imports.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {authenticated ? (
            <>
              <HeronButton variant="brand" size="sm" onClick={() => onSelectMode?.('chat-widget')} icon={false}>
                Ask agent
              </HeronButton>
              <HeronButton variant="outline" size="sm" onClick={() => setWelcomeOpen(true)} className="border-white/40 text-white hover:bg-white hover:text-[#282828]" icon={false}>
                Start setup
              </HeronButton>
              <HeronButton variant="outline" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('helio:navigate', { detail: 'account' }))} className="border-white/40 text-white hover:bg-white hover:text-[#282828]" icon={false}>
                Account
              </HeronButton>
            </>
          ) : (
            <HeronButton variant="brand" size="sm" onClick={() => openAuth('login')} icon={false}>Sign in</HeronButton>
          )}
        </div>
      </div>

      {message && (
        <div className={`mb-6 cad-border p-3 font-mono text-xs ${message.kind === 'ok' ? 'border-emerald-700/40 bg-emerald-50 text-emerald-800' : 'border-[#e15c46] bg-[#e15c46]/10 text-[#a33b2b]'}`}>
          {message.text}
        </div>
      )}

      {authenticated && onboarding && !onboarding.dismissed && !onboarding.completed && (
        <div className="mb-8 bg-[#f4f4ec] cad-border p-6 relative">
          <CadCrosshair position="tl" /><CadCrosshair position="tr" /><CadCrosshair position="bl" /><CadCrosshair position="br" />
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 text-[#e15c46] font-mono text-[10px] font-bold uppercase tracking-widest mb-1">
                <Rocket className="w-4 h-4" />
                <span>SETUP // GET STARTED</span>
              </div>
              <h2 className="font-mono text-lg md:text-xl font-bold uppercase text-[#282828]">Finish setting up your workspace</h2>
              <p className="font-mono text-[11px] text-[#5c5c56] mt-1">Complete these steps to go from zero to a useful company graph. Progress is tracked automatically.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-mono text-[10px] text-[#5c5c56] uppercase">{onboarding.done_count}/{onboarding.total_count} complete</div>
                <div className="h-1.5 w-28 bg-[#282828]/10 mt-1"><div className="h-full bg-[#e15c46]" style={{ width: `${Math.round((onboarding.done_count / Math.max(1, onboarding.total_count)) * 100)}%` }} /></div>
              </div>
              <button onClick={() => void dismissOnboarding()} className="p-1.5 cad-border text-[#5c5c56] hover:text-[#282828]" aria-label="Dismiss setup checklist" title="Dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {onboarding.steps.map((step, idx) => {
              const actionable = !step.done && step.id !== 'account_created';
              return (
                <div key={step.id} className={`cad-border p-4 flex items-start gap-3 ${step.done ? 'bg-white border-emerald-700/25' : 'bg-[#ecece4]'}`}>
                  <div className={`mt-0.5 flex-shrink-0 ${step.done ? 'text-emerald-700' : 'text-[#5c5c56]'}`}>
                    {step.done ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Circle className="w-4.5 h-4.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] font-bold uppercase text-[#282828] flex items-center gap-2">
                      <span className="text-[#5c5c56] font-normal">{idx + 1}.</span> {step.title}
                      {step.done && <span className="text-[9px] px-1 py-0.5 border border-emerald-700/30 bg-emerald-50 text-emerald-700">Done</span>}
                    </div>
                    <p className="font-mono text-[10px] text-[#5c5c56] mt-0.5 leading-relaxed">{step.description}</p>
                    {actionable && (
                      <button onClick={() => runOnboardingAction(step.id)} className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-[#e15c46] hover:text-[#282828]">
                        {step.id === 'plan_activated' ? 'Review plan' : step.id === 'source_connected' ? 'Connect source' : step.id === 'import_completed' ? 'Run import' : 'Ask agent'} <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {step.id === 'plan_activated' && !step.done && plan?.id === 'free' && (
                      <button onClick={() => void confirmPlanStep()} className="mt-2 ml-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase text-[#5c5c56] hover:text-[#282828]">
                        Continue on Free
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {authenticated && onboarding?.completed && !onboarding.dismissed && (
        <div className="mb-6 cad-border border-emerald-700/30 bg-emerald-50 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-xs text-emerald-800"><CheckCircle2 className="w-4 h-4" /><span className="font-bold uppercase">Workspace setup complete.</span><span className="text-emerald-700/80">You’ve connected data and started using the graph.</span></div>
          <button onClick={() => void dismissOnboarding()} className="font-mono text-[10px] uppercase text-emerald-800 underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[#f4f4ec] cad-border p-5 relative">
          <CadCrosshair position="tl" /><CadCrosshair position="tr" />
          <div className="font-mono text-xs text-[#5c5c56] uppercase mb-1">Current plan</div>
          <div className="font-mono text-2xl font-bold text-[#282828] uppercase">{plan?.name || 'Free'}</div>
          <div className="font-mono text-[10px] text-[#5c5c56] mt-2">{plan ? formatPrice(plan) : '$0'}{plan?.price_monthly ? '/mo' : ''} · {subscription?.cancel_at_period_end ? `ends ${formatDate(subscription.current_period_end)}` : subscription?.current_period_end ? `renews ${formatDate(subscription.current_period_end)}` : 'no card required'}</div>
        </div>
        <div className="bg-[#f4f4ec] cad-border p-5 relative">
          <CadCrosshair position="tl" /><CadCrosshair position="tr" />
          <div className="font-mono text-xs text-[#5c5c56] uppercase mb-1">Questions this month</div>
          <div className="font-mono text-3xl font-bold text-[#e15c46]"><AnimatedNumber value={used} />{limit ? <span className="text-lg text-[#5c5c56]">/{limit}</span> : null}</div>
          <div className="h-1.5 w-full bg-[#282828]/10 mt-3"><div className="h-full bg-[#e15c46]" style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="bg-[#f4f4ec] cad-border p-5 relative">
          <CadCrosshair position="tl" /><CadCrosshair position="tr" />
          <div className="font-mono text-xs text-[#5c5c56] uppercase mb-1">Data sources</div>
          <div className="font-mono text-3xl font-bold text-[#282828]"><AnimatedNumber value={integrations.length} /></div>
          <div className="font-mono text-[10px] text-[#5c5c56] mt-2">{integrations.filter((i) => i.status === 'connected').length} connected · {providers.length || 7} providers available</div>
        </div>
        <div className="bg-[#f4f4ec] cad-border p-5 relative">
          <CadCrosshair position="tl" /><CadCrosshair position="tr" />
          <div className="font-mono text-xs text-[#5c5c56] uppercase mb-1">Import runs</div>
          <div className="font-mono text-3xl font-bold text-[#282828]"><AnimatedNumber value={runs.length} /></div>
          <div className="font-mono text-[10px] text-[#5c5c56] mt-2">{runs.filter((r) => r.status === 'completed').length} completed · tracked in workspace</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div id="connect-source" className="lg:col-span-5 bg-[#f4f4ec] cad-border p-6 relative">
          <CadCrosshair position="tl" /><CadCrosshair position="tr" /><CadCrosshair position="bl" /><CadCrosshair position="br" />
          <div className="flex items-center gap-2 mb-1">
            <PlugZap className="w-4 h-4 text-[#e15c46]" />
            <h2 className="font-mono text-sm font-bold uppercase text-[#282828]">Connect data sources</h2>
          </div>
          <p className="font-mono text-[10px] text-[#5c5c56] mb-5 leading-relaxed">
            Add GitHub, Slack, and other import sources. Connections and import runs are stored per workspace (backend + API), not only in the browser.
          </p>

          {!authenticated ? (
            <div className="cad-border-dashed cad-border p-5 text-center">
              <p className="font-mono text-xs text-[#5c5c56] mb-4">Sign in to connect data sources and run imports.</p>
              <HeronButton variant="brand" size="sm" onClick={() => openAuth('login')} icon={false}>Sign in</HeronButton>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-[#5c5c56] mb-1.5">Quick connect</span>
                <div className="grid grid-cols-2 gap-2">
                  {['github', 'slack', 'linear', 'notion'].map((id) => {
                    const p = (providers.length ? providers : [{ id: 'github', name: 'GitHub' }, { id: 'slack', name: 'Slack' }, { id: 'linear', name: 'Linear' }, { id: 'notion', name: 'Notion' }]).find((x: any) => x.id === id) || { id, name: id };
                    const active = selectedProviderId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedProviderId(id)}
                        className={`cad-border px-3 py-2.5 text-left font-mono text-xs uppercase flex items-center gap-2 transition-colors ${active ? 'bg-[#282828] text-white border-[#282828]' : 'bg-[#ecece4] text-[#282828] hover:border-[#e15c46]'}`}
                      >
                        <span className={active ? 'text-[#e15c46]' : 'text-[#e15c46]'}>{PROVIDER_ICONS[id] || <PlugZap className="w-4 h-4" />}</span>
                        <span className="font-bold">{p.name}</span>
                        {id === 'github' && !plan?.limits?.github_sync && <span className={`ml-auto text-[9px] ${active ? 'text-white/60' : 'text-[#5c5c56]'}`}>Starter+</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block mb-3">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-[#5c5c56] mb-1.5">Provider</span>
                <select value={selectedProviderId} onChange={(e) => setSelectedProviderId(e.target.value)} className="w-full bg-[#ecece4] cad-border px-3 py-2.5 font-mono text-sm text-[#282828] outline-none focus:border-[#e15c46]">
                  {(providers.length ? providers : [{ id: 'github', name: 'GitHub' }, { id: 'slack', name: 'Slack' }, { id: 'linear', name: 'Linear' }, { id: 'notion', name: 'Notion' }, { id: 'webhook', name: 'Webhook / Custom API' }]).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}{p.category ? ` — ${p.category}` : ''}</option>
                  ))}
                </select>
              </label>

              {selectedProvider && (
                <div className="mb-4 cad-border bg-[#ecece4] p-3 font-mono text-[10px] text-[#5c5c56] leading-relaxed">
                  <span className="font-bold text-[#282828] uppercase">{selectedProvider.name}:</span> {selectedProvider.description}
                </div>
              )}

              <label className="block mb-3">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-[#5c5c56] mb-1.5">Connection name</span>
                <input value={connName} onChange={(e) => setConnName(e.target.value)} placeholder={`${selectedProvider?.name || 'Source'} connection`} className="w-full bg-[#ecece4] cad-border px-3 py-2.5 font-mono text-sm text-[#282828] outline-none focus:border-[#e15c46]" />
              </label>

              <div className="space-y-3 mb-4">
                {(selectedProvider?.fields || []).map((field) => (
                  <label key={field.key} className="block">
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-[#5c5c56] mb-1.5">{field.label}{field.secret ? ' (secret)' : ''}</span>
                    <input
                      type={field.secret ? 'password' : 'text'}
                      value={config[field.key] ?? ''}
                      onChange={(e) => setConfig((c) => ({ ...c, [field.key]: e.target.value }))}
                      placeholder={field.label}
                      className="w-full bg-[#ecece4] cad-border px-3 py-2.5 font-mono text-sm text-[#282828] outline-none focus:border-[#e15c46]"
                    />
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <HeronButton variant="brand" size="sm" onClick={() => void connectSource()} icon={false} className="justify-center">
                  {busy === 'connect' ? 'Saving…' : 'Save connection'}
                </HeronButton>
                <HeronButton variant="outline" size="sm" onClick={() => void load()} icon={false} className="justify-center">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} /> Refresh
                </HeronButton>
              </div>
              <div className="mt-3 font-mono text-[10px] text-[#5c5c56]">
                API: <code>GET/POST /api/integrations</code>, <code>/api/integrations/:id/test</code>, <code>/import</code>.
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#f4f4ec] cad-border p-6 relative">
            <CadCrosshair position="tl" /><CadCrosshair position="tr" />
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#e15c46]" />
                <h2 className="font-mono text-sm font-bold uppercase text-[#282828]">Configured sources</h2>
              </div>
              <span className="font-mono text-[10px] text-[#5c5c56]">{integrations.length} connection{integrations.length === 1 ? '' : 's'}</span>
            </div>

            {!authenticated ? (
              <div className="font-mono text-xs text-[#5c5c56]">Sign in to view and manage workspace integrations.</div>
            ) : integrations.length === 0 ? (
              <div className="cad-border-dashed cad-border p-5 font-mono text-xs text-[#5c5c56]">No data sources connected yet. Add GitHub, Slack, Jira, Linear, Notion, a webhook, or a CSV/file source to start importing.</div>
            ) : (
              <div className="space-y-3">
                {integrations.map((integration) => (
                  <div key={integration.id} className="cad-border bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#282828] uppercase">
                          <span className="text-[#e15c46]">{PROVIDER_ICONS[integration.provider] || <PlugZap className="w-4 h-4" />}</span>
                          {integration.name}
                          <span className={`px-1.5 py-0.5 border text-[9px] tracking-wider ${statusTone(integration.status)}`}>{integration.status}</span>
                        </div>
                        <div className="font-mono text-[10px] text-[#5c5c56] mt-1">
                          {integration.provider} · created {formatDate(integration.created_at)}
                          {integration.last_sync_at ? ` · last import ${formatDate(integration.last_sync_at)}` : ''}
                        </div>
                        {integration.last_error && <div className="font-mono text-[10px] text-[#a33b2b] mt-1">{integration.last_error}</div>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => void runAction(integration, 'test')} className="inline-flex items-center gap-1 cad-border px-2.5 py-1.5 font-mono text-[10px] uppercase text-[#282828] hover:bg-[#ecece4]">
                          {busy === `test:${integration.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Test
                        </button>
                        <button onClick={() => void runAction(integration, 'import')} className="inline-flex items-center gap-1 cad-border border-[#e15c46] bg-[#e15c46] px-2.5 py-1.5 font-mono text-[10px] uppercase text-white hover:bg-[#282828] hover:border-[#282828]">
                          {busy === `import:${integration.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Import
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#f4f4ec] cad-border p-6 relative">
            <CadCrosshair position="tl" /><CadCrosshair position="tr" />
            <div className="flex items-center gap-2 mb-4">
              <Clock3 className="w-4 h-4 text-[#e15c46]" />
              <h2 className="font-mono text-sm font-bold uppercase text-[#282828]">Recent import runs</h2>
            </div>
            {runs.length === 0 ? (
              <div className="font-mono text-xs text-[#5c5c56]">No import runs yet. Test a connection, then run an import.</div>
            ) : (
              <div className="space-y-2">
                {runs.slice(0, 8).map((run) => (
                  <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 cad-border bg-[#ecece4] px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] font-bold text-[#282828] uppercase flex items-center gap-2">
                        {run.provider} · {run.kind}
                        <span className={`px-1.5 py-0.5 border text-[9px] ${statusTone(run.status)}`}>{run.status}</span>
                      </div>
                      <div className="font-mono text-[10px] text-[#5c5c56]">
                        {formatDate(run.created_at)}{run.summary?.items_fetched != null ? ` · ${run.summary.items_fetched} items` : ''}{run.summary?.records_received != null ? ` · ${run.summary.records_received} records` : ''}{run.summary?.messages_received != null ? ` · ${run.summary.messages_received} messages` : ''}
                      </div>
                      {run.error && <div className="font-mono text-[10px] text-[#a33b2b]">{run.error}</div>}
                    </div>
                    {run.status === 'completed' ? <Check className="w-4 h-4 text-emerald-700" /> : run.status === 'failed' ? <AlertTriangle className="w-4 h-4 text-[#e15c46]" /> : <Loader2 className="w-4 h-4 text-amber-700" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <CreditCard className="w-4 h-4" />, title: 'Billing & plan', body: 'Manage subscription, usage, and invoices from your account.', action: () => window.dispatchEvent(new CustomEvent('helio:navigate', { detail: 'account' })) },
              { icon: <KeyRound className="w-4 h-4" />, title: 'API access', body: 'Create keys for programmatic graph queries and imports (plan-dependent).', action: () => window.dispatchEvent(new CustomEvent('helio:navigate', { detail: 'account' })) },
              { icon: <ArrowRight className="w-4 h-4" />, title: 'Ask the graph', body: 'Use the agent with provenance trails once sources are connected.', action: () => onSelectMode?.('chat-widget') },
            ].map((card) => (
              <button key={card.title} onClick={card.action} className="text-left bg-[#282828] text-white cad-border p-4 hover:border-[#e15c46] transition-colors">
                <div className="text-[#e15c46] mb-2">{card.icon}</div>
                <div className="font-mono text-xs font-bold uppercase mb-1">{card.title}</div>
                <div className="font-mono text-[10px] text-white/65 leading-relaxed">{card.body}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <WelcomeFlow
        open={welcomeOpen}
        providers={providers}
        integrationsCount={integrations.length}
        onClose={() => { sessionStorage.setItem('helio_welcome_seen', '1'); setWelcomeOpen(false); }}
        onDone={() => { sessionStorage.setItem('helio_welcome_seen', '1'); setWelcomeOpen(false); void load(); }}
        onAsk={() => { sessionStorage.setItem('helio_welcome_seen', '1'); setWelcomeOpen(false); onSelectMode?.('chat-widget'); }}
      />
    </div>
  );
};

export default DashboardSimulator;