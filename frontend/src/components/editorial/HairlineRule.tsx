"use client";

import { useRef } from "react";
import { useGSAP, gsap } from "@/lib/gsap";

interface HairlineRuleProps {
  className?: string;
  thick?: boolean;
  delay?: number;
  immediate?: boolean;
}

export default function HairlineRule({ className = "", thick, delay = 0, immediate = false }: HairlineRuleProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.from(ref.current, {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 1.2,
        ease: "power3.inOut",
        delay,
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

  return (
    <div
      ref={ref}
      className={`${thick ? "h-[2px] bg-ink" : "h-[1px] bg-rule"} ${className}`}
    />
  );
}
