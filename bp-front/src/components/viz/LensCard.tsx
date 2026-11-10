import React from 'react';
import LiquidGlass from 'liquid-glass-js';
import { useReducedMotion } from '../../lib/utils';

/**
 * A provenance card with a real optical lens floating over it. The lens
 * refracts the card itself (not a blurred copy), so the trail reads larger
 * where the glass sits — a literal "look closer" affordance.
 *
 * Only enabled on fine pointers; touch and reduced-motion users get the card.
 */
export const LensCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const holder = React.useRef<HTMLDivElement>(null);
  const card = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (reduced) return;
    const holderNode = holder.current;
    const cardNode = card.current;
    if (!holderNode || !cardNode) return;
    if (window.matchMedia('(max-width: 767px)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const rect = cardNode.getBoundingClientRect();
    if (rect.width === 0) return;

    const glass = new LiquidGlass({
      background: cardNode,
      width: 172,
      height: 172,
      radius: 86,
      scale: 26,
      depth: 14,
      chroma: 0.07,
      blur: 0,
      tint: 0.06,
      edge: 0.45,
      specAngle: 215,
      draggable: true,
      zIndex: 30,
      x: rect.left + rect.width * 0.58,
      y: rect.top + rect.height * 0.28,
    });

    // The lens is a fixed overlay, so it has to follow the card as the page
    // scrolls or the layout shifts. Otherwise it floats over unrelated content.
    const place = () => {
      const current = cardNode.getBoundingClientRect();
      glass.moveTo(current.left + current.width * 0.58, current.top + current.height * 0.28);
    };
    place();

    const onResize = () => {
      glass.refresh();
      place();
    };
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(place);
    observer.observe(cardNode);

    return () => {
      window.removeEventListener('scroll', place);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      glass.destroy();
    };
  }, [reduced]);

  return (
    <div ref={holder} className={className}>
      <div
        ref={card}
        className="relative overflow-hidden rounded-2xl border border-line bg-ink-soft p-6"
      >
        {children}
      </div>
      <p className="mt-3 font-mono text-xs text-fog">
        <span className="text-accent">◉</span> drag the lens over the trail
      </p>
    </div>
  );
};
