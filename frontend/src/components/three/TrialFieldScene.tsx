"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, RoundedBox, Stars } from "@react-three/drei";
import * as THREE from "three";

/**
 * Narrative phases (progress 0 → 1):
 * 0.00–0.22  Establishing — DNA helix rotating at distance, particles, stars
 * 0.22–0.44  Zoom in — camera approaches, details emerge
 * 0.44–0.66  Through — camera travels up through the helix, data cards appear between strands
 * 0.66–0.85  Emergence — one card zooms forward, becomes hero card
 * 0.85–1.00  Verdict — criteria stamps fly onto hero card, score appears
 */

interface SceneProps {
  progress: number;
}

const BASE_PAIRS = 90;
const HELIX_HEIGHT = 36;
const HELIX_RADIUS = 2.2;
const HELIX_TURNS = 6;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const phaseProgress = (p: number, s: number, e: number) => clamp01((p - s) / (e - s));

// ==================== DNA HELIX ====================
function DNAHelix({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const leftStrandRef = useRef<THREE.Mesh>(null!);
  const rightStrandRef = useRef<THREE.Mesh>(null!);

  // Compute all base pair positions
  const basePairs = useMemo(() => {
    const pairs: {
      y: number;
      angle: number;
      leftColor: string;
      rightColor: string;
    }[] = [];

    // A=Magenta, T=Cyan, G=Green, C=Orange (standard-ish palette)
    const bases = [
      { l: "#E94589", r: "#2CC8E4" }, // A-T
      { l: "#2CC8E4", r: "#E94589" }, // T-A
      { l: "#4ECB71", r: "#FFA83E" }, // G-C
      { l: "#FFA83E", r: "#4ECB71" }, // C-G
    ];

    for (let i = 0; i < BASE_PAIRS; i++) {
      const t = i / (BASE_PAIRS - 1);
      const y = (t - 0.5) * HELIX_HEIGHT;
      const angle = t * Math.PI * 2 * HELIX_TURNS;
      const base = bases[i % bases.length];
      pairs.push({
        y,
        angle,
        leftColor: base.l,
        rightColor: base.r,
      });
    }
    return pairs;
  }, []);

  // Build strand tube geometry
  const { leftCurve, rightCurve } = useMemo(() => {
    const leftPoints: THREE.Vector3[] = [];
    const rightPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
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
      leftCurve: new THREE.CatmullRomCurve3(leftPoints),
      rightCurve: new THREE.CatmullRomCurve3(rightPoints),
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Continuous rotation
    groupRef.current.rotation.y += delta * 0.18;
    // Fade out when hero card is prominent
    const emergenceFade = easeInOut(phaseProgress(progress, 0.78, 0.95));
    const mat = (leftStrandRef.current?.material as THREE.MeshBasicMaterial);
    const matR = (rightStrandRef.current?.material as THREE.MeshBasicMaterial);
    if (mat) mat.opacity = 1 - emergenceFade * 0.5;
    if (matR) matR.opacity = 1 - emergenceFade * 0.5;
    groupRef.current.children.forEach((child) => {
      if (child instanceof THREE.Mesh && child !== leftStrandRef.current && child !== rightStrandRef.current) {
        const m = child.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
        if (m && 'opacity' in m) m.opacity = 1 - emergenceFade * 0.7;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {/* Left strand tube */}
      <mesh ref={leftStrandRef}>
        <tubeGeometry args={[leftCurve, 400, 0.08, 10, false]} />
        <meshBasicMaterial color="#2CC8E4" transparent opacity={1} toneMapped={false} />
      </mesh>

      {/* Right strand tube */}
      <mesh ref={rightStrandRef}>
        <tubeGeometry args={[rightCurve, 400, 0.08, 10, false]} />
        <meshBasicMaterial color="#E94589" transparent opacity={1} toneMapped={false} />
      </mesh>

      {/* Base pair rungs + spheres */}
      {basePairs.map((bp, i) => {
        const lx = Math.cos(bp.angle) * HELIX_RADIUS;
        const lz = Math.sin(bp.angle) * HELIX_RADIUS;
        const rx = Math.cos(bp.angle + Math.PI) * HELIX_RADIUS;
        const rz = Math.sin(bp.angle + Math.PI) * HELIX_RADIUS;
        const mid = [(lx + rx) / 2, bp.y, (lz + rz) / 2] as const;
        const dir = new THREE.Vector3(rx - lx, 0, rz - lz);
        const length = dir.length();
        const angle = Math.atan2(dir.z, dir.x);

        return (
          <group key={i}>
            {/* Rung */}
            <mesh position={mid} rotation={[0, -angle, Math.PI / 2]}>
              <cylinderGeometry args={[0.02, 0.02, length, 6]} />
              <meshBasicMaterial color="#FFFFFF" transparent opacity={0.25} toneMapped={false} />
            </mesh>
            {/* Left base — double mesh for fake glow */}
            <mesh position={[lx, bp.y, lz]}>
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshBasicMaterial color={bp.leftColor} toneMapped={false} />
            </mesh>
            <mesh position={[lx, bp.y, lz]}>
              <sphereGeometry args={[0.28, 12, 12]} />
              <meshBasicMaterial color={bp.leftColor} transparent opacity={0.25} toneMapped={false} blending={THREE.AdditiveBlending} />
            </mesh>
            {/* Right base */}
            <mesh position={[rx, bp.y, rz]}>
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshBasicMaterial color={bp.rightColor} toneMapped={false} />
            </mesh>
            <mesh position={[rx, bp.y, rz]}>
              <sphereGeometry args={[0.28, 12, 12]} />
              <meshBasicMaterial color={bp.rightColor} transparent opacity={0.25} toneMapped={false} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ==================== FLOATING TRIAL CARDS ====================
function FloatingTrialCards({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const count = 30;

  const cards = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const y = (t - 0.5) * HELIX_HEIGHT * 0.9;
      const angle = t * Math.PI * 2 * 3;
      const radius = 4 + Math.sin(t * 20) * 1.5;
      arr.push({
        pos: [
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius,
        ] as [number, number, number],
        rot: angle,
      });
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const appearance = easeInOut(phaseProgress(progress, 0.4, 0.7));
    const fade = easeInOut(phaseProgress(progress, 0.72, 0.9));

    groupRef.current.children.forEach((child, i) => {
      const targetScale = appearance * (1 - fade);
      child.scale.setScalar(targetScale);
      child.rotation.y = cards[i].rot + t * 0.1;
      child.rotation.z = Math.sin(t * 0.3 + i) * 0.1;
    });
  });

  return (
    <group ref={groupRef}>
      {cards.map((card, i) => (
        <group key={i} position={card.pos} scale={0}>
          <RoundedBox args={[1.1, 1.5, 0.04]} radius={0.06} smoothness={3}>
            <meshStandardMaterial
              color="#FFFFFF"
              emissive="#0071E3"
              emissiveIntensity={0.3}
              roughness={0.3}
              metalness={0.1}
              toneMapped={false}
            />
          </RoundedBox>
          <mesh position={[0, 0.5, 0.025]}>
            <planeGeometry args={[0.85, 0.08]} />
            <meshBasicMaterial color="#0071E3" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.3, 0.025]}>
            <planeGeometry args={[0.75, 0.05]} />
            <meshBasicMaterial color="#1D1D1F" opacity={0.6} transparent />
          </mesh>
          {Array.from({ length: 5 }).map((_, j) => (
            <mesh key={j} position={[-0.25 + j * 0.12, -0.15, 0.025]}>
              <circleGeometry args={[0.028, 12]} />
              <meshBasicMaterial color={j < 3 ? "#30D158" : j === 3 ? "#FF9F0A" : "#86868B"} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ==================== HERO MATCH CARD ====================
function HeroCard({ progress }: { progress: number }) {
  const ref = useRef<THREE.Group>(null!);
  const scoreRef = useRef<THREE.Group>(null!);
  const stampRefs = useRef<(THREE.Group | null)[]>([]);

  const stamps = useMemo(() => [
    { label: "Age", from: [-5, 3, 3] as [number, number, number], delay: 0, ok: true },
    { label: "Gender", from: [5, 3, 3] as [number, number, number], delay: 0.1, ok: true },
    { label: "HbA1c", from: [-5, -1, 3] as [number, number, number], delay: 0.2, ok: true },
    { label: "Meds", from: [5, -1, 3] as [number, number, number], delay: 0.3, ok: true },
    { label: "eGFR", from: [-4, 4, 4] as [number, number, number], delay: 0.4, ok: true },
    { label: "—", from: [4, -4, 4] as [number, number, number], delay: 0.5, ok: false },
  ], []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;

    const emerge = easeInOut(phaseProgress(progress, 0.66, 0.88));
    const verdict = easeInOut(phaseProgress(progress, 0.85, 1.0));

    ref.current.visible = emerge > 0.01;

    // Position: comes forward from background
    ref.current.position.z = -4 + emerge * 4.5;
    ref.current.position.y = -4 + emerge * 4;
    ref.current.rotation.y = Math.PI * 0.35 - emerge * Math.PI * 0.35 + Math.sin(t * 0.4) * 0.04;
    ref.current.rotation.x = Math.sin(t * 0.25) * 0.03;

    const scale = 0.3 + emerge * 1.7;
    ref.current.scale.setScalar(scale);

    // Score visible during verdict
    if (scoreRef.current) {
      scoreRef.current.visible = verdict > 0.05;
      scoreRef.current.scale.setScalar(0.3 + verdict * 0.8);
    }

    // Stamps fly in
    stampRefs.current.forEach((stamp, i) => {
      if (!stamp) return;
      const stampProgress = clamp01((verdict - stamps[i].delay) / 0.25);
      const eased = easeInOut(stampProgress);

      const fx = stamps[i].from[0];
      const fy = stamps[i].from[1];
      const fz = stamps[i].from[2];

      const tx = -0.55 + (i % 2) * 1.1;
      const ty = 0.25 - Math.floor(i / 2) * 0.3;
      const tz = 0.05;

      stamp.position.set(fx + (tx - fx) * eased, fy + (ty - fy) * eased, fz + (tz - fz) * eased);
      stamp.rotation.z = (1 - eased) * 0.6 + Math.sin(t * 0.5 + i) * 0.02 * eased;
      stamp.scale.setScalar(eased);
      stamp.visible = stampProgress > 0.01;
    });
  });

  return (
    <group ref={ref} position={[0, -4, -4]}>
      {/* Glow behind card */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[3, 3.5]} />
        <meshBasicMaterial color="#0071E3" transparent opacity={0.15} toneMapped={false} />
      </mesh>

      {/* Card body */}
      <RoundedBox args={[2, 2.7, 0.08]} radius={0.1} smoothness={4}>
        <meshStandardMaterial
          color="#FFFFFF"
          roughness={0.2}
          metalness={0.15}
          emissive="#0071E3"
          emissiveIntensity={0.25}
          toneMapped={false}
        />
      </RoundedBox>

      {/* Top strip */}
      <mesh position={[-0.6, 1.1, 0.045]}>
        <planeGeometry args={[0.55, 0.1]} />
        <meshBasicMaterial color="#0071E3" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.9, 0.045]}>
        <planeGeometry args={[1.7, 0.08]} />
        <meshBasicMaterial color="#1D1D1F" opacity={0.9} transparent />
      </mesh>
      <mesh position={[-0.4, 0.77, 0.045]}>
        <planeGeometry args={[0.9, 0.05]} />
        <meshBasicMaterial color="#1D1D1F" opacity={0.5} transparent />
      </mesh>

      {/* Score */}
      <group ref={scoreRef} position={[0.7, 1.18, 0.05]}>
        <Text
          fontSize={0.3}
          color="#30D158"
          anchorX="right"
          anchorY="middle"
          fontWeight={700}
        >
          94%
        </Text>
      </group>

      {/* Divider */}
      <mesh position={[0, 0.55, 0.045]}>
        <planeGeometry args={[1.85, 0.003]} />
        <meshBasicMaterial color="#E8E8ED" />
      </mesh>

      {/* Stamps */}
      {stamps.map((stamp, i) => (
        <group key={i} ref={(el) => { stampRefs.current[i] = el; }} visible={false}>
          <RoundedBox args={[1.0, 0.25, 0.025]} radius={0.05} smoothness={2}>
            <meshStandardMaterial
              color={stamp.ok ? "#E6F7EB" : "#FFF4E0"}
              emissive={stamp.ok ? "#30D158" : "#FF9F0A"}
              emissiveIntensity={0.4}
              roughness={0.4}
              toneMapped={false}
            />
          </RoundedBox>
          <Text
            position={[0, 0, 0.02]}
            fontSize={0.1}
            color={stamp.ok ? "#228B3F" : "#A6690A"}
            anchorX="center"
            anchorY="middle"
            fontWeight={700}
          >
            {stamp.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ==================== CAMERA RIG ====================
function CameraRig({ progress }: { progress: number }) {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;

    // Phase positions
    // Phase 0 (0-0.22): establishing, camera at distance
    // Phase 1 (0.22-0.44): zoom in
    // Phase 2 (0.44-0.66): travel up through helix
    // Phase 3 (0.66-1.0): pull back for hero card
    const p1 = easeInOut(phaseProgress(progress, 0.0, 0.22));
    const p2 = easeInOut(phaseProgress(progress, 0.22, 0.44));
    const p3 = easeInOut(phaseProgress(progress, 0.44, 0.66));
    const p4 = easeInOut(phaseProgress(progress, 0.66, 1.0));

    // Base: far away, wide shot
    let targetZ = 14 - p1 * 2; // slight push during phase 1
    let targetY = -8 + p1 * 8;  // rise up
    let targetX = 0;

    // Phase 2: approach the helix
    targetZ -= p2 * 8; // closer
    targetY += p2 * 2;

    // Phase 3: travel up through the helix
    targetZ += p3 * 2; // inside
    targetY += p3 * 6; // going up
    targetX = Math.sin(t * 0.3) * p3 * 1.5; // slight sway

    // Phase 4: pull back for hero card reveal
    targetZ += p4 * 5;
    targetY -= p4 * 3;
    targetX = Math.sin(t * 0.2) * 0.5 * (1 - p4) + p4 * 0.5;

    // Smoothly lerp
    camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.08);

    // Look target also shifts
    const lookY = -2 + p2 * 2 + p3 * 4 - p4 * 2;
    camera.lookAt(0, lookY, 0);
  });

  return null;
}

// ==================== AMBIENT PARTICLES ====================
function Particles({ progress }: { progress: number }) {
  const ref = useRef<THREE.Points>(null!);

  const { positions, colors } = useMemo(() => {
    const count = 400;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color("#2CC8E4"),
      new THREE.Color("#E94589"),
      new THREE.Color("#4ECB71"),
      new THREE.Color("#FFA83E"),
      new THREE.Color("#FFFFFF"),
    ];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    return { positions, colors };
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.02;
      const mat = ref.current.material as THREE.PointsMaterial;
      mat.opacity = 0.7 - progress * 0.4;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}

// ==================== MAIN SCENE ====================
export default function TrialFieldScene({ progress }: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, -8, 14], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      style={{ background: "#05070F" }}
    >
      {/* Dark gradient background via fog */}
      <color attach="background" args={["#05070F"]} />
      <fog attach="fog" args={["#05070F", 18, 45]} />

      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#FFFFFF" />
      <pointLight position={[-10, -10, -10]} intensity={0.4} color="#2CC8E4" />
      <pointLight position={[0, 0, 5]} intensity={0.6} color="#E94589" />

      <Stars radius={60} depth={50} count={2000} factor={3} fade speed={0.6} />

      <Particles progress={progress} />

      <CameraRig progress={progress} />

      <DNAHelix progress={progress} />

      <FloatingTrialCards progress={progress} />

      <HeroCard progress={progress} />
    </Canvas>
  );
}
