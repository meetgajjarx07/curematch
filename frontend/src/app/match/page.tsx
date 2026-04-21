"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import SearchableSelect from "@/components/forms/SearchableSelect";
import AsyncSearchableSelect from "@/components/forms/AsyncSearchableSelect";
import SceneErrorBoundary from "@/components/three/SceneErrorBoundary";
import { CONDITIONS_LIST, MEDICATIONS_LIST, LAB_FIELDS } from "@/lib/mock-data";

async function fetchConditions(q: string) {
  try {
    const res = await fetch(`/api/conditions/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}
import { useMediaQuery, useReducedMotion } from "@/lib/hooks";

const LocationMap = dynamic(() => import("@/components/forms/LocationMap"), {
  ssr: false,
  loading: () => <div className="h-52 bg-paper-alt rounded-xl" />,
});

const MatchBackdrop = dynamic(() => import("@/components/three/MatchBackdrop"), {
  ssr: false,
  loading: () => null,
});

const STEPS = [
  { label: "Demographics" },
  { label: "Conditions" },
  { label: "Medications" },
  { label: "Lab Values" },
  { label: "Location" },
];

interface FormState {
  age: string;
  gender: string;
  ethnicity: string;
  conditions: string[];
  medications: string[];
  labValues: Record<string, string>;
  labUnknown: Record<string, boolean>;
  city: string;
  searchRadius: number;
  locationLat?: number;
  locationLng?: number;
  locationDisplay?: string;
}

const initialState: FormState = {
  age: "", gender: "", ethnicity: "",
  conditions: [], medications: [],
  labValues: {}, labUnknown: {},
  city: "", searchRadius: 100,
};

// ============================================================================
// Demo presets — one-click profiles for live demos. Realistic medical data
// that exercises different match verdicts (matches, exclusions, unknowns).
// ============================================================================
const DEMO_PRESETS: { id: string; label: string; emoji: string; form: FormState }[] = [
  {
    id: "diabetes",
    label: "T2 Diabetes · 58F",
    emoji: "🩺",
    form: {
      age: "58",
      gender: "female",
      ethnicity: "",
      conditions: ["Type 2 Diabetes", "Diabetes Mellitus, Type 2"],
      medications: ["Metformin", "Atorvastatin", "Lisinopril"],
      labValues: { hba1c: "8.2", egfr: "75", ldl: "95" },
      labUnknown: {},
      city: "Rochester, MN",
      searchRadius: 500,
      locationLat: 44.0225,
      locationLng: -92.4699,
      locationDisplay: "Rochester, MN",
    },
  },
  {
    id: "breast-cancer",
    label: "Breast Cancer · 52F",
    emoji: "🎗️",
    form: {
      age: "52",
      gender: "female",
      ethnicity: "",
      conditions: ["Breast Cancer"],
      medications: ["Tamoxifen"],
      labValues: { hemoglobin: "12.8", platelet_count: "240", alt: "32" },
      labUnknown: {},
      city: "Boston, MA",
      searchRadius: 200,
      locationLat: 42.3601,
      locationLng: -71.0589,
      locationDisplay: "Boston, MA",
    },
  },
  {
    id: "alzheimers",
    label: "Alzheimer's · 70M",
    emoji: "🧠",
    form: {
      age: "70",
      gender: "male",
      ethnicity: "",
      conditions: ["Alzheimer Disease"],
      medications: ["Donepezil", "Memantine"],
      labValues: { egfr: "68", hemoglobin: "13.5" },
      labUnknown: {},
      city: "Baltimore, MD",
      searchRadius: 300,
      locationLat: 39.2904,
      locationLng: -76.6122,
      locationDisplay: "Baltimore, MD",
    },
  },
  {
    id: "excluded",
    label: "Warfarin patient · 68M",
    emoji: "⚠️",
    form: {
      age: "68",
      gender: "male",
      ethnicity: "",
      conditions: ["Atrial Fibrillation"],
      medications: ["Warfarin", "Metoprolol"],
      labValues: { egfr: "45", hemoglobin: "11.8" },
      labUnknown: {},
      city: "Chicago, IL",
      searchRadius: 250,
      locationLat: 41.8781,
      locationLng: -87.6298,
      locationDisplay: "Chicago, IL",
    },
  },
];

export default function MatchPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isMatching, setIsMatching] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const reducedMotion = useReducedMotion();

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!form.age || Number(form.age) < 1 || Number(form.age) > 120) errs.age = "Enter a valid age (1–120)";
      if (!form.gender) errs.gender = "Select your gender";
    }
    if (step === 1 && form.conditions.length === 0) errs.conditions = "Select at least one condition";
    if (step === 4 && !form.city.trim()) errs.city = "Enter a city or zip code";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [step, form]);

  const nextStep = () => {
    if (!validate()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const prevStep = () => { if (step > 0) setStep(step - 1); };

  const handleSubmit = () => {
    if (!validate()) return;
    setIsMatching(true);
    sessionStorage.setItem("patientProfile", JSON.stringify(form));
    setTimeout(() => router.push("/results"), 2000);
  };

  if (isMatching) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center overflow-hidden">
        <div className="text-center max-w-lg px-6">
          {/* Orb with concentric rings */}
          <div className="relative w-24 h-24 mx-auto mb-10">
            <div className="absolute inset-0 rounded-full bg-accent/10 blur-2xl animate-pulse" aria-hidden="true" />
            <div className="absolute inset-0 rounded-full border-2 border-accent/30" style={{ animation: "ring-pulse 2s ease-in-out infinite" }} aria-hidden="true" />
            <div className="absolute inset-2 rounded-full border border-accent/50" style={{ animation: "ring-pulse 2s ease-in-out 0.3s infinite" }} aria-hidden="true" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin" strokeWidth={2} />
            </div>
          </div>

          <h2 className="text-[32px] md:text-[40px] font-semibold mb-3 tracking-tight text-balance">
            Screening{" "}
            <span className="text-accent tabular">65,081</span>{" "}
            trials…
          </h2>
          <p className="text-[17px] text-fg-mute leading-relaxed mb-10 max-w-md mx-auto">
            Comparing your profile against every actively recruiting study
            in the U.S. National Library of Medicine registry.
          </p>

          {/* Indeterminate progress bar */}
          <div className="max-w-xs mx-auto">
            <div className="relative h-0.5 bg-line-soft rounded-full overflow-hidden">
              <div className="absolute inset-y-0 w-[40%] bg-gradient-to-r from-transparent via-accent to-transparent" style={{ animation: "progress-sweep 1.4s ease-in-out infinite" }} />
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.15em] text-fg-faint tabular">
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-success" style={{ animation: "blink 1.2s infinite" }} />
                Parsing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-warning" style={{ animation: "blink 1.2s 0.3s infinite" }} />
                Scoring
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-accent" style={{ animation: "blink 1.2s 0.6s infinite" }} />
                Ranking
              </span>
            </div>
          </div>

          <style jsx>{`
            @keyframes ring-pulse {
              0%, 100% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.15); opacity: 0.2; }
            }
            @keyframes progress-sweep {
              0% { left: -40%; }
              100% { left: 100%; }
            }
            @keyframes blink {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 1; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3.5 bg-white border border-line rounded-xl text-[17px] focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all";

  return (
    <div className="relative bg-paper min-h-screen overflow-hidden">
      {/* 3D Helix backdrop — only mount on desktop and respect reduced motion */}
      {isDesktop && !reducedMotion && (
        <div className="absolute top-0 bottom-0 right-0 w-1/2 opacity-60 hidden md:block">
          <SceneErrorBoundary fallback={null}>
            <MatchBackdrop step={step} totalSteps={STEPS.length} />
          </SceneErrorBoundary>
        </div>
      )}

      {/* White-to-transparent fade over the backdrop */}
      <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/90 to-paper/30 pointer-events-none hidden md:block" />

      <div className="relative max-w-[640px] mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-8">
          <p className="eyebrow-sm mb-3 text-accent">Build Your Profile</p>
          <h1 className="section-headline mb-3">
            Tell us about yourself.
          </h1>
          <p className="text-[19px] text-fg-mute">
            Step {step + 1} of {STEPS.length} — {STEPS[step].label}
          </p>
        </div>

        {/* Demo presets */}
        <div className="mb-10 p-4 bg-paper-alt rounded-2xl border border-line-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint mb-2.5">
            Try a demo patient
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMO_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => { setForm(preset.form); setStep(0); setErrors({}); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-line-soft rounded-full text-[12px] font-medium text-fg hover:border-accent/40 hover:bg-accent/5 transition-all"
              >
                <span>{preset.emoji}</span>
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-fg-faint mt-2.5 leading-relaxed">
            One-click profiles for demos. Exercises match, exclusion, and unknown verdicts.
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-14">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? "bg-accent" : "bg-line"
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div key={step} className="step-fade-in">
          {/* Step 0 — Demographics */}
          {step === 0 && (
            <div className="space-y-8">
              <div>
                <label className="block text-[13px] font-medium text-fg-mute mb-2">
                  Age <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  placeholder="45"
                  className={inputClass + " tabular"}
                />
                {errors.age && <p className="mt-1.5 text-[13px] text-error">{errors.age}</p>}
              </div>

              <div>
                <label className="block text-[13px] font-medium text-fg-mute mb-2">
                  Gender <span className="text-error">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["male", "female", "other"].map((g) => (
                    <button
                      key={g}
                      onClick={() => setForm({ ...form, gender: g })}
                      className={`px-4 py-3 rounded-xl text-[15px] font-medium border transition-all ${
                        form.gender === g
                          ? "bg-accent/10 border-accent text-accent"
                          : "bg-white border-line text-fg hover:border-fg-faint"
                      }`}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
                {errors.gender && <p className="mt-1.5 text-[13px] text-error">{errors.gender}</p>}
              </div>

              <div>
                <label className="block text-[13px] font-medium text-fg-mute mb-2">
                  Ethnicity <span className="text-fg-faint text-[11px] font-normal">— Optional</span>
                </label>
                <select
                  value={form.ethnicity}
                  onChange={(e) => setForm({ ...form, ethnicity: e.target.value })}
                  className={inputClass + " appearance-none styled"}
                >
                  <option value="">Prefer not to say</option>
                  <option value="hispanic">Hispanic or Latino</option>
                  <option value="not_hispanic">Not Hispanic or Latino</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 1 — Conditions */}
          {step === 1 && (
            <div className="space-y-6">
              <AsyncSearchableSelect
                selected={form.conditions}
                onChange={(conditions) => setForm({ ...form, conditions })}
                placeholder="Search across 65,081 trials…"
                label="Medical Conditions *"
                fetchOptions={fetchConditions}
                fallbackOptions={CONDITIONS_LIST}
              />
              {errors.conditions && <p className="text-[13px] text-error">{errors.conditions}</p>}
              <p className="text-[13px] text-fg-mute leading-relaxed">
                Start typing — we search every condition across the live trial database.
                Each result shows the number of trials that match.
              </p>
            </div>
          )}

          {/* Step 2 — Medications */}
          {step === 2 && (
            <div className="space-y-6">
              <SearchableSelect
                options={MEDICATIONS_LIST}
                selected={form.medications}
                onChange={(medications) => setForm({ ...form, medications })}
                placeholder="Search medications..."
                label="Current Medications"
              />
              <p className="text-[13px] text-fg-mute leading-relaxed">
                Many trials exclude specific medications. Adding yours improves accuracy.
                Optional but recommended.
              </p>
            </div>
          )}

          {/* Step 3 — Lab Values */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-[13px] text-fg-mute leading-relaxed mb-1">
                Optional — enter what you know from recent labs.
              </p>
              {LAB_FIELDS.map((field) => (
                <div key={field.key} className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-[12px] font-medium text-fg-mute mb-1.5">
                      {field.label}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.labValues[field.key] || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          labValues: { ...form.labValues, [field.key]: e.target.value },
                          labUnknown: { ...form.labUnknown, [field.key]: false },
                        })
                      }
                      disabled={form.labUnknown[field.key]}
                      placeholder={`${field.min}–${field.max}`}
                      className={inputClass + " py-2.5 text-[15px] tabular disabled:opacity-40"}
                    />
                  </div>
                  <label className="flex items-center gap-1.5 pb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.labUnknown[field.key] || false}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          labUnknown: { ...form.labUnknown, [field.key]: e.target.checked },
                          labValues: e.target.checked ? { ...form.labValues, [field.key]: "" } : form.labValues,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-[12px] text-fg-mute">Skip</span>
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* Step 4 — Location */}
          {step === 4 && (
            <div className="space-y-8">
              <div>
                <label className="block text-[13px] font-medium text-fg-mute mb-2">
                  City or Zip Code <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Rochester, MN"
                  className={inputClass}
                />
                {errors.city && <p className="mt-1.5 text-[13px] text-error">{errors.city}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[13px] font-medium text-fg-mute">Search Radius</label>
                  <span className="text-[14px] font-semibold text-accent tabular">{form.searchRadius} mi</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={form.searchRadius}
                  onChange={(e) => setForm({ ...form, searchRadius: Number(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-[11px] text-fg-faint tabular mt-1">
                  <span>10 mi</span>
                  <span>250 mi</span>
                  <span>500 mi</span>
                </div>
              </div>

              <SceneErrorBoundary
                fallback={
                  <div className="h-48 rounded-xl bg-paper-alt border border-line-soft flex items-center justify-center">
                    <p className="text-[13px] text-fg-mute">Map couldn&apos;t load.</p>
                  </div>
                }
              >
                <LocationMap
                  city={form.city}
                  radius={form.searchRadius}
                  onLocationResolved={(lat, lng, displayName) =>
                    setForm((f) => ({ ...f, locationLat: lat, locationLng: lng, locationDisplay: displayName }))
                  }
                />
              </SceneErrorBoundary>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="mt-14 pt-6 border-t border-line-soft flex items-center justify-between">
          <button
            onClick={prevStep}
            disabled={step === 0}
            className="flex items-center gap-1.5 text-[15px] text-fg-mute hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={nextStep} className="btn-primary">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} className="btn-primary">
              Find Matches <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
