#!/usr/bin/env python3
"""
eval_parser.py — Qualitative evaluation of the rule-based parser.

Samples N random trials, prints raw eligibility text alongside extracted
structure, and saves to a CSV so a human reviewer can spot-check accuracy.

Usage:
    python3 scripts/eval_parser.py                    # 20 random trials
    python3 scripts/eval_parser.py --n 50
    python3 scripts/eval_parser.py --condition diabetes
    python3 scripts/eval_parser.py --only-with-meds   # only trials with excluded meds

Output: data/eval_parser_<timestamp>.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import sqlite3
import sys
import time
from pathlib import Path


def load_sample(
    trials_db: Path,
    parsed_db: Path,
    n: int,
    condition: str | None,
    only_with_meds: bool,
    seed: int,
) -> list[dict]:
    random.seed(seed)

    trials = sqlite3.connect(f"file:{trials_db}?mode=ro", uri=True)
    parsed = sqlite3.connect(f"file:{parsed_db}?mode=ro", uri=True)
    parsed.row_factory = sqlite3.Row

    sql = "SELECT nct_id FROM trials WHERE eligibility_criteria IS NOT NULL AND length(eligibility_criteria) > 200"
    params: list = []
    if condition:
        sql += " AND conditions LIKE ?"
        params.append(f"%{condition}%")

    ids = [r[0] for r in trials.execute(sql, params).fetchall()]
    random.shuffle(ids)

    results: list[dict] = []
    for nct_id in ids:
        if len(results) >= n:
            break

        parsed_row = parsed.execute(
            "SELECT * FROM parsed_eligibility WHERE nct_id = ?", (nct_id,)
        ).fetchone()
        if parsed_row is None:
            continue

        meds = json.loads(parsed_row["medications_excluded"] or "[]")
        labs = json.loads(parsed_row["lab_thresholds"] or "{}")
        ecog = json.loads(parsed_row["ecog"] or "null")

        if only_with_meds and not meds:
            continue

        trial_row = trials.execute(
            "SELECT nct_id, brief_title, eligibility_criteria, phase, conditions FROM trials WHERE nct_id = ?",
            (nct_id,),
        ).fetchone()

        results.append({
            "nct_id": nct_id,
            "title": trial_row[1][:80],
            "phase": trial_row[3] or "NA",
            "conditions": ", ".join(json.loads(trial_row[4] or "[]")[:3]),
            "eligibility_text": trial_row[2][:1200],
            "parsed_meds_excluded": meds,
            "parsed_labs": labs,
            "parsed_ecog": ecog,
            "confidence": parsed_row["confidence"],
        })

    return results


def main() -> int:
    project_root = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--trials-db", type=Path, default=project_root / "data" / "trials.db")
    ap.add_argument("--parsed-db", type=Path, default=project_root / "data" / "parsed.db")
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--condition", type=str, default=None)
    ap.add_argument("--only-with-meds", action="store_true")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    samples = load_sample(
        args.trials_db, args.parsed_db, args.n, args.condition, args.only_with_meds, args.seed
    )

    if not samples:
        print("No samples found. Is the parser data populated?", file=sys.stderr)
        return 2

    # Print to console
    print(f"\nSampled {len(samples)} trials from {args.trials_db.name}\n")
    print("─" * 80)
    for i, s in enumerate(samples, 1):
        print(f"\n[{i}/{len(samples)}] {s['nct_id']} · {s['phase']} · conf={s['confidence']:.2f}")
        print(f"  Title: {s['title']}")
        print(f"  Conditions: {s['conditions']}")
        print(f"  Meds excluded: {s['parsed_meds_excluded'][:6]}{' …' if len(s['parsed_meds_excluded']) > 6 else ''}")
        print(f"  Labs: {dict(list(s['parsed_labs'].items())[:3])}{' …' if len(s['parsed_labs']) > 3 else ''}")
        if s["parsed_ecog"]:
            print(f"  ECOG: {s['parsed_ecog']}")
        print(f"  Eligibility (snip):")
        for line in s["eligibility_text"][:600].split("\n")[:10]:
            if line.strip():
                print(f"    {line.strip()[:100]}")
    print("─" * 80)

    # Save CSV for human review
    out_path = args.out or project_root / "data" / f"eval_parser_{int(time.time())}.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "nct_id", "title", "phase", "conditions", "confidence",
            "parsed_meds_excluded", "parsed_labs", "parsed_ecog",
            "eligibility_text",
            "human_score_meds (1-5)", "human_score_labs (1-5)", "notes",
        ])
        for s in samples:
            w.writerow([
                s["nct_id"], s["title"], s["phase"], s["conditions"], s["confidence"],
                "; ".join(s["parsed_meds_excluded"]),
                json.dumps(s["parsed_labs"]),
                json.dumps(s["parsed_ecog"]),
                s["eligibility_text"],
                "", "", "",
            ])

    # Summary stats
    total_with_meds = sum(1 for s in samples if s["parsed_meds_excluded"])
    total_with_labs = sum(1 for s in samples if s["parsed_labs"])
    total_with_ecog = sum(1 for s in samples if s["parsed_ecog"])
    avg_conf = sum(s["confidence"] for s in samples) / len(samples)

    print("\nSummary")
    print(f"  Sampled        : {len(samples)}")
    print(f"  With excl meds : {total_with_meds} ({total_with_meds / len(samples) * 100:.0f}%)")
    print(f"  With labs      : {total_with_labs} ({total_with_labs / len(samples) * 100:.0f}%)")
    print(f"  With ECOG      : {total_with_ecog} ({total_with_ecog / len(samples) * 100:.0f}%)")
    print(f"  Avg confidence : {avg_conf:.2f}")
    print(f"\nCSV written to : {out_path}")
    print(f"Open in a spreadsheet and score each row 1-5 on extraction accuracy.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
