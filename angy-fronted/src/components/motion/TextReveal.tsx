import React, { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { EASE_OUT, SPRING_SOFT } from '../../lib/motion';

interface TextRevealProps {
  text: string | string[];
  className?: string;
  lineClassNames?: string[];
  stagger?: number;
  delay?: number;
  blur?: number;
  yOffset?: string | number;
  once?: boolean;
  whileInView?: boolean;
}

/**
 * Adapted from beUI's TextReveal (MIT):
 * https://beui.dev/r/text-reveal.json
 *
 * Words are wrapped in inline-block spans so long lines still wrap naturally.
 */
export const TextReveal: React.FC<TextRevealProps> = ({
  text,
  className = '',
  lineClassNames = [],
  stagger = 0.055,
  delay = 0,
  blur = 8,
  yOffset = '38%',
  once = true,
  whileInView = false,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once, amount: 0.35 });
  const reduce = useReducedMotion();
  const shouldAnimate = whileInView ? inView : true;

  const lines = Array.isArray(text) ? text : [text];
  let unitIndex = 0;

  return (
    <span ref={ref} className={className}>
      {lines.map((line, lineIndex) => {
        const groups = line.match(/\S+\s*|\s+/g) ?? [];

        return (
          <span
            key={`${line}-${lineIndex}`}
            className={`block ${lineClassNames[lineIndex] ?? ''}`}
          >
            {groups.map((group, groupIndex) => {
              const wordDelay = delay + unitIndex * stagger;
              unitIndex += 1;

              const hidden = reduce
                ? { opacity: 0 }
                : { y: yOffset, opacity: 0, filter: `blur(${blur}px)` };
              const shown = reduce
                ? { opacity: 1 }
                : { y: 0, opacity: 1, filter: 'blur(0px)' };

              return (
                <motion.span
                  key={`${group}-${groupIndex}`}
                  initial={hidden}
                  animate={shouldAnimate ? shown : hidden}
                  transition={
                    reduce
                      ? { opacity: { duration: 0.3, ease: EASE_OUT, delay: wordDelay * 0.3 } }
                      : {
                          y: { ...SPRING_SOFT, delay: wordDelay },
                          opacity: { duration: 0.65, ease: EASE_OUT, delay: wordDelay },
                          filter: { duration: 0.8, ease: EASE_OUT, delay: wordDelay },
                        }
                  }
                  className="inline-block whitespace-pre will-change-transform"
                >
                  {group}
                </motion.span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
};
