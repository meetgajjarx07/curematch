import { NextRequest } from "next/server";
import { getDb, RawTrial } from "@/lib/db";
import { streamCompletion, LLMMessage, getBackendInfo } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_MESSAGES = 12;
const MAX_ELIGIBILITY_CHARS = 6000;

interface ChatRequestBody {
  messages?: { role: "user" | "assistant"; content: string }[];
  profile?: {
    age?: number;
    gender?: string;
    conditions?: string[];
    medications?: string[];
  };
}

/**
 * POST /api/chat/[nctId]
 * RAG chat agent grounded in a single trial's eligibility + description text.
 * Streams SSE to the client.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ nctId: string }> }
) {
  const { nctId } = await params;

  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userMessages = (body.messages || []).slice(-MAX_MESSAGES);
  if (userMessages.length === 0) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Pull trial from DB
  const db = getDb();
  const trial = db
    .prepare(`SELECT nct_id, brief_title, eligibility_criteria, phase, conditions FROM trials WHERE nct_id = ?`)
    .get(nctId) as Pick<RawTrial, "nct_id" | "brief_title" | "eligibility_criteria" | "phase" | "conditions"> | undefined;

  if (!trial) {
    return new Response(JSON.stringify({ error: "Trial not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build grounded system prompt
  const eligibility = (trial.eligibility_criteria || "").slice(0, MAX_ELIGIBILITY_CHARS);
  let conditionsList = "";
  try {
    const arr = JSON.parse(trial.conditions || "[]") as string[];
    conditionsList = arr.slice(0, 6).join(", ");
  } catch {}

  const profileNote = body.profile
    ? `\n\nThe reader has shared this profile:\n` +
      [
        body.profile.age !== undefined ? `- Age: ${body.profile.age}` : "",
        body.profile.gender ? `- Gender: ${body.profile.gender}` : "",
        body.profile.conditions?.length ? `- Conditions: ${body.profile.conditions.join(", ")}` : "",
        body.profile.medications?.length ? `- Medications: ${body.profile.medications.join(", ")}` : "",
      ].filter(Boolean).join("\n")
    : "";

  const systemPrompt = `You are a clinical trial assistant for CureMatch. You help patients understand a specific trial by answering questions grounded STRICTLY in the trial's published information below.

RULES:
1. Answer ONLY using information from the TRIAL CONTEXT. If the trial text does not say something, respond with: "The trial's public information doesn't specify that — you'll want to ask the study team directly."
2. Never invent eligibility rules, side effects, dosing schedules, or outcomes.
3. Keep responses concise (≤ 150 words) and in plain language. Explain medical jargon (e.g. "ECOG 0-1 means you're generally active and able to care for yourself").
4. When discussing eligibility for this specific reader, compare their profile to the trial's criteria verbatim — do not speculate.
5. Always close eligibility answers with: "Final eligibility is determined by the trial's investigators."
6. Never provide medical advice, diagnosis, or treatment recommendations. If asked, redirect to their physician.

TRIAL CONTEXT
─────────────
NCT ID: ${trial.nct_id}
Title: ${trial.brief_title}
Phase: ${trial.phase || "Not specified"}
Conditions: ${conditionsList || "Not specified"}

Eligibility Criteria:
${eligibility || "(No eligibility text available for this trial.)"}${profileNote}`;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...userMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  // Stream back as plain text chunks (simpler than SSE for this use case)
  const encoder = new TextEncoder();
  const backend = getBackendInfo();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Emit backend metadata as a single JSON line at the start
        controller.enqueue(
          encoder.encode(`::meta ${JSON.stringify({ provider: backend.provider, model: backend.model })}\n`)
        );

        for await (const chunk of streamCompletion({
          messages,
          temperature: 0.3,
          maxTokens: 400,
        })) {
          if (chunk.delta) {
            controller.enqueue(encoder.encode(chunk.delta));
          }
          if (chunk.done) break;
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`\n\n[Error: ${msg}]`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-LLM-Provider": backend.provider,
      "X-LLM-Model": backend.model,
    },
  });
}
