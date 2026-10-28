import React, { useEffect, useState } from 'react';

interface CoordinateReadoutProps {
  /** `on-brand` switches the readout to white for use inside the coral CTA. */
  tone?: 'default' | 'on-brand';
  className?: string;
}

/**
 * Compact X/Y pointer readout. It lives inside the navbar CTA rather than in a
 * full-width status strip, so the page starts with the navbar itself.
 */
export const CoordinateReadout: React.FC<CoordinateReadoutProps> = ({
  tone = 'default',
  className = '',
}) => {
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCoords({ x: Math.round(e.clientX), y: Math.round(e.clientY) });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const onBrand = tone === 'on-brand';

  return (
    <div
      className={`flex items-center gap-1 font-mono text-[10px] leading-none tracking-wider select-none ${
        onBrand ? 'text-white/60' : 'text-[#5c5c56]'
      } ${className}`}
    >
      <span>X</span>
      <span
        className={`w-7 text-right tabular-nums ${
          onBrand ? 'text-white' : 'text-[#e15c46]'
        }`}
      >
        {coords.x}
      </span>
      <span className={onBrand ? 'text-white/30' : 'text-[#282828]/25'}>/</span>
      <span>Y</span>
      <span
        className={`w-7 text-right tabular-nums ${
          onBrand ? 'text-white' : 'text-[#e15c46]'
        }`}
      >
        {coords.y}
      </span>
      <span className={onBrand ? 'text-white/45' : 'text-[#282828]/40'}>PX</span>
    </div>
  );
};
