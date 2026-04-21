import { NextRequest, NextResponse } from "next/server";
import { getDb, RawTrial, RawLocation } from "@/lib/db";
import { getParsedDb, rowToParsedEligibility, ParsedEligibility, ParsedEligibilityRow } from "@/lib/parsed-db";
import { scoreTrial, scoredTrialToMatch, PatientProfileInput } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/trials/batch
 * Body: { ids: string[], profile?: PatientProfileInput }
 * Returns: { trials: TrialMatch[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids.slice(0, 100) : [];
    const profile: PatientProfileInput | undefined = body.profile;

    if (ids.length === 0) {
      return NextResponse.json({ trials: [] });
    }

    const db = getDb();
    const placeholders = ids.map(() => "?").join(",");

    const rawTrials = db
      .prepare(
        `SELECT nct_id, brief_title, eligibility_criteria, eligibility_sex,
                minimum_age, maximum_age, conditions, phase, enrollment_count,
                enrollment_type
         FROM trials WHERE nct_id IN (${placeholders})`
      )
      .all(...ids) as RawTrial[];

    const rawLocations = db
      .prepare(
        `SELECT nct_id, facility, city, state, country, latitude, longitude
         FROM locations WHERE nct_id IN (${placeholders})`
      )
      .all(...ids) as RawLocation[];

    const locByNctId = new Map<string, RawLocation[]>();
    for (const loc of rawLocations) {
      const arr = locByNctId.get(loc.nct_id) ?? [];
      arr.push(loc);
      locByNctId.set(loc.nct_id, arr);
    }

    // Bulk-load parsed eligibility
    const parsedByNctId = new Map<string, ParsedEligibility>();
    try {
      const parsedDb = getParsedDb();
      const parsedRows = parsedDb
        .prepare(`SELECT * FROM parsed_eligibility WHERE nct_id IN (${placeholders})`)
        .all(...ids) as ParsedEligibilityRow[];
      for (const row of parsedRows) {
        parsedByNctId.set(row.nct_id, rowToParsedEligibility(row));
      }
    } catch {}

    const trials = rawTrials.map((t) => {
      const locs = locByNctId.get(t.nct_id) || [];
      const parsed = parsedByNctId.get(t.nct_id) || null;
      const scored = profile
        ? scoreTrial(t, locs, profile, parsed)
        : { trial: t, locations: locs, nearestDistance: null, matchScore: 0, criteriaResults: [], parsedEligibility: parsed };
      return scoredTrialToMatch(scored);
    });

    // Preserve input order
    const byId = new Map(trials.map((t) => [t.nctId, t]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

    return NextResponse.json({ trials: ordered });
  } catch (err) {
    console.error("/api/trials/batch error:", err);
    return NextResponse.json({ error: "Batch fetch failed" }, { status: 500 });
  }
}
