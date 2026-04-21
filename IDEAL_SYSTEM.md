# CureMatch — Ideal System Architecture

**Project title:** CureMatch — Matching Trials With Large Language Models.
**Scope:** End-to-end pipeline where LLMs do the heavy lifting wherever the task is language-shaped.

This document describes the **ideal system**. Our current implementation is a
principled subset of it — the remaining components are explicit roadmap.

---

## Core design principle

> **LLMs read. Rules decide. Humans verify.**

Every component of CureMatch can be classified into one of those three roles.
LLMs touch language — dense medical prose, patient questions, explanations.
Rules touch decisions — eligibility scoring, exclusion logic, ranking. Humans
(clinicians, trial investigators) own the final call on enrollment.

---

## System layers

```
┌─────────────────────────────────────────────────────────────────┐
│  9. Human-in-the-loop · clinician feedback, active learning     │
├─────────────────────────────────────────────────────────────────┤
│  8. User-facing agents · chat, explainer, query expansion        │
├─────────────────────────────────────────────────────────────────┤
│  7. Deterministic matching engine · per-criterion verdicts       │
├─────────────────────────────────────────────────────────────────┤
│  6. Retrieval layer · vector search + structured filters         │
├─────────────────────────────────────────────────────────────────┤
│  5. Embeddings · trial + criteria vectors                        │
├─────────────────────────────────────────────────────────────────┤
│  4. Fine-tuned domain LLM · eligibility parsing + Q&A            │
├─────────────────────────────────────────────────────────────────┤
│  3. Structured criteria store · parsed JSON per trial            │
├─────────────────────────────────────────────────────────────────┤
│  2. LLM parsing · free-text eligibility → structured fields      │
├─────────────────────────────────────────────────────────────────┤
│  1. Data ingest · ClinicalTrials.gov API → raw corpus            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1 — Data ingestion

**Input:** ClinicalTrials.gov API v2 (free, public, no auth).
**Output:** `trials.db` (SQLite) with 65,081 actively recruiting trials.

| Field | Source | Notes |
|---|---|---|
| `nct_id` | API | Primary key |
| `brief_title`, `official_title` | API | |
| `eligibility_criteria` | API | Free-text prose — the hard part |
| `minimum_age`, `maximum_age` | API | Strings like `"18 Years"` |
| `eligibility_sex` | API | `ALL` / `MALE` / `FEMALE` |
| `conditions` | API | MeSH-tagged array |
| `phase` | API | `PHASE1` / `PHASE2` / ... |
| `enrollment_count`, `status` | API | |
| `locations` | API | Lat/lng per site |
| `arms_interventions` | API | Drugs / procedures |
| `raw_json` | API | Full payload for completeness |

**Refresh cadence:** weekly cron job · incremental update on changed NCT IDs.

---

## Layer 2 — LLM eligibility parsing

**This is where the project's LLM work begins.** Every trial's free-text
`eligibility_criteria` field is processed by an LLM to extract structured
data that the matching engine can reason over.

**Input:** raw eligibility text (hundreds of words, medical prose).
**Output:** structured JSON per trial.

```json
{
  "nct_id": "NCT05243264",
  "inclusion_criteria": {
    "age": { "min": 40, "max": 75, "unit": "years" },
    "sex": "all",
    "conditions_required": ["type 2 diabetes mellitus"],
    "conditions_excluded": ["type 1 diabetes"],
    "medications_required": [],
    "medications_excluded": [
      { "name": "GLP-1 receptor agonist", "class": true, "rxnorm_code": null }
    ],
    "lab_thresholds": {
      "hba1c": { "min": 7.0, "max": 10.5, "unit": "%" },
      "egfr":  { "min": 30,  "max": null, "unit": "mL/min/1.73m²" },
      "bmi":   { "min": 25,  "max": null, "unit": "kg/m²" }
    },
    "performance_status": {
      "scale": "ECOG", "min": 0, "max": 1
    },
    "prior_treatments_excluded": ["current_glp1_ra"],
    "comorbidity_exclusions": ["pancreatitis_history", "severe_gastroparesis"]
  },
  "parse_metadata": {
    "model": "gemma-3-12b-fine-tuned-curematch-v1",
    "version": "parse-v2.0",
    "confidence": 0.91,
    "parsed_at": 1745000000,
    "human_verified": false
  }
}
```

### Pipeline implementation

**Ideal: fine-tuned open-source LLM.**

1. **Base model** — Gemma 3 12B or Llama 3.1 8B (open weights, commercial-safe).
2. **Training data** — 1,000 hand-curated eligibility-text → JSON pairs,
   augmented with 9,000 LLM-generated pairs self-distilled from a frontier
   model (Claude / GPT-4), filtered by regex validity + schema compliance.
3. **Fine-tuning** — LoRA (rank 16) via `mlx-lm` on Apple Silicon or
   `transformers` + `peft` on CUDA. 3 epochs, ~1-2 hours.
4. **Inference** — run offline in batch across all 65,081 trials via
   Ollama or vLLM. Takes ~12 hours on consumer hardware; hours on a GPU.
5. **Output validation** — JSON-schema validation + confidence scoring +
   auto-retry with more context for failed parses.
6. **Versioning** — parse version stored on each row; re-parse only on
   model upgrade or eligibility-text change.

**Current implementation:** rule-based parser (RxNorm dictionary + regex)
covers ~33% of trials with medication exclusions, ~29% with lab thresholds.
Runs in 86 seconds. The LLM pipeline is next — this is the single biggest
future expansion.

---

## Layer 3 — Structured criteria store

**Schema:** `parsed_eligibility` table, co-located with `trials.db`.

Separation matters: `trials.db` is immutable source-of-truth. `parsed.db` is
derived. Allows re-parsing without touching source. Allows multiple parse
versions to co-exist for A/B evaluation.

```sql
CREATE TABLE parsed_eligibility (
  nct_id               TEXT PRIMARY KEY,
  inclusion            JSON,  -- the full structured object above
  exclusion            JSON,
  parse_model          TEXT,  -- which LLM/version produced this
  parse_version        TEXT,
  confidence           REAL,
  human_verified       BOOLEAN,
  human_verified_by    TEXT,
  human_verified_at    INTEGER,
  parsed_at            INTEGER
);
```

---

## Layer 4 — Fine-tuned domain LLM

This is the heart of "Matching Trials With Large Language Models."

### Training objective

Specialize a small LLM (1B–12B parameters) to excel at three tasks:

1. **Eligibility parsing** — free text → structured JSON (layer 2).
2. **Patient-facing Q&A** — grounded conversational answers (layer 8).
3. **Match explanation** — per-trial narrative from verdicts (layer 8).

### Training data

| Dataset | Size | Source |
|---|---|---|
| Eligibility text → JSON pairs | 10,000 | Hand-curated + distilled |
| Patient Q&A grounded in trial context | 5,000 | Auto-generated from parser output |
| Match explanation narratives | 2,000 | Verdict vector → human-written narrative |
| Out-of-context refusal pairs | 1,000 | Synthetic, negative sampling |
| **Total** | **18,000** | |

### Architecture

- **Base:** Llama 3.2 3B or Gemma 3 4B — small enough for local inference
- **Adapter:** LoRA rank 32, alpha 64, target all attention + MLP projections
- **Training:** 3 epochs, cosine LR schedule, 2e-4 base LR
- **Evaluation:** hold-out set + clinician panel review

### Why small? Why fine-tune?

- **Latency** — sub-second chat responses required
- **Cost** — runs on consumer hardware, no API per-token fees
- **Determinism** — pin model version per deployment; reproducible
- **Domain adaptation** — medical prose differs from general text; domain
  FT improves both quality and refusal behavior

### Why not *only* fine-tune?

- **Frontier models are smarter** — for truly open-ended Q&A, a 70B base
  model still outperforms a 3B fine-tune
- **Tradeoff**: we fine-tune a small model for the **bulk** of inference
  (parsing, common Q&A) and call a frontier model (via API) for hard cases

### Current implementation

- **Training data generator:** `scripts/build_training_dataset.py` — writes
  450+ grounded Q&A pairs to `data/training/train.jsonl`
- **Fine-tuning notebook:** `notebooks/finetune_curematch.ipynb` — Colab LoRA
  on Llama 3.2 1B, or local MLX on Apple Silicon
- **Production inference:** base Llama 3.3 70B via Groq (fast, free tier)
- Roadmap: migrate production to fine-tuned local model once quality matches

---

## Layer 5 — Embeddings

Every trial (title + summary + parsed conditions) is encoded to a dense vector.

- **Model:** `BAAI/bge-large-en-v1.5` or similar open-source medical embedder
- **Dimension:** 1024
- **Store:** LanceDB (embedded columnar vector DB)
- **Update:** when a trial's parsed criteria change

---

## Layer 6 — Retrieval layer

Patient profile → relevant trials, in two stages:

1. **Structured pre-filter** (SQL):
   - Age within trial's min/max range
   - Gender compatible with `eligibility_sex`
   - Conditions overlap (MeSH-tagged)
   - Geographic proximity (haversine ≤ searchRadius miles)

2. **Semantic rerank** (vector):
   - Patient profile → embedding
   - Cosine similarity against pre-filtered candidates
   - Top-K passed to layer 7 (scoring)

Retrieval narrows 65,081 trials → top 500 candidates in milliseconds.

---

## Layer 7 — Deterministic matching engine

For each candidate trial, apply rule-based scoring.

### Criteria evaluated

| Criterion | Source | Weight |
|---|---|---|
| Condition | MeSH overlap + LLM-parsed | 35 |
| Medications | RxNorm / LLM-parsed exclusion list | 20 |
| Lab values | LOINC / LLM-parsed thresholds | 15 |
| Age | Structured API field | 12 |
| Proximity | Haversine from patient location | 10 |
| Gender | Structured API field | 8 |
| **Total weight** | | **100** |

### Per-criterion verdicts

```
┌────────────┬─────────────────────────────────────┐
│ match      │ Patient value satisfies criterion   │
│ excluded   │ Patient value disqualifies          │
│ unknown    │ Patient didn't supply data          │
│ not_applic │ Criterion not specified by trial    │
└────────────┴─────────────────────────────────────┘
```

Composite score = weighted average of satisfied criteria.
Trials excluded on condition are dropped before ranking (hard filter).

### Why rules, not LLM, for matching?

- **Determinism** — reproducible, testable, same input → same output forever
- **Auditability** — every match has a visible verdict trail
- **Speed** — 65,081 trials scored in milliseconds
- **Trust** — "the LLM said so" isn't defensible in medical decisions

---

## Layer 8 — User-facing LLM agents

Three agentic touchpoints where an LLM serves the user directly.

### 8a. Conversational profile intake (agentic)

Replace rigid multi-step form with a chat agent that builds the profile
via **tool calls**:

- User: *"I'm 58, type 2 diabetes, on metformin. HbA1c was 8.2 last week."*
- Agent: `set_age(58)`, `add_condition("Type 2 Diabetes")`, `add_medication("Metformin")`, `set_lab("hba1c", 8.2)`
- Agent: *"Got it. Any recent kidney function results? eGFR or creatinine?"*

This is real tool-using agency: the LLM plans what to extract, uses tools,
asks for missing data, submits when complete.

### 8b. Per-trial chat agent (grounded RAG)

On every trial's detail page, a floating chat panel answers patient
questions about that specific trial:

- Context: the trial's full eligibility text
- Refusal: out-of-context questions → "The trial's public information doesn't specify that."
- No hallucination: answers must be verifiable against the retrieved context

### 8c. Match explainer (structured → narrative)

Takes the matching engine's verdict vector and writes a 2-sentence
plain-English explanation:

> *"You match this trial on age, gender, and primary condition. Your Warfarin use is on the trial's exclusion list — the trial excludes patients on current anticoagulants."*

### Why agents, not just templates?

- **Adaptation** — each patient's verdicts are different; templates can't cover the permutations
- **Natural refusal** — trained to decline unknown / out-of-context queries
- **Plain language** — translates ECOG, MeSH, and trial jargon for patients

---

## Layer 9 — Human-in-the-loop feedback

The system improves when clinicians verify parser output.

- **Verification interface** — web form showing eligibility text + LLM-parsed JSON side-by-side, clinician marks accurate/inaccurate + corrects
- **Retraining** — verified pairs feed back into the next fine-tune
- **Confidence calibration** — parses flagged as low-confidence prioritized for human review
- **Adverse-event reporting** — if a matched patient enrolls and discovers a contraindication the parser missed, that case trains the next model

---

## Evaluation

### Parser quality

| Metric | Target | Method |
|---|---|---|
| Medication exclusion F1 | ≥ 0.90 | 200-trial hand-labeled test set |
| Lab threshold extraction F1 | ≥ 0.85 | Same set |
| ECOG range accuracy | ≥ 0.95 | Same set |
| Schema compliance | 100% | JSON schema validation |

### End-to-end match quality

| Metric | Target | Method |
|---|---|---|
| Precision @ top-10 | ≥ 0.80 | Clinician panel scores top matches |
| Recall of known-qualifying trials | ≥ 0.90 | Blind test with pre-enrolled patients |
| Refusal accuracy on OOC questions | ≥ 0.95 | Adversarial Q&A set |
| Time-to-first-match | ≤ 500ms | End-to-end latency from profile submit |

---

## Deployment architecture

```
┌───────────────────────────────────────────────────────┐
│  Patient browser                                       │
│  ├─ Next.js frontend (React + TypeScript)             │
│  ├─ R3F 3D scenes (landing, results globe)            │
│  └─ localStorage for saved trials + session profile   │
└───────────────────────┬───────────────────────────────┘
                        │ HTTPS
┌───────────────────────┴───────────────────────────────┐
│  Next.js API routes (edge + node)                      │
│  ├─ /api/match          → rule engine + retrieval     │
│  ├─ /api/trials/[id]    → SQL + embedding lookup      │
│  ├─ /api/chat/[nctId]   → RAG agent                   │
│  ├─ /api/match/explain  → narrative agent             │
│  └─ /api/conditions     → autocomplete                │
└────┬──────────────────────────────────────┬───────────┘
     │                                       │
┌────┴─────────┐                   ┌─────────┴─────────┐
│  SQLite      │                   │  LLM gateway       │
│  trials.db   │                   │  ├─ Ollama (local) │
│  parsed.db   │                   │  ├─ Groq (cloud)   │
│  embeddings  │                   │  └─ Anthropic (fb) │
└──────────────┘                   └────────────────────┘
```

- **Frontend:** Next.js 14 App Router + TypeScript + Tailwind
- **API:** Next.js serverless routes (could swap to FastAPI for Python-heavy work)
- **DB:** SQLite for prototype; Postgres + pgvector for production scale
- **LLM:** pluggable backend — Ollama local, Groq cloud, or Anthropic frontier
- **Privacy:** patient data never leaves browser for profile; inference calls send only the trial + profile slice needed

---

## Ethics & privacy

- **No accounts, no tracking, no cookies.** Patient profile persists only in
  `sessionStorage` — gone when the tab closes.
- **No logs of patient data.** API routes don't write identifiable queries.
- **Bias awareness.** Trials skew U.S./European/high-income-country. Globe
  visualization surfaces the bias rather than hiding it.
- **Clinician accountability.** The system explicitly says: *"Final
  eligibility is determined by the trial's investigators."* Every match UI
  reinforces this.
- **Not a medical device.** Clearly disclaimed on every page.

---

## Current implementation vs. ideal

| Layer | Ideal | Current | Status |
|---|---|---|---|
| 1. Ingest | ClinicalTrials.gov API v2 | Same — 65,081 trials | ✅ Complete |
| 2. LLM parsing | Fine-tuned 3-12B model, 10k hand-curated pairs | Rule-based parser (RxNorm + regex) | ⚠️ Subset |
| 3. Structured store | Full JSON schema, confidence, human-verified flag | Same schema, rule source only | ✅ Schema-ready |
| 4. Fine-tuned domain LLM | Production-grade LoRA on Llama 3.2 3B | LoRA training notebook + 500 Q&A dataset | ✅ Prototype ready |
| 5. Embeddings | Dense vectors in LanceDB | Not implemented | 🔜 Roadmap |
| 6. Retrieval | Structured pre-filter + semantic rerank | SQL pre-filter only | ⚠️ Subset |
| 7. Matching engine | Weighted rule-based, 6 criteria | Same — 100% implemented | ✅ Complete |
| 8a. Profile intake agent | Tool-using chat agent | Multi-step form | 🔜 Roadmap |
| 8b. Per-trial chat | Grounded RAG with streaming | Implemented — Groq-backed | ✅ Complete |
| 8c. Match explainer | Structured → narrative | Implemented — Groq-backed | ✅ Complete |
| 9. Human-in-the-loop | Clinician verification UI | Not implemented | 🔜 Roadmap |

**What's shipped:** layers 1, 3, 7, 8b, 8c — a functioning end-to-end product
using pragmatic shortcuts (rules instead of LLM parsing) where the shortcut
preserves determinism.

**What's next:** LLM parser (layer 2) — the single highest-impact addition.
Fine-tuned via LoRA, deployed offline, re-parses the full corpus to raise
medication and lab-threshold coverage from ~30% → ~90%.

---

## Why this architecture is right for clinical trial matching

1. **LLMs go where language is.** Parsing prose, answering patient questions,
   narrating matches — these are language tasks. The LLM lives here.

2. **Rules go where decisions are.** Whether a 58-year-old on Warfarin
   qualifies for a trial — this is a rules question with a binary answer
   per criterion. The LLM doesn't belong here.

3. **Humans keep ownership.** The trial's investigators make the enrollment
   call. The system shows a patient what criteria they meet, so they can
   have a productive conversation with a study coordinator.

4. **Transparency is non-negotiable.** Every verdict is visible, every parse
   is versioned, every agent invocation is logged. A reviewer can trace any
   match back to its inputs.

5. **Cost stays at zero.** Free data (ClinicalTrials.gov), free LLM (Groq
   tier or local Ollama), free hosting (Vercel). The entire apparatus runs
   without a revenue model — which is appropriate for a public-health tool.

---

## Thesis-level claim

> *CureMatch demonstrates that matching patients to clinical trials is
> best modeled as a two-layer system: an **LLM layer** that reads
> unstructured medical prose into structured criteria and converses with
> patients in plain English, and a **deterministic layer** that makes
> the actual matching decision from the structured output. The
> separation preserves what LLMs are good at — language — while
> eliminating their weaknesses — nondeterminism and hallucination —
> from the medical decision itself.*

---

**End of ideal-system document.**
