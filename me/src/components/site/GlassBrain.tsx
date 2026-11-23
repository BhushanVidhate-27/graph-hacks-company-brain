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
      const uniforms = { pixelRatio: { value: 1 } };
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
          uniform float pixelRatio;
          varying float ink;
          void main() {
            vec4 p = modelViewMatrix * vec4(position, 1.);
            float depth = smoothstep(-.7, .68, (modelViewMatrix * vec4(position, 0.)).z);
            ink = mix(.14, .93, depth * depth);
            gl_PointSize = max(1., pixelRatio * mix(.8, 1.35, depth));
            gl_Position = projectionMatrix * p;
          }`,
        fragmentShader: `
          varying float ink;
          void main() {
            if (length(gl_PointCoord - .5) > .48) discard;
            gl_FragColor = vec4(vec3(ink), 1.);
          }`,
      });
      const brain = new THREE.Points(geometry, material);
      scene.add(brain);
      const motion = matchMedia("(prefers-reduced-motion: reduce)");
      const openingYaw = -.42;
      const turn = THREE.MathUtils.degToRad(6);
      let elapsed = 0;
      let previousTime = 0;
      let frame = 0;
      let visible = false;
      let targetYaw = 0;
      let targetPitch = 0;
      let yaw = 0;
      let pitch = 0;
      let drag: { id: number; x: number; yaw: number } | undefined;

      function requestDraw() {
        if (!frame && visible && !document.hidden && !abort.signal.aborted) {
          frame = requestAnimationFrame(draw);
        }
      }

      function draw(now: number) {
        frame = 0;
        if (!visible || document.hidden) return;
        const dt = previousTime ? Math.min(now - previousTime, 100) : 0;
        previousTime = now;
        elapsed = motion.matches ? 900 : Math.min(900, elapsed + dt);
        const progress = 1 - (1 - elapsed / 900) ** 3;
        const smoothing = 1 - Math.exp(-dt / 90);
        yaw = motion.matches ? 0 : THREE.MathUtils.lerp(yaw, targetYaw, smoothing);
        pitch = motion.matches ? 0 : THREE.MathUtils.lerp(pitch, targetPitch, smoothing);
        brain.rotation.set(-.12 + pitch, openingYaw + turn * progress + yaw, -.10);
        renderer.render(scene, camera);
        canvas.dataset["ready"] = "true";
        if (elapsed < 900 || (!motion.matches &&
            (Math.abs(yaw - targetYaw) > .0002 || Math.abs(pitch - targetPitch) > .0002))) {
          requestDraw();
        } else {
          previousTime = 0;
        }
      }

      function refresh() {
        cancelAnimationFrame(frame);
        frame = 0;
        previousTime = 0;
        requestDraw();
      }

      const resize = new ResizeObserver(() => {
        const { width, height } = canvas.getBoundingClientRect();
        if (!width || !height) return;
        const ratio = Math.min(devicePixelRatio, 1.6);
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        uniforms.pixelRatio.value = ratio * Math.max(1, height / 560);
        camera.aspect = width / height;
        camera.position.z = 2.90;
        camera.updateProjectionMatrix();
        refresh();
      });
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? false;
        refresh();
      });
      resize.observe(canvas);
      observer.observe(canvas);
      const options = { signal: abort.signal };
      canvas.addEventListener("pointerdown", event => {
        if (!event.isPrimary || event.pointerType === "mouse" || motion.matches) return;
        drag = { id: event.pointerId, x: event.clientX, yaw: targetYaw };
        canvas.setPointerCapture(event.pointerId);
      }, options);
      canvas.addEventListener("pointermove", event => {
        if (motion.matches) return;
        const rect = canvas.getBoundingClientRect();
        if (drag && drag.id === event.pointerId) {
          targetYaw = THREE.MathUtils.clamp(drag.yaw + (event.clientX - drag.x) / rect.width * 1.8, -.8, .8);
        } else if (event.pointerType === "mouse") {
          targetYaw = ((event.clientX - rect.left) / rect.width - .5) * .23;
          targetPitch = ((event.clientY - rect.top) / rect.height - .5) * .12;
        } else {
          return;
        }
        requestDraw();
      }, options);
      canvas.addEventListener("lostpointercapture", () => { drag = undefined; }, options);
      canvas.addEventListener("pointerleave", event => {
        if (event.pointerType === "mouse") {
          targetYaw = targetPitch = 0;
          requestDraw();
        }
      }, options);
      motion.addEventListener("change", refresh, options);
      document.addEventListener("visibilitychange", refresh, options);
      canvas.addEventListener("webglcontextlost", () => {
        cancelAnimationFrame(frame);
        delete canvas.dataset["ready"];
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
    mount(canvas).catch(() => { delete canvas.dataset["ready"]; });
    return () => { abort.abort(); dispose?.(); };
  }, []);

  return <canvas className="brain-canvas" ref={surface} aria-hidden="true" />;
}
