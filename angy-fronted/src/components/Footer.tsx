import React from 'react';
import { HelioLogo } from './HelioLogo';
import { CadCrosshair } from './CadCrosshair';
import { ExternalLink, ArrowUpRight, GitBranch, Mail } from 'lucide-react';
import { ViewMode } from '../types';

interface FooterProps {
  onSelectMode: (mode: ViewMode) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectMode }) => {
  return (
    <footer className="relative w-full cad-border-t bg-[#f4f4ec] select-none pt-16 pb-12 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 pb-16 cad-border-b">
          
          {/* Col 1-5: Brand & Mission */}
          <div className="lg:col-span-5 space-y-6">
            <HelioLogo showText={true} />
            <p className="font-mono text-xs text-[#5c5c56] max-w-sm leading-relaxed">
              Helio is an organizational knowledge graph engine.
              Answering who knows what, what breaks if it dies, and where decisions were made —
              with the path behind every answer.
            </p>

            <div className="bg-[#ecece4] cad-border p-4 text-[11px] font-mono text-[#5c5c56] space-y-2">
              <div className="text-[#282828] font-bold">CONTACT & INQUIRIES:</div>
              <a 
                href="mailto:contact.helio.brain@gmail.com" 
                className="text-[#e15c46] font-bold text-xs hover:underline flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>contact.helio.brain@gmail.com</span>
              </a>
            </div>
          </div>

          {/* Col 6-8: Product */}
          <nav aria-label="Product" className="lg:col-span-3 space-y-3 font-mono text-xs">
            <h2 className="text-[#282828] font-bold uppercase tracking-wider text-[11px]">
              PRODUCT
            </h2>
            <div><a href="/how-it-works" className="hover:text-[#e15c46] transition-colors">How it works</a></div>
            <div><a href="/pricing" className="hover:text-[#e15c46] transition-colors">Pricing</a></div>
            <div><a href="/integrations" className="hover:text-[#e15c46] transition-colors">Integrations</a></div>
            <div><a href="/security" className="hover:text-[#e15c46] transition-colors">Security</a></div>
            <div><a href="/faq" className="hover:text-[#e15c46] transition-colors">FAQ</a></div>
          </nav>

          {/* Col 9-10: Learn */}
          <nav aria-label="Learn" className="lg:col-span-2 space-y-3 font-mono text-xs">
            <h2 className="text-[#282828] font-bold uppercase tracking-wider text-[11px]">
              LEARN
            </h2>
            <div><a href="/learn/who-owns-this-service" className="hover:text-[#e15c46] transition-colors">Who owns this service?</a></div>
            <div><a href="/learn/blast-radius-analysis" className="hover:text-[#e15c46] transition-colors">Blast radius</a></div>
            <div><a href="/learn/knowledge-graph-vs-rag" className="hover:text-[#e15c46] transition-colors">Graph vs RAG</a></div>
            <div><a href="/learn/service-ownership-on-call" className="hover:text-[#e15c46] transition-colors">Ownership &amp; on-call</a></div>
            <div><a href="/learn/stale-documentation" className="hover:text-[#e15c46] transition-colors">Stale documentation</a></div>
          </nav>

          {/* Col 11-12: Self-host */}
          <div className="lg:col-span-2 space-y-3 font-mono text-xs">
            <h2 className="text-[#282828] font-bold uppercase tracking-wider text-[11px]">
              SELF-HOST
            </h2>
            <p className="text-[#5c5c56] text-[11px] leading-relaxed">
              Run the graph, API and frontend in your own environment with Docker,
              or use the managed product.
            </p>
            <div className="flex flex-col gap-1.5 pt-2 text-[11px] font-bold">
              <a
                href="https://github.com/BhushanVidhate-27/graph-hacks-company-brain"
                target="_blank"
                rel="noreferrer"
                className="text-[#282828] hover:text-[#e15c46] flex items-center gap-1.5 transition-colors"
              >
                <GitBranch className="w-3.5 h-3.5" aria-hidden="true" />
                <span>GITHUB REPOSITORY</span>
                <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-[#5c5c56]">
          <div>
            © 2026 HELIO. ALL RIGHTS RESERVED.
          </div>
          <div className="flex items-center gap-6">
            <a href="mailto:contact.helio.brain@gmail.com" className="hover:text-[#282828] transition-colors">
              contact.helio.brain@gmail.com
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};
