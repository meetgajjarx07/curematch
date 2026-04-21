"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { LayoutList, Map, SlidersHorizontal, Search, ArrowRight, Bookmark, Loader2 } from "lucide-react";
import TrialCard from "@/components/results/TrialCard";
import TrialCardSkeleton from "@/components/results/TrialCardSkeleton";
import FilterSidebar from "@/components/results/FilterSidebar";
import SceneErrorBoundary from "@/components/three/SceneErrorBoundary";
import { CONDITION_CATEGORY } from "@/lib/mock-data";
import { SearchFilters, TrialMatch } from "@/lib/types";

const MapView = dynamic(() => import("@/components/results/MapView"), {
  ssr: false,
  loading: () => <div className="w-full h-[500px] rounded-[18px] bg-paper-alt" />,
});

const TrialGlobe = dynamic(() => import("@/components/three/TrialGlobe"), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

const SORT_OPTIONS = [
  { value: "score", label: "Match Score" },
  { value: "distance", label: "Distance" },
  { value: "enrollment", label: "Enrollment" },
] as const;

const DEFAULT_FILTERS: SearchFilters = {
  conditionCategory: "All",
  phase: [],
  minDistance: 0,
  maxDistance: 2000,
  minScore: 0,
  sortBy: "score",
};

export default function ResultsPage() {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [allTrials, setAllTrials] = useState<TrialMatch[]>([]);
  const [totalScreened, setTotalScreened] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SearchFilters["sortBy"]>("score");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [loaded, setLoaded] = useState(false);

  // Profile check + restore filters
  useEffect(() => {
    if (typeof window === "undefined") return;
    const profileRaw = sessionStorage.getItem("patientProfile");
    setHasProfile(!!profileRaw);

    try {
      const savedFilters = sessionStorage.getItem("resultsFilters");
      if (savedFilters) setFilters(JSON.parse(savedFilters));
      const savedSort = sessionStorage.getItem("resultsSort");
      if (savedSort) setSortBy(savedSort as SearchFilters["sortBy"]);
      const savedSearch = sessionStorage.getItem("resultsSearch");
      if (savedSearch) setSearch(savedSearch);
      const savedView = sessionStorage.getItem("resultsView");
      if (savedView === "list" || savedView === "map") setView(savedView);
    } catch {}

    setLoaded(true);
  }, []);

  // Fetch matches from API when profile loads
  useEffect(() => {
    if (typeof window === "undefined" || hasProfile !== true) return;

    const profileRaw = sessionStorage.getItem("patientProfile");
    if (!profileRaw) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const raw = JSON.parse(profileRaw);

        // Translate the form's state into the scoring engine's expected shape.
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

        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, limit: 150 }),
        });

        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = await res.json();

        if (!cancelled) {
          setAllTrials(data.trials || []);
          setTotalScreened(data.totalScreened || 0);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [hasProfile]);

  // Persist filters
  useEffect(() => {
    if (!loaded) return;
    sessionStorage.setItem("resultsFilters", JSON.stringify(filters));
    sessionStorage.setItem("resultsSort", sortBy);
    sessionStorage.setItem("resultsSearch", search);
    sessionStorage.setItem("resultsView", view);
  }, [filters, sortBy, search, view, loaded]);

  const filteredTrials = useMemo(() => {
    let result = [...allTrials];

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((t) =>
        t.briefTitle.toLowerCase().includes(q) ||
        t.sponsor.toLowerCase().includes(q) ||
        t.nctId.toLowerCase().includes(q) ||
        t.conditions.some((c) => c.toLowerCase().includes(q))
      );
    }

    if (filters.conditionCategory && filters.conditionCategory !== "All") {
      result = result.filter((t) =>
        t.conditions.some((c) => CONDITION_CATEGORY[c] === filters.conditionCategory)
      );
    }

    result = result.filter((t) => t.matchScore >= filters.minScore);
    result = result.filter((t) => t.nearestDistance <= filters.maxDistance);

    if (filters.phase.length > 0) {
      result = result.filter((t) =>
        filters.phase.some((p) => t.phase.toLowerCase().includes(p.toLowerCase()))
      );
    }

    switch (sortBy) {
      case "score": result.sort((a, b) => b.matchScore - a.matchScore); break;
      case "distance": result.sort((a, b) => a.nearestDistance - b.nearestDistance); break;
      case "enrollment": result.sort((a, b) => b.enrollmentCount - a.enrollmentCount); break;
    }

    return result;
  }, [allTrials, filters, sortBy, search]);

  const globeLocations = useMemo(() => {
    return filteredTrials.slice(0, 100).flatMap(t =>
      t.locations.slice(0, 3).map(loc => ({ lat: loc.lat, lng: loc.lng, score: t.matchScore }))
    );
  }, [filteredTrials]);

  const activeFilterCount =
    (filters.conditionCategory !== "All" ? 1 : 0) +
    filters.phase.length +
    (filters.minScore > 0 ? 1 : 0) +
    (filters.maxDistance < 2000 ? 1 : 0) +
    (search ? 1 : 0);

  if (hasProfile === false) {
    return (
      <div className="bg-paper">
        <div className="max-w-apple mx-auto px-6 py-24 text-center">
          <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Search className="w-6 h-6 text-accent" strokeWidth={2.25} />
          </div>
          <h1 className="section-headline mb-4 text-balance">Enter your profile first.</h1>
          <p className="text-[19px] text-fg-mute max-w-lg mx-auto mb-8 leading-snug">
            Results are ranked against your medical profile. It takes about three minutes,
            and your data stays in your browser.
          </p>
          <Link href="/match" className="btn-primary">
            Build Profile <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-[13px] text-fg-faint mt-6">
            Already have a saved list?{" "}
            <Link href="/saved" className="text-accent hover:text-accent-hover underline underline-offset-2">
              View saved trials
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (hasProfile === null) {
    return (
      <div className="bg-paper">
        <div className="max-w-apple mx-auto px-6 py-24 text-center">
          <h1 className="section-headline mb-4 text-balance">Your matches</h1>
          <p className="text-[17px] text-fg-mute">Loading your results…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-paper">
      <section className="relative bg-deep text-white overflow-hidden h-[75vh] min-h-[560px]">
        <div className="absolute inset-0">
          <SceneErrorBoundary>
            <TrialGlobe locations={globeLocations} className="w-full h-full" />
          </SceneErrorBoundary>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-deep/85 via-deep/30 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-paper to-transparent pointer-events-none" />

        <div className="relative h-full flex items-center">
          <div className="max-w-wide mx-auto px-6 w-full grid grid-cols-12">
            <div className="col-span-12 md:col-span-7 lg:col-span-6 pt-20">
              <p className="eyebrow-sm mb-4 text-cosmic-cyan text-shadow-glow-cyan">The Index</p>
              <h1 className="mega-headline mb-5 text-balance text-white text-shadow-hero">
                {loading ? "Matching…" : `${filteredTrials.length} trials,`}
                <br />
                <span className="text-white/50">mapped to your profile.</span>
              </h1>
              <p className="text-[19px] text-white/80 leading-snug max-w-md text-shadow-soft">
                Screened against{" "}
                <span className="text-white font-semibold tabular">
                  {(totalScreened || 65081).toLocaleString()}
                </span>{" "}
                actively recruiting studies. Each dot on the globe is a trial site.
              </p>

              <div className="mt-6 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-white/70">
                  <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_10px_#30D158]" />
                  Strong match
                </span>
                <span className="flex items-center gap-1.5 text-white/70">
                  <span className="w-2 h-2 rounded-full bg-warning shadow-[0_0_10px_#FF9F0A]" />
                  Partial
                </span>
                <span className="flex items-center gap-1.5 text-white/70">
                  <span className="w-2 h-2 rounded-full bg-error shadow-[0_0_10px_#FF3B30]" />
                  Weak
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-wide mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm px-3.5 py-1.5 bg-white border border-line rounded-full focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
            <Search className="w-3.5 h-3.5 text-fg-faint flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trials, conditions, sponsors…"
              className="flex-1 bg-transparent text-[13px] outline-none"
              aria-label="Search trials"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-fg-faint hover:text-fg text-[13px]"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex items-center bg-paper-alt rounded-full p-1">
            {[
              { key: "list" as const, icon: LayoutList, label: "List" },
              { key: "map" as const, icon: Map, label: "Map" },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                  view === key ? "bg-white shadow-sm text-fg" : "text-fg-mute hover:text-fg"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowMobileFilters(true)}
            className="lg:hidden relative flex items-center gap-1.5 px-3 py-1.5 bg-paper-alt rounded-full text-[13px] font-medium text-fg-mute hover:text-fg"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          <Link
            href="/saved"
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper-alt rounded-full text-[13px] font-medium text-fg-mute hover:text-fg transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Saved
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium uppercase tracking-wider text-fg-faint">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SearchFilters["sortBy"])}
              className="bg-white border border-line rounded-full px-3 py-1.5 text-[13px] font-medium text-fg outline-none cursor-pointer styled"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="mb-6 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Active</span>
            {filters.conditionCategory !== "All" && (
              <FilterChip label={filters.conditionCategory} onRemove={() => setFilters({ ...filters, conditionCategory: "All" })} />
            )}
            {filters.phase.map((p) => (
              <FilterChip key={p} label={p} onRemove={() => setFilters({ ...filters, phase: filters.phase.filter((x) => x !== p) })} />
            ))}
            {filters.minScore > 0 && (
              <FilterChip label={`≥ ${filters.minScore}% match`} onRemove={() => setFilters({ ...filters, minScore: 0 })} />
            )}
            {filters.maxDistance < 2000 && (
              <FilterChip label={`≤ ${filters.maxDistance} mi`} onRemove={() => setFilters({ ...filters, maxDistance: 2000 })} />
            )}
            <button
              onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(""); }}
              className="text-[11px] font-semibold uppercase tracking-wider text-accent hover:text-accent-hover ml-1"
            >
              Clear all
            </button>
          </div>
        )}

        <div className="flex gap-8">
          <div className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-20">
              <FilterSidebar filters={filters} onChange={setFilters} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {loading ? (
              <>
                <div className="mb-5 flex items-center gap-2 text-[13px] text-fg-mute">
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                  <span>Screening 65,081 trials…</span>
                </div>
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TrialCardSkeleton key={i} index={i} />
                  ))}
                </div>
              </>
            ) : error ? (
              <div className="bg-error/5 border border-error/20 rounded-[18px] p-6 text-center">
                <p className="text-[14px] text-error font-medium">{error}</p>
              </div>
            ) : view === "list" ? (
              <div className="space-y-3">
                {filteredTrials.map((trial, i) => (
                  <TrialCard key={trial.nctId} trial={trial} index={i} />
                ))}
              </div>
            ) : (
              <SceneErrorBoundary
                fallback={
                  <div className="w-full h-[500px] rounded-[18px] bg-paper-alt border border-line-soft flex items-center justify-center">
                    <p className="text-[14px] text-fg-mute">Map couldn&apos;t load. Try list view.</p>
                  </div>
                }
              >
                <MapView trials={filteredTrials} />
              </SceneErrorBoundary>
            )}

            {!loading && !error && filteredTrials.length === 0 && (
              <div className="text-center py-24 bg-white rounded-[18px] border border-line-soft">
                <div className="w-12 h-12 mx-auto mb-5 rounded-2xl bg-paper-alt flex items-center justify-center">
                  <Search className="w-5 h-5 text-fg-faint" strokeWidth={2} />
                </div>
                <h3 className="text-[19px] font-semibold mb-1">No trials found</h3>
                <p className="text-[14px] text-fg-mute mb-5 max-w-sm mx-auto">
                  {search
                    ? `Nothing matched "${search}". Try a different term or clear your filters.`
                    : "Adjust your filters to see more results."}
                </p>
                <button
                  onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(""); }}
                  className="text-[13px] font-medium text-accent hover:text-accent-hover"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>

        {showMobileFilters && (
          <>
            <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setShowMobileFilters(false)} />
            <div className="fixed left-0 top-0 bottom-0 w-72 bg-white p-6 z-50 lg:hidden overflow-y-auto">
              <FilterSidebar filters={filters} onChange={setFilters} onClose={() => setShowMobileFilters(false)} isMobile />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[12px] font-medium">
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label}`} className="hover:text-accent-hover">
        ×
      </button>
    </span>
  );
}
