import React from 'react';
import { Liquid } from 'liquid-gooey';

/**
 * The Helio mark: three drops that merge gooily as the pointer approaches.
 * Items are inline-block so they sit in one row; the x/y offsets are what pull
 * them apart at rest and let the liquid bridge them on hover.
 */
export const Mark: React.FC<{ className?: string }> = ({ className }) => {
  const [active, setActive] = React.useState(false);

  return (
    <Liquid
      className={className}
      blur={7}
      contrast={22}
      fill="#ff5b3a"
      shadow="0 8px 18px rgba(255,91,58,0.35)"
      filterPadding={28}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      <Liquid.Item
        x={active ? 6 : 0}
        y={active ? 3 : 0}
        transition="bouncy"
        radius={10}
        className="inline-block h-5 w-5 align-top"
      >
        <span className="block h-full w-full rounded-full bg-accent" />
      </Liquid.Item>
      <Liquid.Item
        x={active ? 16 : 14}
        y={active ? 4 : 4}
        transition="bouncy"
        delay={45}
        radius={8}
        className="inline-block h-4 w-4 align-top"
      >
        <span className="block h-full w-full rounded-full bg-paper" />
      </Liquid.Item>
      <Liquid.Item
        x={active ? 22 : 26}
        y={active ? 9 : 12}
        transition="bouncy"
        delay={90}
        radius={6}
        className="inline-block h-3 w-3 align-top"
      >
        <span className="block h-full w-full rounded-full bg-[#ffb199]" />
      </Liquid.Item>
    </Liquid>
  );
};
