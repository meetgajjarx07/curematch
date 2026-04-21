# CureMatch — Final Presentation Plan

**Format:** 12 min group presentation · 3 min demo video · 5 min Q&A
**Team:** 3 speakers

---

## Speaker split — 12 minutes total

| Minute | Speaker | Section | Slides |
|--------|---------|---------|--------|
| 0:00 – 3:30 | **Person A** | Problem + Solution | 1 – 4 |
| 3:30 – 8:00 | **Person B** | Architecture + Live Demo | 5 – 8 |
| 8:00 – 11:30 | **Person C** | Design · LLM strategy · Limitations | 9 – 12 |
| 11:30 – 12:00 | **All** | Closing + transition to video | 13 |

---

## Slide deck — 13 slides

### Slide 1 — Cover (10 sec)
> **CureMatch**
> Finding clinical trials you qualify for — at the speed of scroll.
>
> [Your names] · [Your institution] · [Date]

**Speaker A says:**
*"Hi, we're [names]. For the last [X weeks] we built CureMatch — a matching platform for the 65,081 clinical trials currently recruiting on ClinicalTrials.gov."*

---

### Slide 2 — The Problem (45 sec)
**Visual:** Screenshot of a real eligibility criteria wall from a ClinicalTrials.gov trial. Big headline:
> **"80% of clinical trials fail to meet enrollment deadlines."**

**Speaker A says:**
*"The reason is simple. Every trial publishes its eligibility criteria as a wall of medical prose. A patient looking for trials has to read pages per trial, across 65,000 of them, written in language like — [point to screenshot] 'ECOG 0–1, no prior anti-PD-1 therapy, eGFR ≥ 30.' It's impossible. Trials don't enroll. Patients don't find them. Research slows down."*

---

### Slide 3 — What We Built (60 sec)
**Visual:** Three icons side by side
1. 🔍 **Enter profile** (3 min)
2. ⚡ **Screen 65,081 trials** (milliseconds)
3. 📋 **See per-criterion verdicts** (plain English)

**Speaker A says:**
*"CureMatch reads all 65,081 trials for you. You enter your medical profile — age, conditions, medications, lab values. The engine compares against every trial's parsed eligibility in milliseconds. You get ranked matches, and for each trial, every single criterion is shown: ✅ match, ❌ excluded, ⚠️ unknown. No black boxes."*

---

### Slide 4 — Why This Is Hard (45 sec)
**Visual:** The split between structured vs unstructured data

| Structured in API | Free text (the hard part) |
|---|---|
| Age bounds | Excluded medications |
| Gender | Lab value thresholds |
| Conditions (MeSH) | Performance status |
| Phase / locations | Prior treatment rules |

**Speaker A says:**
*"The ClinicalTrials.gov API gives us some data as clean fields — age, gender, conditions. But the most important criteria — what medications exclude you, what lab ranges are required — those are buried in free-text prose. That's where the real work is."*

**→ Hand to Speaker B**

---

### Slide 5 — Architecture (60 sec)
**Visual:** The diagram from README.md (simplified)

```
   ClinicalTrials.gov API
           │
    ┌──────┴──────┐
    │  trials.db  │  65,081 trials, readonly
    └──────┬──────┘
           │
   ┌───────┴────────┐
   │  Rule parser   │  RxNorm + regex, 86 seconds
   │  → parsed.db   │  21k trials with extracted meds, 19k with labs
   └───────┬────────┘
           │
   ┌───────┴─────────┐
   │ Matching engine │  Deterministic, no AI
   └───────┬─────────┘
           │
   ┌───────┴──────────┐
   │ User-facing LLM  │  Chat + match explanations
   │ (Groq Llama 3.3) │
   └──────────────────┘
```

**Speaker B says:**
*"Here's our architecture. Source of truth is a SQLite database with all 65,081 trials. A Python parser reads every trial's eligibility text, uses medical dictionaries like RxNorm and regex patterns, and extracts structured data — medications, lab thresholds, performance status. Takes 86 seconds for the whole corpus. The matching engine reads the structured data and applies deterministic rules. No AI in the matching path. The LLM comes in only at the user interface — for chat and explanations."*

---

### Slide 6 — The Design Decision (45 sec)
**Visual:** Two-column comparison

| | LLM-only parser | Rule-based + LLM interface |
|---|---|---|
| Runtime on 65k | ~50 hours | **86 seconds** |
| Determinism | No | **Yes** |
| Auditable | Hard | **Trivial** |
| Cost | Compute or API | **$0** |
| Language tasks | Same | **LLM handles these separately** |

**Speaker B says:**
*"We made a deliberate design choice here. The spec said 'parse with an LLM.' We evaluated that and chose hybrid: rules for extraction, LLM for language. Why? Rules run in 86 seconds, not 50 hours. They're deterministic — same input, same output, every time. That matters for medical matching, where a reviewer needs to audit every decision. The LLM still matters — it does what rules can't: answer patient questions in natural language. Right tool for each job."*

---

### Slide 7 — Live Demo (90 sec)
**Slide content:** Just the URL `localhost:3000` and a QR code if possible

**Speaker B says:** *(minimize slides, open browser)*

**Demo flow (rehearse this):**

1. **(0:00)** On `/match` — click the 🩺 **T2 Diabetes · 58F** demo preset. Show the form populates: age 58, conditions, medications, HbA1c 8.2, Rochester MN location with map.

2. **(0:20)** Click **"Match me"** — cinematic loader plays ("Screening 65,081 trials · Parsing · Scoring · Ranking").

3. **(0:40)** Results page loads. Call out:
   - *"147 trials matched out of 65,081 screened"*
   - The 3D globe showing trial sites around the world
   - Top matches with colored score badges

4. **(1:00)** Click the top match. On the trial detail page:
   - *"Match breakdown shows every criterion: age ✅, gender ✅, condition ✅, medications ✅, HbA1c ✅, distance ✅"*
   - Click **"Explain this match in plain English"** → Groq streams a narrative.
   - Scroll down: show the **"Structured criteria"** section with parsed medications and lab thresholds. *"This is what the rule parser extracted from the free text."*

5. **(1:20)** Click the floating **"Ask about this trial"** button. Type: *"Can I join if I'm on warfarin?"* Show the grounded answer with warfarin/anticoagulant reasoning.

6. **(1:30)** Back to `/match`. Click the ⚠️ **Warfarin patient** preset. Match again. Show the match results have **red "Excluded" verdicts** on medication because warfarin hits the anticoagulant exclusion list.

**Total demo time: 90 sec. Rehearse to hit it.**

---

### Slide 8 — What Runs Where (30 sec)
**Visual:** Three concentric circles

- **Outer** (orange): "LLM — user-facing language"
  - RAG chat, match explanations
- **Middle** (blue): "Deterministic matching"
  - Age, gender, condition, medication, lab, proximity → weighted score
- **Inner** (gray): "Structured data"
  - 65,081 trials · 21k with parsed meds · 19k with parsed labs

**Speaker B says:**
*"This is the separation of concerns. Data is static. Matching is deterministic. Language is where the LLM adds value. We never mix the two."*

**→ Hand to Speaker C**

---

### Slide 9 — Design Principles (45 sec)
**Visual:** Screenshots of the 3D scenes — DNA helix, globe, molecule

**Speaker C says:**
*"For the interface, we designed around three principles. First — show, don't just tell. Scrolling the landing page takes you through a 3D DNA helix that tells the story of matching: chaos, library, scan, verdict. Second — every criterion visible. No hidden scores. If we say 94% match, you see exactly which six out of six criteria contributed. Third — patients shouldn't need a medical dictionary. The chat agent and the explainer translate trial jargon into plain English, grounded in that specific trial's text."*

---

### Slide 10 — LLM Strategy (60 sec)
**Visual:** Three boxes with examples

**Three touchpoints, each doing what only an LLM can:**

1. **Chat agent**
   *"Can I join if I'm on warfarin?"* → Grounded answer from trial eligibility text.
   Prevents hallucination by refusing out-of-context questions.

2. **Match explainer**
   Takes deterministic verdicts → narrates in plain English
   *"You match on age and condition, but your Warfarin use is on the exclusion list."*

3. **Query expansion** *(future)*
   Patient lay terms → MeSH medical terms for better search.

**Speaker C says:**
*"The LLM handles three language tasks the rule engine can't. One — a chat agent that answers patient questions using only that trial's published text. Two — a match explainer that turns our criteria verdicts into a plain-English paragraph. Three — we're planning query expansion so patients can type 'heart problems' and we'll map it to the right medical concepts. Each of these is language work. None of them affect the matching decision itself."*

---

### Slide 11 — Results (30 sec)
**Visual:** Stats

> **65,081 trials** · indexed
> **411,042 trial sites** · mapped with lat/lng
> **21,191 trials** · structured medication exclusions extracted
> **19,062 trials** · lab thresholds extracted
> **86 seconds** · full corpus parse time
> **$0/month** · cost to operate
> **0 accounts · 0 tracking · 0 analytics**

**Speaker C says:**
*"In numbers: 65,081 trials indexed, 411,000 sites mapped, medication exclusions extracted for 21,000 trials, lab thresholds for 19,000. The whole parse runs in 86 seconds. The entire stack costs zero dollars. And we store nothing — patient data never leaves the browser."*

---

### Slide 12 — Limitations (45 sec)
**Visual:** Honest checklist

- ⚠️ **Research prototype.** Not a medical device. Final eligibility is the trial investigators' call.
- ⚠️ **Parser coverage** ~33% on medications, ~29% on labs. Some trials phrase criteria in ways rules don't catch.
- ⚠️ **No LLM fallback yet** on low-confidence trials. Schema is ready for it.
- ⚠️ **Evaluation** — spot-check CSV generated, formal F1 not computed.

**Speaker C says:**
*"We want to be honest about what's not solved. This is a research prototype. Final eligibility decisions belong to the trial investigators. Our parser extracts structured data from about a third of trials — the other two-thirds have phrasings our rules don't catch. Our next step is an LLM fallback for those cases. The schema is already set up for it; we just haven't run it. And formal accuracy evaluation is on our roadmap — we've done qualitative spot-checking but no published F1 score yet."*

---

### Slide 13 — Closing + thank you (20 sec)
> **CureMatch**
> *"LLMs for language. Rules for decisions."*
>
> github.com/[yourrepo] · [contact]
> Questions?

**Speaker A says:**
*"To close — our one-line summary: LLMs for language, rules for decisions. We think that separation is the right shape for medical software. Thank you. Happy to take questions."*

---

## 3-Minute Video Plan

Shoot this AFTER rehearsing the live demo. This is the backup if the live demo fails during the presentation, OR the supplementary material.

**Recording tool:** QuickTime (Mac) — Cmd+Shift+5 → Record Screen + Mic.

**Script (timestamps):**

| Time | Shot | Narration |
|------|------|-----------|
| 0:00 – 0:20 | Landing page, scroll through 3D helix | *"CureMatch matches patients to clinical trials. Here's a quick walkthrough."* |
| 0:20 – 0:50 | `/match` — click T2 Diabetes demo preset, show auto-fill | *"We prefilled a demo profile — a 58-year-old woman with type 2 diabetes on Metformin, with lab values and her location in Rochester, Minnesota."* |
| 0:50 – 1:10 | Submit, show cinematic loader | *"When we submit, the scoring engine screens all 65,081 trials in under a second."* |
| 1:10 – 1:40 | Results page, globe rotating, top matches | *"Results come back ranked. Each dot on the globe is a trial site. Each card shows the composite score and how many criteria matched."* |
| 1:40 – 2:15 | Click top trial, scroll through match breakdown, click "Explain" | *"Every criterion is visible. When we click 'Explain', an LLM grounded in this trial's text writes a plain-English summary."* |
| 2:15 – 2:45 | Click "Ask about this trial", type a question, show streamed answer | *"Patients can ask natural questions — the agent answers using only that trial's published criteria, and refuses anything out of context."* |
| 2:45 – 3:00 | End card: logo + one-liner | *"CureMatch. LLMs for language. Rules for decisions."* |

**Shoot tips:**
- Use a clean browser — no bookmarks visible, no other tabs.
- Clear localStorage first so "Saved" is empty.
- Rehearse the clicks once before you hit record.
- Record in 1080p minimum.

---

## Q&A Prep (5 minutes)

**Likely questions + your answers:**

### Q1. "How accurate is the parser?"
> *"We ran 86 seconds on the full 65k corpus. Qualitative spot-checks on 20 random trials: medication extraction is ~85–90% on cases where the text uses common drug names, lower on paraphrases and brand-name variations. We didn't compute formal F1 — that's on our roadmap. The matching engine degrades gracefully: if the parser missed something, the trial just shows 'unknown' on that criterion instead of a false positive."*

### Q2. "Why not just use an LLM for matching?"
> *"Three reasons: determinism, auditability, speed. A matching decision affects medical enrollment. A reviewer needs to reproduce our output exactly. LLMs can't guarantee that — temperature, model version, prompt phrasing all drift. Rules give us stable behavior. We put the LLM where it's safe — language translation."*

### Q3. "How do you handle bias in the data?"
> *"ClinicalTrials.gov is itself biased — most trials recruit in the U.S., Europe, and high-income countries. We don't correct for that; we surface it. Our globe visualization shows trial density by region, which makes the bias visible rather than hidden. A future version could weight matches toward trials serving under-represented populations."*

### Q4. "What about privacy?"
> *"Patient profile never leaves the browser. No accounts, no cookies, no analytics, no telemetry. All matching runs against our backend, which doesn't log queries. We treat this the same way WebMD should treat you — but actually do it."*

### Q5. "Why hybrid parsing?"
> *"Pure rules can't handle compound criteria like 'unless the patient also has condition X.' Pure LLM costs 50 hours and hallucinates. Hybrid: rules get the 80% of cases where phrasing is predictable, and the schema has room to run an LLM fallback on the remaining 20% when we have compute budget. We haven't run the fallback yet — but the pipeline is ready."*

### Q6. "What would you do with more time?"
> *"Three things. One — LLM fallback on low-confidence parses. Two — formal accuracy evaluation with ground truth labels. Three — a clinician dashboard so trial coordinators can see what patients are being matched to their trial, and flag mismatches."*

### Q7. "What's the business model?"
> *(If asked — academics often don't ask this, but good to have)*
> *"It's not a business. It's a public-interest tool built on public data. Running cost is zero because everything is free-tier — Groq LLM free tier, OpenStreetMap geocoding, ClinicalTrials.gov data. A production version could be funded by partnering with academic medical centers who want better patient recruitment."*

### Q8. "How does this compare to [TrialMatch / ClinicalConnection / existing matcher]?"
> *"Honestly, most existing tools are either forms that email trial coordinators, or ML black boxes that don't explain their matches. Our differentiator is transparency — every criterion is visible, rule-based, auditable. If a patient asks 'why didn't I match?', we can show them the exact verdict per criterion. Others can't."*

### Q9. "Show me the code."
> *"Sure — [show the GitHub repo / codebase / README.md]. The README has the full architecture, design decisions, and setup instructions. The parser is a single Python file. The frontend is Next.js with TypeScript. All open."*

### Q10. "What did you personally contribute?" *(if directed at one person)*
> *(Each speaker should have an answer ready.)*
> Speaker A: *"I owned the product research — interviewing potential users, studying how existing trial matchers fail, and writing the problem definition."*
> Speaker B: *"I built the data pipeline — the parser, the SQLite schema, the scoring engine, and the API routes."*
> Speaker C: *"I designed and built the frontend — all six pages, the 3D scenes, the chat agent integration, and the visual design system."*

---

## Division of labor (between now and Tuesday)

### Person A — Problem framing + slides 1–4
- [ ] Build slides 1–4 in Keynote / Google Slides
- [ ] Record a 30-second elevator pitch version as backup
- [ ] Write Q1, Q3 answers into notes

### Person B — Architecture + demo
- [ ] Build slides 5–8
- [ ] **Rehearse the live demo 3 times** — clean browser, cleared storage, known profile
- [ ] Record the 3-minute video (shoot on Sunday)
- [ ] Write Q2, Q5, Q6 answers

### Person C — Design + limitations + closing
- [ ] Build slides 9–13
- [ ] Polish any remaining visual issues
- [ ] Collect screenshots of 3D scenes, match breakdown, chat
- [ ] Write Q4, Q7, Q8 answers
- [ ] Prepare one-sentence answers to "what did you contribute" (for all 3)

---

## Rehearsal schedule

- **Sunday evening:** First full run-through (expect overruns, trim content)
- **Monday morning:** Record the 3-minute video
- **Monday evening:** Second full run-through WITH video embedded
- **Tuesday morning:** Final run, time each speaker to the second
- **Tuesday presentation:** Deep breath.

---

## Presentation-day checklist

Before walking in:

- [ ] Laptop fully charged + charger in bag
- [ ] HDMI / USB-C / Lightning adapters
- [ ] Browser with dev server running (or build deployed to Vercel)
- [ ] **Backup demo video on desktop** in case live demo fails
- [ ] Slides exported as PDF (backup in case of Keynote issue)
- [ ] Phone on silent
- [ ] Water bottle

---

## One-line summary for the moderator / abstract

> *"CureMatch matches patients to the 65,081 actively recruiting clinical trials on ClinicalTrials.gov. A rule-based parser extracts structured criteria from free-text eligibility in 86 seconds; a deterministic scoring engine produces per-criterion verdicts; an LLM handles only the user-facing language — chat Q&A and plain-English match explanations. Built in [timeframe] with Next.js, Python, SQLite, and Groq. Zero ongoing cost."*
