"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover3d?: boolean;
  delay?: number;
  glowOnHover?: boolean;
  animatedBorder?: boolean;
  as?: "div" | "section" | "article";
}

export default function GlassCard({
  children,
  className,
  delay = 0,
  animatedBorder = false,
  as = "div",
}: GlassCardProps) {
  const Component = motion[as];

  return (
    <Component
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "relative rounded-2xl",
        "bg-bg-surface border border-white/[0.05]",
        "transition-colors duration-200",
        "hover:border-white/[0.08]",
        animatedBorder && "ring-animated",
        className
      )}
    >
      {children}
    </Component>
  );
}
