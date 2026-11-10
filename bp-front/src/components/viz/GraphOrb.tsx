import React from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useReducedMotion } from '../../lib/utils';

interface NodeSpec {
  position: [number, number, number];
  radius: number;
  hub?: boolean;
}

const NODES: NodeSpec[] = [
  { position: [-1.5, 0.35, 0.1], radius: 0.14, hub: true },
  { position: [-1.15, 0.85, -0.2], radius: 0.07 },
  { position: [-0.85, 0.45, 0.35], radius: 0.06 },
  { position: [-1.35, -0.25, -0.15], radius: 0.07 },
  { position: [-0.95, -0.7, 0.2], radius: 0.09 },
  { position: [-1.7, -0.55, 0.3], radius: 0.06 },
  { position: [0, 0.9, -0.35], radius: 0.07 },
  { position: [0.35, 0.55, 0.15], radius: 0.06 },
  { position: [1.5, -0.1, 0.05], radius: 0.14, hub: true },
  { position: [1.1, 0.5, -0.25], radius: 0.07 },
  { position: [1.2, -0.7, 0.3], radius: 0.09 },
  { position: [1.9, 0.45, 0.2], radius: 0.06 },
  { position: [1.75, -0.6, -0.15], radius: 0.06 },
  { position: [0.7, 0.1, -0.4], radius: 0.05 },
];

const EDGES: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [3, 4],
  [3, 5],
  [1, 6],
  [2, 7],
  [8, 9],
  [8, 10],
  [8, 11],
  [8, 12],
  [9, 13],
  [6, 13],
  [13, 7],
  [0, 8],
];

function edgeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(EDGES.length * 6);
  EDGES.forEach(([a, b], index) => {
    positions.set(NODES[a].position, index * 6);
    positions.set(NODES[b].position, index * 6 + 3);
  });
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

const Graph: React.FC<{ reduced: boolean }> = ({ reduced }) => {
  const group = React.useRef<THREE.Group>(null);
  const geometry = React.useMemo(edgeGeometry, []);
  const pointer = React.useRef({ x: 0, y: 0 });

  React.useEffect(() => {
    if (reduced) return;
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.current.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduced]);

  useFrame((state, delta) => {
    const node = group.current;
    if (!node) return;
    node.rotation.y = THREE.MathUtils.damp(node.rotation.y, pointer.current.x * 0.28 + state.clock.elapsedTime * 0.06, 2, delta);
    node.rotation.x = THREE.MathUtils.damp(node.rotation.x, -pointer.current.y * 0.16, 2, delta);
  });

  return (
    <group ref={group}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#3d3d46" transparent opacity={0.65} />
      </lineSegments>
      {NODES.map((node, index) => (
        <mesh key={index} position={node.position}>
          <sphereGeometry args={[node.radius, 24, 24]} />
          <meshStandardMaterial
            color={node.hub ? '#ff5b3a' : '#e8e6df'}
            emissive={node.hub ? '#ff5b3a' : '#8a877f'}
            emissiveIntensity={node.hub ? 0.9 : 0.25}
            roughness={0.35}
            metalness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
};

/**
 * The product in one object: a small ownership graph that reacts to the
 * pointer. Sits on the shader wash, so the two effects stay in one focal plane.
 */
export const GraphOrb: React.FC<{ className?: string }> = ({ className }) => {
  const reduced = useReducedMotion();

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 4.6], fov: 42 }}
        dpr={[1, 1.75]}
        frameloop={reduced ? 'never' : 'always'}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 4, 5]} intensity={1.4} color="#fff2e8" />
        <pointLight position={[-3, -2, 3]} intensity={2.2} color="#ff5b3a" />
        <Graph reduced={reduced} />
      </Canvas>
    </div>
  );
};
