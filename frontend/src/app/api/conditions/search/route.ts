import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/conditions/search?q=diabetes
 * Returns the top matching condition names (deduped, ranked by trial count).
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const db = getDb();

    // conditions column stores a JSON array as text. Substring search finds rows
    // where any condition contains the query.
    const rows = db
      .prepare(
        `SELECT conditions FROM trials
         WHERE conditions LIKE ?
         LIMIT 2000`
      )
      .all(`%${q}%`) as { conditions: string }[];

    const counts = new Map<string, number>();
    const qLower = q.toLowerCase();

    for (const row of rows) {
      try {
        const arr = JSON.parse(row.conditions) as string[];
        for (const c of arr) {
          if (c.toLowerCase().includes(qLower)) {
            counts.set(c, (counts.get(c) ?? 0) + 1);
          }
        }
      } catch {}
    }

    const results = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("/api/conditions/search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
