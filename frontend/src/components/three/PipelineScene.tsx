"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Stars } from "@react-three/drei";
import * as THREE from "three";

interface PipelineSceneProps {
  progress: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const phaseProgress = (p: number, s: number, e: number) => clamp01((p - s) / (e - s));

/**
 * 4 pipeline nodes arranged horizontally:
 * [Raw trials] → [LLM Parser] → [Structured DB] → [Match Engine]
 *
 * Data packets flow between them based on scroll progress.
 */

const NODE_POSITIONS: [number, number, number][] = [
  [-6, 0, 0],
  [-2, 0, 0],
  [2, 0, 0],
  [6, 0, 0],
];

const NODE_COLORS = ["#2CC8E4", "#E94589", "#FFA83E", "#4ECB71"];
const NODE_LABELS = ["RAW", "PARSE", "STORE", "MATCH"];

function Node({
  index,
  progress,
}: {
  index: number;
  progress: number;
}) {
  const ref = useRef<THREE.Group>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const pos = NODE_POSITIONS[index];
  const color = NODE_COLORS[index];

  // Each node activates at different scroll progress
  const activateAt = index * 0.25;
  const active = progress > activateAt;
  const activeP = easeInOut(phaseProgress(progress, activateAt, activateAt + 0.1));

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    // Float and pulse
    ref.current.position.y = pos[1] + Math.sin(t * 0.8 + index) * 0.15;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.6;
      ringRef.current.scale.setScalar(1 + activeP * 0.2);
    }
  });

  return (
    <group ref={ref} position={pos}>
      {/* Core cube/prism */}
      <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.8, 0]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 1 : 0.25}
          toneMapped={false}
          wireframe
        />
      </mesh>
      {/* Solid inner */}
      <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 0.35 : 0.08}
          toneMapped={false}
        />
      </mesh>
      {/* Glow halo */}
      <mesh>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 0.18 * activeP : 0}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Orbiting ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.4, 0.015, 6, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 0.6 : 0.15}
          toneMapped={false}
        />
      </mesh>
      {/* Label */}
      <Text
        position={[0, -1.6, 0]}
        fontSize={0.24}
        color={active ? color : "#3D4F6F"}
        anchorX="center"
        anchorY="middle"
        fontWeight={700}
      >
        {NODE_LABELS[index]}
      </Text>
    </group>
  );
}

function DataPackets({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const count = 16;

  const packets = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      offset: (i / count) * 4, // spread across segments
      lane: (Math.random() - 0.5) * 0.6,
      speed: 0.8 + Math.random() * 0.4,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;

    groupRef.current.children.forEach((child, i) => {
      const p = packets[i];
      // Position along the 4-node chain
      const cycle = ((t * p.speed + p.offset) % 4) / 4; // 0 to 1 across full chain
      const segmentCount = 3; // 3 segments between 4 nodes
      const segmentPos = cycle * segmentCount;
      const segment = Math.floor(segmentPos);
      const inSegment = segmentPos - segment;

      if (segment >= 3) return;
      const from = NODE_POSITIONS[segment];
      const to = NODE_POSITIONS[segment + 1];

      child.position.x = from[0] + (to[0] - from[0]) * inSegment;
      child.position.y = from[1] + p.lane + Math.sin(inSegment * Math.PI) * 0.3;
      child.position.z = from[2] + Math.sin(inSegment * Math.PI * 2) * 0.2;

      // Visibility based on which nodes are active
      const activateAt = segment * 0.25;
      const visible = progress > activateAt;
      child.visible = visible;

      // Color transitions through segment
      const fromColor = new THREE.Color(NODE_COLORS[segment]);
      const toColor = new THREE.Color(NODE_COLORS[segment + 1]);
      const currentColor = fromColor.lerp(toColor, inSegment);
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial;
      if (material) {
        material.color = currentColor;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {packets.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Connections() {
  return (
    <>
      {[0, 1, 2].map((i) => {
        const from = NODE_POSITIONS[i];
        const to = NODE_POSITIONS[i + 1];
        const mid: [number, number, number] = [(from[0] + to[0]) / 2, 0, 0];
        const distance = Math.abs(to[0] - from[0]);
        return (
          <mesh key={i} position={mid} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.015, 0.015, distance, 6]} />
            <meshBasicMaterial color="#1B3E5F" transparent opacity={0.4} />
          </mesh>
        );
      })}
    </>
  );
}

function CameraRig({ progress }: { progress: number }) {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;

    // Scroll-driven camera dolly across the pipeline
    const targetX = -6 + progress * 12;
    const targetY = 0.5 + Math.sin(t * 0.2) * 0.2;
    const targetZ = 8 - progress * 2;

    camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.06);
    camera.lookAt(targetX, 0, 0);
  });
  return null;
}

export default function PipelineScene({ progress }: PipelineSceneProps) {
  return (
    <Canvas
      camera={{ position: [-6, 0.5, 8], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      style={{ background: "#05070F" }}
    >
      <color attach="background" args={["#05070F"]} />
      <fog attach="fog" args={["#05070F", 10, 30]} />

      <ambientLight intensity={0.3} />
      <pointLight position={[0, 5, 5]} intensity={0.7} color="#FFFFFF" />
      <pointLight position={[-8, -3, -3]} intensity={0.4} color="#2CC8E4" />
      <pointLight position={[8, -3, -3]} intensity={0.4} color="#E94589" />

      <Stars radius={30} depth={20} count={800} factor={2.5} fade speed={0.4} />

      <CameraRig progress={progress} />
      <Connections />
      {NODE_POSITIONS.map((_, i) => (
        <Node key={i} index={i} progress={progress} />
      ))}
      <DataPackets progress={progress} />
    </Canvas>
  );
}
