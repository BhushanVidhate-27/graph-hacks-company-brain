import React, { useEffect, useRef, useState } from 'react';

/**
 * Static plus cursor with luminance-aware colour.
 *
 * The native cursor is hidden in CSS; this is the only thing drawn at the
 * pointer position: four ticks, no trailing, no lock frame, no label. It is
 * written in the same frame as the pointer so it reads as the cursor itself.
 *
 * The mark is near-black on light surfaces and white on dark ones, so it stays
 * legible over the cream canvas, the coral nodes and the dark proof panels.
 * A live X/Y PX readout rides alongside the mark and inherits that colour.
 * Text fields keep their native I-beam and hide the plus.
 */

type Rgba = [number, number, number, number];

const parseRgb = (value: string): Rgba | null => {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;

  const parts = match[1]
    .split(/[,\s/]+/)
    .filter(Boolean)
    .map(Number);

  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
};

const luminance = ([r, g, b]: Rgba) => {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** Nearest painted background wins; 0.18 is where black and white contrast. */
const cursorColorFor = (element: Element | null) => {
  let node = element;

  while (node) {
    const background = parseRgb(getComputedStyle(node).backgroundColor);
    if (background && background[3] > 0.1) {
      return luminance(background) > 0.18 ? '#161616' : '#ffffff';
    }
    node = node.parentElement;
  }

  return '#161616';
};

export const PlusCursor: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const xRef = useRef<HTMLSpanElement>(null);
  const yRef = useRef<HTMLSpanElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(pointer: fine)');
    const sync = () => setEnabled(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const cursor = ref.current;
    if (!cursor) return;
    const readout = readoutRef.current;
    const xText = xRef.current;
    const yText = yRef.current;

    let seen = false;
    let lastColor = '';
    let lastX = 0;
    let lastY = 0;
    let frame = 0;
    let settleTimer = 0;

    const paintAt = (x: number, y: number) => {
      const next = cursorColorFor(document.elementFromPoint(x, y));
      if (next !== lastColor) {
        lastColor = next;
        cursor.style.color = next;
      }
    };

    const onMove = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const overText = Boolean(
        target?.closest('input, textarea, select, [contenteditable="true"]'),
      );

      lastX = event.clientX;
      lastY = event.clientY;

      if (!seen) {
        seen = true;
        document.documentElement.classList.add('plus-cursor-active');
      }

      cursor.style.transform = `translate3d(${lastX}px, ${lastY}px, 0)`;
      cursor.style.opacity = overText ? '0' : '1';
      paintAt(lastX, lastY);

      if (xText) xText.textContent = String(Math.round(lastX));
      if (yText) yText.textContent = String(Math.round(lastY));
      if (readout) {
        // Sit beside the mark, flipping before the viewport edges.
        const flipX = window.innerWidth - lastX < 150;
        const flipY = window.innerHeight - lastY < 48;
        readout.style.transform = `translate(${
          flipX ? 'calc(-100% - 16px)' : '16px'
        }, ${flipY ? 'calc(-100% - 14px)' : '14px'})`;
      }

      // Card hovers animate from light to dark; re-sample once things settle.
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => paintAt(lastX, lastY), 350);
    };

    // The page scrolls under a resting pointer; re-check the surface then.
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        paintAt(lastX, lastY);
      });
    };

    const hide = () => {
      cursor.style.opacity = '0';
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.addEventListener('mouseleave', hide);
    window.addEventListener('blur', hide);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mouseleave', hide);
      window.removeEventListener('blur', hide);
      document.documentElement.classList.remove('plus-cursor-active');
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      data-plus-cursor
      className="fixed left-0 top-0 z-[70] pointer-events-none opacity-0"
    >
      <div className="absolute -translate-x-1/2 -translate-y-1/2">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M0 11H7" stroke="currentColor" strokeWidth="1" />
          <path d="M15 11H22" stroke="currentColor" strokeWidth="1" />
          <path d="M11 0V7" stroke="currentColor" strokeWidth="1" />
          <path d="M11 15V22" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>

      <div
        ref={readoutRef}
        style={{ transform: 'translate(16px, 14px)' }}
        className="absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap font-mono text-[9px] leading-none tracking-wider"
      >
        <span className="opacity-55">X</span>
        <span ref={xRef} className="w-7 text-right tabular-nums">
          0
        </span>
        <span className="opacity-30">/</span>
        <span className="opacity-55">Y</span>
        <span ref={yRef} className="w-7 text-right tabular-nums">
          0
        </span>
        <span className="opacity-45">PX</span>
      </div>
    </div>
  );
};
