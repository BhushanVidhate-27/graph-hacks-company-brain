import React from 'react';
import { Sparkle } from 'lucide-react';

interface TickerBarProps {
  items: string[];
  /** brand = orange promo bar (top of page); dark = light text on black; light = dark text on cream. */
  variant?: 'brand' | 'dark' | 'light';
  /** Render each item as a bordered chip (integration list). */
  chip?: boolean;
  className?: string;
  /** Seconds for one full loop. */
  speed?: number;
  label?: string;
}

/**
 * Infinite scrolling ticker, Hostinger-style: a full-bleed strip whose items
 * drift left on a seamless loop (content duplicated once, track translates
 * -50%). Pauses on hover, stops under prefers-reduced-motion.
 *
 * Used for the top announcement bar, the hero sub-bar and the proof strip —
 * places that were previously static text lines.
 */
export const TickerBar: React.FC<TickerBarProps> = ({
  items,
  variant = 'dark',
  chip = false,
  className = '',
  speed = 30,
  label,
}) => {
  const brand = variant === 'brand';
  const light = variant === 'light';
  return (
    <div
      role={label ? undefined : 'marquee'}
      aria-label={label}
      className={`ticker overflow-hidden select-none ${className}`}
      style={
        brand
          ? undefined
          : {
              maskImage:
                'linear-gradient(to right, transparent, black 4rem, black calc(100% - 4rem), transparent)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent, black 4rem, black calc(100% - 4rem), transparent)',
            }
      }
    >
      <div
        className="ticker-track flex w-max items-center"
        style={{ animationDuration: `${speed}s` }}
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            aria-hidden={copy === 1}
            className="flex shrink-0 items-center gap-8 pr-8 md:gap-12 md:pr-12"
          >
            {items.map((item, i) => (
              <span key={`${copy}-${i}`} className="flex shrink-0 items-center gap-8 md:gap-12">
                {chip ? (
                  <span
                    className={`inline-flex items-center px-4 py-2 font-mono text-[11px] uppercase tracking-wider whitespace-nowrap ${
                      brand
                        ? 'border border-white/50 text-white'
                        : light
                          ? 'border border-[#282828]/20 text-[#282828]'
                          : 'border border-white/10 text-white/60'
                    }`}
                  >
                    {item}
                  </span>
                ) : (
                  <span
                    className={`font-mono text-[11px] font-bold uppercase tracking-[0.18em] whitespace-nowrap ${
                      brand ? 'text-white' : light ? 'text-[#282828]' : 'text-white/70'
                    }`}
                  >
                    {item}
                  </span>
                )}
                <Sparkle
                  aria-hidden="true"
                  className={`size-3 shrink-0 ${brand ? 'text-white/80' : 'text-[#e15c46]'}`}
                />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Top announcement bar, above the navbar like the reference screenshot. */
export const AnnouncementTicker: React.FC = () => (
  <TickerBar
    variant="brand"
    speed={26}
    label="Helio offers"
    className="bg-[#e15c46] py-2"
    items={[
      '50 free questions / month',
      'No card required',
      'Every answer shows its path',
      '14-day free trial',
      'Cancel anytime',
      'Open-source core',
    ]}
  />
);

export default TickerBar;
