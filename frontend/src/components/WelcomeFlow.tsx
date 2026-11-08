import React, { useEffect, useState } from 'react';
import { X, Users, User, Bot, GitBranch, MessageSquare, Workflow, FileSpreadsheet, Link2, Check, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { api, type IntegrationProvider } from '../lib/api';
import { useAuth } from '../lib/auth';

type Props = {
  open: boolean;
  providers: IntegrationProvider[];
  integrationsCount: number;
  onClose: () => void;
  onDone: () => void;
  onAsk: () => void;
};

const STEPS = ['Kind', 'Add data', 'Ask'] as const;

// Graph visual — helio's take on the brain: nodes + edges, not pixels.
const GraphVisual: React.FC<{ active: boolean }> = ({ active }) => (
  <svg viewBox="0 0 340 340" className="h-full w-full" aria-hidden="true">
    <defs>
      <radialGradient id="helio-core" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#e15c46" />
        <stop offset="100%" stopColor="#e15c46" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="170" cy="170" r="90" fill="url(#helio-core)" opacity="0.12" />
    {[
      { x: 170, y: 80 }, { x: 250, y: 120 }, { x: 240, y: 215 }, { x: 170, y: 260 },
      { x: 100, y: 215 }, { x: 90, y: 120 }, { x: 170, y: 170 },
    ].map((p, i) => (
      <line key={`e-${i}`} x1="170" y1="170" x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
    ))}
    {[
      { x: 170, y: 80 }, { x: 250, y: 120 }, { x: 240, y: 215 }, { x: 170, y: 260 },
      { x: 100, y: 215 }, { x: 90, y: 120 },
    ].map((p, i) => (
      <g key={`n-${i}`}>
        <circle cx={p.x} cy={p.y} r="10" fill="#0e0e11" stroke={active ? '#f08a75' : 'rgba(255,255,255,0.5)'} strokeWidth="1.5" />
        <circle cx={p.x} cy={p.y} r="3" fill={active && i % 2 === 0 ? '#e15c46' : 'rgba(255,255,255,0.6)'} />
      </g>
    ))}
    <circle cx="170" cy="170" r="18" fill="#e15c46" />
    <circle cx="170" cy="170" r="26" fill="none" stroke="#e15c46" strokeWidth="1.5" strokeDasharray="4 6" />
  </svg>
);

export const WelcomeFlow: React.FC<Props> = ({ open, providers, integrationsCount, onClose, onDone, onAsk }) => {
  const { refresh } = useAuth();
  const [step, setStep] = useState(0); // 0 kind, 1 data, 2 ask
  const [kind, setKind] = useState<'company' | 'personal' | 'agent'>('company');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setPicked([]);
    setChecking(true);
    const t = window.setTimeout(() => setChecking(false), 1400);
    return () => window.clearTimeout(t);
  }, [open ]);

  if (!open) return null;

  const finish = async () => {
    setBusy(true);
    try {
      await api.onboarding.update({ dismissed: true });
      await refresh();
    } finally {
      setBusy(false);
      onDone();
    }
  };

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const kinds = [
    { id: 'company' as const, icon: <Users className="size-4" />, title: 'Company brain', sub: 'Shared memory for your whole team' },
    { id: 'personal' as const, icon: <User className="size-4" />, title: 'Personal brain', sub: 'Private memory only you can ask' },
    { id: 'agent' as const, icon: <Bot className="size-4" />, title: 'Agent memory', sub: 'Memory for your coding agents' },
  ];

  const sourceRows = (providers.length ? providers : [{ id: 'github', name: 'GitHub' }, { id: 'slack', name: 'Slack' }, { id: 'csv', name: 'CSV upload' }]).slice(0, 5).map((p: any) => ({
    id: p.id,
    name: p.name,
    icon:
      p.id === 'github' ? <GitBranch className="size-4" /> :
      p.id === 'slack' ? <MessageSquare className="size-4" /> :
      p.id === 'csv' ? <FileSpreadsheet className="size-4" /> :
      p.id === 'webhook' ? <Link2 className="size-4" /> :
      <Workflow className="size-4" />,
  }));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Welcome to helio">
      <div className="w-full max-w-3xl overflow-hidden border border-white/15 bg-[#0e0e11] text-white shadow-2xl">
        <div className="grid md:grid-cols-2">
          <div className="relative min-h-[280px] border-b border-white/10 md:border-b-0 md:border-r">
            <div className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-widest text-white/45">your graph</div>
            <div className="px-6 pt-12">
              <GraphVisual active={step > 0} />
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <div className="mb-2 flex justify-between font-mono text-[10px] text-white/50">
                <span>Step {step + 1} of {STEPS.length}</span>
                <span>{STEPS[step]}</span>
              </div>
              <div className="h-1 w-full bg-white/10">
                <div className="h-full bg-[#e15c46] transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-wider text-white/40">
                {STEPS.map((s) => <span key={s} className={STEPS[step] === s ? 'text-white' : ''}>{s}</span>)}
              </div>
            </div>
          </div>

          <div className="relative p-6">
            <button onClick={onClose} className="absolute right-4 top-4 text-white/50 hover:text-white" aria-label="Close welcome">
              <X className="size-4" />
            </button>

            {checking ? (
              <>
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#f08a75]">
                  <Sparkles className="size-3.5" /> Welcome to helio
                </div>
                <h2 className="mt-3 font-mono text-xl font-bold uppercase tracking-tight">Your workspace is being set up.</h2>
                <div className="mt-6 space-y-3 font-mono text-xs">
                  {['Creating your API key', 'Preparing your workspace', 'Preparing your data'].map((l, i) => (
                    <div key={l} className="flex items-center gap-2 text-white/70">
                      {i === 0 ? <Check className="size-3.5 text-[#e15c46]" /> : <Loader2 className="size-3.5 animate-spin text-white/40" />}
                      {l}
                    </div>
                  ))}
                </div>
                <p className="mt-6 font-mono text-[11px] leading-relaxed text-white/45">Usually under a minute. Choose what to build meanwhile — your graph starts as soon as it’s ready.</p>
              </>
            ) : step === 0 ? (
              <>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#f08a75]">Step 1 of {STEPS.length}</div>
                <h2 className="mt-2 font-mono text-lg font-bold uppercase tracking-tight">What kind of memory?</h2>
                <div className="mt-5 space-y-2">
                  {kinds.map((k) => (
                    <button key={k.id} onClick={() => setKind(k.id)} className={`flex w-full items-center gap-3 border px-3 py-3 text-left ${kind === k.id ? 'border-[#e15c46] bg-[#e15c46]/10' : 'border-white/10 hover:border-white/30'}`}>
                      <span className="border border-white/15 bg-white/5 p-2">{k.icon}</span>
                      <span>
                        <span className="block font-mono text-xs font-bold uppercase">{k.title}</span>
                        <span className="block font-mono text-[10px] text-white/50 mt-0.5">{k.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setStep(1)} className="mt-6 w-full bg-[#e15c46] px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-[#c2452d] inline-flex items-center justify-center gap-2">Continue <ChevronRight className="size-3.5" /></button>
              </>
            ) : step === 1 ? (
              <>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#f08a75]">Step 2 of {STEPS.length}</div>
                <h2 className="mt-2 font-mono text-lg font-bold uppercase tracking-tight">What should helio read?</h2>
                <p className="mt-2 font-mono text-[11px] text-white/50">Connect a source. Everyone in this workspace can ask about what you add.</p>
                <div className="mt-4 divide-y divide-white/10 border border-white/10">
                  {sourceRows.map((r) => (
                    <button key={r.id} onClick={() => toggle(r.id)} className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-white/5">
                      <span className="inline-flex items-center gap-3 font-mono text-xs"><span className="text-white/70">{r.icon}</span>{r.name}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">{picked.includes(r.id) ? 'Selected' : 'Add'} {picked.includes(r.id) && <Check className="inline size-3.5 text-[#e15c46]" />}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex gap-2">
                  <button onClick={() => setStep(0)} className="border border-white/20 px-4 py-3 font-mono text-xs uppercase">Back</button>
                  <button onClick={() => setStep(2)} className="flex-1 bg-[#e15c46] px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-[#c2452d]">Continue</button>
                </div>
                <button onClick={() => setStep(2)} className="mt-3 font-mono text-[10px] uppercase text-white/50 underline underline-offset-4">Skip for now</button>
              </>
            ) : (
              <>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#f08a75]">Step 3 of {STEPS.length}</div>
                <h2 className="mt-2 font-mono text-lg font-bold uppercase tracking-tight">Ask your first question.</h2>
                <p className="mt-2 font-mono text-[11px] text-white/50">Every answer comes with its graph path — nodes, edges, dates.</p>
                <div className="mt-5 space-y-2">
                  {['Who owns payments?', 'What breaks if ledger dies?', 'Who knows the retry logic?'].map((q) => (
                    <button key={q} onClick={() => { onAsk(); }} className="w-full border border-white/10 px-3 py-2.5 text-left font-mono text-xs hover:border-[#e15c46]">{q}</button>
                  ))}
                </div>
                <div className="mt-6 flex gap-2">
                  <button onClick={() => setStep(1)} className="border border-white/20 px-4 py-3 font-mono text-xs uppercase">Back</button>
                  <button onClick={() => void finish()} disabled={busy} className="flex-1 bg-[#e15c46] px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-[#c2452d] disabled:opacity-60">{busy ? 'Finishing…' : 'Open workspace'}</button>
                </div>
              </>
            )}
            {integrationsCount > 0 && <p className="mt-4 font-mono text-[10px] text-white/40">{integrationsCount} source{integrationsCount === 1 ? '' : 's'} connected</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
