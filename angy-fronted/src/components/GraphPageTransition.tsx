import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import { ViewMode } from '../types';

export type TransitionPhase = 'idle' | 'out' | 'in';

/**
 * The primary pages, arranged as a small graph. The same coordinates are used
 * by the page shrink/grow animation and by the overlay, so a page visually
 * collapses into its node and the next page grows back out of another one.
 */
export const GRAPH_PAGES: { mode: ViewMode; label: string; x: number; y: number }[] = [
  { mode: 'website', label: 'SITE', x: 18, y: 68 },
  { mode: 'chat-widget', label: 'AGENT', x: 40, y: 32 },
  { mode: 'dashboard', label: 'CONSOLE', x: 62, y: 68 },
  { mode: 'account', label: 'ACCOUNT', x: 84, y: 32 },
];

export const pageIndex = (mode: ViewMode) => GRAPH_PAGES.findIndex((page) => page.mode === mode);

/**
 * Utility screens (auth, device preview) borrow the nearest graph node so the
 * transition still has somewhere to collapse into.
 */
export const transitionIndex = (mode: ViewMode) => {
  if (mode === 'auth') return pageIndex('account');
  if (mode === 'viewport') return pageIndex('website');
  return pageIndex(mode);
};

const EXIT_TRANSITION: Transition = { duration: 0.36, ease: [0.7, 0, 0.84, 0] };
const ENTER_TRANSITION: Transition = { duration: 0.58, ease: [0.16, 1, 0.3, 1] };

interface PageTransitionFrameProps {
  phase: TransitionPhase;
  fromIndex: number;
  toIndex: number;
  children: React.ReactNode;
}

/**
 * Wraps the active page. While transitioning it clips the page to one viewport
 * and scales that viewport-sized card into (or out of) a graph node.
 */
export const PageTransitionFrame: React.FC<PageTransitionFrameProps> = ({
  phase,
  fromIndex,
  toIndex,
  children,
}) => {
  const reduceMotion = useReducedMotion();
  const [viewport, setViewport] = useState({
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
  });

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const activeIndex = phase === 'out' ? fromIndex : toIndex;
  const node = GRAPH_PAGES[activeIndex];
  const navbarHeight = viewport.width >= 768 ? 65 : 57;
  const origin = node
    ? {
        x: (node.x / 100) * viewport.width,
        y: (node.y / 100) * viewport.height - navbarHeight,
      }
    : { x: viewport.width / 2, y: viewport.height / 2 };

  const locked = phase !== 'idle';

  return (
    <>
      <motion.div
        initial={false}
        animate={
          phase === 'out'
            ? reduceMotion
              ? { opacity: 0 }
              : {
                  scale: 0.04,
                  opacity: [1, 1, 0],
                  filter: ['blur(0px)', 'blur(0px)', 'blur(7px)'],
                }
            : reduceMotion
              ? { opacity: 1 }
              : {
                  scale: 1,
                  opacity: [0, 1, 1],
                  filter: ['blur(7px)', 'blur(0px)', 'blur(0px)'],
                }
        }
        transition={
          phase === 'out'
            ? { ...EXIT_TRANSITION, times: [0, 0.72, 1] }
            : { ...ENTER_TRANSITION, times: [0, 0.35, 1] }
        }
        className="relative z-20 bg-[#ecece4]"
        style={{
          transformOrigin: `${origin.x}px ${origin.y}px`,
          height: locked ? '100dvh' : undefined,
          overflow: locked ? 'hidden' : undefined,
          willChange: locked ? 'transform, opacity, filter' : undefined,
        }}
      >
        {children}
      </motion.div>

      <GraphTransitionOverlay
        fromIndex={fromIndex}
        toIndex={toIndex}
        visible={phase !== 'idle'}
      />
    </>
  );
};

interface GraphTransitionOverlayProps {
  fromIndex: number;
  toIndex: number;
  visible: boolean;
}

const GraphTransitionOverlay: React.FC<GraphTransitionOverlayProps> = ({
  fromIndex,
  toIndex,
  visible,
}) => {
  const from = GRAPH_PAGES[fromIndex];
  const to = GRAPH_PAGES[toIndex];
  const pathStart = Math.min(fromIndex, toIndex);
  const pathEnd = Math.max(fromIndex, toIndex);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-10 pointer-events-none overflow-hidden bg-[#ecece4]/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.08, duration: 0.2 }}
          aria-hidden="true"
        >
          <svg className="absolute inset-0 w-full h-full" fill="none">
            {GRAPH_PAGES.slice(0, -1).map((node, index) => {
              const next = GRAPH_PAGES[index + 1];
              const active = index >= pathStart && index < pathEnd;
              return (
                <motion.line
                  key={node.mode}
                  x1={`${node.x}%`}
                  y1={`${node.y}%`}
                  x2={`${next.x}%`}
                  y2={`${next.y}%`}
                  stroke={active ? '#e15c46' : '#282828'}
                  strokeOpacity={active ? 0.75 : 0.16}
                  strokeWidth={active ? 1.5 : 1}
                  strokeDasharray={active ? '5 5' : undefined}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                />
              );
            })}
          </svg>

          {from && to && fromIndex !== toIndex && (
            <motion.span
              className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e15c46] shadow-[0_0_16px_#e15c46]"
              initial={{ left: `${from.x}%`, top: `${from.y}%`, opacity: 0 }}
              animate={{
                left: `${to.x}%`,
                top: `${to.y}%`,
                opacity: [0, 1, 1, 0],
              }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            />
          )}

          {GRAPH_PAGES.map((node, index) => {
            const isTarget = index === toIndex;
            const isSource = index === fromIndex;

            return (
              <div
                key={node.mode}
                className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                {isTarget && (
                  <motion.span
                    className="absolute inset-0 rounded-full border border-[#e15c46]"
                    initial={{ scale: 1, opacity: 0.9 }}
                    animate={{ scale: [1, 4], opacity: [0.9, 0] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}

                <span
                  className={`relative block w-2.5 h-2.5 rounded-full border ${
                    isTarget
                      ? 'bg-[#e15c46] border-[#e15c46]'
                      : isSource
                        ? 'bg-[#282828] border-[#282828]'
                        : 'bg-[#ecece4] border-[#282828]/35'
                  }`}
                />

                <span
                  className={`absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] tracking-[0.18em] ${
                    isTarget ? 'text-[#e15c46]' : 'text-[#5c5c56]'
                  }`}
                >
                  {node.label}
                </span>
              </div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
