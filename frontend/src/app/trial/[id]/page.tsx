"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft, ExternalLink, MapPin, Users, Calendar, Bookmark, BookmarkCheck, Share2,
  Phone, Mail, Check, X, AlertTriangle, Minus, Building2, Loader2,
} from "lucide-react";
import { formatDistance } from "@/lib/utils";
import { CriterionResult, TrialMatch, ParsedEligibilitySummary } from "@/lib/types";
import SceneErrorBoundary from "@/components/three/SceneErrorBoundary";

const MoleculeHero = dynamic(() => import("@/components/three/MoleculeHero"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-deep" />,
});

const TrialChatPanel = dynamic(() => import("@/components/chat/TrialChatPanel"), {
  ssr: false,
});

const MatchExplainer = dynamic(() => import("@/components/chat/MatchExplainer"), {
  ssr: false,
});

const resultIcons = { match: Check, excluded: X, unknown: AlertTriangle, not_applicable: Minus };
const resultStyles = {
  match: { bg: "bg-success/12", text: "text-success", dot: "bg-success" },
  excluded: { bg: "bg-error/12", text: "text-error", dot: "bg-error" },
  unknown: { bg: "bg-warning/12", text: "text-warning", dot: "bg-warning" },
  not_applicable: { bg: "bg-paper-alt", text: "text-fg-faint", dot: "bg-line" },
};
const resultLabels = { match: "Match", excluded: "Excluded", unknown: "Unknown", not_applicable: "N/A" };

export default function TrialDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [trial, setTrial] = useState<TrialMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    (async () => {
      try {
        const profileRaw = typeof window !== "undefined"
          ? sessionStorage.getItem("patientProfile")
          : null;
        let profileParam = "";
        if (profileRaw) {
          try {
            const raw = JSON.parse(profileRaw);
            const labValues: Record<string, number> = {};
            if (raw.labValues && typeof raw.labValues === "object") {
              for (const [k, v] of Object.entries(raw.labValues)) {
                const n = Number(v);
                if (v !== "" && !Number.isNaN(n)) labValues[k] = n;
              }
            }
            const profile = {
              age: raw.age ? Number(raw.age) : undefined,
              gender: raw.gender || undefined,
              conditions: raw.conditions || [],
              medications: raw.medications || [],
              labValues,
              lat: raw.locationLat,
              lng: raw.locationLng,
              searchRadius: raw.searchRadius,
            };
            profileParam = `?profile=${encodeURIComponent(JSON.stringify(profile))}`;
          } catch {}
        }

        const res = await fetch(`/api/trials/${id}${profileParam}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        if (!cancelled) setTrial(data);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id || typeof window === "undefined") return;
    try {
      const list: string[] = JSON.parse(localStorage.getItem("savedTrials") || "[]");
      setSaved(list.includes(id));
    } catch {}
  }, [id]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const toggleSave = () => {
    if (!id) return;
    try {
      const list: string[] = JSON.parse(localStorage.getItem("savedTrials") || "[]");
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      localStorage.setItem("savedTrials", JSON.stringify(next));
      setSaved(next.includes(id));
      showToast(next.includes(id) ? "Saved to your list" : "Removed from your list");
    } catch {
      showToast("Could not save — storage unavailable");
    }
  };

  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = trial?.briefTitle ?? "Clinical trial";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard");
    } catch {
      showToast("Sharing is not available on this browser");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-6 h-6 text-accent mx-auto mb-4 animate-spin" />
          <p className="text-[14px] text-fg-mute">Loading trial…</p>
        </div>
      </div>
    );
  }

  if (notFound || !trial) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <h1 className="text-[28px] font-semibold mb-3">Trial not found</h1>
          <p className="text-[15px] text-fg-mute mb-6">
            No trial with identifier{" "}
            <span className="font-mono bg-paper-alt px-1.5 py-0.5 rounded">{id}</span>.
            It may have been removed or moved to a different registry.
          </p>
          <Link
            href="/results"
            className="inline-flex items-center gap-1.5 text-accent hover:text-accent-hover"
          >
            <ArrowLeft className="w-4 h-4" /> Back to results
          </Link>
        </div>
      </div>
    );
  }

  const matchCount = trial.criteriaResults.filter(c => c.result === "match").length;
  const totalCount = trial.criteriaResults.length;
  const scoreColor = trial.matchScore >= 80 ? "text-success" : trial.matchScore >= 50 ? "text-warning" : "text-error";

  return (
    <div className="bg-paper">
      {/* 3D HERO */}
      <section className="relative bg-deep text-white overflow-hidden h-[65vh] min-h-[480px]">
        <div className="absolute inset-0">
          <SceneErrorBoundary>
            <MoleculeHero score={trial.matchScore} phase={trial.phase} className="w-full h-full" />
          </SceneErrorBoundary>
        </div>

        {/* Top fade */}
        <div className="absolute inset-0 bg-gradient-to-b from-deep/40 via-transparent to-transparent pointer-events-none" />
        {/* Left fade for copy */}
        <div className="absolute inset-0 bg-gradient-to-r from-deep/90 via-deep/30 to-transparent pointer-events-none" />
        {/* Bottom fade into paper */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-paper to-transparent pointer-events-none" />

        {/* Back link */}
        <div className="relative max-w-apple mx-auto px-6 pt-8">
          <Link href="/results" className="inline-flex items-center gap-1.5 text-[13px] text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Results
          </Link>
        </div>

        {/* Copy */}
        <div className="relative h-full flex items-end pb-24">
          <div className="max-w-apple mx-auto px-6 w-full">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider bg-cosmic-cyan/15 text-cosmic-cyan border border-cosmic-cyan/25 px-2 py-0.5 rounded-full">
                {trial.phase}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider bg-success/20 text-success border border-success/25 px-2 py-0.5 rounded-full">
                {trial.status}
              </span>
              <span className="text-[12px] font-medium text-white/50 tabular">{trial.nctId}</span>
            </div>

            <h1 className="mega-headline mb-4 text-balance max-w-3xl text-white text-shadow-hero">
              {trial.briefTitle}
            </h1>
            <p className="text-[18px] text-white/75 text-shadow-soft">
              {trial.sponsor}
            </p>
          </div>
        </div>
      </section>

      {/* Action bar */}
      <section className="max-w-apple mx-auto px-6 pt-2 pb-10">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleSave}
            aria-pressed={saved}
            className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-medium transition-colors ${
              saved
                ? "bg-accent/10 text-accent hover:bg-accent/15"
                : "bg-paper-alt text-fg hover:bg-line-soft"
            }`}
          >
            {saved ? <BookmarkCheck className="w-3.5 h-3.5" strokeWidth={2.25} /> : <Bookmark className="w-3.5 h-3.5" strokeWidth={2.25} />}
            {saved ? "Saved" : "Save"}
          </button>
          <button
            onClick={onShare}
            className="inline-flex items-center gap-1.5 h-9 px-4 bg-paper-alt rounded-full text-[13px] font-medium text-fg hover:bg-line-soft transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" strokeWidth={2.25} /> Share
          </button>
          <a
            href={`https://clinicaltrials.gov/study/${trial.nctId}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-4 bg-accent text-white rounded-full text-[13px] font-medium hover:bg-accent-hover transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.25} /> ClinicalTrials.gov
          </a>
        </div>
      </section>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-dark text-white px-4 py-2.5 rounded-full text-[13px] font-medium shadow-xl animate-[stepFadeIn_0.3s_ease-out]"
        >
          {toast}
        </div>
      )}

      {/* Chat assistant — RAG-grounded on this trial */}
      <TrialChatPanel nctId={trial.nctId} trialTitle={trial.briefTitle} />

      {/* Match Breakdown — feature */}
      <section className="max-w-apple mx-auto px-6 mb-16">
        <div className="bg-white rounded-[22px] border border-line-soft overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.08)]">
          <div className="px-8 py-6 bg-paper-alt border-b border-line-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint mb-1">Match Breakdown</p>
                <h2 className="text-[24px] font-semibold">{matchCount} of {totalCount} criteria matched</h2>
              </div>
              <div className="text-right">
                <div className={`text-[64px] font-semibold leading-none tabular ${scoreColor}`}>
                  {trial.matchScore}<span className="text-[32px]">%</span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <MatchExplainer nctId={trial.nctId} />
            </div>
          </div>

          {/* Summary bar */}
          <div className="flex gap-0.5 h-1.5 bg-paper-alt">
            {trial.criteriaResults.map((cr, i) => (
              <div key={i} className={`flex-1 ${resultStyles[cr.result].dot}`}
                style={{ opacity: 0, animation: `fadeIn 0.4s ease-out ${0.1 + i * 0.06}s forwards` }}
              />
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-line-soft">
            {trial.criteriaResults.map((cr: CriterionResult, i: number) => {
              const Icon = resultIcons[cr.result];
              const styles = resultStyles[cr.result];
              return (
                <div key={i} className="flex items-center gap-3 md:gap-4 px-5 md:px-8 py-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${styles.bg} ${styles.text}`}>
                    <Icon className="w-4 h-4" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-0.5 items-baseline">
                    <div className="text-[14px] md:text-[15px] font-semibold truncate">{cr.criterion}</div>
                    <div className="text-[12px] md:text-[13px] text-fg-mute tabular truncate md:text-left">
                      <span className="md:hidden text-fg-faint mr-1">You:</span>
                      {cr.patientValue}
                    </div>
                    <div className="text-[12px] md:text-[13px] text-fg-faint tabular truncate md:text-left">
                      <span className="md:hidden mr-1">Requires:</span>
                      {cr.trialRequirement}
                    </div>
                  </div>
                  <div className={`flex-shrink-0 text-[10px] md:text-[11px] font-semibold uppercase tracking-wider ${styles.text} w-16 text-right`}>
                    {resultLabels[cr.result]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Content grid */}
      <section className="max-w-apple mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-10">
          {/* Main */}
          <div className="space-y-12">
            <div>
              <h2 className="text-[28px] font-semibold mb-4 tracking-tight">About this trial</h2>
              <div className="space-y-4 text-[17px] text-fg-mute leading-[1.6]">
                <p>{trial.briefSummary}</p>
                <p>{trial.detailedDescription}</p>
              </div>
            </div>

            <div>
              <h2 className="text-[28px] font-semibold mb-4 tracking-tight">Eligibility criteria</h2>
              <EligibilityBlock text={trial.eligibilityCriteria} />
            </div>

            {trial.parsed && (
              <ParsedCriteriaBlock parsed={trial.parsed} />
            )}

            <div>
              <h2 className="text-[28px] font-semibold mb-4 tracking-tight">Interventions</h2>
              <ul className="space-y-2">
                {trial.interventions.map((int, i) => (
                  <li key={i} className="flex gap-4 p-4 bg-paper-alt rounded-xl">
                    <span className="text-[20px] font-semibold text-accent tabular flex-shrink-0 w-8">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[15px] text-fg-soft leading-relaxed">{int}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-[28px] font-semibold mb-4 tracking-tight">
                Locations — {trial.locations.length} sites
              </h2>
              <div className="space-y-2">
                {trial.locations.map((loc, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-white border border-line-soft rounded-xl">
                    <Building2 className="w-5 h-5 text-fg-faint flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-[15px] font-semibold">{loc.facility}</p>
                      <p className="text-[13px] text-fg-mute">{loc.city}, {loc.state}, {loc.country}</p>
                    </div>
                    {loc.distance !== undefined && (
                      <span className="text-[13px] font-semibold text-accent tabular">{formatDistance(loc.distance)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-5">
            <div className="bg-white border border-line-soft rounded-2xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint mb-4">Details</p>
              <div className="space-y-4">
                {[
                  { icon: Users, label: "Enrollment", value: `${trial.enrollmentCount.toLocaleString()}` },
                  { icon: MapPin, label: "Nearest", value: formatDistance(trial.nearestDistance) },
                  { icon: Calendar, label: "Updated", value: trial.lastUpdated },
                  { icon: Building2, label: "Sites", value: `${trial.locations.length}` },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-paper-alt flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-3.5 h-3.5 text-fg-mute" strokeWidth={2.25} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">{item.label}</p>
                      <p className="text-[14px] font-medium tabular">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {trial.contactName && (
              <div className="bg-white border border-line-soft rounded-2xl p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint mb-3">Contact</p>
                <p className="text-[14px] font-semibold mb-2.5">{trial.contactName}</p>
                {trial.contactEmail && (
                  <a href={`mailto:${trial.contactEmail}`} className="flex items-center gap-2 text-[13px] text-accent hover:text-accent-hover transition-colors mb-1.5">
                    <Mail className="w-3.5 h-3.5" strokeWidth={2.25} />{trial.contactEmail}
                  </a>
                )}
                {trial.contactPhone && (
                  <a href={`tel:${trial.contactPhone}`} className="flex items-center gap-2 text-[13px] text-fg-mute hover:text-fg transition-colors">
                    <Phone className="w-3.5 h-3.5" strokeWidth={2.25} />{trial.contactPhone}
                  </a>
                )}
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

// ============================================
// Eligibility block — parses Inclusion/Exclusion sections
// ============================================

function EligibilityBlock({ text }: { text: string }) {
  const sections = useMemo(() => {
    const result: { title: string; items: string[]; kind: "inclusion" | "exclusion" }[] = [];
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    let currentTitle = "";
    let currentItems: string[] = [];
    let currentKind: "inclusion" | "exclusion" = "inclusion";

    const flush = () => {
      if (currentTitle || currentItems.length) {
        result.push({
          title: currentTitle || "Criteria",
          items: currentItems,
          kind: currentKind,
        });
      }
      currentTitle = "";
      currentItems = [];
    };

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes("inclusion") && lower.endsWith(":")) {
        flush();
        currentTitle = line.replace(/:$/, "");
        currentKind = "inclusion";
      } else if (lower.includes("exclusion") && lower.endsWith(":")) {
        flush();
        currentTitle = line.replace(/:$/, "");
        currentKind = "exclusion";
      } else if (line.startsWith("-") || line.startsWith("•") || line.startsWith("*")) {
        currentItems.push(line.replace(/^[-•*]\s*/, ""));
      } else {
        currentItems.push(line);
      }
    }
    flush();
    return result;
  }, [text]);

  if (sections.length === 0) {
    return (
      <div className="bg-paper-alt rounded-2xl p-6 text-[15px] text-fg-soft leading-[1.6] whitespace-pre-line">
        {text}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sections.map((section, i) => {
        const isExclusion = section.kind === "exclusion";
        return (
          <div
            key={i}
            className={`rounded-2xl p-6 border ${
              isExclusion ? "bg-error/[0.03] border-error/15" : "bg-success/[0.03] border-success/15"
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                isExclusion ? "bg-error/15 text-error" : "bg-success/15 text-success"
              }`}>
                {isExclusion ? <X className="w-3 h-3" strokeWidth={2.5} /> : <Check className="w-3 h-3" strokeWidth={2.5} />}
              </div>
              <h3 className="text-[15px] font-semibold">{section.title}</h3>
            </div>
            <ul className="space-y-2">
              {section.items.map((item, j) => (
                <li key={j} className="flex gap-2.5 text-[14px] text-fg-soft leading-relaxed">
                  <span className={`flex-shrink-0 mt-2 w-1 h-1 rounded-full ${
                    isExclusion ? "bg-error/60" : "bg-success/60"
                  }`} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Parsed criteria block — shows what the rule-based parser extracted from
// the free-text eligibility. Proves the pipeline is real.
// ============================================================================

const LAB_DISPLAY: Record<string, { name: string; unit: string }> = {
  hba1c: { name: "HbA1c", unit: "%" },
  egfr: { name: "eGFR", unit: "mL/min" },
  creatinine: { name: "Creatinine", unit: "mg/dL" },
  alt: { name: "ALT", unit: "U/L" },
  ast: { name: "AST", unit: "U/L" },
  bilirubin: { name: "Bilirubin", unit: "mg/dL" },
  hemoglobin: { name: "Hemoglobin", unit: "g/dL" },
  platelet: { name: "Platelets", unit: "×10⁹/L" },
  wbc: { name: "WBC", unit: "×10⁹/L" },
  anc: { name: "ANC", unit: "×10⁹/L" },
  ldl: { name: "LDL", unit: "mg/dL" },
  ef: { name: "LVEF", unit: "%" },
  bmi: { name: "BMI", unit: "kg/m²" },
  nt_probnp: { name: "NT-proBNP", unit: "pg/mL" },
  mmse: { name: "MMSE", unit: "" },
  bp_systolic: { name: "Systolic BP", unit: "mmHg" },
  bp_diastolic: { name: "Diastolic BP", unit: "mmHg" },
};

function formatThreshold(t: { min?: number | null; max?: number | null }, unit: string): string {
  const u = unit ? ` ${unit}` : "";
  if (t.min != null && t.max != null) return `${t.min}–${t.max}${u}`;
  if (t.max != null) return `≤ ${t.max}${u}`;
  if (t.min != null) return `≥ ${t.min}${u}`;
  return "—";
}

function ParsedCriteriaBlock({ parsed }: { parsed: ParsedEligibilitySummary }) {
  const hasMeds = parsed.medicationsExcluded.length > 0 || parsed.medicationsRequired.length > 0;
  const labEntries = Object.entries(parsed.labThresholds).filter(
    ([, t]) => t && (t.min != null || t.max != null)
  );
  const hasLabs = labEntries.length > 0;
  const hasEcog = parsed.ecog && (parsed.ecog.min != null || parsed.ecog.max != null);

  if (!hasMeds && !hasLabs && !hasEcog) return null;

  const confPct = parsed.confidence != null ? Math.round(parsed.confidence * 100) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight">Structured criteria</h2>
          <p className="text-[13px] text-fg-mute mt-1">
            Extracted from the eligibility text above by our rule-based parser.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 text-accent rounded-full text-[11px] font-semibold uppercase tracking-wider">
            {parsed.source}-parsed
          </span>
          {confPct !== null && (
            <span className="text-[11px] text-fg-faint tabular">
              {confPct}% conf.
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hasMeds && (
          <div className="rounded-2xl bg-white border border-line-soft p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint mb-3">
              Medications
            </p>
            {parsed.medicationsExcluded.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] font-semibold text-error mb-1.5">Excluded</p>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.medicationsExcluded.slice(0, 12).map((m, i) => (
                    <span
                      key={i}
                      className="text-[12px] px-2 py-0.5 bg-error/8 text-error rounded-md font-mono"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {parsed.medicationsRequired.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-success mb-1.5">Required</p>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.medicationsRequired.slice(0, 8).map((m, i) => (
                    <span
                      key={i}
                      className="text-[12px] px-2 py-0.5 bg-success/10 text-success rounded-md font-mono"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {hasLabs && (
          <div className="rounded-2xl bg-white border border-line-soft p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint mb-3">
              Lab thresholds
            </p>
            <ul className="space-y-1.5">
              {labEntries.slice(0, 8).map(([key, t]) => {
                const display = LAB_DISPLAY[key] || { name: key, unit: "" };
                return (
                  <li key={key} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="font-medium text-fg">{display.name}</span>
                    <span className="font-mono text-fg-mute tabular">
                      {formatThreshold(t, display.unit)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {hasEcog && parsed.ecog && (
          <div className="rounded-2xl bg-white border border-line-soft p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint mb-3">
              Performance status
            </p>
            <p className="text-[15px] font-medium">
              ECOG{" "}
              <span className="font-mono text-fg-mute">
                {parsed.ecog.min ?? 0}–{parsed.ecog.max ?? 5}
              </span>
            </p>
          </div>
        )}
      </div>

      <p className="text-[11px] text-fg-faint mt-3 leading-relaxed">
        Parser: <span className="font-mono">{parsed.parserVersion || "unknown"}</span> · The matching engine reads these
        structured values directly — no LLM in the matching path.
      </p>
    </div>
  );
}
