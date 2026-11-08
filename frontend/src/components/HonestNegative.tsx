import React, { useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { CadCrosshair } from './CadCrosshair';
import { EASE_OUT } from '../lib/motion';

/**
 * The honest negative, animated.
 *
 * The edge is drawn toward a team that does not exist, and it stops. A hollow
 * node stays where an answer would have been. This is the one claim the product
 * cannot make with prose alone: the missing edge is the result.
 */

export const HonestNegative: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduce = useReducedMotion();
  const [run, setRun] = useState(0);
  const started = inView || Boolean(reduce);

  const rise = (delay: number) => ({
    initial: reduce ? (false as const) : { opacity: 0, y: 8 },
    animate: started ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
    transition: { duration: 0.45, delay, ease: EASE_OUT },
  });

  return (
    <div ref={ref} className="relative mt-6 bg-[#1c1c1b] cad-border text-white overflow-hidden">
      <CadCrosshair position="tl" tone="light" />
      <CadCrosshair position="tr" tone="light" />
      <CadCrosshair position="bl" tone="light" />
      <CadCrosshair position="br" tone="light" />

      {/* Panel header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 md:px-8 py-4 border-b border-white/15">
        <div className="flex items-center gap-3 text-[10px]">
          <span className="bg-[#e15c46] text-white px-2 py-1 font-bold tracking-wider">PROOF 04</span>
          <span className="text-white/50 tracking-widest">HONEST NEGATIVE</span>
        </div>
        <button
          type="button"
          onClick={() => setRun((value) => value + 1)}
          className="flex items-center gap-1.5 border border-white/20 px-2 py-1 text-[10px] text-white/60 hover:bg-white hover:text-[#1c1c1b] transition-colors"
        >
          <span aria-hidden>↻</span>
          RUN AGAIN
        </button>
      </div>

      <div key={run} className="grid grid-cols-1 lg:grid-cols-12">
        {/* Copy */}
        <div className="lg:col-span-5 p-5 md:p-8 lg:border-r border-white/15">
          <motion.h3
            {...rise(0.05)}
            className="text-2xl md:text-3xl font-bold uppercase leading-tight text-white"
          >
            The answer that
            <br />
            isn&apos;t there.
          </motion.h3>

          <motion.p
            {...rise(0.15)}
            className="mt-4 text-[11px] md:text-xs text-white/55 leading-relaxed max-w-md"
          >
            Five of the twenty demo questions have no answer in the graph. A model that
            invents a plausible team produces the same shaped sentence as one that knows.
            Helio returns the missing edge as the result.
          </motion.p>

          <motion.div
            {...rise(0.85)}
            className="mt-6 border border-white/15 bg-black/30 p-3"
          >
            <div className="flex items-center justify-between text-[9px] tracking-widest text-white/35">
              <span>A CHATBOT WOULD WRITE</span>
              <span className="text-[#e15c46]">INVENTED</span>
            </div>
            <div className="relative mt-2 inline-block text-[11px] md:text-xs text-white/70">
              &quot;Platform Team owns config-service.&quot;
              <motion.span
                className="absolute left-0 top-1/2 h-px w-full bg-[#e15c46] origin-left"
                initial={reduce ? false : { scaleX: 0 }}
                animate={started ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 0.5, delay: 1.2, ease: EASE_OUT }}
              />
            </div>
          </motion.div>

          <motion.div {...rise(1.5)} className="mt-5 pl-3 border-l-2 border-[#e15c46]">
            <div className="text-[9px] tracking-widest text-white/35">HELIO RETURNS</div>
            <div className="mt-1 text-sm md:text-base font-bold text-white">No team owns it.</div>
            <div className="mt-1 text-[10px] text-white/45">
              0 rows · <span className="text-[#e15c46]">OWNED_BY: null</span>
            </div>
          </motion.div>
        </div>

        {/* Animated canvas */}
        <div
          className="lg:col-span-7 relative p-5 md:p-8 bg-[#181817] cad-grid-pattern overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between text-[9px] tracking-widest text-white/35 mb-6">
            <span>QUERY 04 · RETURN t.name</span>
            <span className="text-white/25">GRAPH</span>
          </div>

          <div className="flex-1 flex items-center py-4 md:py-6">
            <div className="flex items-center w-full">
              <motion.div
                {...rise(0.25)}
                className="relative shrink-0 border border-white/25 bg-[#e15c46] px-3 py-2 text-[9px] md:text-[10px] font-bold text-white"
              >
                config-service
                <span className="absolute -bottom-5 left-0 text-[8px] font-normal tracking-widest text-white/35">
                  :Service
                </span>
              </motion.div>

              {/* The attempted traversal, and where it stops. */}
              <div className="relative flex-1 h-9 mx-1">
                <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-white/10" />

                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[58%]">
                  <motion.div
                    className="h-px w-full origin-left"
                    style={{
                      background:
                        'linear-gradient(90deg, #e15c46 0%, #e15c46 72%, rgba(225,92,70,0.12) 100%)',
                    }}
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={started ? { scaleX: 1 } : { scaleX: 0 }}
                    transition={{ duration: 0.85, delay: 0.7, ease: EASE_OUT }}
                  />
                </div>

                <div className="absolute top-1/2 left-[58%] -translate-x-1/2 -translate-y-1/2">
                  <motion.div
                    className="flex flex-col items-center"
                    initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                    animate={started ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.3, delay: 1.5, ease: EASE_OUT }}
                  >
                    <span className="text-[#e15c46] text-sm leading-none">∅</span>
                    <span className="hidden sm:block mt-1 text-[7px] tracking-widest text-[#e15c46]/80 whitespace-nowrap">
                      NO EDGE
                    </span>
                  </motion.div>
                </div>
              </div>

              <motion.div
                initial={reduce ? false : { opacity: 0 }}
                animate={started ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.4, delay: 1.4 }}
                className="relative shrink-0 w-[88px] md:w-[118px] h-9 border border-dashed border-white/30 flex items-center justify-center text-[9px] md:text-[10px] text-white/35"
              >
                ? t:Team
                <span className="absolute -bottom-5 left-0 text-[8px] tracking-widest text-white/25">
                  not in graph
                </span>
              </motion.div>
            </div>
          </div>

          {/* What the graph returned */}
          <div className="mt-8 bg-black/40 border border-white/10 px-3 py-2.5 text-[9px] md:text-[10px] leading-relaxed">
            <div className="text-white/30 tracking-widest text-[8px]">CYPHER</div>
            <div className="text-emerald-400/80">
              {"MATCH (s:Service {name:'config-service'})"}
            </div>
            <div className="text-emerald-400/80 pl-3">-[:OWNED_BY]-&gt;(t:Team)</div>
            <div className="text-emerald-400/80">RETURN t.name</div>

            <motion.div
              {...rise(1.9)}
              className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between"
            >
              <span className="text-white/40 tracking-widest">ROWS</span>
              <span>
                <span className="text-[#e15c46] font-bold">0</span>
                <span className="ml-2 text-white/30">// t.name = null</span>
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};
