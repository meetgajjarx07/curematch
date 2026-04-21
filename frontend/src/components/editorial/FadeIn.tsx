"use client";

import { useRef } from "react";
import { useGSAP, gsap } from "@/lib/gsap";

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "article" | "aside";
  immediate?: boolean;
}

export default function FadeIn({
  children,
  className = "",
  delay = 0,
  y = 24,
  as = "div",
  immediate = false,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.from(ref.current, {
        opacity: 0,
        y,
        duration: 0.9,
        ease: "power3.out",
        delay: delay / 1000,
        scrollTrigger: immediate
          ? undefined
          : {
              trigger: ref.current,
              start: "top 90%",
              toggleActions: "play none none none",
            },
      });
    },
    { scope: ref }
  );

  const Tag = as;
  return (
    <Tag ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </Tag>
  );
}
