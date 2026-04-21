import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/stats — quick counts for the landing page.
 */
export async function GET() {
  try {
    const db = getDb();
    const trials = (db.prepare("SELECT COUNT(*) as c FROM trials").get() as { c: number }).c;
    const countries = (db
      .prepare("SELECT COUNT(DISTINCT country) as c FROM locations WHERE country IS NOT NULL")
      .get() as { c: number }).c;
    const locations = (db.prepare("SELECT COUNT(*) as c FROM locations").get() as { c: number }).c;

    return NextResponse.json({ trials, countries, locations });
  } catch (err) {
    console.error("/api/stats error:", err);
    return NextResponse.json({ error: "Stats failed" }, { status: 500 });
  }
}
