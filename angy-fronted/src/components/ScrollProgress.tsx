import React from 'react';
import { motion, useScroll, useSpring } from 'motion/react';

/**
 * Thin progress rule pinned to the bottom edge of the navbar. It gives the
 * long single-page narrative a sense of position without adding another HUD.
 */
export const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    mass: 0.3,
  });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="absolute bottom-0 left-0 right-0 h-[2px] origin-left bg-[#e15c46]"
    />
  );
};
