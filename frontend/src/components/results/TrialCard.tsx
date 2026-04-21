"use client";

import Link from "next/link";
import { useRef } from "react";
import { MapPin, Users, ArrowRight } from "lucide-react";
import { useGSAP, gsap } from "@/lib/gsap";
import { TrialMatch } from "@/lib/types";
import { formatDistance } from "@/lib/utils";

interface TrialCardProps {
  trial: TrialMatch;
  index: number;
}

const dotColor = {
  match: "bg-success",
  excluded: "bg-error",
  unknown: "bg-warning",
  not_applicable: "bg-line",
};

export default function TrialCard({ trial, index }: TrialCardProps) {
  const ref = useRef<HTMLElement>(null);
  const matchCount = trial.criteriaResults.filter(c => c.result === "match").length;

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.from(ref.current, {
        opacity: 0,
        y: 16,
        duration: 0.6,
        ease: "power3.out",
        delay: index * 0.04,
        scrollTrigger: { trigger: ref.current, start: "top 95%", toggleActions: "play none none none" },
      });
    },
    { scope: ref }
  );

  return (
    <article ref={ref} className="group">
      <Link
        href={`/trial/${trial.nctId}`}
        className="group relative block bg-white border border-line-soft rounded-[18px] p-6 hover:border-accent/40 hover:shadow-[0_20px_50px_-20px_rgba(0,113,227,0.15)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 overflow-hidden"
      >
        {/* accent stripe on hover */}
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        />
        <div className="flex items-start gap-5">
          {/* Score block */}
          <div className="flex-shrink-0 text-center">
            <div className={`text-[36px] font-semibold leading-none tabular mb-0.5 ${
              trial.matchScore >= 80 ? "text-success" :
              trial.matchScore >= 50 ? "text-warning" : "text-error"
            }`}>
              {trial.matchScore}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
              Match
            </div>
          </div>

          {/* Vertical rule */}
          <div className="w-px bg-line-soft self-stretch" />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                {trial.phase}
              </span>
              <span className="text-[11px] text-fg-faint tabular">{trial.nctId}</span>
            </div>

            <h3 className="text-[17px] font-semibold leading-snug mb-1 line-clamp-2 group-hover:text-accent transition-colors">
              {trial.briefTitle}
            </h3>
            <p className="text-[13px] text-fg-mute mb-3">{trial.sponsor}</p>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1">
                {trial.criteriaResults.map((c, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${dotColor[c.result]}`} />
                ))}
                <span className="text-[11px] text-fg-mute ml-1.5 tabular">
                  {matchCount}/{trial.criteriaResults.length}
                </span>
              </div>
              <span className="text-[12px] text-fg-mute flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {formatDistance(trial.nearestDistance)}
              </span>
              <span className="text-[12px] text-fg-mute flex items-center gap-1">
                <Users className="w-3 h-3" />
                {trial.enrollmentCount.toLocaleString()}
              </span>
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-fg-faint opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-2" />
        </div>
      </Link>
    </article>
  );
}
