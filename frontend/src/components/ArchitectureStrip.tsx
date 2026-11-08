import React from 'react';
import { Reveal } from './motion/Reveal';

const LAYERS = [
  { tag: 'L1', name: 'System prompt', status: 'v1 versioned', done: true },
  { tag: 'L2', name: 'Graph retrieval', status: 'Cypher + trail', done: true },
  { tag: 'L3', name: 'Tools', status: 'narrow, read-first', done: true },
  { tag: 'L5', name: 'Guardrails', status: 'injection + PII', done: true },
  { tag: 'L7', name: 'Traces', status: 'logged per ask', done: true },
  { tag: 'L4', name: 'RBAC', status: 'account-scoped', done: false },
  { tag: 'L6', name: 'Cache + router', status: 'next', done: false },
];

export const ArchitectureStrip: React.FC = () => (
  <section className="relative w-full px-4 md:px-8 py-12 md:py-16 max-w-7xl mx-auto">
    <Reveal>
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#f08a75] font-bold">Under the hood</div>
      <h2 className="mt-3 font-mono text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">The tower, exposed.</h2>
    </Reveal>
    <div className="mt-6 divide-y divide-white/10 border border-white/10">
      {LAYERS.map((layer, i) => (
        <Reveal key={layer.tag} delay={i * 0.04}>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] font-bold text-[#e15c46]">{layer.tag}</span>
              <span className="font-mono text-xs font-bold uppercase text-white">{layer.name}</span>
            </div>
            <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${layer.done ? 'border-emerald-500/40 text-emerald-300' : 'border-white/15 text-white/45'}`}>
              {layer.status}
            </span>
          </div>
        </Reveal>
      ))}
    </div>
    <p className="mt-4 font-mono text-[10px] leading-relaxed text-white/40">
      Prompt versioned · injection blocked · PII redacted · every ask traced (prompt, trail, latency).
    </p>
  </section>
);
