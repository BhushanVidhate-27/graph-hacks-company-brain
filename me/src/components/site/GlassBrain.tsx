import { useEffect, useRef } from "react";
import type { WebGLRenderer } from "three";

export function GlassBrain() {
  const surface = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = surface.current;
    if (!canvas) return;
    const abort = new AbortController();
    let dispose: (() => void) | undefined;

    async function mount(canvas: HTMLCanvasElement) {
      const [THREE, response] = await Promise.all([
        import("three"),
        fetch("/glass-brain-points.bin", { signal: abort.signal }),
      ]);
      if (!response.ok) throw new Error("Could not load brain geometry");
      const points = new Int16Array(await response.arrayBuffer());
      if (abort.signal.aborted) return;
      let renderer: WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      } catch {
        return; // The model-derived poster is also used while the scene loads.
      }
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 10);
      camera.position.z = 3.65;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(points, 3, true));
      const uniforms = { pixelRatio: { value: 1 }, phase: { value: 0 } };
      const material = new THREE.ShaderMaterial({
        uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `
          uniform float pixelRatio, phase;
          varying vec3 color;
          void main() {
            vec4 p = modelViewMatrix * vec4(position, 1.);
            float band = exp(-13. * abs(position.x - sin(phase * .48) * .96));
            float nearSide = smoothstep(-.35, .70, position.z);
            color = mix(vec3(.32,.19,.30), vec3(1.,.54,.27), nearSide);
            color += band * vec3(.38,.20,.08);
            gl_PointSize = pixelRatio * (1.25 + .75 * nearSide + .65 * band);
            gl_Position = projectionMatrix * p;
          }`,
        fragmentShader: `
          varying vec3 color;
          void main() {
            float a = 1. - smoothstep(.05, .5, length(gl_PointCoord - .5));
            gl_FragColor = vec4(color, a * .62);
          }`,
      });
      const brain = new THREE.Points(geometry, material);
      scene.add(brain);
      const motion = matchMedia("(prefers-reduced-motion: reduce)");
      let pointerX = 0, pointerY = 0, time = 0, last = 0, frame = 0, visible = true;
      const move = (event: PointerEvent) => {
        const bounds = canvas.getBoundingClientRect();
        pointerX = (event.clientX - bounds.left) / bounds.width - .5;
        pointerY = (event.clientY - bounds.top) / bounds.height - .5;
      };
      const leave = () => { pointerX = pointerY = 0; };
      function draw(now: number) {
        frame = 0;
        if (!visible || document.hidden) return;
        time += motion.matches ? 0 : Math.min((now - last) / 1000, .05);
        last = now;
        const yaw = -.42 + (motion.matches ? 0 : Math.sin(time * .24) * .22 + pointerX * .38);
        const pitch = -.12 + (motion.matches ? 0 : pointerY * .22);
        brain.rotation.set(THREE.MathUtils.lerp(brain.rotation.x, pitch, .08),
          THREE.MathUtils.lerp(brain.rotation.y, yaw, .08), -.10);
        uniforms.phase.value = time;
        renderer.render(scene, camera);
        canvas.dataset.ready = "true";
        if (!motion.matches) frame = requestAnimationFrame(draw);
      }
      function refresh() { cancelAnimationFrame(frame); last = performance.now(); draw(last); }
      const resize = new ResizeObserver(() => {
        const { width, height } = canvas.getBoundingClientRect();
        if (!width || !height) return;
        const ratio = Math.min(devicePixelRatio, 1.6);
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        uniforms.pixelRatio.value = ratio * Math.max(1, height / 380);
        camera.aspect = width / height;
        camera.position.z = 3.3 / Math.min(1, camera.aspect);
        camera.updateProjectionMatrix();
        refresh();
      });
      const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refresh(); });
      brain.rotation.set(-.12, -.42, -.10);
      resize.observe(canvas);
      observer.observe(canvas);
      const options = { signal: abort.signal };
      canvas.addEventListener("pointermove", move, options);
      canvas.addEventListener("pointerleave", leave, options);
      motion.addEventListener("change", refresh, options);
      document.addEventListener("visibilitychange", refresh, options);
      canvas.addEventListener("webglcontextlost", () => {
        cancelAnimationFrame(frame);
        delete canvas.dataset.ready;
        observer.disconnect();
        resize.disconnect();
        abort.abort();
      }, options);
      dispose = () => {
        cancelAnimationFrame(frame);
        resize.disconnect();
        observer.disconnect();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    }
    mount(canvas).catch(() => { delete canvas.dataset.ready; });
    return () => { abort.abort(); dispose?.(); };
  }, []);

  return <canvas className="brain-canvas" ref={surface} aria-hidden="true" />;
}
