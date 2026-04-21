"use client";

import { useState, useRef, useCallback } from "react";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";

interface MatchExplainerProps {
  nctId: string;
}

interface Profile {
  age?: number;
  gender?: string;
  conditions?: string[];
  medications?: string[];
  labValues?: Record<string, number>;
  lat?: number;
  lng?: number;
  searchRadius?: number;
}

export default function MatchExplainer({ nctId }: MatchExplainerProps) {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const getProfile = useCallback((): Profile | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem("patientProfile");
      if (!raw) return null;
      const form = JSON.parse(raw);
      const labValues: Record<string, number> = {};
      if (form.labValues && typeof form.labValues === "object") {
        for (const [k, v] of Object.entries(form.labValues)) {
          const n = Number(v);
          if (v !== "" && !Number.isNaN(n)) labValues[k] = n;
        }
      }
      return {
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender,
        conditions: form.conditions,
        medications: form.medications,
        labValues,
        lat: form.locationLat,
        lng: form.locationLng,
        searchRadius: form.searchRadius,
      };
    } catch {
      return null;
    }
  }, []);

  const explain = useCallback(async () => {
    const profile = getProfile();
    if (!profile) {
      setText("Build your profile first — otherwise there's nothing to compare.");
      setStarted(true);
      return;
    }

    setStarted(true);
    setLoading(true);
    setText("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/match/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nctId, profile }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`API returned ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let metaParsed = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        let chunk = decoder.decode(value, { stream: true });

        if (!metaParsed && chunk.startsWith("::meta ")) {
          const newlineIdx = chunk.indexOf("\n");
          if (newlineIdx >= 0) {
            try {
              const meta = JSON.parse(chunk.slice(7, newlineIdx));
              setProvider(`${meta.provider} · ${meta.model}`);
            } catch {}
            chunk = chunk.slice(newlineIdx + 1);
            metaParsed = true;
          }
        }

        buf += chunk;
        setText(buf);
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort) {
        setText(`Couldn't generate explanation. ${err instanceof Error ? err.message : ""}`.trim());
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [nctId, getProfile]);

  if (!started) {
    return (
      <button
        onClick={explain}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-hover transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" strokeWidth={2.25} />
        Explain this match in plain English
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 bg-accent/5 border border-accent/15 rounded-xl">
      <div className="flex items-start gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" strokeWidth={2.25} />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
          AI Explanation
          {provider && <span className="ml-2 normal-case tracking-normal text-accent/60">· {provider}</span>}
        </p>
      </div>
      <p className="text-[14px] leading-relaxed text-fg-soft min-h-[3em]">
        {text || (loading ? <span className="inline-flex gap-1 items-center text-fg-faint"><Loader2 className="w-3 h-3 animate-spin" /> Reading verdicts…</span> : null)}
      </p>
      {!loading && text && (
        <button
          onClick={explain}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-fg-faint hover:text-fg transition-colors"
        >
          <RefreshCw className="w-3 h-3" strokeWidth={2.25} />
          Regenerate
        </button>
      )}
    </div>
  );
}
