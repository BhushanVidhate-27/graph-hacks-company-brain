import React from 'react';
import { ArrowRight, CheckCircle2, Database, Lock, MessageSquare, Server } from 'lucide-react';
import { Reveal } from './motion/Reveal';
import { TickerBar } from './TickerBar';

const SOURCES = [
  { tag: 'dependency', label: 'payments-gateway' },
  { tag: 'on-call', label: 'Platform rotation' },
  { tag: 'decision', label: 'D-21' },
];

const INTEGRATIONS = [
  { name: 'GitHub', status: 'Connector' },
  { name: 'Slack', status: 'Connector' },
  { name: 'Linear', status: 'Import' },
  { name: 'Notion', status: 'Import' },
  { name: 'Webhook', status: 'Import' },
  { name: 'CSV', status: 'Import' },
  { name: 'Jira', status: 'Not native yet' },
];

const SNIPPET = `# ask with provenance
curl -X POST /ask \\
  -H "Authorization: Bearer $HELIO_KEY" \\
  -d '{"question":"Who owns payments?"}'

# python
import httpx
r = httpx.post("/ask", json={"question": "Who owns payments?"})
print(r.json()["trail"])`;

export const CodeSnippet: React.FC = () => {
  const [copied, setCopied] = React.useState(false);
  return (
    <section className="relative w-full px-4 md:px-8 py-12 md:py-16 max-w-7xl mx-auto">
      <Reveal>
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#f08a75] font-bold">Developer</div>
            <h2 className="mt-3 font-mono text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">Try it in 30 seconds.</h2>
            <p className="mt-3 font-mono text-xs md:text-sm text-white/55 leading-relaxed">One call. Every answer carries its path.</p>
          </div>
          <div className="border border-white/10 bg-[#101013]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/45">helio · quickstart</span>
              <button
                onClick={() => { navigator.clipboard?.writeText(SNIPPET); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }}
                className="border border-white/15 px-3 py-1 font-mono text-[10px] uppercase text-white/70 hover:border-[#e15c46] hover:text-white"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-white/75">{SNIPPET}</pre>
          </div>
        </div>
      </Reveal>
    </section>
  );
};

export const ProofStrip: React.FC = () => (
  <section aria-label="Proof points" className="w-full border-y border-white/10 bg-white/[0.015] py-4">
    <TickerBar
      variant="dark"
      speed={28}
      label="Every supported answer includes its graph path. 50 questions per month on the free plan. No card required. Cancel anytime."
      items={[
        'Every supported answer includes its graph path',
        '50 questions / month on Free',
        'No card required',
        'Cancel anytime',
        'Self-host or managed',
      ]}
    />
  </section>
);

export const DemoQuestion: React.FC = () => (
  <section className="relative w-full px-4 md:px-8 py-12 md:py-16 max-w-7xl mx-auto">
    <Reveal>
      <div className="border border-white/10 bg-white/[0.02] p-5 md:p-7">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#f08a75] font-bold">Example</div>
        <div className="mt-3 font-mono text-xl md:text-2xl font-bold uppercase tracking-tight text-white">
          What breaks if payments-gateway goes down?
        </div>
        <p className="mt-3 max-w-2xl font-mono text-xs md:text-sm text-white/60 leading-relaxed">
          Eight downstream services across three hops; one dependent has no recorded owner.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/70">
              <CheckCircle2 className="size-3 text-[#e15c46]" aria-hidden="true" />
              {s.tag} · {s.label}
            </span>
          ))}
        </div>
        <div className="mt-5">
          <a href="/agent" className="inline-flex items-center gap-2 bg-[#e15c46] px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-[#c2452d] transition-colors">
            Open the console <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </Reveal>
  </section>
);

export const IntegrationMarquee: React.FC = () => (
  <section aria-label="Integrations" className="w-full border-y border-white/10 bg-white/[0.015] py-5 overflow-hidden">
    <TickerBar
      variant="dark"
      chip
      speed={32}
      label="Native connectors: GitHub, Slack. Imports: Linear, Notion, Webhook, CSV. Jira is not native yet."
      items={INTEGRATIONS.map(({ name, status }) => `${name} · ${status}`)}
    />
    <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-white/40">
      Status-matched connectors and imports — see Integrations for details
    </p>
  </section>
);

export const DeploymentStrip: React.FC = () => {
  const items = [
    { icon: <Server className="size-4" />, title: 'Self-host', body: 'Docker on your infra. $0 model fees.' },
    { icon: <Database className="size-4" />, title: 'Cloud', body: 'Managed memory. BYOC available.' },
    { icon: <Lock className="size-4" />, title: 'VPC / air-gapped', body: 'Data stays inside your network.' },
  ];
  return (
    <section className="relative w-full px-4 md:px-8 py-12 md:py-16 max-w-7xl mx-auto">
      <Reveal>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#f08a75] font-bold">Deployment</div>
        <h2 className="mt-3 font-mono text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">Runs where your data lives.</h2>
      </Reveal>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {items.map((item, i) => (
          <Reveal key={item.title} delay={i * 0.06}>
            <div className="border border-white/10 bg-white/[0.02] p-5">
              <div className="text-[#e15c46]">{item.icon}</div>
              <div className="mt-3 font-mono text-xs font-bold uppercase text-white">{item.title}</div>
              <div className="mt-1 font-mono text-[11px] text-white/50">{item.body}</div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.2}>
        <p className="mt-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
          <MessageSquare className="size-3.5" aria-hidden="true" />
          One isolated brain per customer — no data crossing tenants.
        </p>
      </Reveal>
    </section>
  );
};
