#!/usr/bin/env python3
"""
parse_rules.py — Rule-based eligibility parser for CureMatch.

Reads all 65k trials from data/trials.db (readonly), extracts structured
criteria using regex + drug/lab dictionaries, writes results to
data/parsed.db::parsed_eligibility.

Usage:
    python3 scripts/parse_rules.py              # parse all trials
    python3 scripts/parse_rules.py --limit 500  # parse first 500
    python3 scripts/parse_rules.py --condition diabetes  # filter

Output schema:
    {
      "medications_excluded": ["warfarin", "apixaban", ...],
      "medications_required": [...],
      "lab_thresholds": {"hba1c": {"min": null, "max": 10.5}, ...},
      "ecog": {"min": 0, "max": 1},
      "other_inclusion": [sentence, ...],
      "other_exclusion": [sentence, ...]
    }
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any

PARSER_VERSION = "rule-v1.0.0"

# ---------------------------------------------------------------------------
# Drug dictionary — seed list of common medications frequently mentioned in
# eligibility criteria. A production parser would load RxNorm RRF files here.
# This seed list already covers the common exclusions (anticoagulants,
# immunosuppressants, GLP-1, anti-PD-1, etc.)
# ---------------------------------------------------------------------------

DRUGS = {
    # Anticoagulants
    "warfarin", "apixaban", "rivaroxaban", "dabigatran", "edoxaban", "heparin",
    "enoxaparin", "dalteparin", "clopidogrel", "prasugrel", "ticagrelor",
    "aspirin", "fondaparinux",

    # Diabetes
    "metformin", "insulin", "glargine", "lispro", "aspart", "sitagliptin",
    "empagliflozin", "dapagliflozin", "canagliflozin", "semaglutide",
    "liraglutide", "dulaglutide", "exenatide", "tirzepatide", "pioglitazone",
    "glimepiride", "glipizide", "glyburide",

    # Statins / cardiac
    "atorvastatin", "rosuvastatin", "simvastatin", "pravastatin", "lisinopril",
    "enalapril", "losartan", "valsartan", "amlodipine", "metoprolol",
    "carvedilol", "bisoprolol", "spironolactone", "eplerenone", "furosemide",

    # Biologics / immunomodulators
    "adalimumab", "infliximab", "etanercept", "rituximab", "abatacept",
    "tocilizumab", "ustekinumab", "secukinumab", "risankizumab",
    "upadacitinib", "tofacitinib", "baricitinib", "methotrexate",
    "leflunomide", "cyclosporine", "tacrolimus", "mycophenolate",
    "azathioprine", "prednisone", "methylprednisolone", "dexamethasone",

    # Oncology
    "pembrolizumab", "nivolumab", "atezolizumab", "durvalumab", "ipilimumab",
    "tamoxifen", "letrozole", "anastrozole", "exemestane", "fulvestrant",
    "paclitaxel", "docetaxel", "cisplatin", "carboplatin", "oxaliplatin",
    "pemetrexed", "gemcitabine", "doxorubicin", "cyclophosphamide",
    "trastuzumab", "bevacizumab", "cetuximab", "panitumumab", "sacituzumab",
    "erlotinib", "gefitinib", "osimertinib", "imatinib", "dasatinib",
    "ibrutinib", "venetoclax", "lenalidomide", "bortezomib",

    # Neurology
    "donepezil", "rivastigmine", "galantamine", "memantine", "lecanemab",
    "donanemab", "aducanumab", "levodopa", "carbidopa", "pramipexole",
    "rasagiline", "selegiline", "amantadine", "gabapentin", "pregabalin",

    # Psych
    "sertraline", "fluoxetine", "escitalopram", "paroxetine", "citalopram",
    "duloxetine", "venlafaxine", "bupropion", "mirtazapine", "trazodone",

    # Respiratory
    "albuterol", "salmeterol", "formoterol", "fluticasone", "budesonide",
    "montelukast", "tiotropium", "dupilumab", "mepolizumab", "benralizumab",
    "omalizumab",

    # GI
    "mesalamine", "sulfasalazine", "vedolizumab", "ozanimod", "tofacitinib",

    # Other
    "omeprazole", "pantoprazole", "levothyroxine", "allopurinol", "febuxostat",
}

# Drug class keywords (broader than individual names)
DRUG_CLASSES = {
    "anticoagulant", "anticoagulants", "anticoagulation",
    "antiplatelet", "antiplatelets",
    "glp-1", "glp-1 agonist", "glp-1 agonists", "glp-1 receptor agonist",
    "dpp-4", "dpp-4 inhibitor",
    "sglt2", "sglt-2", "sglt2 inhibitor",
    "sulfonylurea", "sulfonylureas",
    "thiazolidinedione",
    "insulin",
    "biologic", "biologics", "biologic therapy",
    "anti-tnf", "tnf inhibitor", "tnf inhibitors",
    "jak inhibitor", "jak inhibitors",
    "anti-pd-1", "anti-pd-l1", "anti-pd-l2", "pd-1 inhibitor",
    "immunotherapy", "immunosuppressive", "immunosuppressants",
    "chemotherapy", "chemotherapeutic",
    "corticosteroid", "corticosteroids", "steroids",
    "ssri", "snri", "maoi", "tricyclic",
    "nsaid", "nsaids",
    "ace inhibitor", "ace inhibitors", "arb", "arbs",
    "beta blocker", "beta-blocker", "beta-blockers",
    "statin", "statins",
}

# ---------------------------------------------------------------------------
# Lab value patterns — match common lab thresholds in eligibility text
# ---------------------------------------------------------------------------

LAB_ALIASES = {
    "hba1c": ["hba1c", "hemoglobin a1c", "glycated hemoglobin", "glycosylated hemoglobin", "a1c"],
    "egfr": ["egfr", "estimated gfr", "glomerular filtration rate", "creatinine clearance", "crcl"],
    "creatinine": ["serum creatinine", "creatinine"],
    "alt": ["alt", "alanine aminotransferase", "sgpt"],
    "ast": ["ast", "aspartate aminotransferase", "sgot"],
    "bilirubin": ["total bilirubin", "bilirubin"],
    "hemoglobin": ["hemoglobin", "hgb", "hb"],
    "platelet": ["platelet count", "platelets"],
    "wbc": ["wbc", "white blood cell", "leukocyte count"],
    "anc": ["anc", "absolute neutrophil count", "neutrophils"],
    "ldl": ["ldl cholesterol", "ldl-c", "ldl"],
    "ef": ["lvef", "ejection fraction"],
    "bmi": ["bmi", "body mass index"],
    "nt_probnp": ["nt-probnp", "ntprobnp", "nt probnp"],
    "mmse": ["mmse", "mini-mental state"],
    "bp_systolic": ["systolic blood pressure", "systolic bp"],
    "bp_diastolic": ["diastolic blood pressure", "diastolic bp"],
}

# Regex to match "<alias> <comparator> <number> <optional unit>"
_NUMBER = r"(\d+(?:\.\d+)?)"
_COMPARATOR = r"(<=|>=|≤|≥|<|>|=)"


def _build_lab_regex(aliases: list[str]) -> re.Pattern:
    # (alias)(anything ≤40 chars)(comparator)(space)(number)
    alias_group = "|".join(re.escape(a) for a in aliases)
    pattern = rf"({alias_group})\b[^.;\n]{{0,40}}?{_COMPARATOR}\s*{_NUMBER}"
    return re.compile(pattern, re.IGNORECASE)


LAB_PATTERNS: dict[str, re.Pattern] = {
    key: _build_lab_regex(aliases) for key, aliases in LAB_ALIASES.items()
}

# Range pattern: "between X and Y", "X-Y", "X to Y"
_RANGE_PATTERNS = [
    re.compile(rf"between\s+{_NUMBER}\s+and\s+{_NUMBER}", re.IGNORECASE),
    re.compile(rf"{_NUMBER}\s*[-–]\s*{_NUMBER}"),
    re.compile(rf"{_NUMBER}\s+to\s+{_NUMBER}", re.IGNORECASE),
]


def _extract_range_near(text: str, alias_match: re.Match, window: int = 60) -> tuple[float, float] | None:
    """Look for an explicit numeric range close to an alias."""
    start = max(0, alias_match.end())
    chunk = text[start : start + window]
    for pat in _RANGE_PATTERNS:
        m = pat.search(chunk)
        if m:
            try:
                return float(m.group(1)), float(m.group(2))
            except (ValueError, IndexError):
                continue
    return None


def parse_lab_thresholds(text: str) -> dict[str, dict[str, float | None]]:
    """Extract lab thresholds keyed by lab short-code."""
    out: dict[str, dict[str, float | None]] = {}
    text_lower = text.lower()

    for key, pattern in LAB_PATTERNS.items():
        for m in pattern.finditer(text_lower):
            cmp_op, num_str = m.group(2), m.group(3)
            try:
                val = float(num_str)
            except ValueError:
                continue

            entry = out.setdefault(key, {"min": None, "max": None})
            if cmp_op in ("<", "<=", "≤"):
                if entry["max"] is None or val < entry["max"]:
                    entry["max"] = val
            elif cmp_op in (">", ">=", "≥"):
                if entry["min"] is None or val > entry["min"]:
                    entry["min"] = val

    # Also try range patterns for each lab alias
    for key, aliases in LAB_ALIASES.items():
        if key in out and (out[key]["min"] is not None or out[key]["max"] is not None):
            continue
        alias_group = "|".join(re.escape(a) for a in aliases)
        alias_re = re.compile(rf"({alias_group})\b", re.IGNORECASE)
        for m in alias_re.finditer(text_lower):
            rng = _extract_range_near(text_lower, m)
            if rng:
                lo, hi = sorted(rng)
                out[key] = {"min": lo, "max": hi}
                break

    return out


# ---------------------------------------------------------------------------
# ECOG / Karnofsky
# ---------------------------------------------------------------------------

ECOG_PAT = re.compile(r"ecog\s*(?:performance\s*status\s*|ps\s*)?(?:of\s*|score\s*|:\s*)?(\d)(?:\s*[-–to]+\s*(\d))?", re.IGNORECASE)
KPS_PAT = re.compile(r"(?:karnofsky|kps)\s*(?:performance\s*status\s*|ps\s*)?(?:≥|>=|at\s*least\s*)?\s*(\d{2,3})", re.IGNORECASE)


def parse_ecog(text: str) -> dict[str, int | None] | None:
    m = ECOG_PAT.search(text)
    if not m:
        return None
    try:
        a = int(m.group(1))
        b = int(m.group(2)) if m.group(2) else a
        return {"min": min(a, b), "max": max(a, b)}
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Medication extraction — split into inclusion vs exclusion
# ---------------------------------------------------------------------------

def split_inclusion_exclusion(text: str) -> tuple[str, str]:
    """Return (inclusion_block, exclusion_block)."""
    text_lower = text.lower()
    incl_idx = text_lower.find("inclusion")
    excl_idx = text_lower.find("exclusion")

    if excl_idx == -1:
        return text, ""
    if incl_idx == -1 or incl_idx > excl_idx:
        return "", text[excl_idx:]
    return text[incl_idx:excl_idx], text[excl_idx:]


# Negation cues that suggest a drug is prohibited rather than required
EXCLUSION_CUES = re.compile(
    r"\b(no|not|without|cannot|unable|excluded|ineligible|prohibited|contraindicated|must not|should not|forbidden|prior use of|previous (?:treatment|use|therapy) with|history of (?:taking|using))\b",
    re.IGNORECASE,
)

REQUIRED_CUES = re.compile(
    r"\b(required|must be on|currently on|stable (?:dose of|treatment with)|receiving|taking|prescribed)\b",
    re.IGNORECASE,
)


def _split_sentences(text: str) -> list[str]:
    # Cheap sentence splitter; eligibility text is often bullet-y
    parts = re.split(r"(?:\n[-•*]\s*|\n\s*\d+\.\s*|\.\s+|\n\s*\n)", text)
    return [p.strip() for p in parts if p and len(p.strip()) > 2]


def extract_medications(text: str) -> tuple[list[str], list[str]]:
    """Return (required, excluded). We split the text into sentences and check
    whether each drug mention co-occurs with negation or requirement cues."""
    _incl_block, excl_block = split_inclusion_exclusion(text)

    sentences = _split_sentences(text)
    text_lower = text.lower()

    required: set[str] = set()
    excluded: set[str] = set()

    for sent in sentences:
        s_lower = sent.lower()
        is_excl = bool(EXCLUSION_CUES.search(s_lower))
        is_req = bool(REQUIRED_CUES.search(s_lower))
        # Sentence inside the exclusion block is exclusion by default
        in_excl_block = sent.strip() and (sent.strip() in excl_block)

        for drug in DRUGS:
            if drug in s_lower:
                if is_excl or in_excl_block:
                    excluded.add(drug)
                elif is_req:
                    required.add(drug)

        for cls in DRUG_CLASSES:
            if cls in s_lower:
                if is_excl or in_excl_block:
                    excluded.add(cls)
                elif is_req:
                    required.add(cls)

    # Sanity: if a drug appears only in exclusion block, force exclude
    for drug in DRUGS | DRUG_CLASSES:
        if drug in excl_block.lower() and drug not in required:
            excluded.add(drug)

    # Dedup (prefer excluded on conflict — safer for matching)
    required -= excluded

    return sorted(required), sorted(excluded)


# ---------------------------------------------------------------------------
# Performance-status free-text snippet
# ---------------------------------------------------------------------------

PERFORMANCE_KEYWORDS = [
    "ecog", "karnofsky", "kps", "performance status", "activities of daily living",
    "ambulatory", "bedridden",
]


def extract_performance_notes(text: str) -> str | None:
    for sent in _split_sentences(text):
        s_lower = sent.lower()
        if any(kw in s_lower for kw in PERFORMANCE_KEYWORDS):
            return sent[:240]
    return None


# ---------------------------------------------------------------------------
# Free-text inclusion / exclusion bullets (not extracted above)
# ---------------------------------------------------------------------------

def extract_other_criteria(text: str) -> tuple[list[str], list[str]]:
    incl_block, excl_block = split_inclusion_exclusion(text)
    incl_sents = [s for s in _split_sentences(incl_block)]
    excl_sents = [s for s in _split_sentences(excl_block)]
    return incl_sents[:12], excl_sents[:12]


# ---------------------------------------------------------------------------
# Confidence score — heuristic: more fields populated → higher confidence
# ---------------------------------------------------------------------------

def score_confidence(parsed: dict[str, Any]) -> float:
    score = 0.0
    if parsed.get("medications_excluded"):
        score += 0.3
    if parsed.get("lab_thresholds"):
        score += 0.3
    if parsed.get("ecog") is not None:
        score += 0.2
    if parsed.get("other_inclusion") or parsed.get("other_exclusion"):
        score += 0.2
    return min(1.0, score)


# ---------------------------------------------------------------------------
# DB I/O
# ---------------------------------------------------------------------------

def ensure_parsed_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS parsed_eligibility (
      nct_id               TEXT PRIMARY KEY,
      medications_excluded TEXT,
      medications_required TEXT,
      lab_thresholds       TEXT,
      ecog                 TEXT,
      performance_notes    TEXT,
      other_inclusion      TEXT,
      other_exclusion      TEXT,
      source               TEXT NOT NULL,
      confidence           REAL,
      parsed_at            INTEGER NOT NULL,
      parser_version       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_parsed_source ON parsed_eligibility(source);
    """)
    conn.commit()


UPSERT_SQL = """
INSERT OR REPLACE INTO parsed_eligibility
  (nct_id, medications_excluded, medications_required, lab_thresholds, ecog,
   performance_notes, other_inclusion, other_exclusion, source, confidence,
   parsed_at, parser_version)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
"""


def parse_trial(nct_id: str, eligibility_text: str) -> dict[str, Any]:
    text = eligibility_text or ""
    required, excluded = extract_medications(text)
    labs = parse_lab_thresholds(text)
    ecog = parse_ecog(text)
    perf = extract_performance_notes(text)
    incl, excl = extract_other_criteria(text)

    parsed = {
        "medications_required": required,
        "medications_excluded": excluded,
        "lab_thresholds": labs,
        "ecog": ecog,
        "performance_notes": perf,
        "other_inclusion": incl,
        "other_exclusion": excl,
    }
    parsed["_confidence"] = score_confidence(parsed)
    return parsed


def main() -> int:
    project_root = Path(__file__).resolve().parent.parent
    default_trials = project_root / "data" / "trials.db"
    default_parsed = project_root / "data" / "parsed.db"

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--trials-db", type=Path, default=default_trials)
    ap.add_argument("--parsed-db", type=Path, default=default_parsed)
    ap.add_argument("--limit", type=int, default=0, help="0 = all trials")
    ap.add_argument("--condition", type=str, default="", help="substring filter on conditions column")
    ap.add_argument("--resume", action="store_true", help="skip trials already parsed")
    args = ap.parse_args()

    if not args.trials_db.exists():
        print(f"trials db not found: {args.trials_db}", file=sys.stderr)
        return 2

    args.parsed_db.parent.mkdir(parents=True, exist_ok=True)

    src = sqlite3.connect(f"file:{args.trials_db}?mode=ro", uri=True)
    dst = sqlite3.connect(args.parsed_db)
    dst.execute("PRAGMA journal_mode = WAL;")
    dst.execute("PRAGMA synchronous = NORMAL;")
    ensure_parsed_schema(dst)

    sql = "SELECT nct_id, eligibility_criteria FROM trials WHERE eligibility_criteria IS NOT NULL AND eligibility_criteria != ''"
    params: list[Any] = []
    if args.condition:
        sql += " AND conditions LIKE ?"
        params.append(f"%{args.condition}%")
    if args.resume:
        sql += " AND nct_id NOT IN (SELECT nct_id FROM parsed_eligibility)"
    if args.limit > 0:
        sql += f" LIMIT {args.limit}"

    rows = src.execute(sql, params).fetchall()
    total = len(rows)
    if total == 0:
        print("No trials to parse.")
        return 0

    print(f"Parsing {total:,} trials…")
    started = time.time()
    rows_inserted = 0
    rows_batch: list[tuple] = []

    for i, (nct_id, text) in enumerate(rows, 1):
        try:
            parsed = parse_trial(nct_id, text)
        except Exception as e:
            print(f"  [err] {nct_id}: {e}", file=sys.stderr)
            continue

        rows_batch.append((
            nct_id,
            json.dumps(parsed["medications_excluded"]),
            json.dumps(parsed["medications_required"]),
            json.dumps(parsed["lab_thresholds"]),
            json.dumps(parsed["ecog"]) if parsed["ecog"] else None,
            parsed["performance_notes"],
            json.dumps(parsed["other_inclusion"]),
            json.dumps(parsed["other_exclusion"]),
            "rule",
            parsed["_confidence"],
            int(time.time()),
            PARSER_VERSION,
        ))

        if len(rows_batch) >= 500:
            dst.executemany(UPSERT_SQL, rows_batch)
            dst.commit()
            rows_inserted += len(rows_batch)
            rows_batch.clear()

        if i % 2000 == 0:
            elapsed = time.time() - started
            rate = i / elapsed if elapsed > 0 else 0
            print(f"  {i:,}/{total:,}  ({rate:,.0f}/s)")

    if rows_batch:
        dst.executemany(UPSERT_SQL, rows_batch)
        dst.commit()
        rows_inserted += len(rows_batch)

    elapsed = time.time() - started
    print(f"\nDone. {rows_inserted:,} trials parsed in {elapsed:.1f}s ({rows_inserted / elapsed:,.0f}/s)")
    print(f"Output: {args.parsed_db}")

    # Quick summary
    sample = dst.execute("""
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN json_array_length(medications_excluded) > 0 THEN 1 END) as has_meds_excl,
        COUNT(CASE WHEN lab_thresholds != '{}' AND lab_thresholds IS NOT NULL THEN 1 END) as has_labs,
        COUNT(CASE WHEN ecog IS NOT NULL THEN 1 END) as has_ecog,
        AVG(confidence) as avg_conf
      FROM parsed_eligibility
    """).fetchone()
    print(f"\nSummary:")
    print(f"  Total parsed       : {sample[0]:,}")
    print(f"  With excluded meds : {sample[1]:,} ({sample[1] / sample[0] * 100:.1f}%)")
    print(f"  With lab thresholds: {sample[2]:,} ({sample[2] / sample[0] * 100:.1f}%)")
    print(f"  With ECOG          : {sample[3]:,} ({sample[3] / sample[0] * 100:.1f}%)")
    print(f"  Avg confidence     : {sample[4]:.2f}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
