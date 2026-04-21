# How CureMatch actually works

A walkthrough of what happens when a patient uses your system — what's an LLM,
what's rules, what's data. Use this as a presentation-ready technical narrative.

---

## The one-paragraph version

> CureMatch turns 65,081 clinical trials — each published as a wall of dense
> medical prose on ClinicalTrials.gov — into structured records that a patient
> profile can be compared against. A rule-based parser reads every trial's
> eligibility text and extracts medications, lab thresholds, and performance
> status into a structured database. When a patient enters their profile, a
> deterministic scoring engine compares them against every parsed trial and
> returns ranked matches with per-criterion verdicts. An LLM — running at the
> user interface — answers patient questions about each trial using only that
> trial's published text, and narrates match results in plain English. The
> LLM never touches the matching decision; that stays deterministic.

---

## The six moments — a user's journey

### ① Profile intake — `/match`

**What the user does:**
Fills a 5-step form (or clicks a demo preset): age · gender · conditions ·
medications · lab values · location.

**What happens behind the scenes:**
- **Condition autocomplete** hits `GET /api/conditions/search?q=diabetes`.
  The API queries the real `trials.db`, returns ranked results:
  *"Type 2 Diabetes — 258 trials · Diabetes Mellitus, Type 2 — 184 trials."*
  The autocomplete suggests what's actually in the corpus.
- **Location** is geocoded via OpenStreetMap Nominatim → lat/lng stored
  in the profile for proximity scoring.
- Profile saved to `sessionStorage` — stays in the browser, never leaves.

**LLM involvement:** none yet.

---

### ② Match submit — `POST /api/match`

**Input:** the patient profile (age, gender, conditions, meds, labs, lat/lng).

**What the engine does:**

1. **SQL pre-filter** on `trials.db` — narrows 65,081 trials to candidates
   whose distinctive condition words appear in the trial's `conditions`
   field. For a diabetes patient: ~1,572 candidates. For Alzheimer's: ~512.
   Milliseconds.
2. **Gender pre-filter** — drops trials whose `eligibility_sex` is incompatible.
3. **Bulk-load parsed data** — SELECT all rows from `parsed.db` for those
   candidate NCT IDs in one query.
4. **Score each candidate** — the scoring engine runs six checks per trial:
   - **Age**: parse trial's `minimum_age` / `maximum_age`. In range? → match / excluded.
   - **Gender**: trial sex vs patient gender.
   - **Condition**: distinctive-word overlap (filters out generic words like "disease" to avoid false positives).
   - **Medications**: patient's drugs vs `parsed.medications_excluded` list. Uses a drug-class map so **Warfarin matches "anticoagulants"**. Any hit → `excluded`.
   - **Lab thresholds**: patient's lab values vs `parsed.lab_thresholds`. HbA1c 6.2 < trial's required ≥ 7.5 → `excluded`.
   - **Proximity**: haversine distance from patient location to nearest trial site. Within `searchRadius` → match.
5. **Weighted composite score** — condition 35% · medications 20% · labs 15% · age 12% · proximity 10% · gender 8%.
6. **Drop hard exclusions** — any trial excluded on condition is dropped
   entirely (we don't surface a prostate cancer trial to a breast cancer patient).
7. **Sort + return top 150** ranked by score.

**LLM involvement:** none. Matching is 100% deterministic.

---

### ③ Results — `/results`

**What the user sees:**
- **3D globe** with pulsing dots for every site in their top matches
- **Header**: *"147 trials, mapped to your profile. Screened against 65,081
  actively recruiting studies."*
- **Ranked list** with trial cards — each showing phase badge, title,
  sponsor, match score (color-coded), criterion dots (green/yellow/red).
- **Filters**: condition category, phase, min score, max distance. Real-time
  client-side filtering of the returned set.
- **Search bar**: free-text across title / sponsor / NCT ID / conditions.

**LLM involvement:** none yet.

---

### ④ Trial detail — `/trial/NCT06147323`

**What happens on navigation:**

`GET /api/trials/NCT06147323?profile=...` runs:

1. **Fetch** trial row from `trials.db` (title, eligibility text, phase).
2. **Fetch locations** for this trial.
3. **Fetch interventions** from `arms_interventions`.
4. **Fetch parsed data** from `parsed.db`.
5. **Re-score** against the patient's profile → fresh per-criterion verdicts
   with real values substituted in: *"You (HbA1c 6.2) → Required (≥ 7.5) — excluded."*
6. Return everything as JSON.

**What the user sees:**
- 3D molecule + score orb hero
- Full match breakdown card: every criterion as a row — criterion name, your
  value, trial requirement, verdict icon (✅❌⚠️)
- **"Explain this match in plain English"** button → click it, see ⑤
- **"Structured criteria"** section showing what the parser extracted from
  the free text: excluded medications list, lab threshold table, ECOG range
- Full eligibility criteria parsed into "Inclusion" and "Exclusion" cards
- Interventions list, locations list, contact info
- Floating **"Ask about this trial"** button bottom-right → click it, see ⑥

**LLM involvement:** none yet — only when the user clicks ⑤ or ⑥.

---

### ⑤ Match explainer — `POST /api/match/explain` — *LLM*

**Trigger:** user clicks "Explain this match in plain English."

**What the backend does:**
1. Re-score the trial against the patient profile → fresh criteria verdicts.
2. Serialize verdicts into a compact string:
   ```
   - Age: reader=58 years | required=40–75 | verdict=match
   - Medications: reader=Warfarin | required=Excludes anticoagulant | verdict=excluded
   - HbA1c: reader=8.2% | required=7.0–10.5% | verdict=match
   ...
   ```
3. Send to Groq with a carefully-engineered system prompt:
   > *"You are the CureMatch explainer. Given verdicts, write ONE paragraph, 2–3 sentences, ≤ 80 words. Lead with the strongest positive. If there are exclusions, name them specifically. Close factually — no hype."*
4. Groq (Llama 3.3 70B, ~500 tokens/sec) streams the response back.

**What the user sees:**
> *"You match on age, condition, and HbA1c — the trial accepts patients
> 40–75 with type 2 diabetes and HbA1c in range, which you meet. Your
> Warfarin use is on the trial's exclusion list; the protocol requires
> no current anticoagulant therapy."*

**LLM involvement:** yes — narrative synthesis only. Verdicts are computed
deterministically beforehand; the LLM cannot change them.

---

### ⑥ Per-trial chat — `POST /api/chat/[nctId]` — *LLM agent*

**Trigger:** user opens the chat panel and asks a question.

**What the backend does:**
1. Load the trial's `eligibility_criteria` from `trials.db`.
2. Construct a grounded system prompt:
   > *"You are CureMatch's clinical trial assistant. Answer ONLY using the
   > information below. If the trial text doesn't say something, respond:
   > 'The trial's public information doesn't specify that.' Never invent
   > eligibility rules. Keep responses ≤ 150 words."*
   > Followed by: full eligibility text + optional patient profile.
3. Append the user's question to the conversation history.
4. Stream from Groq.

**What makes it agentic:**
- The agent **autonomously decides** whether a question is in scope.
  Ask "what's the weather in Tokyo?" → it refuses using the trial's own
  published-text standard.
- The agent **maintains conversation state** across turns — follow-up
  questions reference prior answers.
- The agent **grounds strictly in retrieved context** — zero hallucination
  is the design goal.

**What the user sees:** a streaming text response in a chat bubble, with a
provider badge showing *"groq · llama-3.3-70b-versatile"*.

**LLM involvement:** yes — this is the primary user-facing LLM touchpoint.

---

## The three LLM touchpoints — summarized

| Where | What it does | Why only an LLM can |
|---|---|---|
| **Match explainer** (⑤) | Narrates verdicts in plain English | Language synthesis, can't be rule-based |
| **Per-trial chat** (⑥) | Answers patient questions about a trial | Conversational, grounded, refusal-aware |
| **Future: parser** | Extracts structured criteria from prose | Compound criteria, negation, paraphrase |

---

## What's deterministic (no LLM)

- Data ingestion (ClinicalTrials.gov API)
- Eligibility parsing (rule-based: RxNorm dictionary + regex)
- Candidate pre-filter (SQL)
- Per-criterion verdicts (rule-based scoring)
- Weighted composite score
- Ranking
- UI rendering

---

## The data flow, as a sentence chain

> **Patient profile** → SQL pre-filter on `trials.db` → candidate set → bulk
> load `parsed.db` rows → `scoreTrial()` per candidate → per-criterion
> verdicts + composite score → sort + slice → send to frontend → render
> ranked list → patient clicks a trial → re-score against profile → render
> match breakdown → patient clicks "Explain" → LLM narrates verdicts →
> patient asks a question → LLM answers grounded in that trial's text.

---

## When someone asks "where's the LLM?"

Point at **three places in the running app**:

1. Open `/trial/[id]` — click **"Explain this match in plain English."**
   → *"This narrative is an LLM writing in real-time, using deterministic
   verdicts as input."*

2. Same page — click **"Ask about this trial."** → *"This is the LLM chat
   agent. Watch —"* (ask an in-context question, then an out-of-context one
   to show refusal behavior).

3. Open `/data` — *"The LLM is also the future expansion of this orange
   parser-coverage bar. Our current parser is rule-based and covers 33% of
   trials. Replacing it with the fine-tuned LLM we've trained is the single
   highest-impact next step."*

---

## The sentence that sells it

> *"We use LLMs where only an LLM can succeed — reading prose and answering
> patient questions in natural language. We use rules where rules must win —
> medical matching decisions that have to be deterministic, auditable, and
> reproducible. That separation is the entire product."*

Rehearse that sentence. Say it in the closing.
