export interface PatientProfile {
  age: number;
  gender: "male" | "female" | "other";
  ethnicity?: string;
  conditions: string[];
  medications: string[];
  labValues: Record<string, number | null>;
  location: {
    city: string;
    lat: number;
    lng: number;
  };
  searchRadius: number;
}

export interface TrialLocation {
  facility: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  distance?: number;
}

export interface CriterionResult {
  criterion: string;
  patientValue: string;
  trialRequirement: string;
  result: "match" | "excluded" | "unknown" | "not_applicable";
}

export interface TrialMatch {
  nctId: string;
  briefTitle: string;
  officialTitle: string;
  sponsor: string;
  phase: string;
  status: string;
  enrollmentCount: number;
  briefSummary: string;
  detailedDescription: string;
  conditions: string[];
  interventions: string[];
  eligibilityCriteria: string;
  matchScore: number;
  criteriaResults: CriterionResult[];
  locations: TrialLocation[];
  nearestDistance: number;
  lastUpdated: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  parsed?: ParsedEligibilitySummary | null;
}

export interface ParsedEligibilitySummary {
  nctId: string;
  medicationsExcluded: string[];
  medicationsRequired: string[];
  labThresholds: Record<string, { min?: number | null; max?: number | null }>;
  ecog: { min?: number | null; max?: number | null } | null;
  source: "rule" | "llm" | "hybrid";
  confidence: number | null;
  parsedAt: number;
  parserVersion: string | null;
}

export interface SearchFilters {
  conditionCategory: string;
  phase: string[];
  minDistance: number;
  maxDistance: number;
  minScore: number;
  sortBy: "score" | "distance" | "enrollment" | "updated";
}
