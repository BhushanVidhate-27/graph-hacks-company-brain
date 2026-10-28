import React, { useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { CadCrosshair } from './CadCrosshair';
import { EASE_OUT } from '../lib/motion';

/**
 * The signature traversal plot.
 *
 * A real blast-radius query (`payments-gateway`, HAS_DEPENDENT*1..3) is drawn
 * the way a CAD plotter would draw it: orthogonal risers, one hop layer at a
 * time, nodes printing as their incoming edge lands. The live route to the
 * deepest service stays in brand red so "one traversal, path shown" is visible
 * before the copy is read.
 */

const CHIP_H = 24;

interface BandNode {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Reveal delay in seconds. */
  delay: number;
  root?: boolean;
  route?: boolean;
}

interface BandEdge {
  from: string;
  to: string;
  /** Where the riser sits between the two chips. */
  bias: number;
  delay: number;
  route?: boolean;
}

const NODES: BandNode[] = [
  { id: 'payments', name: 'payments-gateway', x: 24, y: 115, delay: 0.05, root: true },
  { id: 'checkout', name: 'checkout-api', x: 250, y: 30, delay: 0.54 },
  { id: 'ledger', name: 'ledger-service', x: 250, y: 80, delay: 0.59, route: true },
  { id: 'core', name: 'ledger-core', x: 250, y: 130, delay: 0.64 },
  { id: 'fraud', name: 'fraud-engine', x: 250, y: 180, delay: 0.69 },
  { id: 'subscription', name: 'subscription-worker', x: 520, y: 30, delay: 1.1 },
  { id: 'notification', name: 'notification-worker', x: 520, y: 95, delay: 1.18, route: true },
  { id: 'dispute', name: 'dispute-service', x: 520, y: 165, delay: 1.26 },
  { id: 'reconciliation', name: 'reconciliation-worker', x: 760, y: 95, delay: 1.7, route: true },
];

const EDGES: BandEdge[] = [
  { from: 'payments', to: 'checkout', bias: 0.28, delay: 0.12 },
  { from: 'payments', to: 'ledger', bias: 0.44, delay: 0.2, route: true },
  { from: 'payments', to: 'core', bias: 0.6, delay: 0.28 },
  { from: 'payments', to: 'fraud', bias: 0.76, delay: 0.36 },
  { from: 'checkout', to: 'subscription', bias: 0.5, delay: 0.68 },
  { from: 'ledger', to: 'notification', bias: 0.45, delay: 0.76, route: true },
  { from: 'ledger', to: 'dispute', bias: 0.62, delay: 0.84 },
  { from: 'notification', to: 'reconciliation', bias: 0.5, delay: 1.3, route: true },
];

const chipWidth = (name: string) => Math.round(name.length * 6.1 + 20);
const nodeById = (id: string) => NODES.find((n) => n.id === id)!;

const edgePath = (edge: BandEdge) => {
  const from = nodeById(edge.from);
  const to = nodeById(edge.to);
  const sx = from.x + chipWidth(from.name);
  const sy = from.y;
  const tx = to.x;
  const ty = to.y;
  const mx = sx + (tx - sx) * edge.bias;
  return `M ${sx} ${sy} H ${mx} V ${ty} H ${tx}`;
};

export const TraversalBand: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const [run, setRun] = useState(0);
  const start = inView || Boolean(reduce);

  return (
    <section className="relative w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-10 select-none">
      <div ref={ref} className="relative bg-[#f4f4ec] cad-border">
        <CadCrosshair position="tl" />
        <CadCrosshair position="tr" />
        <CadCrosshair position="bl" />
        <CadCrosshair position="br" />

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3.5 cad-border-b">
          <div className="flex items-center gap-3">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-wide text-[#282828]">
              One query · eight services · three hops
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-[#5c5c56]">
            <button
              type="button"
              onClick={() => setRun((value) => value + 1)}
              className="flex items-center gap-1.5 border border-[#282828]/30 px-2 py-1 text-[#282828] hover:bg-[#282828] hover:text-white transition-colors"
            >
              <span aria-hidden>↻</span>
              REPLAY
            </button>
            <span className="md:hidden text-[#282828]/40 tracking-wider">DRAG TO PAN</span>
          </div>
        </div>

        {/* Plot: pans horizontally on narrow screens instead of shrinking labels. */}
        <div
          className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          data-no-swipe
        >
          <div className="min-w-[820px] md:min-w-0">
            <svg
              viewBox="0 0 1000 220"
              role="img"
              aria-label="Dependency traversal from payments-gateway: eight downstream services across three hops, with the route to reconciliation-worker highlighted."
              className="block w-full h-auto"
            >
              {/* Hop guides */}
              {[
                { x: 250, label: 'HOP 1' },
                { x: 520, label: 'HOP 2' },
                { x: 760, label: 'HOP 3' },
              ].map((guide) => (
                <g key={guide.label}>
                  <line
                    x1={guide.x}
                    y1={20}
                    x2={guide.x}
                    y2={208}
                    stroke="rgba(40,40,40,0.14)"
                    strokeWidth={1}
                    strokeDasharray="2 5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={guide.x}
                    y={11}
                    fontSize={8}
                    letterSpacing="1.4"
                    fill="rgba(40,40,40,0.4)"
                    style={{ fontFamily: 'inherit' }}
                  >
                    {guide.label}
                  </text>
                </g>
              ))}

              <text
                x={24}
                y={11}
                fontSize={8}
                letterSpacing="1.4"
                fill="#e15c46"
                style={{ fontFamily: 'inherit' }}
              >
                ROOT
              </text>

              <g key={run}>
                {EDGES.map((edge) => (
                  <motion.path
                    key={`${edge.from}-${edge.to}`}
                    d={edgePath(edge)}
                    fill="none"
                    stroke={edge.route ? '#e15c46' : 'rgba(40,40,40,0.30)'}
                    strokeWidth={edge.route ? 1.8 : 1.2}
                    vectorEffect="non-scaling-stroke"
                    initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                    animate={start ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                    transition={{
                      pathLength: { duration: 0.42, delay: edge.delay, ease: EASE_OUT },
                      opacity: { duration: 0.12, delay: edge.delay },
                    }}
                  />
                ))}

                {NODES.map((node) => {
                  const width = chipWidth(node.name);
                  const onRoute = Boolean(node.route);
                  const fill = node.root ? '#282828' : onRoute ? '#e15c46' : '#f4f4ec';
                  const text = node.root || onRoute ? '#ffffff' : '#282828';
                  const stroke = node.root || onRoute ? '#282828' : 'rgba(40,40,40,0.45)';

                  return (
                    <motion.g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y - CHIP_H / 2})`}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={start ? { opacity: 1 } : { opacity: 0 }}
                      transition={{ duration: 0.35, delay: node.delay, ease: EASE_OUT }}
                    >
                      <rect
                        width={width}
                        height={CHIP_H}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={1}
                        vectorEffect="non-scaling-stroke"
                      />
                      {node.root && <rect width={3} height={CHIP_H} fill="#e15c46" />}
                      <text
                        x={node.root ? 12 : 10}
                        y={CHIP_H / 2 + 3.5}
                        fontSize={10}
                        fontWeight={700}
                        letterSpacing="0.2"
                        fill={text}
                        style={{ fontFamily: 'inherit' }}
                      >
                        {node.name}
                      </text>
                    </motion.g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>

        {/* Readout */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 px-4 md:px-6 py-3 cad-border-t text-[10px]">
          <div className="flex items-start gap-2 min-w-0">
            <span className="w-2 h-2 mt-1 bg-[#e15c46] shrink-0" />
            <span className="text-[#5c5c56] shrink-0">PATH:</span>
            <span className="font-bold text-[#282828] leading-relaxed break-words">
              payments-gateway → ledger-service → notification-worker → reconciliation-worker
            </span>
          </div>

          <div className="flex items-center gap-3 text-[#5c5c56] shrink-0">
            <span>8 DOWNSTREAM</span>
            <span className="text-[#282828]/20">·</span>
            <span>3 HOPS</span>
            <span className="text-[#282828]/20">·</span>
            <span className="font-bold text-[#282828]">0 INVENTED</span>
          </div>
        </div>
      </div>
    </section>
  );
};
