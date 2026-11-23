import { useEffect, useRef, useState } from "react";
import type { WebGLRenderer } from "three";

function AnimatedBrain() {
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
      const openingYaw = -0.42;
      let started = performance.now();
      let hiddenAt = document.hidden ? started : undefined;
      let frame = 0;
      let visible = false;

      function refresh() {
        cancelAnimationFrame(frame);
        if (visible && !document.hidden && !abort.signal.aborted)
          frame = requestAnimationFrame(draw);
      }

      function draw(now: number) {
        if (document.hidden || !visible || abort.signal.aborted) return;
        const angle = (((now - started) % 40000) / 40000) * 2 * Math.PI;
        brain.rotation.set(-0.12, openingYaw + angle, -0.1);
        renderer.render(scene, camera);
        canvas.dataset["ready"] = "true";
        frame = requestAnimationFrame(draw);
      }

      const resize = new ResizeObserver(() => {
        const { width, height } = canvas.getBoundingClientRect();
        if (!width || !height) return;
        const ratio = Math.min(devicePixelRatio, 1.6);
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        uniforms.pixelRatio.value = ratio * Math.max(1, height / 560);
        camera.aspect = width / height;
        camera.position.z = 2.9;
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
      document.addEventListener(
        "visibilitychange",
        () => {
          const now = performance.now();
          if (document.hidden) hiddenAt ??= now;
          else if (hiddenAt !== undefined) {
            started += now - hiddenAt;
            hiddenAt = undefined;
          }
          refresh();
        },
        options,
      );
      canvas.addEventListener(
        "webglcontextlost",
        () => {
          cancelAnimationFrame(frame);
          delete canvas.dataset["ready"];
          observer.disconnect();
          resize.disconnect();
          abort.abort();
        },
        options,
      );
      dispose = () => {
        cancelAnimationFrame(frame);
        resize.disconnect();
        observer.disconnect();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    }
    mount(canvas).catch(() => {
      delete canvas.dataset["ready"];
    });
    return () => {
      abort.abort();
      dispose?.();
    };
  }, []);

  return <canvas className="brain-canvas" ref={surface} aria-hidden="true" />;
}

export function GlassBrain() {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAnimate(!preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  return (
    <div className="brain-backdrop" aria-hidden="true">
      <div className="brain-portrait">{animate && <AnimatedBrain />}</div>
    </div>
  );
}
