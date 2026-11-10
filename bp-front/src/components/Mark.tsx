import React from 'react';
import { Liquid } from 'liquid-gooey';

/**
 * The Helio mark: three drops that merge gooily as the pointer approaches.
 * The drops are real DOM, so the effect keeps its shadow and stays crisp.
 */
export const Mark: React.FC<{ className?: string }> = ({ className }) => {
  const [active, setActive] = React.useState(false);

  return (
    <Liquid
      className={className}
      blur={7}
      contrast={24}
      fill="#ff5b3a"
      shadow="0 8px 18px rgba(255,91,58,0.35)"
      filterPadding={28}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      <Liquid.Item
        x={active ? 5 : 0}
        y={active ? 4 : 0}
        transition="bouncy"
        radius={10}
        className="absolute"
        style={{ left: 0, top: 10 }}
      >
        <span className="block h-5 w-5 rounded-full bg-accent" />
      </Liquid.Item>
      <Liquid.Item
        x={active ? 0 : 0}
        y={active ? 5 : 0}
        transition="bouncy"
        delay={45}
        radius={8}
        className="absolute"
        style={{ left: 18, top: 0 }}
      >
        <span className="block h-4 w-4 rounded-full bg-paper" />
      </Liquid.Item>
      <Liquid.Item
        x={active ? 2 : 0}
        y={active ? 9 : 0}
        transition="bouncy"
        delay={90}
        radius={6}
        className="absolute"
        style={{ left: 21, top: 17 }}
      >
        <span className="block h-3 w-3 rounded-full bg-[#ffb199]" />
      </Liquid.Item>
    </Liquid>
  );
};
