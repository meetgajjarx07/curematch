"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useGSAP, gsap, ScrollTrigger } from "@/lib/gsap";

const PipelineScene = dynamic(() => import("./PipelineScene"), {
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
    eyebrow: "Stage 01 · Raw",
    title: "65,081 trials\narrive as prose.",
    body: "The ClinicalTrials.gov API gives us structured metadata plus a wall of eligibility text per trial.",
    range: [0, 0.25],
  },
  {
    eyebrow: "Stage 02 · Parse",
    title: "A language model\nextracts structure.",
    body: "Gemma 4 26B runs offline through Ollama, converting free-text criteria into machine-readable fields. Once per trial.",
    range: [0.25, 0.5],
  },
  {
    eyebrow: "Stage 03 · Store",
    title: "Structured records,\nindexed for recall.",
    body: "Ages, medications, lab thresholds, conditions — all stored in SQLite, ready for matching.",
    range: [0.5, 0.75],
  },
  {
    eyebrow: "Stage 04 · Match",
    title: "Rule-based,\ndeterministic, fast.",
    body: "Your profile compared against every parsed record. No AI in this step — just straight comparisons. Reproducible every time.",
    range: [0.75, 1.0],
  },
];

export default function PipelineScrollSection() {
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

      return () => { masterST.kill(); };
    },
    { scope: sectionRef }
  );

  const currentStage = PHASES.findIndex(p => progress >= p.range[0] && progress < p.range[1]) + 1 || PHASES.length;

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#05070F]"
      style={{ height: "450vh" }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="absolute inset-0">
          {mounted && <PipelineScene progress={progress} />}
        </div>

        {/* Vignettes */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#05070F]/60 via-transparent to-[#05070F]/40" />

        {/* Copy — bottom band */}
        <div className="absolute inset-x-0 bottom-20 pointer-events-none">
          <div className="max-w-wide mx-auto px-6 grid grid-cols-12">
            <div className="col-span-12 md:col-span-7 lg:col-span-6 relative min-h-[220px]">
              {PHASES.map((phase, i) => (
                <div
                  key={i}
                  ref={(el) => { phaseRefs.current[i] = el; }}
                  className="absolute inset-0"
                  style={{ opacity: 0 }}
                >
                  <p className="eyebrow-sm mb-3 text-[#2CC8E4]" style={{ textShadow: "0 0 20px rgba(44,200,228,0.4)" }}>
                    {phase.eyebrow}
                  </p>
                  <h2
                    className="text-[36px] md:text-[48px] font-semibold mb-3 whitespace-pre-line text-balance text-white leading-[1.05]"
                    style={{ textShadow: "0 4px 20px rgba(0,0,0,0.6)" }}
                  >
                    {phase.title}
                  </h2>
                  <p
                    className="text-[16px] leading-relaxed max-w-md text-white/75"
                    style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
                  >
                    {phase.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="absolute top-8 left-0 right-0 px-6 pointer-events-none">
          <div className="max-w-wide mx-auto flex items-center gap-4 text-white/60">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] tabular">
              Stage {String(currentStage).padStart(2, "0")} of 04
            </span>
            <div className="flex-1 h-px bg-white/15 relative overflow-hidden">
              <div
                className="absolute inset-0 h-px origin-left"
                style={{
                  background: "linear-gradient(90deg, #2CC8E4, #E94589, #FFA83E, #4ECB71)",
                  transform: `scaleX(${progress})`,
                  transition: "transform 0.1s ease-out",
                }}
              />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] tabular">
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
