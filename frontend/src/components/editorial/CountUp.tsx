"use client";

import { useRef } from "react";
import { useGSAP, gsap } from "@/lib/gsap";

interface CountUpProps {
  to: number;
  from?: number;
  className?: string;
  duration?: number;
  format?: "integer" | "comma" | "percent" | "currency";
  prefix?: string;
  suffix?: string;
}

export default function CountUp({
  to,
  from = 0,
  className = "",
  duration = 2,
  format = "comma",
  prefix = "",
  suffix = "",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      const obj = { val: from };
      gsap.to(obj, {
        val: to,
        duration,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 90%",
          toggleActions: "play none none none",
        },
        onUpdate: () => {
          if (!ref.current) return;
          let formatted: string;
          switch (format) {
            case "comma":
              formatted = Math.round(obj.val).toLocaleString();
              break;
            case "percent":
              formatted = Math.round(obj.val) + "%";
              break;
            case "currency":
              formatted = "$" + Math.round(obj.val).toLocaleString();
              break;
            default:
              formatted = String(Math.round(obj.val));
          }
          ref.current.textContent = prefix + formatted + suffix;
        },
      });
    },
    { scope: ref, dependencies: [to, from] }
  );

  return <span ref={ref} className={className}>{prefix}{format === "comma" ? from.toLocaleString() : from}{suffix}</span>;
}
