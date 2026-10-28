import React, { useState } from 'react';
import { CadCrosshair } from './CadCrosshair';
import { Reveal } from './motion/Reveal';
import { Plus, Minus } from 'lucide-react';
import { FAQ_ITEMS } from '../content/faq';

export const FAQSection: React.FC = () => {
  const [openId, setOpenId] = useState<string>('faq1');
  const faqs = FAQ_ITEMS;

  return (
    <section id="faq-section" className="relative w-full py-16 md:py-24 px-4 md:px-8 max-w-7xl mx-auto select-none">
      
      <Reveal>
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl md:text-5xl font-mono font-bold tracking-tight text-[#282828] uppercase leading-tight">
            Got Questions? We've Got Verified Answers.
          </h2>
        </div>
      </Reveal>

      <div className="space-y-4">
        {faqs.map((faq, index) => {
          const isOpen = openId === faq.id;
          return (
            <Reveal key={faq.id} delay={index * 0.04} y={12}>
              <div
                className={`cad-border transition-colors duration-300 relative ${
                  isOpen ? 'bg-[#f4f4ec]' : 'bg-[#ecece4] hover:bg-[#f4f4ec]'
                }`}
              >
                <CadCrosshair position="tl" />
                <CadCrosshair position="tr" />
                <CadCrosshair position="bl" />
                <CadCrosshair position="br" />

                <h3 className="m-0">
                  <button
                    onClick={() => setOpenId(isOpen ? '' : faq.id)}
                    aria-expanded={isOpen}
                    aria-controls={`${faq.id}-answer`}
                    className="w-full text-left p-6 flex items-center justify-between gap-4 font-mono select-none"
                  >
                    <span className="flex items-center gap-4">
                      <span className={`text-xs font-bold ${isOpen ? 'text-[#e15c46]' : 'text-[#5c5c56]'}`}>
                        [0{index + 1}]
                      </span>
                      <span className="font-bold text-base md:text-lg text-[#282828] uppercase">
                        {faq.question}
                      </span>
                    </span>

                    <span className={`w-7 h-7 flex items-center justify-center cad-border flex-shrink-0 transition-colors ${
                      isOpen ? 'bg-[#e15c46] text-white border-[#e15c46]' : 'bg-white text-[#282828]'
                    }`}>
                      {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </span>
                  </button>
                </h3>

                <div
                  id={`${faq.id}-answer`}
                  className={`${isOpen ? '' : 'hidden'} faq-answer px-6 pb-6 pt-2 font-mono text-xs md:text-sm text-[#5c5c56] leading-relaxed cad-border-t border-[#282828]/15`}
                >
                  <p className="max-w-3xl">{faq.answer}</p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

    </section>
  );
};
