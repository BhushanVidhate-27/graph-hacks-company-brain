import React, { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { CadCrosshair } from './CadCrosshair';

/**
 * Contained still of the split inspector, assembled out of square tiles.
 *
 * SWAPPING THE ART
 * Change DEFAULT_IMAGE (or pass `src` / `alt` to <InspectorStillBand />). Any
 * replacement is center-cropped to the frame, so it never stretches. Pass
 * `aspect`, `title` or `footnote` to retarget the frame for new copy.
 *
 * The screenshot lives on a canvas. On every viewport entry, a 64 x 40 grid of
 * image tiles grows in from the left edge to the right: each tile appears as a
 * small white pixel, grows, and resolves into its slice of the frame. The result
 * reads like the image is being generated pixel by pixel rather than fading in
 * as one block.
 *
 * Replays on every pass (up or down), matching the site's scroll reveals.
 * Reduced-motion visitors get the finished frame with no animation.
 */

export const DEFAULT_IMAGE = {
  src: '/images/inspector-split.png',
  alt: 'Split view of the Helio inspector: stale flat keyword search on the left, verified graph traversal on the right.',
};

interface InspectorStillBandProps {
  /** Any image URL. Center-cropped to the frame, never stretched. */
  src?: string;
  alt?: string;
  title?: string;
  footnote?: string;
  /** CSS aspect-ratio for the frame, e.g. "16 / 10" or "1 / 1". */
  aspect?: string;
}

const COLS = 64;
const ROWS = 40;
const SWEEP = 2.2;
const CELL = 0.6;
const TOTAL = SWEEP + 0.22 + CELL;

/** Deterministic per-tile jitter so columns are not a clean vertical wipe. */
const scatter = (col: number, row: number) => {
  const value = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;

const sizeCanvas = (canvas: HTMLCanvasElement) => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(canvas.clientWidth));
  const height = Math.max(1, Math.round(canvas.clientHeight));
  const bufferWidth = Math.round(width * dpr);
  const bufferHeight = Math.round(height * dpr);

  if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
  }

  return { width, height, dpr };
};

export const InspectorStillBand: React.FC<InspectorStillBandProps> = ({
  src = DEFAULT_IMAGE.src,
  alt = DEFAULT_IMAGE.alt,
  title = 'Flat search vs. graph traversal — one frame',
  footnote = 'LEFT: STALE / TRAPPED · RIGHT: VERIFIED PATH',
  aspect = '16 / 10',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const inView = useInView(ref, { once: false, amount: 0.25 });
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    setReady(false);
    imageRef.current = null;

    const image = new Image();
    image.decoding = 'async';

    const markReady = () => {
      imageRef.current = image;
      setReady(true);
    };

    image.onload = markReady;
    image.src = src;
    if (image.complete) markReady();

    return () => {
      image.onload = null;
    };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dims = sizeCanvas(canvas);
    let last = 0;
    let frame = 0;

    const paint = (progress: number) => {
      last = progress;
      const { width: w, height: h, dpr } = dims;
      const cw = w / COLS;
      const ch = h / ROWS;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#151514';
      ctx.fillRect(0, 0, w, h);

      // Faint plot grid: visible wherever a tile has not landed yet.
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 1;
      for (let col = 1; col < COLS; col += 1) {
        const x = Math.round(col * cw) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let row = 1; row < ROWS; row += 1) {
        const y = Math.round(row * ch) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const image = imageRef.current;
      if (!image) return;

      // Center-crop any source to the frame. Nothing is ever stretched.
      const frameRatio = w / h;
      const imageRatio = image.width / image.height;
      let cropX = 0;
      let cropY = 0;
      let cropW = image.width;
      let cropH = image.height;

      if (imageRatio > frameRatio) {
        cropW = image.height * frameRatio;
        cropX = (image.width - cropW) / 2;
      } else {
        cropH = image.width / frameRatio;
        cropY = (image.height - cropH) / 2;
      }

      if (progress >= TOTAL) {
        // Land the exact frame once the last tile has settled.
        ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, w, h);
        return;
      }

      for (let col = 0; col < COLS; col += 1) {
        for (let row = 0; row < ROWS; row += 1) {
          const start = (col / (COLS - 1)) * SWEEP + scatter(col, row) * 0.22;
          const raw = (progress - start) / CELL;
          if (raw <= 0) continue;

          const settled = Math.min(raw, 1);
          const eased = easeOutCubic(settled);
          const x = col * cw;
          const y = row * ch;
          const scale = 0.45 + 0.55 * eased;

          // Draw the tile directly at its scaled size (no clip/save needed).
          const dw = (cw + 1) * scale;
          const dh = (ch + 1) * scale;
          const dx = x + (cw - dw) / 2;
          const dy = y + (ch - dh) / 2;

          const sx = cropX + (col * cropW) / COLS;
          const sy = cropY + (row * cropH) / ROWS;
          ctx.globalAlpha = 1;
          ctx.drawImage(
            image,
            sx,
            sy,
            cropW / COLS,
            cropH / ROWS,
            dx,
            dy,
            dw,
            dh,
          );

          // Each tile is a white pixel while it is settling. The white fades
          // as the slice of the image resolves underneath it.
          const flash = Math.max(0, 1 - raw / 0.6);
          if (flash > 0) {
            ctx.globalAlpha = flash;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(dx, dy, dw, dh);
          }
        }
      }

      // The writing edge of the sweep.
      const frontier = Math.min((progress / TOTAL) * w, w);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#e15c46';
      ctx.fillRect(frontier, 0, 1, h);
      ctx.globalAlpha = 1;
    };

    const observer = new ResizeObserver(() => {
      dims = sizeCanvas(canvas);
      paint(last);
    });
    observer.observe(canvas);

    if (!ready) {
      paint(0);
      return () => observer.disconnect();
    }

    if (reduce) {
      paint(TOTAL);
      return () => observer.disconnect();
    }

    if (!inView) {
      paint(0);
      return () => observer.disconnect();
    }

    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / 1000, TOTAL);
      paint(progress);
      if (progress < TOTAL) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [inView, ready, reduce, run]);

  return (
    <section className="relative w-full max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 select-none">
      <div ref={ref} className="relative bg-[#1c1c1b] cad-border">
        <CadCrosshair position="tl" tone="light" />
        <CadCrosshair position="tr" tone="light" />
        <CadCrosshair position="bl" tone="light" />
        <CadCrosshair position="br" tone="light" />

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3.5 border-b border-white/15">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-wide text-white/80">
              {title}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-white/40">
            <button
              type="button"
              onClick={() => setRun((value) => value + 1)}
              className="flex items-center gap-1.5 border border-white/20 px-2 py-1 text-white/70 hover:bg-white hover:text-[#1c1c1b] transition-colors"
            >
              <span aria-hidden>↻</span>
              REPLAY
            </button>
          </div>
        </div>

        {/* The frame: pans on narrow screens instead of shrinking the labels. */}
        <div
          className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          data-no-swipe
        >
          <div className="min-w-[720px] md:min-w-0">
            <div className="relative overflow-hidden bg-[#151514]" style={{ aspectRatio: aspect }}>
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={alt}
                className="block w-full h-full"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 md:px-6 py-3 border-t border-white/15 text-[10px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 bg-[#e15c46] shrink-0" />
            <span className="uppercase tracking-wide text-white/45">
              {footnote}
            </span>
          </div>

          <div className="flex items-center gap-3 text-white/30 shrink-0">
            <span className="md:hidden tracking-wider">DRAG TO PAN</span>
          </div>
        </div>
      </div>
    </section>
  );
};
