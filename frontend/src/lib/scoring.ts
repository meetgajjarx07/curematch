import { RawTrial, RawLocation } from "./db";
import { ParsedEligibility } from "./parsed-db";
import { CriterionResult, TrialMatch } from "./types";

export interface PatientProfileInput {
  age?: number;
  gender?: string;
  conditions?: string[];
  medications?: string[];
  labValues?: Record<string, number | null>;
  lat?: number;
  lng?: number;
  searchRadius?: number;
}

// ============================================================================
// Age parser — "18 Years", "6 Months", "N/A", "" → years | null
// ============================================================================
export function parseAgeYears(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(year|month|week|day)s?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  switch (unit) {
    case "year": return n;
    case "month": return n / 12;
    case "week": return n / 52;
    case "day": return n / 365;
  }
  return null;
}

// ============================================================================
// Condition overlap — normalize and require a distinctive word to match
// ============================================================================
function normalizeCondition(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

const GENERIC_MEDICAL_TERMS = new Set([
  "disease", "diseases", "disorder", "disorders", "syndrome", "syndromes",
  "condition", "conditions", "cancer", "cancers", "tumor", "tumors",
  "neoplasm", "neoplasms", "carcinoma", "type", "stage", "primary",
  "secondary", "chronic", "acute", "severe", "moderate", "mild",
  "advanced", "early", "late", "metastatic", "systemic", "active",
  "inactive", "refractory", "resistant", "progressive", "relapsed",
  "recurrent", "malignant", "benign", "patient", "patients", "adult",
  "adults", "pediatric", "human", "study", "trial", "therapy",
]);

function distinctiveWords(text: string): string[] {
  return normalizeCondition(text)
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !GENERIC_MEDICAL_TERMS.has(w));
}

function conditionOverlap(patientConditions: string[], trialConditions: string[]): {
  matched: string[];
  partial: boolean;
} {
  const trialNorm = trialConditions.map(normalizeCondition);
  const matched: string[] = [];

  for (const pc of patientConditions) {
    const pNorm = normalizeCondition(pc);
    const pWords = distinctiveWords(pc);

    const isMatch = trialNorm.some((tc) => {
      if (tc === pNorm) return true;
      if (tc.includes(pNorm) || pNorm.includes(tc)) return true;
      if (pWords.length === 0) return false;
      const tWords = distinctiveWords(tc);
      if (tWords.length === 0) return false;
      return pWords.some((pw) => tWords.includes(pw));
    });

    if (isMatch) matched.push(pc);
  }

  return {
    matched,
    partial: matched.length > 0 && matched.length < patientConditions.length,
  };
}

// ============================================================================
// Medication matching — parsed data first, fallback to text scan
// ============================================================================

// Map of common drugs → their class umbrella (for cross-matching "warfarin" with "anticoagulants")
const DRUG_CLASS_MAP: Record<string, string[]> = {
  warfarin: ["anticoagulant", "anticoagulants", "anticoagulation"],
  apixaban: ["anticoagulant", "anticoagulants", "anticoagulation"],
  rivaroxaban: ["anticoagulant", "anticoagulants", "anticoagulation"],
  dabigatran: ["anticoagulant", "anticoagulants", "anticoagulation"],
  heparin: ["anticoagulant", "anticoagulants", "anticoagulation"],
  clopidogrel: ["antiplatelet", "antiplatelets"],
  aspirin: ["antiplatelet", "antiplatelets"],
  prasugrel: ["antiplatelet", "antiplatelets"],
  ticagrelor: ["antiplatelet", "antiplatelets"],
  metformin: ["biguanide"],
  insulin: ["insulin"],
  semaglutide: ["glp-1", "glp-1 agonist", "glp-1 receptor agonist"],
  liraglutide: ["glp-1", "glp-1 agonist", "glp-1 receptor agonist"],
  dulaglutide: ["glp-1", "glp-1 agonist", "glp-1 receptor agonist"],
  tirzepatide: ["glp-1", "glp-1 agonist"],
  sitagliptin: ["dpp-4", "dpp-4 inhibitor"],
  empagliflozin: ["sglt2", "sglt-2", "sglt2 inhibitor"],
  dapagliflozin: ["sglt2", "sglt-2", "sglt2 inhibitor"],
  canagliflozin: ["sglt2", "sglt-2", "sglt2 inhibitor"],
  adalimumab: ["anti-tnf", "tnf inhibitor", "biologic", "biologics"],
  infliximab: ["anti-tnf", "tnf inhibitor", "biologic", "biologics"],
  etanercept: ["anti-tnf", "tnf inhibitor", "biologic", "biologics"],
  upadacitinib: ["jak inhibitor", "jak inhibitors"],
  tofacitinib: ["jak inhibitor", "jak inhibitors"],
  baricitinib: ["jak inhibitor", "jak inhibitors"],
  pembrolizumab: ["anti-pd-1", "pd-1 inhibitor", "immunotherapy"],
  nivolumab: ["anti-pd-1", "pd-1 inhibitor", "immunotherapy"],
  atorvastatin: ["statin", "statins"],
  rosuvastatin: ["statin", "statins"],
  simvastatin: ["statin", "statins"],
  lisinopril: ["ace inhibitor", "ace inhibitors"],
  enalapril: ["ace inhibitor", "ace inhibitors"],
  losartan: ["arb", "arbs"],
  valsartan: ["arb", "arbs"],
  metoprolol: ["beta blocker", "beta-blocker", "beta-blockers"],
  prednisone: ["corticosteroid", "corticosteroids", "steroids"],
  methylprednisolone: ["corticosteroid", "corticosteroids", "steroids"],
  dexamethasone: ["corticosteroid", "corticosteroids", "steroids"],
  methotrexate: ["immunosuppressive", "immunosuppressants"],
  cyclosporine: ["immunosuppressive", "immunosuppressants"],
};

function drugMatches(patientDrug: string, excludedDrug: string): boolean {
  const p = patientDrug.toLowerCase().trim();
  const e = excludedDrug.toLowerCase().trim();
  if (p === e) return true;
  if (p.includes(e) || e.includes(p)) return true;

  // Class-based matching: patient drug's classes vs excluded drug
  const classes = DRUG_CLASS_MAP[p] || [];
  if (classes.includes(e)) return true;

  // Reverse: excluded is a specific drug whose class the patient has
  const reverseClasses = DRUG_CLASS_MAP[e] || [];
  if (reverseClasses.some((c) => classes.includes(c))) return true;

  return false;
}

function checkMedicationsStructured(
  patientMeds: string[],
  excludedList: string[]
): { excluded: string[]; hitBy: string | null } {
  if (patientMeds.length === 0 || excludedList.length === 0) {
    return { excluded: [], hitBy: null };
  }

  for (const pm of patientMeds) {
    for (const ex of excludedList) {
      if (drugMatches(pm, ex)) {
        return { excluded: [pm], hitBy: ex };
      }
    }
  }
  return { excluded: [], hitBy: null };
}

function checkMedicationsFallback(
  patientMeds: string[],
  eligibilityText: string | null
): { excluded: string[] } {
  if (!eligibilityText || patientMeds.length === 0) return { excluded: [] };
  const exclIdx = eligibilityText.toLowerCase().indexOf("exclusion");
  const exclText = (exclIdx >= 0 ? eligibilityText.slice(exclIdx) : eligibilityText).toLowerCase();
  const excluded = patientMeds.filter((m) => exclText.includes(m.toLowerCase()));
  return { excluded };
}

// ============================================================================
// Lab value comparison
// ============================================================================

// Patient lab keys → parsed lab keys (may differ casing / aliases)
const LAB_KEY_ALIASES: Record<string, string[]> = {
  hba1c: ["hba1c"],
  creatinine: ["creatinine"],
  egfr: ["egfr"],
  alt: ["alt"],
  ast: ["ast"],
  hemoglobin: ["hemoglobin"],
  platelet_count: ["platelet"],
  wbc: ["wbc"],
  total_cholesterol: ["total_cholesterol"],
  ldl: ["ldl"],
};

function getPatientLabValue(
  patientLabs: Record<string, number | null> | undefined,
  parsedKey: string
): number | null {
  if (!patientLabs) return null;
  for (const [patientKey, aliases] of Object.entries(LAB_KEY_ALIASES)) {
    if (aliases.includes(parsedKey)) {
      const v = patientLabs[patientKey];
      return typeof v === "number" && !Number.isNaN(v) ? v : null;
    }
  }
  return null;
}

interface LabCheckOutcome {
  key: string;
  patientValue: number | null;
  min: number | null;
  max: number | null;
  result: "match" | "excluded" | "unknown";
}

function checkLabs(
  parsed: ParsedEligibility,
  patientLabs: Record<string, number | null> | undefined
): LabCheckOutcome[] {
  const outcomes: LabCheckOutcome[] = [];
  for (const [key, thr] of Object.entries(parsed.labThresholds)) {
    if (thr == null) continue;
    const min = typeof thr.min === "number" ? thr.min : null;
    const max = typeof thr.max === "number" ? thr.max : null;
    if (min === null && max === null) continue;

    const pv = getPatientLabValue(patientLabs, key);
    if (pv === null) {
      outcomes.push({ key, patientValue: null, min, max, result: "unknown" });
      continue;
    }
    const belowMin = min !== null && pv < min;
    const aboveMax = max !== null && pv > max;
    outcomes.push({
      key,
      patientValue: pv,
      min,
      max,
      result: belowMin || aboveMax ? "excluded" : "match",
    });
  }
  return outcomes;
}

const LAB_DISPLAY_NAMES: Record<string, string> = {
  hba1c: "HbA1c",
  egfr: "eGFR",
  creatinine: "Creatinine",
  alt: "ALT",
  ast: "AST",
  bilirubin: "Bilirubin",
  hemoglobin: "Hemoglobin",
  platelet: "Platelets",
  wbc: "WBC",
  anc: "ANC",
  ldl: "LDL",
  ef: "LVEF",
  bmi: "BMI",
  nt_probnp: "NT-proBNP",
  mmse: "MMSE",
  bp_systolic: "Systolic BP",
  bp_diastolic: "Diastolic BP",
};

const LAB_UNITS: Record<string, string> = {
  hba1c: "%",
  egfr: "mL/min",
  creatinine: "mg/dL",
  alt: "U/L",
  ast: "U/L",
  hemoglobin: "g/dL",
  platelet: "×10⁹/L",
  wbc: "×10⁹/L",
  ldl: "mg/dL",
  ef: "%",
  bmi: "kg/m²",
  mmse: "",
  bp_systolic: "mmHg",
  bp_diastolic: "mmHg",
};

function formatLabRange(min: number | null, max: number | null, unit: string): string {
  const u = unit ? ` ${unit}` : "";
  if (min !== null && max !== null) return `${min}–${max}${u}`;
  if (max !== null) return `≤ ${max}${u}`;
  if (min !== null) return `≥ ${min}${u}`;
  return "Not specified";
}

// ============================================================================
// Haversine distance
// ============================================================================
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ============================================================================
// Main scoring function
// ============================================================================
export interface ScoredTrial {
  trial: RawTrial;
  locations: RawLocation[];
  nearestDistance: number | null;
  matchScore: number;
  criteriaResults: CriterionResult[];
  parsedEligibility: ParsedEligibility | null;
}

const WEIGHTS = {
  age: 12,
  gender: 8,
  condition: 35,
  medication: 20,
  lab: 15,
  proximity: 10,
};

export function scoreTrial(
  trial: RawTrial,
  locations: RawLocation[],
  profile: PatientProfileInput,
  parsed?: ParsedEligibility | null
): ScoredTrial {
  const criteria: CriterionResult[] = [];
  let scoreSum = 0;
  let weightSum = 0;

  // ----- Age -----
  const minAge = parseAgeYears(trial.minimum_age);
  const maxAge = parseAgeYears(trial.maximum_age);
  const ageRange =
    minAge !== null && maxAge !== null
      ? `${Math.round(minAge)} – ${Math.round(maxAge)} years`
      : minAge !== null
      ? `≥ ${Math.round(minAge)} years`
      : maxAge !== null
      ? `≤ ${Math.round(maxAge)} years`
      : "Not specified";

  if (profile.age === undefined) {
    criteria.push({
      criterion: "Age",
      patientValue: "Not provided",
      trialRequirement: ageRange,
      result: "unknown",
    });
  } else if (minAge === null && maxAge === null) {
    criteria.push({
      criterion: "Age",
      patientValue: `${profile.age} years`,
      trialRequirement: "Not specified",
      result: "not_applicable",
    });
  } else {
    const inRange =
      (minAge === null || profile.age >= minAge) &&
      (maxAge === null || profile.age <= maxAge);
    criteria.push({
      criterion: "Age",
      patientValue: `${profile.age} years`,
      trialRequirement: ageRange,
      result: inRange ? "match" : "excluded",
    });
    weightSum += WEIGHTS.age;
    if (inRange) scoreSum += WEIGHTS.age;
  }

  // ----- Gender -----
  const trialSex = (trial.eligibility_sex || "").toUpperCase();
  const requirement =
    trialSex === "ALL" || !trialSex ? "All" :
    trialSex === "MALE" ? "Male only" :
    trialSex === "FEMALE" ? "Female only" : trialSex;

  if (!profile.gender) {
    criteria.push({
      criterion: "Gender",
      patientValue: "Not provided",
      trialRequirement: requirement,
      result: "unknown",
    });
  } else {
    const genderMatch =
      trialSex === "ALL" || !trialSex ||
      (trialSex === "MALE" && profile.gender === "male") ||
      (trialSex === "FEMALE" && profile.gender === "female");

    criteria.push({
      criterion: "Gender",
      patientValue: profile.gender[0].toUpperCase() + profile.gender.slice(1),
      trialRequirement: requirement,
      result: genderMatch ? "match" : "excluded",
    });
    weightSum += WEIGHTS.gender;
    if (genderMatch) scoreSum += WEIGHTS.gender;
  }

  // ----- Conditions -----
  const trialConditions: string[] = trial.conditions
    ? (() => {
        try {
          return JSON.parse(trial.conditions) as string[];
        } catch {
          return [];
        }
      })()
    : [];

  if (!profile.conditions || profile.conditions.length === 0) {
    criteria.push({
      criterion: "Condition",
      patientValue: "Not provided",
      trialRequirement: trialConditions.slice(0, 2).join(", ") || "—",
      result: "unknown",
    });
  } else if (trialConditions.length === 0) {
    criteria.push({
      criterion: "Condition",
      patientValue: profile.conditions[0],
      trialRequirement: "Not specified",
      result: "not_applicable",
    });
  } else {
    const { matched, partial } = conditionOverlap(profile.conditions, trialConditions);
    criteria.push({
      criterion: "Condition",
      patientValue: matched.length > 0 ? matched.join(", ") : profile.conditions.join(", "),
      trialRequirement: trialConditions.slice(0, 2).join(", "),
      result: matched.length === 0 ? "excluded" : partial ? "unknown" : "match",
    });
    weightSum += WEIGHTS.condition;
    if (matched.length > 0) {
      scoreSum += partial ? WEIGHTS.condition * 0.6 : WEIGHTS.condition;
    }
  }

  // ----- Medications (structured if parsed data available) -----
  if (profile.medications && profile.medications.length > 0) {
    if (parsed && parsed.medicationsExcluded.length > 0) {
      const { excluded, hitBy } = checkMedicationsStructured(
        profile.medications,
        parsed.medicationsExcluded
      );
      criteria.push({
        criterion: "Medications",
        patientValue: profile.medications.slice(0, 3).join(", "),
        trialRequirement: excluded.length > 0
          ? `Excludes ${hitBy}`
          : "No exclusion match",
        result: excluded.length > 0 ? "excluded" : "match",
      });
      weightSum += WEIGHTS.medication;
      if (excluded.length === 0) scoreSum += WEIGHTS.medication;
    } else if (trial.eligibility_criteria) {
      const { excluded } = checkMedicationsFallback(profile.medications, trial.eligibility_criteria);
      criteria.push({
        criterion: "Medications",
        patientValue: profile.medications.slice(0, 3).join(", "),
        trialRequirement: excluded.length > 0
          ? `Excludes: ${excluded.join(", ")}`
          : "No specific exclusions found",
        result: excluded.length > 0 ? "excluded" : "match",
      });
      weightSum += WEIGHTS.medication;
      if (excluded.length === 0) scoreSum += WEIGHTS.medication;
    } else {
      criteria.push({
        criterion: "Medications",
        patientValue: profile.medications.slice(0, 2).join(", "),
        trialRequirement: "Not specified",
        result: "not_applicable",
      });
    }
  }

  // ----- Lab values (from parsed thresholds) -----
  if (parsed && Object.keys(parsed.labThresholds).length > 0) {
    const outcomes = checkLabs(parsed, profile.labValues);
    if (outcomes.length > 0) {
      // Score contribution
      const scorable = outcomes.filter((o) => o.result !== "unknown");
      if (scorable.length > 0) {
        weightSum += WEIGHTS.lab;
        const passed = scorable.filter((o) => o.result === "match").length;
        scoreSum += WEIGHTS.lab * (passed / scorable.length);
      }

      // One criterion row per lab with a threshold
      for (const o of outcomes) {
        const display = LAB_DISPLAY_NAMES[o.key] || o.key;
        const unit = LAB_UNITS[o.key] || "";
        const reqText = formatLabRange(o.min, o.max, unit);
        const patientText =
          o.patientValue === null
            ? "Not provided"
            : `${o.patientValue}${unit ? ` ${unit}` : ""}`;
        criteria.push({
          criterion: display,
          patientValue: patientText,
          trialRequirement: reqText,
          result: o.result,
        });
      }
    }
  }

  // ----- Performance status (ECOG) -----
  if (parsed && parsed.ecog) {
    criteria.push({
      criterion: "Performance status",
      patientValue: "Not provided",
      trialRequirement: `ECOG ${parsed.ecog.min ?? 0}–${parsed.ecog.max ?? 5}`,
      result: "unknown",
    });
  }

  // ----- Proximity -----
  let nearestDistance: number | null = null;
  if (profile.lat !== undefined && profile.lng !== undefined && locations.length > 0) {
    const distances = locations
      .filter((l) => l.latitude !== null && l.longitude !== null)
      .map((l) => haversineMiles(profile.lat!, profile.lng!, l.latitude!, l.longitude!));
    if (distances.length > 0) {
      nearestDistance = Math.min(...distances);
    }
  }

  if (nearestDistance !== null && profile.searchRadius !== undefined) {
    const inRadius = nearestDistance <= profile.searchRadius;
    criteria.push({
      criterion: "Distance",
      patientValue: `${Math.round(nearestDistance)} miles`,
      trialRequirement: `≤ ${profile.searchRadius} miles`,
      result: inRadius ? "match" : "excluded",
    });
    weightSum += WEIGHTS.proximity;
    if (inRadius) {
      const proximityScore = WEIGHTS.proximity * (1 - nearestDistance / profile.searchRadius);
      scoreSum += Math.max(WEIGHTS.proximity * 0.5, proximityScore);
    }
  }

  const matchScore = weightSum > 0 ? Math.round((scoreSum / weightSum) * 100) : 0;

  return {
    trial,
    locations,
    nearestDistance,
    matchScore,
    criteriaResults: criteria,
    parsedEligibility: parsed || null,
  };
}

// ============================================================================
// Convert to TrialMatch shape
// ============================================================================
export function scoredTrialToMatch(st: ScoredTrial): TrialMatch {
  const t = st.trial;

  const trialConditions: string[] = t.conditions
    ? (() => {
        try {
          return JSON.parse(t.conditions) as string[];
        } catch {
          return [];
        }
      })()
    : [];

  const phase = (t.phase || "").replace(/_/g, " ").replace(/PHASE/g, "Phase").trim() || "Other";

  return {
    nctId: t.nct_id,
    briefTitle: t.brief_title || "",
    officialTitle: t.brief_title || "",
    sponsor: "—",
    phase,
    status: "Recruiting",
    enrollmentCount: t.enrollment_count || 0,
    briefSummary: "",
    detailedDescription: "",
    conditions: trialConditions,
    interventions: [],
    eligibilityCriteria: t.eligibility_criteria || "",
    matchScore: st.matchScore,
    criteriaResults: st.criteriaResults,
    locations: st.locations.map((l) => ({
      facility: l.facility || "",
      city: l.city || "",
      state: l.state || "",
      country: l.country || "",
      lat: l.latitude || 0,
      lng: l.longitude || 0,
    })),
    nearestDistance: st.nearestDistance || 0,
    lastUpdated: "",
  };
}
