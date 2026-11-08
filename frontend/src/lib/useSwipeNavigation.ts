import React, { useRef } from 'react';

const IGNORE_SELECTOR = 'input, textarea, select, [contenteditable="true"], [role="slider"], [data-no-swipe]';

interface SwipeHandlers {
  onTouchStart: React.TouchEventHandler<HTMLElement>;
  onTouchEnd: React.TouchEventHandler<HTMLElement>;
}

/**
 * Horizontal touch swipe. Vertical gestures are left alone so normal page
 * scrolling keeps working; the caller decides what a left/right swipe means.
 */
export const useSwipeNavigation = (
  enabled: boolean,
  onSwipe: (direction: 1 | -1) => void,
): SwipeHandlers => {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart: React.TouchEventHandler<HTMLElement> = (event) => {
    if (!enabled || event.touches.length !== 1) {
      start.current = null;
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest(IGNORE_SELECTOR)) {
      start.current = null;
      return;
    }

    start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const onTouchEnd: React.TouchEventHandler<HTMLElement> = (event) => {
    const origin = start.current;
    start.current = null;

    if (!enabled || !origin || event.changedTouches.length === 0) return;

    const dx = event.changedTouches[0].clientX - origin.x;
    const dy = event.changedTouches[0].clientY - origin.y;

    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.4) return;

    onSwipe(dx < 0 ? 1 : -1);
  };

  return { onTouchStart, onTouchEnd };
};
