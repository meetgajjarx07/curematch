"use client";

import { useRef } from "react";
import { useGSAP, gsap } from "@/lib/gsap";
import Link from "next/link";

interface MagneticButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  strength?: number;
}

export default function MagneticButton({
  children,
  href,
  onClick,
  className = "",
  strength = 0.3,
}: MagneticButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLElement>(null);

  useGSAP(
    (_, contextSafe) => {
      if (!containerRef.current || !innerRef.current || !contextSafe) return;

      const handleMove = contextSafe((e: MouseEvent) => {
        if (!containerRef.current || !innerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        gsap.to(innerRef.current, {
          x: x * strength,
          y: y * strength,
          duration: 0.6,
          ease: "power3.out",
        });
      });

      const handleLeave = contextSafe(() => {
        if (!innerRef.current) return;
        gsap.to(innerRef.current, {
          x: 0,
          y: 0,
          duration: 0.8,
          ease: "elastic.out(1, 0.4)",
        });
      });

      const container = containerRef.current;
      container.addEventListener("mousemove", handleMove);
      container.addEventListener("mouseleave", handleLeave);

      return () => {
        container.removeEventListener("mousemove", handleMove);
        container.removeEventListener("mouseleave", handleLeave);
      };
    },
    { scope: containerRef, dependencies: [strength] }
  );

  const content = (
    <span ref={innerRef as React.RefObject<HTMLSpanElement>} className="inline-block will-change-transform">
      {children}
    </span>
  );

  if (href) {
    return (
      <div ref={containerRef} className={`inline-block ${className}`}>
        <Link href={href} className="inline-block">
          {content}
        </Link>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`inline-block ${className}`} onClick={onClick}>
      {content}
    </div>
  );
}
