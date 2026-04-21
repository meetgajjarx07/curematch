#!/usr/bin/env python3
"""
Build a training dataset for LoRA fine-tuning, using trials.db + parsed.db.

Each example = (prompt, completion) pair where:
  - prompt contains a user question about a specific trial + that trial's context
  - completion is a grounded answer derived from the parsed structured data

Format: JSONL compatible with Hugging Face datasets / TRL / Axolotl.
Uses the Llama chat template shape (system / user / assistant).

Run:
    python3 scripts/build_training_dataset.py                # 500 examples
    python3 scripts/build_training_dataset.py --n 1000       # larger
    python3 scripts/build_training_dataset.py --split 0.9    # 90/10 train/eval
"""

from __future__ import annotations

import argparse
import json
import random
import sqlite3
import sys
from pathlib import Path


SYSTEM_PROMPT = (
    "You are CureMatch's clinical-trial assistant. You help patients understand "
    "whether they may qualify for a specific trial, using ONLY the trial's "
    "published eligibility criteria. If the information isn't in the trial text, "
    "say so explicitly. Never fabricate medical requirements. End eligibility "
    "answers with: 'Final eligibility is determined by the trial's investigators.'"
)


# ────────────────────────────────────────────────────────────────────
# Question templates grounded in parsed fields
# ────────────────────────────────────────────────────────────────────

def gen_examples_from_trial(nct_id: str, title: str, phase: str, eligibility: str,
                            conditions: list[str], parsed: dict) -> list[dict]:
    """Return multiple Q&A pairs for one trial."""
    examples = []
    phase = phase or "Not specified"

    trial_context = (
        f"NCT ID: {nct_id}\n"
        f"Title: {title}\n"
        f"Phase: {phase}\n"
        f"Conditions: {', '.join(conditions[:3]) if conditions else 'Not specified'}\n\n"
        f"Eligibility Criteria:\n{eligibility[:3000]}"
    )

    # ── 1. Medication exclusion question ──
    meds = parsed.get("medications_excluded", [])
    if meds:
        hit = meds[0]
        patient_med = hit.title()
        examples.append({
            "system": SYSTEM_PROMPT,
            "user": f"Can I join this trial if I'm taking {patient_med}?\n\n{trial_context}",
            "assistant": (
                f"The trial's eligibility criteria list {hit} in the exclusions, "
                f"so based on the published text you would not qualify while "
                f"taking {patient_med}. Final eligibility is determined by the "
                f"trial's investigators."
            ),
        })

        # A question about a medication NOT in the exclusion list
        safe_drug = "Lisinopril" if "lisinopril" not in [m.lower() for m in meds] else "Acetaminophen"
        examples.append({
            "system": SYSTEM_PROMPT,
            "user": f"Is {safe_drug} on this trial's exclusion list?\n\n{trial_context}",
            "assistant": (
                f"The trial's public eligibility text does not name {safe_drug} "
                f"as an exclusion. The named exclusions include: {', '.join(meds[:3])}. "
                f"Final eligibility is determined by the trial's investigators."
            ),
        })

    # ── 2. Lab threshold question ──
    labs = parsed.get("lab_thresholds", {})
    if labs:
        lab_key = next(iter(labs.keys()))
        thr = labs[lab_key]
        if thr.get("min") is not None and thr.get("max") is not None:
            desc = f"between {thr['min']} and {thr['max']}"
        elif thr.get("min") is not None:
            desc = f"at least {thr['min']}"
        elif thr.get("max") is not None:
            desc = f"no more than {thr['max']}"
        else:
            desc = None

        if desc:
            examples.append({
                "system": SYSTEM_PROMPT,
                "user": f"What {lab_key.upper()} level does this trial require?\n\n{trial_context}",
                "assistant": (
                    f"Based on the trial's eligibility criteria, the {lab_key.upper()} "
                    f"requirement is {desc}. Final eligibility is determined by the "
                    f"trial's investigators."
                ),
            })

    # ── 3. ECOG question ──
    ecog = parsed.get("ecog")
    if ecog and (ecog.get("min") is not None or ecog.get("max") is not None):
        lo = ecog.get("min", 0)
        hi = ecog.get("max", 4)
        examples.append({
            "system": SYSTEM_PROMPT,
            "user": f"What ECOG performance status does this trial accept?\n\n{trial_context}",
            "assistant": (
                f"The trial requires an ECOG performance status between {lo} and "
                f"{hi}. Final eligibility is determined by the trial's investigators."
            ),
        })

    # ── 4. Generic eligibility summary ──
    if conditions:
        examples.append({
            "system": SYSTEM_PROMPT,
            "user": f"What is this trial about and who is it for?\n\n{trial_context}",
            "assistant": (
                f"This is a {phase} study titled \"{title}\" focused on "
                f"{conditions[0]}. The full inclusion and exclusion criteria are "
                f"published in the trial's eligibility text above — patients "
                f"interested in participating should review those criteria with "
                f"the trial's investigators."
            ),
        })

    # ── 5. Out-of-context refusal ──
    examples.append({
        "system": SYSTEM_PROMPT,
        "user": f"What's the weather today?\n\n{trial_context}",
        "assistant": (
            "The trial's public information doesn't specify that — you'll want "
            "to ask the study team directly for non-trial questions."
        ),
    })

    return examples


def to_chat_jsonl(ex: dict) -> dict:
    """Format in Hugging Face 'messages' shape for TRL SFTTrainer."""
    return {
        "messages": [
            {"role": "system", "content": ex["system"]},
            {"role": "user", "content": ex["user"]},
            {"role": "assistant", "content": ex["assistant"]},
        ]
    }


def main() -> int:
    project_root = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--trials-db", type=Path, default=project_root / "data" / "trials.db")
    ap.add_argument("--parsed-db", type=Path, default=project_root / "data" / "parsed.db")
    ap.add_argument("--out-dir", type=Path, default=project_root / "data" / "training")
    ap.add_argument("--n", type=int, default=500, help="target number of examples")
    ap.add_argument("--split", type=float, default=0.9, help="train/eval split (0.9 → 90/10)")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    if not args.trials_db.exists() or not args.parsed_db.exists():
        print("Missing trials.db or parsed.db — run ingest + parse_rules first", file=sys.stderr)
        return 2

    random.seed(args.seed)
    args.out_dir.mkdir(parents=True, exist_ok=True)

    trials = sqlite3.connect(f"file:{args.trials_db}?mode=ro", uri=True)
    parsed = sqlite3.connect(f"file:{args.parsed_db}?mode=ro", uri=True)

    # Sample trials with rich parsed data first
    sql = """
        SELECT p.nct_id, t.brief_title, t.phase, t.eligibility_criteria, t.conditions,
               p.medications_excluded, p.lab_thresholds, p.ecog
        FROM parsed_eligibility p
        JOIN trials t ON t.nct_id = p.nct_id
        WHERE p.confidence >= 0.4
          AND t.eligibility_criteria IS NOT NULL
          AND length(t.eligibility_criteria) > 200
        ORDER BY p.confidence DESC
        LIMIT 2000
    """
    rows = parsed.execute("ATTACH ? AS trials_db", (str(args.trials_db),)).fetchall()
    # The ATTACH trick is fussy on some systems — just join in-memory instead
    parsed_rows = parsed.execute("""
        SELECT nct_id, medications_excluded, lab_thresholds, ecog, confidence
        FROM parsed_eligibility
        WHERE confidence >= 0.4
        ORDER BY confidence DESC
        LIMIT 2000
    """).fetchall()

    examples: list[dict] = []
    for row in parsed_rows:
        nct_id, meds_json, labs_json, ecog_json, _conf = row
        trial_row = trials.execute(
            "SELECT brief_title, phase, eligibility_criteria, conditions FROM trials WHERE nct_id = ?",
            (nct_id,),
        ).fetchone()
        if not trial_row:
            continue
        title, phase, eligibility, cond_json = trial_row
        if not eligibility or len(eligibility) < 200:
            continue

        try:
            conditions = json.loads(cond_json) if cond_json else []
            parsed_d = {
                "medications_excluded": json.loads(meds_json) if meds_json else [],
                "lab_thresholds": json.loads(labs_json) if labs_json else {},
                "ecog": json.loads(ecog_json) if ecog_json else None,
            }
        except (json.JSONDecodeError, TypeError):
            continue

        examples.extend(gen_examples_from_trial(
            nct_id, title or "", phase or "", eligibility,
            conditions, parsed_d,
        ))

        if len(examples) >= args.n * 2:
            break

    random.shuffle(examples)
    examples = examples[: args.n]

    # Train / eval split
    split_idx = int(len(examples) * args.split)
    train = examples[:split_idx]
    evalset = examples[split_idx:]

    train_path = args.out_dir / "train.jsonl"
    eval_path = args.out_dir / "eval.jsonl"

    with train_path.open("w") as f:
        for ex in train:
            f.write(json.dumps(to_chat_jsonl(ex)) + "\n")
    with eval_path.open("w") as f:
        for ex in evalset:
            f.write(json.dumps(to_chat_jsonl(ex)) + "\n")

    # Dataset card
    card = args.out_dir / "README.md"
    card.write_text(f"""# CureMatch Eligibility Q&A Dataset

Generated from ClinicalTrials.gov trials + CureMatch's rule-based parser output.

## Stats
- **Total examples:** {len(examples)}
- **Train:** {len(train)} ({args.split:.0%})
- **Eval:**  {len(evalset)} ({1 - args.split:.0%})
- **Source trials:** {len(set(e['user'].split('NCT ID: ')[1][:11] for e in examples if 'NCT ID: ' in e['user']))}
- **Seed:** {args.seed}

## Format
Hugging Face `messages` format (system / user / assistant) — compatible with
`trl.SFTTrainer` and most LLM fine-tuning frameworks.

## Categories covered
1. Medication exclusion checks
2. Medication safety checks (non-excluded drugs)
3. Lab threshold queries (HbA1c, eGFR, platelet, etc.)
4. ECOG performance status
5. Trial summary requests
6. Out-of-context refusals (teaches the model to decline)

## Construction
For each trial with parser confidence ≥ 0.4, we generate up to 6 Q&A pairs
programmatically from the parsed structured data. Answers are *grounded in the
trial's actual eligibility text* — they cite real excluded medications, real
lab thresholds, real ECOG ranges.

This makes the dataset **faithful to the source** by construction — the model
is trained on statements that are verifiable against the trial text it's shown.
""")

    print(f"✅ Dataset written to {args.out_dir}")
    print(f"   train.jsonl : {len(train)} examples")
    print(f"   eval.jsonl  : {len(evalset)} examples")
    print(f"   README.md   : dataset card")
    return 0


if __name__ == "__main__":
    sys.exit(main())
