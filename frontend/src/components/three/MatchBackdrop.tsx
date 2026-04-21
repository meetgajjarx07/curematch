"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface MatchBackdropProps {
  step: number;
  totalSteps: number;
}

const HELIX_HEIGHT = 16;
const HELIX_RADIUS = 1.8;
const HELIX_TURNS = 4;

function Helix({ progress }: { progress: number }) {
  const ref = useRef<THREE.Group>(null!);

  const curves = useMemo(() => {
    const leftPoints: THREE.Vector3[] = [];
    const rightPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const y = (t - 0.5) * HELIX_HEIGHT;
      const angle = t * Math.PI * 2 * HELIX_TURNS;
      leftPoints.push(new THREE.Vector3(
        Math.cos(angle) * HELIX_RADIUS,
        y,
        Math.sin(angle) * HELIX_RADIUS
      ));
      rightPoints.push(new THREE.Vector3(
        Math.cos(angle + Math.PI) * HELIX_RADIUS,
        y,
        Math.sin(angle + Math.PI) * HELIX_RADIUS
      ));
    }
    return {
      left: new THREE.CatmullRomCurve3(leftPoints),
      right: new THREE.CatmullRomCurve3(rightPoints),
    };
  }, []);

  const basePairs = useMemo(() => {
    const pairs: { y: number; angle: number; leftColor: string; rightColor: string }[] = [];
    const bases = [
      { l: "#E94589", r: "#2CC8E4" },
      { l: "#2CC8E4", r: "#E94589" },
      { l: "#4ECB71", r: "#FFA83E" },
      { l: "#FFA83E", r: "#4ECB71" },
    ];
    const count = 36;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const y = (t - 0.5) * HELIX_HEIGHT;
      const angle = t * Math.PI * 2 * HELIX_TURNS;
      pairs.push({ y, angle, leftColor: bases[i % 4].l, rightColor: bases[i % 4].r });
    }
    return pairs;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.1;
    }
  });

  // Step-based reveal threshold — each step lights up more of the helix
  const threshold = progress;

  return (
    <group ref={ref} position={[0, 0, 0]}>
      {/* Left strand */}
      <mesh>
        <tubeGeometry args={[curves.left, 240, 0.055, 8, false]} />
        <meshBasicMaterial color="#2CC8E4" transparent opacity={0.85} toneMapped={false} />
      </mesh>
      {/* Right strand */}
      <mesh>
        <tubeGeometry args={[curves.right, 240, 0.055, 8, false]} />
        <meshBasicMaterial color="#E94589" transparent opacity={0.85} toneMapped={false} />
      </mesh>

      {/* Base pairs — fade in based on step progress */}
      {basePairs.map((bp, i) => {
        const pairProgress = i / basePairs.length;
        const isLit = pairProgress <= threshold;
        const opacity = isLit ? 1 : 0.12;

        const lx = Math.cos(bp.angle) * HELIX_RADIUS;
        const lz = Math.sin(bp.angle) * HELIX_RADIUS;
        const rx = Math.cos(bp.angle + Math.PI) * HELIX_RADIUS;
        const rz = Math.sin(bp.angle + Math.PI) * HELIX_RADIUS;

        return (
          <group key={i}>
            {/* Left base */}
            <mesh position={[lx, bp.y, lz]}>
              <sphereGeometry args={[0.1, 10, 10]} />
              <meshBasicMaterial color={bp.leftColor} transparent opacity={opacity} toneMapped={false} />
            </mesh>
            {isLit && (
              <mesh position={[lx, bp.y, lz]}>
                <sphereGeometry args={[0.2, 10, 10]} />
                <meshBasicMaterial
                  color={bp.leftColor}
                  transparent
                  opacity={0.22}
                  toneMapped={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            )}
            {/* Right base */}
            <mesh position={[rx, bp.y, rz]}>
              <sphereGeometry args={[0.1, 10, 10]} />
              <meshBasicMaterial color={bp.rightColor} transparent opacity={opacity} toneMapped={false} />
            </mesh>
            {isLit && (
              <mesh position={[rx, bp.y, rz]}>
                <sphereGeometry args={[0.2, 10, 10]} />
                <meshBasicMaterial
                  color={bp.rightColor}
                  transparent
                  opacity={0.22}
                  toneMapped={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

export default function MatchBackdrop({ step, totalSteps }: MatchBackdropProps) {
  const progress = (step + 1) / totalSteps;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [4, 0, 7], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[3, 3, 3]} intensity={0.6} color="#2CC8E4" />
        <pointLight position={[-3, -2, -3]} intensity={0.4} color="#E94589" />

        <Helix progress={progress} />
      </Canvas>
    </div>
  );
}
