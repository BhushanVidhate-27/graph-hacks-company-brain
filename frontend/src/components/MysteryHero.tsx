import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

const N_POINTS = 1500;
const N_EMBERS = 70;

const fibonacci = (i: number, n: number) => {
  const ga = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / (n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = ga * i;
  return { x: Math.cos(theta) * r, y, z: Math.sin(theta) * r };
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * MysteryHero — the first screen is intentionally wordless.
 *
 * A dark point-sphere (the company graph, hidden) turns slowly in the black.
 * Moving the cursor is a searchlight: nearby nodes warm up and quietly wire
 * together. Scrolling becomes a descent — the camera pulls into the core, the
 * graph burns out, and the site fades in underneath.
 *
 * GSAP ScrollTrigger drives the descent; Motion handles the cold open.
 */
export const MysteryHero: React.FC = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coreRef = useRef<HTMLDivElement | null>(null);
  const chevronRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef(0);
  const pointerRef = useRef({ x: 0.5, y: 0.5, active: false });
  const reduced = useReducedMotion();

  // Pointer as searchlight (normalised to the section).
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const onMove = (event: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      pointerRef.current = {
        x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
        y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
        active: true,
      };
    };
    const onLeave = () => {
      pointerRef.current.active = false;
    };
    section.addEventListener('pointermove', onMove);
    section.addEventListener('pointerleave', onLeave);
    return () => {
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  // The graph itself.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let width = 1;
    let height = 1;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      width = rect?.width || window.innerWidth;
      height = rect?.height || window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const points = Array.from({ length: N_POINTS }, (_, i) => fibonacci(i, N_POINTS));
    const embers = Array.from({ length: N_EMBERS }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2.1 + 0.5,
      vy: 0.0005 + Math.random() * 0.0011,
      vx: (Math.random() - 0.5) * 0.0009,
      phase: Math.random() * Math.PI * 2,
    }));

    let angle = 0;
    let frame = 0;

    const tick = () => {
      const progress = reduced ? 0 : scrollRef.current;
      const fade = clamp(1 - progress * 1.15, 0, 1);
      const pointer = pointerRef.current;
      const cx = width / 2 + (pointer.active ? (pointer.x - 0.5) * 42 : 0) * fade;
      const cy = height / 2 + (pointer.active ? (pointer.y - 0.5) * 30 : 0) * fade;
      const baseRadius = Math.min(width, height) * 0.32;
      const radius = baseRadius * (1 + progress * 2.6);
      const tilt = 0.42 + progress * 0.65;
      const perspective = 3.2;

      if (!reduced) angle += 0.0026 + progress * 0.012;

      ctx.clearRect(0, 0, width, height);

      // Warm halo under the core.
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius * 1.25);
      halo.addColorStop(0, `rgba(225, 92, 70, ${0.16 * fade})`);
      halo.addColorStop(0.5, `rgba(225, 92, 70, ${0.05 * fade})`);
      halo.addColorStop(1, 'rgba(225, 92, 70, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      // Searchlight.
      const pointerX = pointer.x * width;
      const pointerY = pointer.y * height;
      const lit: Array<{ x: number; y: number; d: number }> = [];
      if (pointer.active && fade > 0.05) {
        const light = ctx.createRadialGradient(pointerX, pointerY, 0, pointerX, pointerY, 170);
        light.addColorStop(0, `rgba(225, 92, 70, ${0.13 * fade})`);
        light.addColorStop(1, 'rgba(225, 92, 70, 0)');
        ctx.fillStyle = light;
        ctx.fillRect(pointerX - 170, pointerY - 170, 340, 340);
      }

      // Embers drifting up through the dark.
      for (const ember of embers) {
        ember.y -= ember.vy * (1 + progress * 2);
        ember.x += ember.vx;
        ember.phase += 0.008;
        if (ember.y < -0.05) {
          ember.y = 1.05;
          ember.x = Math.random();
        }
        if (ember.x < -0.02) ember.x += 1.04;
        if (ember.x > 1.02) ember.x -= 1.04;
        ctx.globalAlpha = (0.25 + Math.sin(ember.phase) * 0.2) * fade;
        ctx.fillStyle = 'rgba(236, 132, 96, 0.9)';
        ctx.beginPath();
        ctx.arc(ember.x * width, ember.y * height, ember.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);

      const projected = points
        .map((point) => {
          const x0 = point.x * cos - point.z * sin;
          const z0 = point.x * sin + point.z * cos;
          const yT = point.y * cosT - z0 * sinT;
          const zT = point.y * sinT + z0 * cosT;
          const scale = perspective / (perspective + zT);
          const sx = cx + x0 * radius * scale;
          const sy = cy + yT * radius * scale;
          const dx = sx - pointerX;
          const dy = sy - pointerY;
          return {
            x: sx,
            y: sy,
            z: zT,
            t: point.y,
            s: scale,
            near: clamp(1 - Math.sqrt(dx * dx + dy * dy) / 150, 0, 1),
          };
        })
        .sort((a, b) => a.z - b.z);

      // Edges only inside the searchlight: the graph wireframes where you look.
      if (pointer.active && fade > 0.05) {
        for (const point of projected) {
          if (point.near > 0.15) lit.push({ x: point.x, y: point.y, d: point.near });
        }
        ctx.lineWidth = 0.7;
        for (let i = 0; i < lit.length; i += 1) {
          for (let j = i + 1; j < lit.length; j += 1) {
            const dx = lit[i].x - lit[j].x;
            const dy = lit[i].y - lit[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 88) {
              const strength = clamp(1 - dist / 88, 0, 1) * lit[i].d * lit[j].d * fade;
              ctx.strokeStyle = `rgba(225, 92, 70, ${strength * 0.55})`;
              ctx.beginPath();
              ctx.moveTo(lit[i].x, lit[i].y);
              ctx.lineTo(lit[j].x, lit[j].y);
              ctx.stroke();
            }
          }
        }
      }

      for (const point of projected) {
        const depth = (point.z + 1) / 2;
        const edge = Math.abs(point.t);
        const base = edge > 0.62 ? [238, 234, 216] : edge > 0.3 ? [224, 173, 122] : [225, 92, 70];
        const warmth = point.near * 0.9;
        const alpha = (0.1 + depth * 0.55) * fade;
        const size = point.s * 1.55 + 0.35 + point.near * 1.3;
        ctx.fillStyle = `rgba(${Math.round(base[0] + (255 - base[0]) * warmth)}, ${Math.round(
          base[1] + (214 - base[1]) * warmth,
        )}, ${Math.round(base[2] + (190 - base[2]) * warmth)}, ${clamp(alpha + point.near * 0.35, 0, 1)})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  // Scroll descent.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reduced) return;

    let cancelled = false;
    let context: { revert: () => void } | undefined;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      context = gsap.context(() => {
        ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          onUpdate: (self) => {
            scrollRef.current = self.progress;
            if (chevronRef.current) {
              chevronRef.current.style.opacity = String(clamp(1 - self.progress * 2.4, 0, 1));
            }
          },
        });

        if (coreRef.current) {
          gsap.to(coreRef.current, {
            yPercent: -16,
            scale: 1.45,
            opacity: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: 'bottom top',
              scrub: true,
            },
          });
        }
      }, section);
    })();

    return () => {
      cancelled = true;
      context?.revert();
    };
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      className="mystery-hero relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-[#09090b]"
      aria-label="Helio"
    >
      <div className="mystery-vignette pointer-events-none absolute inset-0" aria-hidden="true" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

      <div
        ref={coreRef}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="mystery-bloom" aria-hidden="true" />
        <motion.img
          src="/icons/helio-logo.png"
          alt=""
          width={320}
          height={320}
          className="mystery-core relative w-28 object-contain sm:w-36 md:w-44 lg:w-52"
          aria-hidden="true"
          draggable={false}
          initial={reduced ? false : { opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div
        ref={chevronRef}
        className="pointer-events-none absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        <span className="mystery-thread" aria-hidden="true" />
        <ChevronDown className="mystery-chevron size-6 text-white/45" aria-hidden="true" />
      </div>
    </section>
  );
};

export default MysteryHero;
