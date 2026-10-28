import React, { useRef, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '../../lib/motion';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Slide distance in px before reveal. */
  y?: number;
  /** Enter blur in px. Kept small so text stays readable while moving. */
  blur?: number;
  duration?: number;
  delay?: number;
  once?: boolean;
  amount?: number;
}

/**
 * Adapted from beUI's ScrollReveal (MIT):
 * https://beui.dev/r/scroll-reveal.json
 *
 * Reduced-motion visitors get a plain fade instead of slide + blur.
 */
export const Reveal: React.FC<RevealProps> = ({
  children,
  className = '',
  y = 18,
  blur = 6,
  duration = 0.65,
  delay = 0,
  once = true,
  amount = 0.2,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount });
  const reduce = useReducedMotion();

  const hidden = reduce
    ? { opacity: 0 }
    : { opacity: 0, y, filter: `blur(${blur}px)` };
  const shown = reduce
    ? { opacity: 1 }
    : { opacity: 1, y: 0, filter: 'blur(0px)' };

  return (
    <motion.div
      ref={ref}
      initial={hidden}
      animate={inView ? shown : hidden}
      transition={{ duration, ease: EASE_OUT, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
