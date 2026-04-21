"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Stars } from "@react-three/drei";
import * as THREE from "three";

interface MoleculeHeroProps {
  score: number;
  phase: string;
  className?: string;
}

function Molecule() {
  const ref = useRef<THREE.Group>(null!);

  // Generate a simple branching molecule structure
  const atoms = useMemo(() => {
    const arr: { pos: [number, number, number]; color: string; size: number }[] = [];
    const palette = ["#2CC8E4", "#E94589", "#4ECB71", "#FFA83E", "#FFFFFF"];

    // Central ring (hexagon-ish)
    const ring = 6;
    for (let i = 0; i < ring; i++) {
      const angle = (i / ring) * Math.PI * 2;
      arr.push({
        pos: [Math.cos(angle) * 1.1, Math.sin(angle) * 1.1, 0],
        color: palette[i % palette.length],
        size: 0.22,
      });
    }

    // Branching atoms
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 2.1;
      arr.push({
        pos: [
          Math.cos(angle) * r,
          Math.sin(angle) * r * 0.7,
          Math.sin(angle * 2) * 0.8,
        ],
        color: palette[(i + 2) % palette.length],
        size: 0.16,
      });
    }

    return arr;
  }, []);

  // Bonds between atoms
  const bonds = useMemo(() => {
    const arr: { a: [number, number, number]; b: [number, number, number] }[] = [];
    // Ring bonds
    for (let i = 0; i < 6; i++) {
      arr.push({ a: atoms[i].pos, b: atoms[(i + 1) % 6].pos });
    }
    // Branching bonds (ring to outer)
    for (let i = 0; i < 8; i++) {
      const inner = i % 6;
      arr.push({ a: atoms[inner].pos, b: atoms[6 + i].pos });
    }
    return arr;
  }, [atoms]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.15;
      ref.current.rotation.x += delta * 0.04;
    }
  });

  return (
    <group ref={ref}>
      {atoms.map((atom, i) => (
        <group key={i} position={atom.pos}>
          <mesh>
            <sphereGeometry args={[atom.size, 16, 16]} />
            <meshBasicMaterial color={atom.color} toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[atom.size * 1.9, 12, 12]} />
            <meshBasicMaterial
              color={atom.color}
              transparent
              opacity={0.25}
              toneMapped={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}

      {bonds.map((bond, i) => {
        const start = new THREE.Vector3(...bond.a);
        const end = new THREE.Vector3(...bond.b);
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const distance = start.distanceTo(end);
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction
        );
        return (
          <mesh key={i} position={mid.toArray()} quaternion={quaternion.toArray() as [number, number, number, number]}>
            <cylinderGeometry args={[0.025, 0.025, distance, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.35} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function ScoreOrb({ score }: { score: number }) {
  const ref = useRef<THREE.Group>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);

  const color = score >= 80 ? "#30D158" : score >= 50 ? "#FF9F0A" : "#FF3B30";

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.3;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.elapsedTime * 0.5;
    }
  });

  return (
    <group position={[3.5, 0, 0]}>
      <group ref={ref}>
        {/* Core sphere */}
        <mesh>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        {/* Inner glow */}
        <mesh>
          <sphereGeometry args={[0.85, 24, 24]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.35}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {/* Outer glow */}
        <mesh>
          <sphereGeometry args={[1.2, 24, 24]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.15}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* Orbiting ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.4, 0.015, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} />
      </mesh>

      {/* Score text */}
      <Text
        position={[0, 0, 0.7]}
        fontSize={0.42}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fontWeight={700}
      >
        {`${score}%`}
      </Text>
    </group>
  );
}

export default function MoleculeHero({ score, className = "" }: MoleculeHeroProps) {
  return (
    <div className={`relative ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 9], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <color attach="background" args={["#05070F"]} />
        <fog attach="fog" args={["#05070F", 10, 25]} />

        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={0.8} color="#2CC8E4" />
        <pointLight position={[-5, -2, -5]} intensity={0.5} color="#E94589" />

        <Stars radius={25} depth={15} count={500} factor={2} fade speed={0.3} />

        <group position={[-2.5, 0, 0]}>
          <Molecule />
        </group>

        <ScoreOrb score={score} />
      </Canvas>
    </div>
  );
}
