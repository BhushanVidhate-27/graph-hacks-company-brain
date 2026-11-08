import React from 'react';
import { Reveal } from './motion/Reveal';
import { ARTICLES } from '../content/articles';

/**
 * Internal-link strip for the marketing home page. Article pages carry the
 * long-form content; this block makes them reachable from the main page and
 * gives crawlers a path that does not depend on the footer.
 */
export const LearnStrip: React.FC = () => (
  <section id="learn-section" className="relative w-full py-16 md:py-20 px-4 md:px-8 max-w-7xl mx-auto">
    <Reveal>
      <div className="mb-8 max-w-2xl">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#e15c46] font-bold">
          Learn
        </div>
        <h2 className="mt-3 text-3xl md:text-5xl font-mono font-bold tracking-tight text-[#282828] uppercase leading-tight">
          The problems behind the product
        </h2>
        <p className="mt-4 font-mono text-sm text-[#5c5c56] leading-relaxed">
          Guides to ownership, blast radius, on-call tracking and stale documentation.
          They use the same synthetic company as the demo, so every example can be checked.
        </p>
      </div>
    </Reveal>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {ARTICLES.map((article, index) => (
        <Reveal key={article.path} delay={index * 0.04} y={12}>
          <a
            href={article.path}
            className="group block h-full cad-border bg-[#f4f4ec] p-5 hover:bg-[#282828] transition-colors"
          >
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#e15c46] font-bold">
              {article.eyebrow}
            </div>
            <h3 className="mt-2 font-mono text-base font-bold uppercase leading-tight text-[#282828] group-hover:text-white">
              {article.h1}
            </h3>
            <span className="mt-4 inline-block font-mono text-[10px] uppercase tracking-widest text-[#e15c46]">
              Read the guide →
            </span>
          </a>
        </Reveal>
      ))}
    </div>
  </section>
);
