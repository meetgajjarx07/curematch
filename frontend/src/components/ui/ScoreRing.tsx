"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { getScoreColor } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export default function ScoreRing({
  score,
  size = 64,
  strokeWidth = 4,
  showLabel = true,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const displayValue = useMotionValue(0);
  const rounded = useTransform(displayValue, (v) => `${Math.round(v)}%`);

  useEffect(() => {
    const controls = animate(displayValue, score, {
      duration: 1.4,
      ease: "easeOut",
      delay: 0.3,
    });
    return controls.stop;
  }, [score, displayValue]);

  const getGradientId = () => `score-gradient-${score}-${size}`;
  const gradientId = getGradientId();

  const getGradientColors = () => {
    if (score >= 80) return { start: "#10B981", end: "#34D399" };
    if (score >= 50) return { start: "#F59E0B", end: "#FBBF24" };
    return { start: "#EF4444", end: "#F87171" };
  };

  const colors = getGradientColors();

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.start} />
            <stop offset="100%" stopColor={colors.end} />
          </linearGradient>
        </defs>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/[0.06]"
        />
        {/* Animated ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke={`url(#${gradientId})`}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      {showLabel && (
        <motion.span
          className={`absolute font-bold ${getScoreColor(score)} ${
            size >= 70 ? "text-base" : "text-sm"
          }`}
        >
          {rounded}
        </motion.span>
      )}
    </div>
  );
}
