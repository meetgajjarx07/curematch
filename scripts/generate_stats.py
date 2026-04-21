#!/usr/bin/env python3
"""
generate_stats.py — aggregate corpus-wide statistics from trials.db + parsed.db
and write to frontend/public/corpus-stats.json for the About-page dashboard.

Run:
    python3 scripts/generate_stats.py
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
from collections import Counter
from pathlib import Path


def main() -> int:
    project_root = Path(__file__).resolve().parent.parent
    trials_db = project_root / "data" / "trials.db"
    parsed_db = project_root / "data" / "parsed.db"
    out_path = project_root / "frontend" / "public" / "corpus-stats.json"

    if not trials_db.exists():
        print(f"trials.db not found at {trials_db}", file=sys.stderr)
        return 2

    trials = sqlite3.connect(f"file:{trials_db}?mode=ro", uri=True)
    parsed = sqlite3.connect(f"file:{parsed_db}?mode=ro", uri=True) if parsed_db.exists() else None

    out: dict[str, object] = {}

    # ─── Overall totals ───────────────────────────────────────
    total_trials = trials.execute("SELECT COUNT(*) FROM trials").fetchone()[0]
    total_locations = trials.execute("SELECT COUNT(*) FROM locations").fetchone()[0]
    total_interventions = trials.execute("SELECT COUNT(*) FROM arms_interventions").fetchone()[0]
    total_countries = trials.execute(
        "SELECT COUNT(DISTINCT country) FROM locations WHERE country IS NOT NULL"
    ).fetchone()[0]

    out["totals"] = {
        "trials": total_trials,
        "locations": total_locations,
        "interventions": total_interventions,
        "countries": total_countries,
    }

    # ─── Phase distribution ──────────────────────────────────
    rows = trials.execute(
        """SELECT phase, COUNT(*) as c FROM trials
           GROUP BY phase ORDER BY c DESC"""
    ).fetchall()

    phase_counts: Counter[str] = Counter()
    for phase, count in rows:
        clean = (phase or "").strip()
        if not clean:
            phase_counts["Not specified"] += count
            continue
        # Normalize: PHASE1, PHASE2, NA, "PHASE1, PHASE2" → clean labels
        tokens = [t.strip() for t in clean.split(",")]
        if "NA" in tokens and len(tokens) == 1:
            phase_counts["Not specified"] += count
        elif any("1" in t and "EARLY" in t for t in tokens):
            phase_counts["Early Phase 1"] += count
        elif len(tokens) > 1:
            # Multi-phase trial (e.g. "PHASE1, PHASE2") — assign to its own slot
            joined = " / ".join(
                "Phase " + t.replace("PHASE", "").strip()
                for t in tokens
                if t.strip() not in ("NA",)
            )
            phase_counts[joined] += count
        else:
            t = tokens[0]
            if t.startswith("PHASE"):
                phase_counts[f"Phase {t.replace('PHASE', '').strip()}"] += count
            else:
                phase_counts["Not specified"] += count

    # Fold tiny buckets into "Other"
    top_phases = phase_counts.most_common(6)
    consumed = sum(c for _, c in top_phases)
    remainder = total_trials - consumed
    out["phase_distribution"] = [
        {"name": name, "count": count, "pct": round(count / total_trials * 100, 1)}
        for name, count in top_phases
    ]
    if remainder > 0:
        out["phase_distribution"].append(
            {"name": "Other", "count": remainder, "pct": round(remainder / total_trials * 100, 1)}
        )

    # ─── Top conditions (parsed from JSON arrays) ────────────
    condition_counts: Counter[str] = Counter()
    cur = trials.execute(
        "SELECT conditions FROM trials WHERE conditions IS NOT NULL AND conditions != '[]'"
    )
    for (cond_json,) in cur:
        try:
            arr = json.loads(cond_json)
            for c in arr:
                if isinstance(c, str) and c.strip():
                    condition_counts[c.strip()] += 1
        except (json.JSONDecodeError, TypeError):
            continue

    out["top_conditions"] = [
        {"name": name, "count": count}
        for name, count in condition_counts.most_common(12)
    ]

    # ─── Top countries ───────────────────────────────────────
    rows = trials.execute(
        """SELECT country, COUNT(*) as c
           FROM locations
           WHERE country IS NOT NULL AND country != ''
           GROUP BY country ORDER BY c DESC LIMIT 10"""
    ).fetchall()
    out["top_countries"] = [
        {"name": country, "count": count} for country, count in rows
    ]

    # ─── Parser coverage (from parsed.db) ────────────────────
    if parsed is not None:
        parsed_total = parsed.execute(
            "SELECT COUNT(*) FROM parsed_eligibility"
        ).fetchone()[0]
        with_meds = parsed.execute(
            "SELECT COUNT(*) FROM parsed_eligibility WHERE json_array_length(medications_excluded) > 0"
        ).fetchone()[0]
        with_labs = parsed.execute(
            "SELECT COUNT(*) FROM parsed_eligibility WHERE lab_thresholds != '{}' AND lab_thresholds IS NOT NULL"
        ).fetchone()[0]
        with_ecog = parsed.execute(
            "SELECT COUNT(*) FROM parsed_eligibility WHERE ecog IS NOT NULL"
        ).fetchone()[0]

        out["parser_coverage"] = {
            "parsed_total": parsed_total,
            "medications_excluded": {
                "count": with_meds,
                "pct": round(with_meds / parsed_total * 100, 1) if parsed_total else 0,
            },
            "lab_thresholds": {
                "count": with_labs,
                "pct": round(with_labs / parsed_total * 100, 1) if parsed_total else 0,
            },
            "ecog": {
                "count": with_ecog,
                "pct": round(with_ecog / parsed_total * 100, 1) if parsed_total else 0,
            },
        }

        # Most-excluded medications / classes
        med_counts: Counter[str] = Counter()
        cur = parsed.execute(
            "SELECT medications_excluded FROM parsed_eligibility WHERE json_array_length(medications_excluded) > 0"
        )
        for (meds_json,) in cur:
            try:
                arr = json.loads(meds_json)
                for m in arr:
                    if isinstance(m, str) and m.strip():
                        med_counts[m.strip().lower()] += 1
            except (json.JSONDecodeError, TypeError):
                continue

        out["top_excluded_meds"] = [
            {"name": name.title(), "count": count}
            for name, count in med_counts.most_common(12)
        ]

        # Most common lab thresholds
        lab_counts: Counter[str] = Counter()
        cur = parsed.execute(
            "SELECT lab_thresholds FROM parsed_eligibility WHERE lab_thresholds != '{}' AND lab_thresholds IS NOT NULL"
        )
        for (labs_json,) in cur:
            try:
                d = json.loads(labs_json)
                if isinstance(d, dict):
                    for k in d.keys():
                        lab_counts[k] += 1
            except (json.JSONDecodeError, TypeError):
                continue

        LAB_DISPLAY = {
            "hba1c": "HbA1c",
            "egfr": "eGFR",
            "creatinine": "Creatinine",
            "alt": "ALT",
            "ast": "AST",
            "hemoglobin": "Hemoglobin",
            "platelet": "Platelets",
            "wbc": "WBC",
            "anc": "ANC",
            "ldl": "LDL",
            "ef": "LVEF",
            "bmi": "BMI",
            "mmse": "MMSE",
            "bp_systolic": "Systolic BP",
            "bp_diastolic": "Diastolic BP",
            "bilirubin": "Bilirubin",
            "nt_probnp": "NT-proBNP",
        }

        out["top_lab_thresholds"] = [
            {"name": LAB_DISPLAY.get(k, k), "count": count}
            for k, count in lab_counts.most_common(10)
        ]

    # ─── Metadata ────────────────────────────────────────────
    import time
    out["generated_at"] = int(time.time())
    out["parser_version"] = "rule-v1.0.0"

    # ─── Write ───────────────────────────────────────────────
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2))

    print(f"✅ Wrote {out_path}")
    print(f"   Total trials       : {total_trials:,}")
    print(f"   Countries          : {total_countries}")
    print(f"   Phase buckets      : {len(out['phase_distribution'])}")
    print(f"   Top conditions     : {len(out['top_conditions'])}")
    if parsed:
        cov = out['parser_coverage']
        print(f"   Parser coverage    : meds={cov['medications_excluded']['pct']}% labs={cov['lab_thresholds']['pct']}% ecog={cov['ecog']['pct']}%")
        print(f"   Top excluded meds  : {len(out['top_excluded_meds'])}")
        print(f"   Top lab thresholds : {len(out['top_lab_thresholds'])}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
