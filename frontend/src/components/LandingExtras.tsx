import React from 'react';
import { ArrowRight, CheckCircle2, Database, GitBranch, Lock, MessageSquare, Server } from 'lucide-react';
import { Reveal } from './motion/Reveal';

const SOURCES = [
  { tag: 'call transcript', label: 'Renewal call — Oct 12' },
  { tag: 'ticket', label: 'ENG-214' },
  { tag: 'slack', label: '#acme-renewal' },
];

const INTEGRATIONS = ['GitHub', 'Slack', 'Jira', 'Linear', 'Notion', 'Webhook', 'CSV'];

export const DemoQuestion: React.FC = () => (
  <section className="relative w-full px-4 md:px-8 py-12 md:py-16 max-w-7xl mx-auto">
    <Reveal>
      <div className="border border-white/10 bg-white/[0.02] p-5 md:p-7">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#f08a75] font-bold">Live demo</div>
        <div className="mt-3 font-mono text-xl md:text-2xl font-bold uppercase tracking-tight text-white">
          What is blocking the Acme deal?
        </div>
        <p className="mt-3 max-w-2xl font-mono text-xs md:text-sm text-white/60 leading-relaxed">
          SSO — requested in the renewal call, still open with Engineering.
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
            Try it on your data <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </Reveal>
  </section>
);

export const IntegrationMarquee: React.FC = () => (
  <section aria-label="Integrations" className="w-full border-y border-white/10 bg-white/[0.015] py-5 overflow-hidden">
    <div className="footer-luxe-marquee flex w-max items-center gap-4 pl-4">
      {[...INTEGRATIONS, ...INTEGRATIONS].map((name, i) => (
        <span
          key={`${name}-${i}`}
          className="inline-flex shrink-0 items-center gap-2 border border-white/10 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-white/60"
          aria-hidden={i >= INTEGRATIONS.length}
        >
          <GitBranch className="size-3.5 text-[#f08a75]" aria-hidden="true" />
          {name}
        </span>
      ))}
    </div>
    <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-white/40">
      Fed from the tools you already use
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
