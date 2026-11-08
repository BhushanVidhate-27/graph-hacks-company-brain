import React, { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

const N_POINTS = 1800;
const N_EMBERS = 80;

const fibonacci = (i: number, n: number) => {
  const ga = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / (n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = ga * i;
  return { x: Math.cos(theta) * r, y, z: Math.sin(theta) * r };
};

const COLOR = (t: number) => {
  // t ∈ [-1, 1]: poles -> warm off-white, equator -> ember orange
  if (t <= -0.55 || t >= 0.55) return 'rgba(240, 236, 210, 0.92)';
  if (Math.abs(t) > 0.3) return 'rgba(224, 173, 122, 0.85)';
  return 'rgba(235, 93, 70, 0.9)';
};

export const MysteryHero: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const w = canvas.parentElement?.clientWidth || window.innerWidth;
      const h = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const points = Array.from({ length: N_POINTS }, (_, i) => fibonacci(i, N_POINTS));
    const embers = Array.from({ length: N_EMBERS }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2.4 + 0.6,
      vy: 0.0006 + Math.random() * 0.0012,
      vx: (Math.random() - 0.5) * 0.0012,
      a: Math.random(),
    }));

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let angle = 0;
    const tick = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.36;
      const tilt = 0.5;
      const perspective = 3.4;

      ctx.clearRect(0, 0, w, h);
      if (!prefersReduced) angle += 0.0035;
      const a = angle;

      // faint halo
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.15);
      halo.addColorStop(0, 'rgba(225, 92, 70, 0.18)');
      halo.addColorStop(0.55, 'rgba(225, 92, 70, 0.04)');
      halo.addColorStop(1, 'rgba(225, 92, 70, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      // embers
      for (const e of embers) {
        e.y -= e.vy;
        e.x += e.vx;
        if (e.y < -0.05) { e.y = 1.05; e.x = Math.random(); }
        if (e.x < 0) e.x += 1; if (e.x > 1) e.x -= 1;
        ctx.globalAlpha = 0.5 + e.a * 0.4;
        ctx.fillStyle = 'rgba(225, 92, 70, 0.75)';
        ctx.beginPath();
        ctx.arc(e.x * w, e.y * h, e.size, 0, Math.PI * 2);
        ctx.fill();
        e.a = (e.a + 0.01) % 1;
      }
      ctx.globalAlpha = 1;

      // sphere points
      const cos = Math.cos(a), sin = Math.sin(a);
      const pts = points.map((p) => {
        const x0 = p.x * cos - p.z * sin;
        const z0 = p.x * sin + p.z * cos;
        const yT = p.y * Math.cos(tilt) - z0 * Math.sin(tilt);
        const zT = p.y * Math.sin(tilt) + z0 * Math.cos(tilt);
        const scale = perspective / (perspective + zT);
        return { x: cx + x0 * radius * scale, y: cy + yT * radius * scale, z: zT, t: p.y, s: scale };
      }).sort((a2, b2) => a2.z - b2.z);

      for (const p of pts) {
        const depth = (p.z + 1) / 2;
        ctx.globalAlpha = 0.18 + depth * 0.82;
        ctx.fillStyle = COLOR(p.t);
        const size = p.s * 1.8 + 0.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <section className="mystery-hero relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-[#09090b]" aria-label="Helio">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

      {/* Cube glow core */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          src="/icons/helio-logo.png"
          alt=""
          width={320}
          height={320}
          className="mystery-core w-32 sm:w-40 md:w-48 lg:w-56 object-contain"
          aria-hidden="true"
          draggable={false}
        />
      </div>

      {/* Scroll invitation: a quiet chevron only */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
        <ChevronDown className="mystery-chevron size-7 text-white/55" aria-hidden="true" />
      </div>
    </section>
  );
};

export default MysteryHero;
