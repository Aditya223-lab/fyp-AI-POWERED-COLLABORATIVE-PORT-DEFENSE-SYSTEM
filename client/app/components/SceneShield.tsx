'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float, OrbitControls, Stars } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function CoreShield() {
  const ref = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * 0.15;
      ref.current.rotation.y += delta * 0.25;
    }
    if (inner.current) {
      inner.current.rotation.x -= delta * 0.4;
      inner.current.rotation.z += delta * 0.3;
    }
  });

  return (
    <group>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1.4, 1]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#1e40af"
          emissiveIntensity={0.6}
          wireframe
        />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#7c3aed"
          emissiveIntensity={1.2}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

function OrbitNodes() {
  const group = useRef<THREE.Group>(null);
  const nodes = useMemo(() => {
    const count = 8;
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const radius = 3.2;
      return {
        position: [
          Math.cos(angle) * radius,
          (Math.sin(i * 0.7) * radius) / 3,
          Math.sin(angle) * radius,
        ] as [number, number, number],
        speed: 0.3 + Math.random() * 0.4,
      };
    });
  }, []);

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group ref={group}>
      {nodes.map((n, i) => (
        <Float
          key={i}
          speed={n.speed}
          rotationIntensity={0.4}
          floatIntensity={1.2}
        >
          <mesh position={n.position}>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial
              color="#22d3ee"
              emissive="#22d3ee"
              emissiveIntensity={1.5}
            />
          </mesh>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([0, 0, 0, ...n.position]),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#22d3ee"
              transparent
              opacity={0.25}
            />
          </line>
        </Float>
      ))}
    </group>
  );
}

export default function SceneShield() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1.2} color="#22d3ee" />
      <pointLight position={[-10, -5, -10]} intensity={0.8} color="#a855f7" />
      <Stars
        radius={50}
        depth={50}
        count={2000}
        factor={3}
        saturation={0}
        fade
        speed={0.5}
      />
      <CoreShield />
      <OrbitNodes />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.6}
      />
    </Canvas>
  );
}
