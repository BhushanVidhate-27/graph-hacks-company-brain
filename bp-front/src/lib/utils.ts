import React from 'react';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** True when the user has asked the OS for reduced motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/** True below the given breakpoint; SSR-safe. */
export function useIsSmallScreen(maxWidth = 768): boolean {
  const [small, setSmall] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${maxWidth - 1}px)`).matches,
  );

  React.useEffect(() => {
    const query = window.matchMedia(`(max-width: ${maxWidth - 1}px)`);
    const onChange = (event: MediaQueryListEvent) => setSmall(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [maxWidth]);

  return small;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
