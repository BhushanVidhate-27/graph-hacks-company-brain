import React from 'react';

const LEAF =
  'M32 12 L36 26 L48 22 L42 34 L56 38 L44 46 L50 62 L34 54 L32 70 L30 54 L14 62 L20 46 L8 38 L22 34 L16 22 L28 26 Z';

interface LeafSpec {
  left: number;
  size: number;
  delay: number;
  dur: number;
  hue: string;
}

const LEAVES: LeafSpec[] = [
  { left: 6, size: 34, delay: 0.0, dur: 14, hue: '#b8860b' },
  { left: 14, size: 46, delay: 2.0, dur: 18, hue: '#cd5c5c' },
  { left: 24, size: 28, delay: 4.5, dur: 15, hue: '#a0522d' },
  { left: 33, size: 40, delay: 6.5, dur: 20, hue: '#b8860b' },
  { left: 42, size: 32, delay: 1.5, dur: 16, hue: '#cd5c5c' },
  { left: 51, size: 44, delay: 3.2, dur: 19, hue: '#8b4513' },
  { left: 60, size: 30, delay: 5.5, dur: 14, hue: '#a0522d' },
  { left: 69, size: 38, delay: 0.8, dur: 17, hue: '#cd5c5c' },
  { left: 78, size: 42, delay: 4.0, dur: 21, hue: '#b8860b' },
  { left: 87, size: 26, delay: 2.8, dur: 13, hue: '#8b4513' },
  { left: 94, size: 32, delay: 7.5, dur: 18, hue: '#cd5c5c' },
];

export const MapleFall: React.FC = () => (
  <div aria-hidden="true" className="maple-fall pointer-events-none absolute inset-0 overflow-hidden">
    {LEAVES.map((l) => (
      <svg
        key={`${l.left}-${l.size}-${l.delay}`}
        className="maple-fall__leaf"
        style={{
          left: `${l.left}%`,
          width: l.size,
          height: l.size,
          animationDuration: `${l.dur}s`,
          animationDelay: `${l.delay}s`,
          color: l.hue,
        }}
        viewBox="0 0 64 84"
        fill="currentColor"
      >
        <path d={LEAF} />
      </svg>
    ))}
  </div>
);

export default MapleFall;
