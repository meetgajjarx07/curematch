"use client";

import { useRef } from "react";
import { useGSAP, gsap, SplitText } from "@/lib/gsap";

interface TextRevealProps {
  children: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  delay?: number;
  split?: "words" | "chars" | "lines";
  stagger?: number;
  onScroll?: boolean;
}

export default function TextReveal({
  children,
  className = "",
  as = "h1",
  delay = 0,
  split = "words",
  stagger = 0.04,
  onScroll = false,
}: TextRevealProps) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;

      const splitText = SplitText.create(ref.current, {
        type: split === "chars" ? "words, chars" : split,
        mask: split === "chars" ? "chars" : "words",
      });

      const targets =
        split === "chars" ? splitText.chars :
        split === "lines" ? splitText.lines :
        splitText.words;

      gsap.from(targets, {
        yPercent: 120,
        opacity: 0,
        rotate: 4,
        duration: 0.9,
        ease: "power3.out",
        stagger,
        delay,
        scrollTrigger: onScroll
          ? {
              trigger: ref.current,
              start: "top 85%",
              toggleActions: "play none none none",
            }
          : undefined,
      });

      return () => {
        splitText.revert();
      };
    },
    { scope: ref }
  );

  const Tag = as as "h1" | "h2" | "h3" | "p" | "span";
  return (
    <Tag
      ref={ref as React.RefObject<HTMLHeadingElement & HTMLParagraphElement & HTMLSpanElement>}
      className={className}
    >
      {children}
    </Tag>
  );
}
