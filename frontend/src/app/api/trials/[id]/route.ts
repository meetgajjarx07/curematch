import { NextRequest, NextResponse } from "next/server";
import { getDb, RawTrial, RawLocation, RawIntervention } from "@/lib/db";
import { getParsedEligibility } from "@/lib/parsed-db";
import { scoreTrial, scoredTrialToMatch, PatientProfileInput } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/trials/:id
 * Returns a single trial with full details. Accepts optional ?profile= URL-encoded JSON
 * for per-criterion scoring against the reader's profile.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const trial = db
      .prepare(`SELECT * FROM trials WHERE nct_id = ?`)
      .get(id) as RawTrial | undefined;

    if (!trial) {
      return NextResponse.json({ error: "Trial not found" }, { status: 404 });
    }

    const locations = db
      .prepare(
        `SELECT nct_id, facility, city, state, country, latitude, longitude
         FROM locations WHERE nct_id = ?`
      )
      .all(id) as RawLocation[];

    const interventions = db
      .prepare(
        `SELECT nct_id, intervention_type, intervention_name, intervention_description
         FROM arms_interventions WHERE nct_id = ?`
      )
      .all(id) as RawIntervention[];

    // Optional scoring against a supplied profile
    const profileParam = req.nextUrl.searchParams.get("profile");
    let profile: PatientProfileInput | null = null;
    if (profileParam) {
      try {
        profile = JSON.parse(profileParam);
      } catch {}
    }

    let criteriaResults = undefined;
    let matchScore = undefined;
    let nearestDistance = undefined;

    const parsed = getParsedEligibility(id);

    if (profile) {
      const scored = scoreTrial(trial, locations, profile, parsed);
      criteriaResults = scored.criteriaResults;
      matchScore = scored.matchScore;
      nearestDistance = scored.nearestDistance;
    }

    const base = scoredTrialToMatch({
      trial,
      locations,
      nearestDistance: nearestDistance ?? null,
      matchScore: matchScore ?? 0,
      criteriaResults: criteriaResults ?? [],
      parsedEligibility: parsed,
    });

    return NextResponse.json({
      ...base,
      interventions: interventions
        .map((i) => {
          const name = i.intervention_name || "";
          const desc = i.intervention_description || "";
          const type = i.intervention_type || "";
          return [name, type ? `(${type})` : "", desc ? `— ${desc}` : ""]
            .filter(Boolean)
            .join(" ");
        })
        .filter(Boolean),
      parsed: parsed, // expose parsed eligibility to the client
    });
  } catch (err) {
    console.error("/api/trials/:id error:", err);
    return NextResponse.json(
      { error: "Lookup failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
