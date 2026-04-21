# CureMatch Eligibility Q&A Dataset

Generated from ClinicalTrials.gov trials + CureMatch's rule-based parser output.

## Stats
- **Total examples:** 500
- **Train:** 450 (90%)
- **Eval:**  50 (10%)
- **Source trials:** 165
- **Seed:** 42

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
