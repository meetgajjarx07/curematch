"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ArrowRight, Trash2, Loader2 } from "lucide-react";
import TrialCard from "@/components/results/TrialCard";
import { TrialMatch } from "@/lib/types";

export default function SavedPage() {
  const [ids, setIds] = useState<string[]>([]);
  const [trials, setTrials] = useState<TrialMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let savedIds: string[] = [];
    try {
      savedIds = JSON.parse(localStorage.getItem("savedTrials") || "[]");
    } catch {}
    setIds(savedIds);

    if (savedIds.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const profileRaw = sessionStorage.getItem("patientProfile");
        let profile = undefined;
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
            profile = {
              age: raw.age ? Number(raw.age) : undefined,
              gender: raw.gender || undefined,
              conditions: raw.conditions || [],
              medications: raw.medications || [],
              labValues,
              lat: raw.locationLat,
              lng: raw.locationLng,
              searchRadius: raw.searchRadius,
            };
          } catch {}
        }

        const res = await fetch("/api/trials/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: savedIds, profile }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        if (!cancelled) setTrials(data.trials || []);
      } catch {
        if (!cancelled) setTrials([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const clearAll = () => {
    localStorage.setItem("savedTrials", JSON.stringify([]));
    setIds([]);
    setTrials([]);
  };

  return (
    <div className="bg-paper">
      <div className="max-w-wide mx-auto px-6 py-16">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-10">
          <div>
            <p className="eyebrow-sm mb-3 text-accent">Your list</p>
            <h1 className="section-headline mb-2">Saved trials</h1>
            <p className="text-[17px] text-fg-mute">
              <span className="text-fg font-semibold tabular">{ids.length}</span>{" "}
              {ids.length === 1 ? "trial" : "trials"} saved to this browser.
            </p>
          </div>

          {ids.length > 0 && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper-alt hover:bg-line-soft rounded-full text-[13px] font-medium text-fg-mute hover:text-error transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>

        {loading && ids.length > 0 ? (
          <div className="text-center py-16">
            <Loader2 className="w-5 h-5 text-accent mx-auto mb-3 animate-spin" />
            <p className="text-[13px] text-fg-mute">Loading saved trials…</p>
          </div>
        ) : ids.length === 0 ? (
          <div className="bg-white rounded-[18px] border border-line-soft p-16 text-center">
            <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-accent" strokeWidth={2.25} />
            </div>
            <h2 className="text-[24px] font-semibold mb-3">Nothing saved yet.</h2>
            <p className="text-[15px] text-fg-mute max-w-md mx-auto mb-8 leading-relaxed">
              When you find a trial worth revisiting, tap{" "}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-paper-alt rounded text-fg text-[13px]">
                <Bookmark className="w-3 h-3" /> Save
              </span>{" "}
              on its detail page. Saved trials stay in this browser — no account needed.
            </p>
            <Link href="/results" className="btn-primary">
              Browse Results <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {trials.map((trial, i) => (
              <TrialCard key={trial.nctId} trial={trial} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
