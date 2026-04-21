"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useGSAP, gsap, ScrollTrigger } from "@/lib/gsap";

const TrialFieldScene = dynamic(() => import("./TrialFieldScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#05070F]" />,
});

interface Phase {
  eyebrow: string;
  title: string;
  body: string;
  range: [number, number];
}

const PHASES: Phase[] = [
  {
    eyebrow: "Chapter I · The Library",
    title: "Sixty-five thousand\ntrials. In one helix.",
    body: "Every actively recruiting trial on ClinicalTrials.gov. Pre-parsed once, offline, into a structured record.",
    range: [0, 0.22],
  },
  {
    eyebrow: "Chapter II · The Code",
    title: "Eligibility,\nmade legible.",
    body: "Age. Medications. Lab thresholds. Conditions. Each criterion extracted from free-text prose into machine-readable fields.",
    range: [0.22, 0.44],
  },
  {
    eyebrow: "Chapter III · The Scan",
    title: "Your profile,\nscreened at the speed of scroll.",
    body: "When you submit, we compare against every parsed trial. Rule-based. Deterministic. Reproducible.",
    range: [0.44, 0.68],
  },
  {
    eyebrow: "Chapter IV · The Verdict",
    title: "Every criterion.\nIn plain terms.",
    body: "No opaque score. Every match, every exclusion, every unknown — shown beside the trial, line by line.",
    range: [0.68, 1.0],
  },
];

export default function ScrollScene() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const phaseRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      const masterST = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => setProgress(self.progress),
      });

      // Phase fade in/out
      phaseRefs.current.forEach((el, i) => {
        if (!el) return;
        const phase = PHASES[i];
        const midpoint = (phase.range[0] + phase.range[1]) / 2;

        gsap.fromTo(el,
          { opacity: 0, y: 30 },
          {
            opacity: 1, y: 0, ease: "power3.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: `top+=${phase.range[0] * 100}% top`,
              end: `top+=${midpoint * 100}% top`,
              scrub: 0.8,
            },
          }
        );

        gsap.to(el, {
          opacity: 0, y: -30, ease: "power3.in",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: `top+=${midpoint * 100}% top`,
            end: `top+=${phase.range[1] * 100}% top`,
            scrub: 0.8,
          },
        });
      });

      const indicator = sectionRef.current.querySelector(".scroll-indicator");
      if (indicator) {
        gsap.to(indicator, {
          scaleX: 1, transformOrigin: "left", ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
          },
        });
      }

      return () => { masterST.kill(); };
    },
    { scope: sectionRef }
  );

  const currentChapter = PHASES.findIndex(p => progress >= p.range[0] && progress < p.range[1]) + 1 || PHASES.length;

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#05070F]"
      style={{ height: "550vh" }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* 3D scene */}
        <div className="absolute inset-0">
          {mounted && <TrialFieldScene progress={progress} />}
        </div>

        {/* Vignette for text legibility */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#05070F]/80 via-transparent to-transparent" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#05070F]/60 via-transparent to-[#05070F]/40" />

        {/* Text overlays — left side */}
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-wide mx-auto px-6 w-full grid grid-cols-12">
            <div className="col-span-12 md:col-span-6 lg:col-span-5 relative min-h-[380px]">
              {PHASES.map((phase, i) => (
                <div
                  key={i}
                  ref={(el) => { phaseRefs.current[i] = el; }}
                  className="absolute inset-0"
                  style={{ opacity: 0 }}
                >
                  <p className="eyebrow-sm mb-4 text-[#2CC8E4]" style={{ textShadow: "0 0 20px rgba(44,200,228,0.5)" }}>
                    {phase.eyebrow}
                  </p>
                  <h2
                    className="mega-headline mb-6 whitespace-pre-line text-balance text-white"
                    style={{ textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}
                  >
                    {phase.title}
                  </h2>
                  <p
                    className="text-[18px] leading-relaxed max-w-md text-white/80"
                    style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}
                  >
                    {phase.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="absolute bottom-10 left-0 right-0 px-6 pointer-events-none">
          <div className="max-w-wide mx-auto flex items-center gap-4 text-white/60">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] tabular">
              {String(Math.round(progress * 100)).padStart(2, "0")}%
            </span>
            <div className="flex-1 h-px bg-white/15 relative overflow-hidden">
              <div
                className="scroll-indicator absolute inset-0 h-px origin-left"
                style={{
                  background: "linear-gradient(90deg, #2CC8E4, #E94589)",
                  transform: "scaleX(0)",
                }}
              />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] tabular">
              Ch. {String(currentChapter).padStart(2, "0")} / 04
            </span>
          </div>
        </div>

        {/* Small hint top-right */}
        <div className="absolute top-20 right-8 pointer-events-none hidden md:block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
            Scroll to advance
          </p>
        </div>
      </div>
    </section>
  );
}
