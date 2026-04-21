# CureMatch — AI Clinical Trial Matching Platform

## CURRENT FOCUS: FRONTEND ONLY
We are building the frontend first. Do not build any backend, API, database, or data pipeline code yet. Build all pages with realistic mock data hardcoded in the frontend. The backend will be connected later. Focus 100% on making the UI stunning, interactive, and production-grade.

## What This Is
A production-grade web app that matches patients to clinical trials they qualify for. Patients enter their medical profile and instantly get ranked trial matches with clear explanations of why they qualify or don't.

## The Problem
80% of clinical trials fail to meet enrollment deadlines. Patients can't find trials they qualify for because eligibility criteria are buried in walls of unstructured medical text across 65,000+ trials. CureMatch solves this.

## How It Works

### Offline Pipeline (runs once)
1. 65,081 actively recruiting trials downloaded from ClinicalTrials.gov API v2
2. Each trial's eligibility criteria text is parsed by an LLM (Gemma 4 26B MoE via Ollama) into structured JSON
3. Parsed structured data stored in SQLite alongside raw trial metadata
4. LLM is never used again after this step

### Live App (no LLM, no API calls)
1. Patient fills in profile: age, gender, conditions, medications, lab values (optional), location
2. Python scoring engine compares patient profile against all 65,081 pre-parsed trials
3. Each trial gets a match score based on weighted criteria (demographics, conditions, medications, labs, proximity)
4. Results returned ranked by score with per-criterion explainability (match/exclude/unknown per field)

## Tech Stack
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** FastAPI (Python)
- **Database:** SQLite (pre-parsed trial data)
- **LLM (offline batch only):** Gemma 4 26B MoE via Ollama at localhost:11434
- **Maps:** Leaflet (free, open source)
- **Geocoding:** geopy + OpenStreetMap Nominatim
- **No paid APIs. Entire stack is $0.**

## Project Structure
```
curematch/
├── frontend/                # Next.js 14 app
│   ├── app/                 # App Router pages
│   │   ├── page.tsx         # Landing page
│   │   ├── match/           # Patient profile input (multi-step form)
│   │   ├── results/         # Results dashboard
│   │   ├── trial/[id]/      # Trial detail + match breakdown
│   │   └── about/           # About + methodology
│   ├── components/          # Reusable UI components
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── forms/           # Multi-step form components
│   │   ├── results/         # Trial cards, filters, map view
│   │   └── layout/          # Nav, footer, theme
│   ├── lib/                 # Utils, types, API client
│   └── public/              # Static assets
├── backend/                 # FastAPI
│   ├── app/
│   │   ├── main.py          # FastAPI app entry
│   │   ├── routers/         # API route handlers
│   │   ├── scoring/         # Matching engine
│   │   ├── models/          # Pydantic schemas
│   │   └── db/              # SQLite connection + queries
│   └── requirements.txt
├── scripts/                 # One-time data pipeline
│   ├── ingest_trials.py     # Pull from ClinicalTrials.gov API
│   ├── parse_eligibility.py # Batch LLM parsing via Ollama
│   └── build_db.py          # Load parsed data into SQLite
├── data/
│   ├── raw/                 # Raw JSON pages from ClinicalTrials.gov
│   ├── parsed/              # LLM-parsed structured eligibility JSONs
│   └── evaluation/          # Ground truth annotations for paper
└── paper/                   # Conference paper drafts
```

## Data Details

### Source
ClinicalTrials.gov API v2 — US government public database, free, no API key needed.

### What Each Trial Contains (from API)
- `protocolSection.identificationModule` — nctId, briefTitle, officialTitle
- `protocolSection.eligibilityModule` — eligibilityCriteria (FREE TEXT — this is what the LLM parses), sex, minimumAge, maximumAge, healthyVolunteers
- `protocolSection.conditionsModule` — conditions list
- `protocolSection.descriptionModule` — briefSummary, detailedDescription
- `protocolSection.designModule` — studyType, phases, enrollmentInfo
- `protocolSection.armsInterventionsModule` — interventions, arm groups
- `protocolSection.contactsLocationsModule` — locations with facility, city, state, country, geoPoint (lat/lon)
- `derivedSection.conditionBrowseModule.meshes` — MeSH codes (standardized medical terms, use these for matching)

### Already Structured (no LLM needed)
- Age range: `minimumAge`, `maximumAge`
- Gender: `sex` (ALL, MALE, FEMALE)
- Conditions: `conditions` list + MeSH codes
- Locations: facility name, city, country, lat/lon coordinates
- Phase, enrollment count, study type

### Needs LLM Parsing (the hard part)
- `eligibilityCriteria` — free text wall containing inclusion/exclusion criteria
- Contains: required/excluded medications, lab value thresholds, prior treatment history, comorbidity exclusions, performance status requirements
- This is the core research contribution

### LLM Parse Output Schema
```json
{
  "conditions_required": ["list of required medical conditions"],
  "conditions_excluded": ["list of excluded medical conditions"],
  "medications_required": ["list of required medications"],
  "medications_excluded": ["list of excluded medications"],
  "lab_values": {
    "HbA1c": {"min": null, "max": 9.0},
    "creatinine_clearance": {"min": 60, "max": null}
  },
  "procedures_required": ["list of required prior procedures"],
  "procedures_excluded": ["list of excluded prior procedures"],
  "performance_status": {"scale": "ECOG", "min": 0, "max": 1},
  "other_inclusion": ["anything else not captured above"],
  "other_exclusion": ["anything else not captured above"]
}
```

## Scoring Engine Logic
For each trial, compare patient profile against parsed criteria:
- **Age:** patient age within [minimumAge, maximumAge] → match/exclude
- **Gender:** patient gender matches trial sex requirement → match/exclude
- **Conditions:** patient conditions overlap with conditions_required (using MeSH codes for normalization) → match/partial/exclude
- **Medications:** patient medications checked against medications_excluded → match/exclude
- **Lab Values:** patient lab values within required ranges → match/exclude/unknown
- **Proximity:** haversine distance from patient location to nearest trial site → score
- **Composite Score:** weighted sum of all criteria, normalized to 0-100%

Each criterion returns one of: ✅ Match, ❌ Excluded, ⚠️ Unknown (data not provided), ➖ Not applicable

## Pages & Features

### 1. Landing Page (/)
- Hero section with headline, subtext, CTA button
- Stats bar: 65,081 trials | 50+ countries | 100% free
- How it works: 3-step visual (Enter Profile → AI Matches → See Results)
- Featured conditions quick-links (Cancer, Diabetes, Heart Disease, etc.)
- Footer with disclaimer

### 2. Patient Profile Input (/match)
- Multi-step form with animated progress bar
- Step 1: Demographics — age (number input), gender (select), ethnicity (optional select)
- Step 2: Medical Conditions — searchable multi-select with autocomplete, powered by MeSH terms
- Step 3: Medications — searchable multi-select with autocomplete
- Step 4: Lab Values — optional fields (HbA1c, creatinine, blood pressure, cholesterol, etc.) with "I don't know" option per field
- Step 5: Location — city/zip input with map preview, adjustable search radius slider (10-500 miles)
- Back/Next navigation between steps, form state preserved
- "Find My Matches" submit button on final step

### 3. Results Dashboard (/results)
- Top summary: "147 trials matched out of 65,081 screened"
- Filter sidebar: condition category, phase (1/2/3/4), distance range, minimum match score
- Sort options: match score (default), distance, enrollment count, recently updated
- Trial result cards:
  - Title, sponsor, phase badge
  - Match score as percentage with color (green >80%, yellow 50-80%, red <50%)
  - Top 3 match/exclude reasons as pills
  - Distance to nearest site
  - "View Details" button
- Toggle between list view and map view
- Map view: Leaflet map with trial location pins, colored by match score
- Pagination or infinite scroll

### 4. Trial Detail Page (/trial/[id])
- Trial header: title, sponsor, phase, status, enrollment count
- Description section: briefSummary
- **Match Breakdown Panel** (the key feature):
  - Visual checklist showing every criterion evaluated
  - Each row: criterion name, patient value, trial requirement, result icon (✅❌⚠️)
  - Example: "Age: You (45) → Required (18-65) ✅"
  - Example: "Medication: You take warfarin → Trial excludes anticoagulants ❌"
  - Overall match score with donut chart
- Locations section: list of trial sites with map, distances from patient
- Interventions/Arms section
- Contact information
- External link to ClinicalTrials.gov entry
- Save and Share buttons

### 5. About Page (/about)
- What is CureMatch — plain English explanation
- How the matching engine works — technical overview for reviewers
- Methodology — data source, parsing approach, scoring algorithm
- Limitations and disclaimer: "Research prototype. Not medical advice. Always consult your physician."

## Design System

### CRITICAL DESIGN RULE
**DO NOT make this look AI-generated.** No generic gradient hero sections. No cookie-cutter SaaS layouts. No boring card grids with rounded corners and drop shadows that every AI spits out. This must look like a real product built by a human designer with taste.

### Visual Identity
- Think: Vercel + Linear + Raycast — that level of craft
- Dark-first design with depth and dimension
- Primary dark: `#0A0F1C` (near-black with blue undertone)
- Surface: `#111827` (dark cards), `#1F2937` (elevated surfaces)
- Accent: `#3B82F6` (electric blue for CTAs), `#6366F1` (indigo for highlights)
- Success: `#10B981` (green — match)
- Warning: `#F59E0B` (yellow — partial/unknown)
- Error: `#EF4444` (red — excluded)
- Text: `#F9FAFB` (primary white), `#9CA3AF` (secondary gray)
- Glassmorphism on cards: backdrop-blur, semi-transparent backgrounds, subtle borders

### 3D & Animation (NON-NEGOTIABLE)
- Use Three.js or React Three Fiber (@react-three/fiber + @react-three/drei) for 3D elements
- Landing page hero: interactive 3D DNA helix or molecular structure or abstract medical mesh that responds to mouse movement — NOT a static image
- Particle effects: floating medical-themed particles (molecules, crosses, dots) in the background with subtle parallax
- Smooth page transitions using Framer Motion — every page change should feel alive
- Scroll-triggered animations: elements fade/slide in as user scrolls
- Hover effects with 3D transforms: cards tilt slightly on hover (perspective transform)
- Loading states: custom animated skeleton loaders, not boring gray bars
- Match score animations: numbers count up when results load, progress rings animate in
- Micro-interactions everywhere: button press effects, input focus glows, toggle switches with spring physics
- The 3D hero element should be lightweight — don't tank performance

### Typography
- Font: Inter (sans-serif) for body, Outfit or Space Grotesk for headings
- Large bold headings with gradient text effects where appropriate
- Body: 16px base, generous line-height for readability

### Layout Principles
- Full-bleed sections with generous whitespace
- Bento grid layouts for feature sections — not boring 3-column grids
- Glassmorphic cards with subtle noise texture
- Floating elements and layered depth — things should feel like they exist in 3D space
- Spotlight/glow effects behind key elements
- Grid dot patterns or subtle mesh gradients as section backgrounds
- Responsive mobile-first — but the desktop experience should feel premium

### What NOT To Do
- No generic hero with centered text + button + stock illustration
- No plain white cards in a grid
- No boring linear progress bars
- No basic table layouts for results
- No default shadcn/ui styling without heavy customization
- No "built with AI" energy — every pixel should feel intentional
- No light mode as default — dark mode first, light mode as option

## API Endpoints (FastAPI Backend)

### POST /api/match
Request: patient profile (age, gender, conditions, medications, labs, location, radius)
Response: list of matched trials with scores and per-criterion breakdowns

### GET /api/trials/{nct_id}
Response: full trial details + parsed eligibility

### GET /api/conditions/search?q={query}
Response: matching conditions with MeSH codes (for autocomplete)

### GET /api/medications/search?q={query}
Response: matching medications (for autocomplete)

### GET /api/stats
Response: total trials, conditions covered, countries, last updated date

## Rules for Claude Code
- No placeholder text, no lorem ipsum — use realistic medical data for mocks
- No Streamlit — this is a full Next.js + FastAPI app
- All code must be TypeScript (frontend) and typed Python (backend)
- Production-quality: error handling, loading states, empty states, edge cases
- Components must be reusable and well-structured
- Every form field needs validation
- API responses need proper error handling with user-friendly messages
- Use realistic mock data until the real backend is connected:
  - Mock trials should have real condition names, real location data, real eligibility text
  - Mock match scores should be varied and realistic
  - Mock patient profiles should be medically plausible
- Mobile-first responsive design on every page
- Performance matters — no unnecessary re-renders, lazy load heavy components
- Accessibility is required — ARIA labels, keyboard nav, proper heading hierarchy

## Quality Bar
This codebase will be reviewed by OpenAI Codex to benchmark Claude Code's output quality. Every file, every component, every design decision will be scrutinized and compared. If the code is sloppy, generic, or looks AI-generated, it will be publicly called out. Build this like your reputation depends on it — because it does. No shortcuts. No lazy defaults. Ship excellence.
