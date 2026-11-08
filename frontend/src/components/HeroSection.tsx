import React from 'react';
import { HeronButton } from './HeronButton';
import { CadCrosshair } from './CadCrosshair';
import { TextReveal } from './motion/TextReveal';
import { Reveal } from './motion/Reveal';
import { ArrowDown, Network, ShieldCheck, GitBranch, AlertOctagon } from 'lucide-react';
import { TickerBar } from './TickerBar';
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
              text={['Know who owns it.', 'Know what breaks.', 'Know who to page.']}
              lineClassNames={['', '', 'text-[#e15c46]']}
              stagger={0.07}
              delay={0.1}
              whileInView
              once={false}
              priority
            />
          </h1>

          <Reveal delay={0.35} y={14} priority>
            <div className="mt-8 max-w-2xl text-[14px] md:text-[16px] font-mono text-[#5c5c56] leading-relaxed">
              One graph. Every answer shows its path.
            </div>
          </Reveal>

          <Reveal delay={0.45} y={14} priority>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <HeronButton 
                variant="brand" 
                size="lg"
                onClick={() => onSelectMode('chat-widget')}
                graphorbTitle="Ask Helio a question"
                graphorbDescription="Open the agent to ask a question and review the evidence trail behind the answer."
                graphorbAction="Open the agent"
              >
                Ask Helio a question
              </HeronButton>

              <button
                onClick={() => onNavigateSection('inspector-section')}
                data-graphorb-title="See what search misses"
                data-graphorb-description="Scrolls to the side-by-side comparison of flat search results and the typed graph answer to the same question."
                data-graphorb-action="Jump to the comparison"
                className="font-mono text-[11px] uppercase tracking-wider text-[#e15c46] hover:underline flex items-center gap-1.5"
              >
                See what search misses
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigateSection('pricing-section')}
                className="border border-white/25 bg-transparent text-white font-mono text-[11px] uppercase tracking-wider px-4 py-2.5 hover:border-[#e15c46] hover:text-[#f08a75] transition-colors"
              >
                See pricing
              </button>
            </div>
          </Reveal>
        </div>

        {/* Right 4 Cols: HUD (desktop only — mobile keeps headline + CTA) */}
        <Reveal className="lg:col-span-4 hidden lg:block" delay={0.3} y={22} priority>
          <div
            data-graphorb-title="What Helio can answer"
            data-graphorb-description="Ownership, blast radius, decision history, and honest negatives — each with a verifiable evidence trail."
            className="bg-[#f4f4ec] cad-border p-6 relative transition-transform duration-300 hover:-translate-y-1"
          >
            <CadCrosshair position="tl" />
            <CadCrosshair position="tr" />
            <CadCrosshair position="bl" />
            <CadCrosshair position="br" />

            <div className="space-y-4 font-mono text-[12px]">
              <div className="flex items-start gap-3">
                <Network className="w-4 h-4 text-[#e15c46] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#282828]">BLAST RADIUS</div>
                  <div className="text-[11px] text-[#5c5c56]">Every downstream owner.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <GitBranch className="w-4 h-4 text-[#e15c46] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#282828]">EXPERTISE</div>
                  <div className="text-[11px] text-[#5c5c56]">Who really knows it.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#e15c46] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#282828]">DECISIONS</div>
                  <div className="text-[11px] text-[#5c5c56]">Full chain, no stale docs.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <AlertOctagon className="w-4 h-4 text-[#e15c46] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#282828]">HONEST “NO”</div>
                  <div className="text-[11px] text-[#5c5c56]">No answer, no guessing.</div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

      </div>

      {/* Sub-bar: scrolling ticker (was a static text line) */}
      <Reveal className="relative z-10" delay={0.55} y={10} priority>
        <div className="pt-4 flex items-center gap-4 font-mono text-xs">
          <div className="flex shrink-0 items-center gap-2 text-[#5c5c56]">
            <span className="w-2 h-2 bg-[#e15c46]" />
            <span className="font-bold text-[#282828]">ONE GRAPH</span>
          </div>

          <TickerBar
            variant="light"
            speed={24}
            label="One graph: Ownership, Dependencies, Decisions, On-call, Blast radius, Provenance, Honest negatives"
            className="min-w-0 flex-1 py-1"
            items={[
              'Ownership',
              'Dependencies',
              'Decisions',
              'On-call',
              'Blast radius',
              'Provenance',
              'Honest negatives',
            ]}
          />

          <button
            onClick={() => onNavigateSection('inspector-section')}
            className="flex shrink-0 items-center gap-1.5 text-[#e15c46] hover:underline"
          >
            <span>SEARCH VS. GRAPH</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </Reveal>

    </section>
  );
};
