"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

interface TrialLocation {
  lat: number;
  lng: number;
  score: number;
}

interface TrialGlobeProps {
  locations: TrialLocation[];
  className?: string;
}

const RADIUS = 2.4;

function latLngToVec3(lat: number, lng: number, r = RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(r * Math.sin(phi) * Math.cos(theta)),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function Globe({ locations }: { locations: TrialLocation[] }) {
  const groupRef = useRef<THREE.Group>(null!);
  const pointRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Wireframe continent dots — create a latitude/longitude grid
  const gridDots = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 8) {
      for (let lng = -180; lng <= 180; lng += 8) {
        // Skip oceans with a hacky pattern — create a pseudo-continent shape via noise
        const noise =
          Math.sin(lat * 0.3) * Math.cos(lng * 0.4) +
          Math.sin(lng * 0.2) * Math.cos(lat * 0.5);
        if (noise > -0.3) {
          points.push(latLngToVec3(lat, lng, RADIUS * 1.005));
        }
      }
    }
    return points;
  }, []);

  const gridBufferGeo = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(gridDots);
    return g;
  }, [gridDots]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1;
    }
    pointRefs.current.forEach((m, i) => {
      if (!m) return;
      const t = performance.now() / 1000;
      const pulse = 1 + Math.sin(t * 2 + i * 0.5) * 0.25;
      m.scale.setScalar(pulse);
    });
  });

  return (
    <group ref={groupRef}>
      {/* Inner dark sphere */}
      <mesh>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <meshBasicMaterial color="#0A1428" transparent opacity={0.95} />
      </mesh>

      {/* Atmosphere glow */}
      <mesh>
        <sphereGeometry args={[RADIUS * 1.08, 32, 32]} />
        <meshBasicMaterial color="#2CC8E4" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>

      {/* Wireframe mesh */}
      <mesh>
        <sphereGeometry args={[RADIUS * 1.002, 32, 32]} />
        <meshBasicMaterial color="#1B3E5F" wireframe transparent opacity={0.35} />
      </mesh>

      {/* Continent-like dots */}
      <points geometry={gridBufferGeo}>
        <pointsMaterial size={0.025} color="#2CC8E4" transparent opacity={0.6} toneMapped={false} />
      </points>

      {/* Trial location markers */}
      {locations.map((loc, i) => {
        const pos = latLngToVec3(loc.lat, loc.lng, RADIUS * 1.02);
        const color =
          loc.score >= 80 ? "#30D158" :
          loc.score >= 50 ? "#FF9F0A" : "#FF3B30";
        return (
          <group key={i} position={pos}>
            <mesh ref={(el) => { pointRefs.current[i] = el; }}>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            {/* Glow halo */}
            <mesh>
              <sphereGeometry args={[0.12, 12, 12]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.3}
                toneMapped={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
            {/* Beam upward */}
            <mesh position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.3, 6]} />
              <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export default function TrialGlobe({ locations, className = "" }: TrialGlobeProps) {
  return (
    <div className={`relative ${className}`}>
      <Canvas
        camera={{ position: [0, 0.5, 7], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 5, 5]} intensity={0.8} color="#2CC8E4" />
        <pointLight position={[-5, -2, -5]} intensity={0.4} color="#E94589" />

        <Stars radius={30} depth={20} count={600} factor={2} fade speed={0.3} />

        <Globe locations={locations} />
      </Canvas>
    </div>
  );
}
