import React from 'react';
import { CadCrosshair } from './CadCrosshair';
import { Reveal } from './motion/Reveal';

export const RolesSection: React.FC = () => {
  const roles = [
    {
      title: 'SRE / platform',
      desc: 'Use dependency paths and on-call ownership before changes — or during incidents — cascade.',
      num: '[01]'
    },
    {
      title: 'Architecture / leadership',
      desc: 'Follow decision history and ownership blind spots across teams and services.',
      num: '[02]'
    },
    {
      title: 'Engineering teams',
      desc: 'Ask for the current owner and proof trail instead of trusting stale wikis or commit volume.',
      num: '[03]'
    }
  ];

  return (
    <section className="relative w-full py-16 md:py-24 px-4 md:px-8 max-w-7xl mx-auto select-none">
      
      <Reveal>
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl md:text-5xl font-mono font-bold tracking-tight text-[#282828] uppercase leading-tight">
            One source of truth for the entire engineering organization
          </h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((r, index) => (
          <Reveal key={r.num} delay={index * 0.04} className="h-full">
            <div
              className="h-full bg-[#f4f4ec] cad-border p-5 relative hover:bg-[#282828] hover:text-white hover:-translate-y-1 transition-all duration-200 group flex flex-col justify-between"
            >
              <CadCrosshair position="tl" />
              <CadCrosshair position="tr" />
              <CadCrosshair position="bl" />
              <CadCrosshair position="br" />

              <div>
                <div className="flex items-center justify-between font-mono text-[10px] text-[#5c5c56] group-hover:text-white/60 mb-3">
                  <span className="text-[#e15c46] font-bold">STAKEHOLDER</span>
                  <span>{r.num}</span>
                </div>
                <h3 className="font-mono font-bold text-base uppercase mb-2">
                  {r.title}
                </h3>
              </div>

              <p className="font-mono text-xs text-[#5c5c56] group-hover:text-white/80 leading-relaxed pt-3 cad-border-t border-[#282828]/20 group-hover:border-white/20">
                {r.desc}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

    </section>
  );
};
