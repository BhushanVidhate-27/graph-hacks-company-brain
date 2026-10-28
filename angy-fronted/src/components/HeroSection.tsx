import React from 'react';
import { HeronButton } from './HeronButton';
import { CadCrosshair } from './CadCrosshair';
import { TextReveal } from './motion/TextReveal';
import { Reveal } from './motion/Reveal';
import { ArrowDown, Network, ShieldCheck, GitBranch, AlertOctagon } from 'lucide-react';
import { ViewMode } from '../types';

interface HeroSectionProps {
  onSelectMode: (mode: ViewMode) => void;
  onNavigateSection: (sectionId: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onSelectMode, onNavigateSection }) => {
  return (
    <section className="relative w-full min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)] py-12 md:py-16 px-4 md:px-8 max-w-7xl mx-auto select-none flex flex-col justify-center">

      {/* Hero Grid Container */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start cad-border-b pb-12">
        
        {/* Left 8 Cols: Massive Headline */}
        <div className="lg:col-span-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-mono font-bold tracking-tighter text-[#282828] uppercase leading-[0.95]">
            <TextReveal
              text={['Know what breaks.', 'Before it dies.', 'In one traversal.']}
              lineClassNames={['', '', 'text-[#e15c46]']}
              stagger={0.07}
              delay={0.1}
              whileInView
              once={false}
            />
          </h1>

          <Reveal delay={0.35} y={14}>
            <div className="mt-8 max-w-2xl text-[14px] md:text-[16px] font-mono text-[#5c5c56] leading-relaxed">
              Existing enterprise search answers <span className="text-[#282828] font-bold">"where is the doc about X."</span> Helio
              answers <span className="text-[#282828] font-bold">who knows about X, what breaks if it goes down, where was that decided, and how current is that answer</span> —
              in one deterministic Cypher traversal, with the complete path shown. Text search is used only at the leaves.
            </div>
          </Reveal>

          <Reveal delay={0.45} y={14}>
            <div className="mt-8 flex flex-wrap gap-4 items-center">
              <HeronButton 
                variant="brand" 
                size="lg" 
                onClick={() => onSelectMode('chat-widget')}
              >
                Ask Helio Agent
              </HeronButton>

              <HeronButton 
                variant="outline" 
                size="lg" 
                onClick={() => onNavigateSection('inspector-section')}
              >
                Inspect Blast Radius
              </HeronButton>

              <HeronButton 
                variant="dark" 
                size="lg" 
                onClick={() => onSelectMode('dashboard')}
              >
                Graph Console
              </HeronButton>
            </div>
          </Reveal>
        </div>

        {/* Right 4 Cols: Technical Metadata HUD Card */}
        <Reveal className="lg:col-span-4" delay={0.3} y={22}>
          <div className="bg-[#f4f4ec] cad-border p-6 relative transition-transform duration-300 hover:-translate-y-1">
            <CadCrosshair position="tl" />
            <CadCrosshair position="tr" />
            <CadCrosshair position="bl" />
            <CadCrosshair position="br" />

            <div className="space-y-4 font-mono text-[12px]">
              <div className="flex items-start gap-3">
                <Network className="w-4 h-4 text-[#e15c46] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#282828]">BLAST RADIUS TRAVERSAL</div>
                  <div className="text-[11px] text-[#5c5c56]">Walks dependency edges to find every downstream service, owning team and on-call engineer.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <GitBranch className="w-4 h-4 text-[#e15c46] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#282828]">EXPERTISE VOLUME VS RECENCY</div>
                  <div className="text-[11px] text-[#5c5c56]">Ranks who actually knows a system by contribution volume and recency — not job title.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#e15c46] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#282828]">SUPERSEDES PROVENANCE</div>
                  <div className="text-[11px] text-[#5c5c56]">Follows decision edges so newer decisions override stale docs, with the full chain shown.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <AlertOctagon className="w-4 h-4 text-[#e15c46] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#282828]">HONEST NEGATIVES</div>
                  <div className="text-[11px] text-[#5c5c56]">When the graph has no answer, Helio says so instead of inventing one.</div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

      </div>

      {/* Sub-bar: Supported tools ticker */}
      <Reveal className="relative z-10" delay={0.55} y={10}>
        <div className="pt-4 flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-[#5c5c56]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#e15c46]" />
            <span className="font-bold text-[#282828]">ONE GRAPH:</span>
            <span>Ownership · Dependencies · Decisions · On-call</span>
          </div>

          <button 
            onClick={() => onNavigateSection('inspector-section')}
            className="flex items-center gap-1.5 text-[#e15c46] hover:underline"
          >
            <span>INTERACTIVE BLAST RADIUS</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </Reveal>

    </section>
  );
};
