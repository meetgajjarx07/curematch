import { NextRequest, NextResponse } from "next/server";
import { getDb, RawTrial, RawLocation } from "@/lib/db";
import { getParsedDb, rowToParsedEligibility, ParsedEligibility, ParsedEligibilityRow } from "@/lib/parsed-db";
import { scoreTrial, scoredTrialToMatch, PatientProfileInput } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/match
 * Body: { profile: PatientProfileInput, limit?: number }
 * Returns: { trials: TrialMatch[], totalScreened: number, matched: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profile: PatientProfileInput = body.profile || {};
    const limit = Math.min(Math.max(1, Number(body.limit) || 100), 500);
    const minScore = Math.max(0, Number(body.minScore) || 0);

    const db = getDb();

    // Pre-filter at the SQL level to cut 65k down to a manageable candidate set.
    // We filter only on clearly-structured fields; scoring refines.
    let query = `SELECT nct_id, brief_title, eligibility_criteria, eligibility_sex, minimum_age, maximum_age, conditions, phase, enrollment_count, enrollment_type FROM trials WHERE 1=1`;
    const params: (string | number)[] = [];

    // Quick gender pre-filter — trials that explicitly require the opposite sex
    if (profile.gender === "male") {
      query += " AND (eligibility_sex IS NULL OR eligibility_sex != 'FEMALE')";
    } else if (profile.gender === "female") {
      query += " AND (eligibility_sex IS NULL OR eligibility_sex != 'MALE')";
    }

    // Condition candidate filter — use ONLY distinctive words (not generic
    // medical terms like "disease", "cancer", "syndrome"), otherwise we pull
    // the entire corpus and the scorer fights false positives.
    const GENERIC = new Set([
      "disease", "diseases", "disorder", "disorders", "syndrome", "syndromes",
      "cancer", "cancers", "tumor", "tumors", "neoplasm", "neoplasms", "type",
      "stage", "primary", "secondary", "chronic", "acute", "severe",
      "moderate", "mild", "advanced", "early", "late", "metastatic",
      "systemic", "active", "carcinoma", "malignant",
    ]);

    if (profile.conditions && profile.conditions.length > 0) {
      const conditionFilters = profile.conditions
        .flatMap((c) =>
          c.toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length >= 4 && !GENERIC.has(w))
            .slice(0, 3)
        );

      if (conditionFilters.length > 0) {
        const likes = conditionFilters.map(() => "conditions LIKE ?").join(" OR ");
        query += ` AND (${likes})`;
        params.push(...conditionFilters.map((w) => `%${w}%`));
      }
    }

    query += " LIMIT 5000";

    const stmt = db.prepare(query);
    const rawTrials = stmt.all(...params) as RawTrial[];

    // Load locations for these trials
    const locStmt = db.prepare(
      `SELECT nct_id, facility, city, state, country, latitude, longitude
       FROM locations WHERE nct_id IN (${rawTrials.map(() => "?").join(",")})`
    );

    const allLocations = rawTrials.length > 0
      ? (locStmt.all(...rawTrials.map((t) => t.nct_id)) as RawLocation[])
      : [];

    const locByNctId = new Map<string, RawLocation[]>();
    for (const loc of allLocations) {
      const arr = locByNctId.get(loc.nct_id) ?? [];
      arr.push(loc);
      locByNctId.set(loc.nct_id, arr);
    }

    // Bulk-load parsed eligibility for all candidates
    const parsedByNctId = new Map<string, ParsedEligibility>();
    if (rawTrials.length > 0) {
      try {
        const parsedDb = getParsedDb();
        const placeholders = rawTrials.map(() => "?").join(",");
        const parsedRows = parsedDb
          .prepare(`SELECT * FROM parsed_eligibility WHERE nct_id IN (${placeholders})`)
          .all(...rawTrials.map((t) => t.nct_id)) as ParsedEligibilityRow[];
        for (const row of parsedRows) {
          parsedByNctId.set(row.nct_id, rowToParsedEligibility(row));
        }
      } catch (err) {
        // Parsed DB may not exist yet — fall through to text-scan scoring
        console.warn("parsed-db unavailable:", err instanceof Error ? err.message : err);
      }
    }

    // Score each candidate (with parsed data where available)
    const scored = rawTrials.map((t) =>
      scoreTrial(
        t,
        locByNctId.get(t.nct_id) || [],
        profile,
        parsedByNctId.get(t.nct_id) || null
      )
    );

    // Filter + rank
    const ranked = scored
      .filter((s) => s.matchScore >= minScore)
      .filter((s) => {
        // Must not be excluded on condition (the critical criterion)
        const condCriterion = s.criteriaResults.find((c) => c.criterion === "Condition");
        return !condCriterion || condCriterion.result !== "excluded";
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    // Total trials in DB (for "X of Y screened" stat)
    const totalRow = db.prepare("SELECT COUNT(*) as c FROM trials").get() as { c: number };

    const response = {
      trials: ranked.map(scoredTrialToMatch),
      totalScreened: totalRow.c,
      candidates: rawTrials.length,
      matched: ranked.length,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("/api/match error:", err);
    return NextResponse.json(
      { error: "Matching failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
