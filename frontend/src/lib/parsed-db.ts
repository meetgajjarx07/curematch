import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let parsedDb: Database.Database | null = null;

/**
 * Returns the singleton read-write connection to parsed.db.
 * This is a DERIVED store — writes only happen during parsing runs
 * (rule-based batch or on-demand LLM fallback). The canonical source of truth
 * remains trials.db (readonly).
 *
 * Schema is created on first access (idempotent).
 */
export function getParsedDb(): Database.Database {
  if (parsedDb) return parsedDb;

  const dbPath =
    process.env.PARSED_DB_PATH ||
    path.resolve(process.cwd(), "..", "data", "parsed.db");

  // Ensure parent dir exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  parsedDb = new Database(dbPath);
  parsedDb.pragma("journal_mode = WAL");
  parsedDb.pragma("synchronous = NORMAL");
  parsedDb.pragma("temp_store = MEMORY");
  parsedDb.pragma("cache_size = -32000"); // 32MB

  // Idempotent schema creation
  parsedDb.exec(`
    CREATE TABLE IF NOT EXISTS parsed_eligibility (
      nct_id               TEXT PRIMARY KEY,
      medications_excluded TEXT,      -- JSON array
      medications_required TEXT,      -- JSON array
      lab_thresholds       TEXT,      -- JSON object: {"hba1c": {"min":null,"max":10.5}, ...}
      ecog                 TEXT,      -- JSON: {"min":0,"max":1}
      performance_notes    TEXT,      -- free text snippet
      other_inclusion      TEXT,      -- JSON array of sentences
      other_exclusion      TEXT,      -- JSON array of sentences
      source               TEXT NOT NULL CHECK (source IN ('rule','llm','hybrid')),
      confidence           REAL,      -- 0.0 – 1.0
      parsed_at            INTEGER NOT NULL,
      parser_version       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_parsed_source ON parsed_eligibility(source);
    CREATE INDEX IF NOT EXISTS idx_parsed_at ON parsed_eligibility(parsed_at);

    CREATE TABLE IF NOT EXISTS llm_cache (
      cache_key   TEXT PRIMARY KEY,   -- sha256(model + prompt + context_hash)
      response    TEXT NOT NULL,      -- full response body
      model       TEXT,
      tokens_in   INTEGER,
      tokens_out  INTEGER,
      latency_ms  INTEGER,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cache_created ON llm_cache(created_at);

    CREATE TABLE IF NOT EXISTS chat_sessions (
      session_id  TEXT PRIMARY KEY,   -- client-generated uuid
      nct_id      TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      message_count INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_chat_nct ON chat_sessions(nct_id);
  `);

  return parsedDb;
}

export interface ParsedEligibilityRow {
  nct_id: string;
  medications_excluded: string | null;
  medications_required: string | null;
  lab_thresholds: string | null;
  ecog: string | null;
  performance_notes: string | null;
  other_inclusion: string | null;
  other_exclusion: string | null;
  source: "rule" | "llm" | "hybrid";
  confidence: number | null;
  parsed_at: number;
  parser_version: string | null;
}

export interface ParsedEligibility {
  nctId: string;
  medicationsExcluded: string[];
  medicationsRequired: string[];
  labThresholds: Record<string, { min?: number | null; max?: number | null }>;
  ecog: { min?: number | null; max?: number | null } | null;
  performanceNotes: string | null;
  otherInclusion: string[];
  otherExclusion: string[];
  source: "rule" | "llm" | "hybrid";
  confidence: number | null;
  parsedAt: number;
  parserVersion: string | null;
}

function safeJsonParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

export function rowToParsedEligibility(r: ParsedEligibilityRow): ParsedEligibility {
  return {
    nctId: r.nct_id,
    medicationsExcluded: safeJsonParse(r.medications_excluded, []),
    medicationsRequired: safeJsonParse(r.medications_required, []),
    labThresholds: safeJsonParse(r.lab_thresholds, {}),
    ecog: safeJsonParse<ParsedEligibility["ecog"]>(r.ecog, null),
    performanceNotes: r.performance_notes,
    otherInclusion: safeJsonParse(r.other_inclusion, []),
    otherExclusion: safeJsonParse(r.other_exclusion, []),
    source: r.source,
    confidence: r.confidence,
    parsedAt: r.parsed_at,
    parserVersion: r.parser_version,
  };
}

export function getParsedEligibility(nctId: string): ParsedEligibility | null {
  const db = getParsedDb();
  const row = db
    .prepare("SELECT * FROM parsed_eligibility WHERE nct_id = ?")
    .get(nctId) as ParsedEligibilityRow | undefined;
  return row ? rowToParsedEligibility(row) : null;
}
