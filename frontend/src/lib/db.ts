import Database from "better-sqlite3";
import path from "path";

let db: Database.Database | null = null;

/**
 * Returns a singleton connection to the trials SQLite database.
 * The path is resolved from the DATABASE_PATH env var, or defaults to
 * ../data/trials.db relative to the frontend directory.
 */
export function getDb(): Database.Database {
  if (db) return db;

  const dbPath =
    process.env.DATABASE_PATH ||
    path.resolve(process.cwd(), "..", "data", "trials.db");

  db = new Database(dbPath, { readonly: true, fileMustExist: true });
  // Query-tuning — only pragmas compatible with readonly mode
  db.pragma("cache_size = -64000"); // 64MB cache
  db.pragma("temp_store = MEMORY");

  return db;
}

export interface RawTrial {
  nct_id: string;
  brief_title: string;
  eligibility_criteria: string | null;
  eligibility_sex: string | null;
  minimum_age: string | null;
  maximum_age: string | null;
  conditions: string | null; // JSON array string
  phase: string | null;
  enrollment_count: number | null;
  enrollment_type: string | null;
}

export interface RawLocation {
  nct_id: string;
  facility: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface RawIntervention {
  nct_id: string;
  intervention_type: string | null;
  intervention_name: string | null;
  intervention_description: string | null;
}
