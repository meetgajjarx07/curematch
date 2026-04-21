import { NextRequest } from "next/server";
import { getDb, RawTrial, RawLocation } from "@/lib/db";
import { getParsedEligibility } from "@/lib/parsed-db";
import { scoreTrial, PatientProfileInput } from "@/lib/scoring";
import { streamCompletion, LLMMessage, getBackendInfo } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ExplainRequest {
  nctId: string;
  profile: PatientProfileInput;
}

/**
 * POST /api/match/explain
 * Produces a plain-English narrative explanation of a trial match for a reader.
 *
 * Pipeline:
 *   1. Load trial + locations + parsed eligibility
 *   2. Re-score against the reader's profile → per-criterion verdicts
 *   3. Feed profile + verdicts + trial context to the LLM
 *   4. Stream a 2–3 sentence narrative back to the client
 */
export async function POST(req: NextRequest) {
  let body: ExplainRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.nctId) {
    return new Response(JSON.stringify({ error: "nctId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDb();
  const trial = db
    .prepare("SELECT * FROM trials WHERE nct_id = ?")
    .get(body.nctId) as RawTrial | undefined;

  if (!trial) {
    return new Response(JSON.stringify({ error: "Trial not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const locations = db
    .prepare(
      "SELECT nct_id, facility, city, state, country, latitude, longitude FROM locations WHERE nct_id = ?"
    )
    .all(body.nctId) as RawLocation[];

  const parsed = getParsedEligibility(body.nctId);
  const scored = scoreTrial(trial, locations, body.profile || {}, parsed);

  // Serialize verdicts compactly for the LLM
  const verdicts = scored.criteriaResults
    .map((c) => `- ${c.criterion}: reader=${c.patientValue || "—"} | required=${c.trialRequirement || "—"} | verdict=${c.result}`)
    .join("\n");

  const matchCount = scored.criteriaResults.filter((c) => c.result === "match").length;
  const excludedCount = scored.criteriaResults.filter((c) => c.result === "excluded").length;
  const unknownCount = scored.criteriaResults.filter((c) => c.result === "unknown").length;

  const phase = (trial.phase || "").replace(/_/g, " ").replace(/PHASE/g, "Phase").trim() || "Not specified";

  const systemPrompt = `You are CureMatch's match explainer. Given a trial, a reader's profile, and deterministic per-criterion verdicts, write ONE concise plain-English paragraph (2–3 sentences, ≤ 80 words) explaining why this trial matched the reader.

RULES:
1. Speak directly to the reader using "you" and "your".
2. Lead with the STRONGEST positive (e.g. "You match on condition and age").
3. If there are EXCLUSIONS, name them specifically and why ("…but your ${excludedCount > 0 ? "warfarin use" : ""} is on the exclusion list").
4. If there are UNKNOWNS (reader didn't provide data), name the single most important one.
5. Do NOT invent criteria not in the verdicts list below.
6. Do NOT give medical advice or recommend enrollment.
7. End tone: factual, specific, no hype, no "exciting opportunity" language.`;

  const userPrompt = `TRIAL
Title: ${trial.brief_title}
NCT ID: ${trial.nct_id}
Phase: ${phase}
Composite match score: ${scored.matchScore}%

PER-CRITERION VERDICTS
${verdicts}

SUMMARY
${matchCount} matching, ${excludedCount} excluding, ${unknownCount} unknown (reader didn't provide).

Write the explanation paragraph.`;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const encoder = new TextEncoder();
  const backend = getBackendInfo();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`::meta ${JSON.stringify({ provider: backend.provider, model: backend.model })}\n`)
        );

        for await (const chunk of streamCompletion({
          messages,
          temperature: 0.2,
          maxTokens: 180,
        })) {
          if (chunk.delta) controller.enqueue(encoder.encode(chunk.delta));
          if (chunk.done) break;
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[LLM error: ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-LLM-Provider": backend.provider,
    },
  });
}
