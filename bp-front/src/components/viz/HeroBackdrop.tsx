import React from 'react';
import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { useReducedMotion } from '../../lib/utils';

/**
 * Full-bleed animated shader wash behind the hero. Purely decorative: the
 * canvas ignores the pointer, and reduced-motion users get a static gradient.
 */
export const HeroBackdrop: React.FC<{ className?: string }> = ({ className }) => {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div
        aria-hidden="true"
        className={className}
        style={{
          background:
            'radial-gradient(60% 50% at 70% 20%, rgba(255,91,58,0.22) 0%, rgba(255,91,58,0) 70%), radial-gradient(50% 40% at 20% 80%, rgba(99,214,164,0.10) 0%, rgba(99,214,164,0) 70%), #08080a',
        }}
      />
    );
  }

  return (
    <div className={className}>
      <ShaderGradientCanvas
        pixelDensity={1.25}
        fov={42}
        pointerEvents="none"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <ShaderGradient
          control="props"
          type="plane"
          animate="on"
          uSpeed={0.18}
          uStrength={1.2}
          uDensity={2.2}
          uFrequency={0.9}
          uAmplitude={0.1}
          color1="#e04a2c"
          color2="#180c08"
          color3="#08080a"
          positionX={0.2}
          positionY={-0.05}
          rotationX={0}
          rotationY={0}
          reflection={0.04}
          grain="off"
          brightness={0.9}
        />
      </ShaderGradientCanvas>
    </div>
  );
};
