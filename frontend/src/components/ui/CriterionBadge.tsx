"use client";

import { Check, X, AlertTriangle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type CriterionStatus = "match" | "excluded" | "unknown" | "not_applicable";

const config: Record<CriterionStatus, { icon: typeof Check; label: string; classes: string }> = {
  match: {
    icon: Check,
    label: "Match",
    classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  },
  excluded: {
    icon: X,
    label: "Excluded",
    classes: "bg-red-500/15 text-red-400 border-red-500/20",
  },
  unknown: {
    icon: AlertTriangle,
    label: "Unknown",
    classes: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  },
  not_applicable: {
    icon: Minus,
    label: "N/A",
    classes: "bg-white/[0.04] text-text-secondary border-white/[0.06]",
  },
};

interface CriterionBadgeProps {
  status: CriterionStatus;
  label?: string;
  className?: string;
}

export default function CriterionBadge({ status, label, className }: CriterionBadgeProps) {
  const { icon: Icon, label: defaultLabel, classes } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border",
        classes,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {label || defaultLabel}
    </span>
  );
}
