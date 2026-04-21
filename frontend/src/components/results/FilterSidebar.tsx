"use client";

import { X } from "lucide-react";
import { SearchFilters } from "@/lib/types";

interface FilterSidebarProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onClose?: () => void;
  isMobile?: boolean;
}

const PHASES = ["Phase 1", "Phase 2", "Phase 3", "Phase 4"];
const CATEGORIES = ["All", "Cancer", "Diabetes", "Cardiovascular", "Neurological", "Autoimmune", "Pulmonary"];

export default function FilterSidebar({ filters, onChange, onClose, isMobile }: FilterSidebarProps) {
  const togglePhase = (phase: string) => {
    const current = filters.phase;
    onChange({
      ...filters,
      phase: current.includes(phase) ? current.filter((p) => p !== phase) : [...current, phase],
    });
  };

  return (
    <aside>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-fg-mute">Filters</h3>
        {isMobile && onClose && (
          <button onClick={onClose} className="text-fg-mute hover:text-fg">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Category */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint mb-2">Category</p>
          <div className="space-y-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => onChange({ ...filters, conditionCategory: cat })}
                className={`block w-full text-left py-1.5 text-[14px] rounded transition-colors ${
                  filters.conditionCategory === cat
                    ? "text-accent font-medium"
                    : "text-fg-mute hover:text-fg"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Phase */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint mb-2">Phase</p>
          <div className="flex flex-wrap gap-1.5">
            {PHASES.map((phase) => (
              <button
                key={phase}
                onClick={() => togglePhase(phase)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                  filters.phase.includes(phase)
                    ? "bg-accent text-white border-accent"
                    : "bg-white border-line text-fg-mute hover:border-fg-faint hover:text-fg"
                }`}
              >
                {phase}
              </button>
            ))}
          </div>
        </div>

        {/* Min Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Min Score</p>
            <span className="text-[11px] font-semibold text-accent tabular">{filters.minScore}%</span>
          </div>
          <input
            type="range"
            min={0} max={100} step={5}
            value={filters.minScore}
            onChange={(e) => onChange({ ...filters, minScore: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        {/* Distance */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Max Distance</p>
            <span className="text-[11px] font-semibold text-accent tabular">{filters.maxDistance} mi</span>
          </div>
          <input
            type="range"
            min={10} max={2000} step={10}
            value={filters.maxDistance}
            onChange={(e) => onChange({ ...filters, maxDistance: Number(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>
    </aside>
  );
}
