"use client";

import { Check, X, AlertTriangle } from "lucide-react";
import { forwardRef } from "react";

export interface MatchCardRow {
  label: string;
  you: string;
  req: string;
  status: "match" | "excluded" | "unknown";
}

interface MatchCardProps {
  title?: string;
  nct?: string;
  phase?: string;
  score?: number;
  rows: MatchCardRow[];
  compact?: boolean;
  dark?: boolean;
}

const icons = { match: Check, excluded: X, unknown: AlertTriangle };

const MatchCard = forwardRef<HTMLDivElement, MatchCardProps>(function MatchCard(
  {
    title = "Tirzepatide vs Insulin Glargine in T2DM",
    nct = "NCT05243264",
    phase = "Phase 3",
    score = 94,
    rows,
    compact = false,
    dark = false,
  },
  ref
) {
  const scoreColor =
    score >= 80 ? "text-success" :
    score >= 50 ? "text-warning" : "text-error";

  return (
    <div
      ref={ref}
      className={`rounded-[22px] overflow-hidden ${
        dark
          ? "bg-[#2C2C2E] text-white border border-white/5"
          : "bg-white border border-line-soft"
      } shadow-[0_30px_80px_-20px_rgba(0,0,0,0.15)]`}
    >
      {/* Header */}
      <div className={`px-6 py-5 border-b ${dark ? "border-white/10" : "border-line-soft"}`}>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? "text-accent-dark" : "text-accent"} bg-accent/10 px-2 py-0.5 rounded-full`}>
                {phase}
              </span>
              <span className={`text-[11px] tabular ${dark ? "text-white/50" : "text-fg-faint"} font-medium`}>
                {nct}
              </span>
            </div>
            <h3 className={`text-[17px] font-semibold leading-tight ${compact ? "line-clamp-2" : ""}`}>
              {title}
            </h3>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`text-[56px] font-semibold leading-none tabular score-value ${scoreColor}`}>
              {score}
              <span className="text-[28px]">%</span>
            </div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mt-1 ${dark ? "text-white/50" : "text-fg-faint"}`}>
              Match Score
            </p>
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className={`divide-y ${dark ? "divide-white/5" : "divide-line-soft"}`}>
        {rows.map((row, i) => {
          const Icon = icons[row.status];
          const statusBg =
            row.status === "match" ? "bg-success/15 text-success" :
            row.status === "excluded" ? "bg-error/15 text-error" : "bg-warning/15 text-warning";

          return (
            <div
              key={i}
              data-row-index={i}
              className="match-row grid grid-cols-12 items-center gap-3 px-6 py-3"
            >
              <div className={`col-span-4 text-[13px] font-medium ${dark ? "text-white" : "text-fg"}`}>
                {row.label}
              </div>
              <div className={`col-span-3 text-[12px] tabular ${dark ? "text-white/70" : "text-fg-mute"}`}>
                {row.you}
              </div>
              <div className={`col-span-3 text-[12px] tabular ${dark ? "text-white/50" : "text-fg-faint"}`}>
                {row.req}
              </div>
              <div className="col-span-2 flex justify-end">
                <div className={`match-badge inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${statusBg}`}>
                  <Icon className="w-3 h-3" strokeWidth={2.5} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">
                    {row.status === "unknown" ? "Unkn" : row.status === "excluded" ? "Excl" : "Match"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default MatchCard;

export const SAMPLE_ROWS: MatchCardRow[] = [
  { label: "Age", you: "45 years", req: "18 – 65", status: "match" },
  { label: "Gender", you: "Female", req: "All", status: "match" },
  { label: "HbA1c", you: "7.2%", req: "< 10.5%", status: "match" },
  { label: "Medications", you: "Metformin", req: "No GLP-1", status: "match" },
  { label: "eGFR", you: "78 mL/min", req: "≥ 30", status: "match" },
  { label: "Pancreatitis", you: "Unknown", req: "No history", status: "unknown" },
];
