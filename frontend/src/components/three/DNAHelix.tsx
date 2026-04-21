"use client";

import { useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sphere, Line } from "@react-three/drei";
import * as THREE from "three";

function MouseLight() {
  const light = useRef<THREE.PointLight>(null!);
  const { viewport } = useThree();

  useFrame(({ pointer }) => {
    if (light.current) {
      light.current.position.x = (pointer.x * viewport.width) / 2;
      light.current.position.y = (pointer.y * viewport.height) / 2;
    }
  });

  return (
    <pointLight
      ref={light}
      intensity={2}
      distance={8}
      color="#60A5FA"
      position={[0, 0, 3]}
    />
  );
}

function GlowingSphere({
  position,
  color,
  size = 0.07,
  pulseSpeed = 1,
}: {
  position: THREE.Vector3 | [number, number, number];
  color: string;
  size?: number;
  pulseSpeed?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * pulseSpeed) * 0.15;
      ref.current.scale.setScalar(s);
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + Math.sin(clock.elapsedTime * pulseSpeed) * 0.08;
    }
  });

  return (
    <group position={position instanceof THREE.Vector3 ? position.toArray() : position}>
      <Sphere ref={ref} args={[size, 12, 12]}>
        <meshBasicMaterial color={color} />
      </Sphere>
      <Sphere ref={glowRef} args={[size * 3, 12, 12]}>
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </Sphere>
    </group>
  );
}

function HelixStrand() {
  const groupRef = useRef<THREE.Group>(null!);
  const mouseTarget = useRef({ x: 0, y: 0 });

  const helixData = useMemo(() => {
    const points1: THREE.Vector3[] = [];
    const points2: THREE.Vector3[] = [];
    const connections: { a: THREE.Vector3; b: THREE.Vector3; mid: THREE.Vector3 }[] = [];
    const numPoints = 80;
    const height = 10;
    const radius = 1.4;

    for (let i = 0; i < numPoints; i++) {
      const t = i / numPoints;
      const y = (t - 0.5) * height;
      const angle = t * Math.PI * 5;

      const x1 = Math.cos(angle) * radius;
      const z1 = Math.sin(angle) * radius;
      const x2 = Math.cos(angle + Math.PI) * radius;
      const z2 = Math.sin(angle + Math.PI) * radius;

      points1.push(new THREE.Vector3(x1, y, z1));
      points2.push(new THREE.Vector3(x2, y, z2));

      if (i % 5 === 0) {
        connections.push({
          a: new THREE.Vector3(x1, y, z1),
          b: new THREE.Vector3(x2, y, z2),
          mid: new THREE.Vector3((x1 + x2) / 2, y, (z1 + z2) / 2),
        });
      }
    }

    return { points1, points2, connections };
  }, []);

  const floatingParticles = useMemo(() => {
    const particles: {
      pos: [number, number, number];
      speed: number;
      size: number;
      color: string;
      orbit: number;
    }[] = [];
    const colors = ["#3B82F6", "#6366F1", "#818CF8", "#60A5FA", "#34D399", "#A78BFA"];
    for (let i = 0; i < 60; i++) {
      particles.push({
        pos: [
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 8,
        ],
        speed: 0.2 + Math.random() * 0.6,
        size: 0.015 + Math.random() * 0.035,
        color: colors[Math.floor(Math.random() * colors.length)],
        orbit: Math.random() * Math.PI * 2,
      });
    }
    return particles;
  }, []);

  const particleRefs = useRef<(THREE.Mesh | null)[]>([]);

  const setParticleRef = useCallback((index: number) => (el: THREE.Mesh | null) => {
    particleRefs.current[index] = el;
  }, []);

  useFrame(({ clock, pointer }) => {
    mouseTarget.current.x += (pointer.x * 0.3 - mouseTarget.current.x) * 0.05;
    mouseTarget.current.y += (pointer.y * 0.2 - mouseTarget.current.y) * 0.05;

    if (groupRef.current) {
      groupRef.current.rotation.y =
        clock.elapsedTime * 0.12 + mouseTarget.current.x * 0.5;
      groupRef.current.rotation.x = mouseTarget.current.y * 0.3;
      groupRef.current.position.y =
        Math.sin(clock.elapsedTime * 0.25) * 0.2;
    }

    particleRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const p = floatingParticles[i];
      const t = clock.elapsedTime * p.speed + p.orbit;
      mesh.position.x = p.pos[0] + Math.sin(t) * 0.3;
      mesh.position.y = p.pos[1] + Math.cos(t * 0.7) * 0.4;
      mesh.position.z = p.pos[2] + Math.sin(t * 0.5) * 0.2;

      const scale = 0.8 + Math.sin(t * 2) * 0.2;
      mesh.scale.setScalar(scale);
    });
  });

  return (
    <>
      <group ref={groupRef}>
        {/* Main helix strands */}
        <Line
          points={helixData.points1}
          color="#3B82F6"
          lineWidth={2.5}
          transparent
          opacity={0.9}
        />
        <Line
          points={helixData.points2}
          color="#6366F1"
          lineWidth={2.5}
          transparent
          opacity={0.9}
        />

        {/* Rungs with gradient-like appearance */}
        {helixData.connections.map((conn, i) => (
          <group key={`conn-${i}`}>
            <Line
              points={[conn.a, conn.mid]}
              color="#3B82F6"
              lineWidth={1.2}
              transparent
              opacity={0.25}
            />
            <Line
              points={[conn.mid, conn.b]}
              color="#6366F1"
              lineWidth={1.2}
              transparent
              opacity={0.25}
            />
            {/* Center node on each rung */}
            <GlowingSphere
              position={conn.mid}
              color="#818CF8"
              size={0.04}
              pulseSpeed={1 + i * 0.1}
            />
          </group>
        ))}

        {/* Glowing nodes on strand 1 */}
        {helixData.points1
          .filter((_, i) => i % 5 === 0)
          .map((point, i) => (
            <GlowingSphere
              key={`s1-${i}`}
              position={point}
              color="#60A5FA"
              size={0.06}
              pulseSpeed={0.8 + i * 0.15}
            />
          ))}

        {/* Glowing nodes on strand 2 */}
        {helixData.points2
          .filter((_, i) => i % 5 === 0)
          .map((point, i) => (
            <GlowingSphere
              key={`s2-${i}`}
              position={point}
              color="#A78BFA"
              size={0.06}
              pulseSpeed={1.0 + i * 0.15}
            />
          ))}
      </group>

      {/* Floating particles */}
      {floatingParticles.map((p, i) => (
        <Sphere
          key={`fp-${i}`}
          ref={setParticleRef(i)}
          args={[p.size, 6, 6]}
          position={p.pos}
        >
          <meshBasicMaterial color={p.color} transparent opacity={0.5} />
        </Sphere>
      ))}
    </>
  );
}

export default function DNAHelix() {
  return (
    <div className="absolute inset-0 z-0" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={1.2} color="#3B82F6" distance={15} />
        <pointLight position={[-5, -3, -5]} intensity={0.6} color="#6366F1" distance={12} />
        <pointLight position={[0, 5, -3]} intensity={0.4} color="#34D399" distance={10} />
        <MouseLight />
        <HelixStrand />
      </Canvas>
    </div>
  );
}
