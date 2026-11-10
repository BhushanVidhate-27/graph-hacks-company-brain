import React from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { SCENE_EDGES, SCENE_NODES, SCENE_STEPS } from './sceneData';

interface SceneGraphProps {
  /** Mutable state written by the scroll timeline; never triggers a render. */
  state: React.MutableRefObject<{ rotation: number; step: number }>;
}

const IDLE = new THREE.Color('#4a4a55');
const ACTIVE = new THREE.Color('#ff5b3a');
const PERSON = new THREE.Color('#e8e6df');
const DECISION = new THREE.Color('#f0b58f');

const SceneGraph: React.FC<SceneGraphProps> = ({ state }) => {
  const group = React.useRef<THREE.Group>(null);
  const materials = React.useRef<THREE.MeshStandardMaterial[]>([]);

  const geometry = React.useMemo(() => {
    const positions = new Float32Array(SCENE_EDGES.length * 6);
    SCENE_EDGES.forEach((edge, index) => {
      const from = SCENE_NODES.find((node) => node.id === edge.from);
      const to = SCENE_NODES.find((node) => node.id === edge.to);
      if (!from || !to) return;
      positions.set(from.position, index * 6);
      positions.set(to.position, index * 6 + 3);
    });
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return buffer;
  }, []);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;

    node.rotation.y = THREE.MathUtils.damp(node.rotation.y, state.current.rotation, 3, delta);
    node.rotation.x = THREE.MathUtils.damp(
      node.rotation.x,
      Math.sin(state.current.rotation * 0.5) * 0.12,
      3,
      delta,
    );

    const step = state.current.step;
    const from = Math.floor(step);
    const next = Math.min(SCENE_STEPS.length - 1, from + 1);
    const mix = step - from;

    SCENE_NODES.forEach((sceneNode, index) => {
      const material = materials.current[index];
      if (!material) return;
      const inFrom = SCENE_STEPS[from].ids.includes(sceneNode.id);
      const inNext = SCENE_STEPS[next].ids.includes(sceneNode.id);
      const active = inFrom && inNext ? 1 : inFrom ? 1 - mix : mix;

      const base =
        sceneNode.kind === 'person' ? PERSON : sceneNode.kind === 'decision' ? DECISION : IDLE;
      const target = base.clone().lerp(ACTIVE, active * 0.9);
      material.color.lerp(target, 0.12);
      material.emissive.lerp(ACTIVE.clone().multiplyScalar(active), 0.12);
      material.emissiveIntensity = 0.15 + active * 0.85;
    });
  });

  return (
    <group ref={group} scale={1.15}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#4a4a55" transparent opacity={0.75} />
      </lineSegments>
      {SCENE_NODES.map((node, index) => (
        <mesh key={node.id} position={node.position}>
          <sphereGeometry args={[node.radius, 24, 24]} />
          <meshStandardMaterial
            ref={(material) => {
              if (material) materials.current[index] = material;
            }}
            color="#4a4a55"
            emissive="#ff5b3a"
            emissiveIntensity={0.15}
            roughness={0.32}
            metalness={0.15}
          />
        </mesh>
      ))}
    </group>
  );
};

/** The graph scene. Rotation and focus are driven by the scroll timeline. */
export const SceneCanvas: React.FC<{
  state: React.MutableRefObject<{ rotation: number; step: number }>;
  /** Bloom is a fullscreen pass; skip it for users who asked for less motion. */
  effects?: boolean;
}> = ({ state, effects = true }) => (
  <Canvas
    camera={{ position: [0, 0, 6.2], fov: 42 }}
    dpr={[1, 1.6]}
    frameloop="always"
    gl={{ alpha: true, antialias: true }}
  >
    <ambientLight intensity={1.15} />
    <directionalLight position={[3, 4, 5]} intensity={1.2} color="#fff3ea" />
    <pointLight position={[-3, -2, 3]} intensity={2.4} color="#ff5b3a" />
    <SceneGraph state={state} />
    {effects && (
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.85}
          luminanceThreshold={0.28}
          luminanceSmoothing={0.5}
          kernelSize={KernelSize.LARGE}
          mipmapBlur
        />
        <Vignette offset={0.28} darkness={0.72} eskil={false} />
      </EffectComposer>
    )}
  </Canvas>
);
