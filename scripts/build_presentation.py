#!/usr/bin/env python3
"""
Generate CureMatch_Presentation.pptx — editorial Apple-style deck.

Structure:
  1. Cover
  2. The problem
  3. What we built (3 steps)
  4. Architecture — LLMs read · Rules decide · Humans verify
  5. Team + LLM split
  6–7  Aashish Patel  — Match Explainer LLM
  8–10 Meet Gajjar    — Frontend + Chat Agent LLM + LoRA fine-tune
  11–12 Daksh Gupta   — LLM Eligibility Parser
  13   Corpus — in numbers
  14   Limitations
  15   Closing

Run:
    python3 scripts/build_presentation.py
"""

from __future__ import annotations

from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CHARTS_DIR = PROJECT_ROOT / "data" / "charts"


# ─── Design tokens ──────────────────────────────────────────────
INK       = RGBColor(0x1D, 0x1D, 0x1F)
INK_SOFT  = RGBColor(0x3B, 0x3B, 0x41)
INK_MUTE  = RGBColor(0x6E, 0x6E, 0x73)
INK_FAINT = RGBColor(0x86, 0x86, 0x8B)
LINE      = RGBColor(0xD2, 0xD2, 0xD7)
LINE_SOFT = RGBColor(0xE8, 0xE8, 0xED)
PAPER     = RGBColor(0xFB, 0xFB, 0xFD)
PAPER_ALT = RGBColor(0xF5, 0xF5, 0xF7)
DEEP      = RGBColor(0x05, 0x07, 0x0F)
ACCENT    = RGBColor(0x00, 0x71, 0xE3)
ACCENT_LT = RGBColor(0x29, 0x97, 0xFF)
SUCCESS   = RGBColor(0x30, 0xD1, 0x58)
WARNING   = RGBColor(0xFF, 0x9F, 0x0A)
WHITE     = RGBColor(0xFF, 0xFF, 0xFF)

FONT_SANS = "Helvetica Neue"
FONT_MONO = "JetBrains Mono"

SLIDE_W_IN = 10.667
SLIDE_H_IN = 7.5
TOTAL_SLIDES = 15


# ─── Primitives ─────────────────────────────────────────────────
def set_bg(slide, color: RGBColor):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def text(slide, left, top, width, height, body,
         *, size=16, color=INK, bold=False, italic=False,
         font=FONT_SANS, align="left", anchor="top",
         line_spacing=1.2, letter_spacing=None):
    tb = slide.shapes.add_textbox(
        Inches(left), Inches(top), Inches(width), Inches(height))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = 0
    tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = {
        "top": MSO_ANCHOR.TOP,
        "middle": MSO_ANCHOR.MIDDLE,
        "bottom": MSO_ANCHOR.BOTTOM,
    }[anchor]
    for i, line in enumerate(body.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER,
                       "right": PP_ALIGN.RIGHT}[align]
        p.line_spacing = line_spacing
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.color.rgb = color
        r.font.bold = bold
        r.font.italic = italic
        r.font.name = font
        if letter_spacing is not None:
            r._r.get_or_add_rPr().set("spc", str(letter_spacing))
    return tb


def rect(slide, left, top, width, height, fill,
         *, line=None, rounded=False, radius=0.06):
    shp = MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE
    s = slide.shapes.add_shape(
        shp, Inches(left), Inches(top), Inches(width), Inches(height))
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(0.75)
    s.shadow.inherit = False
    if rounded:
        s.adjustments[0] = radius
    return s


def image(slide, path: Path, *, left, top, width=None, height=None):
    if not path.exists():
        w = width or 5
        h = height or 3
        rect(slide, left, top, w, h, PAPER_ALT, line=LINE_SOFT, rounded=True)
        text(slide, left, top + h / 2 - 0.2, w, 0.4,
             f"[ {path.name} not found — run the generator ]",
             size=10, color=INK_FAINT, align="center", italic=True)
        return None
    kw = {}
    if width is not None:
        kw["width"] = Inches(width)
    if height is not None:
        kw["height"] = Inches(height)
    return slide.shapes.add_picture(str(path), Inches(left), Inches(top), **kw)


# ─── Slide chrome ───────────────────────────────────────────────
def eyebrow(slide, label: str, *, top=0.55, color=INK_MUTE):
    """Small uppercase tracked label at top-left."""
    text(slide, 0.6, top, 9.5, 0.3, label.upper(),
         size=10, color=color, bold=True, letter_spacing=250)


def footer(slide, page: int, *, dark=False):
    c = RGBColor(0x86, 0x86, 0x8B) if dark else INK_FAINT
    text(slide, 0.5, 7.08, 3, 0.3, "CureMatch",
         size=10, color=c, letter_spacing=100)
    text(slide, 9.5, 7.08, 0.9, 0.3, f"{page:02d} / {TOTAL_SLIDES:02d}",
         size=10, color=c, align="right", font=FONT_MONO)


def title(slide, body: str, *, top=1.1, size=46, color=INK, height=1.6,
          bold=True, line_spacing=1.05, letter_spacing=-28, align="left"):
    text(slide, 0.6, top, SLIDE_W_IN - 1.2, height, body,
         size=size, color=color, bold=bold, letter_spacing=letter_spacing,
         line_spacing=line_spacing, align=align)


# ─── Build ──────────────────────────────────────────────────────
def build(out_path: Path):
    prs = Presentation()
    prs.slide_width = Inches(SLIDE_W_IN)
    prs.slide_height = Inches(SLIDE_H_IN)
    blank = prs.slide_layouts[6]

    # ════════════════════════════════════════════════════════════
    # 01 · COVER
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)

    text(s, 0.6, 0.55, 10, 0.3, "FINAL GROUP PRESENTATION · APRIL 2026",
         size=10, color=INK_MUTE, bold=True, letter_spacing=300)

    text(s, 0.6, 2.0, 10, 1.5, "CureMatch.",
         size=128, color=INK, bold=True, letter_spacing=-60)

    text(s, 0.6, 3.8, 10, 0.9,
         "Matching clinical trials with large language models.",
         size=26, color=INK_MUTE)

    rect(s, 0.6, 5.4, 0.5, 0.04, ACCENT)
    text(s, 0.6, 5.65, 10, 0.4,
         "Meet Gajjar  ·  Aashish Patel  ·  Daksh Gupta",
         size=14, color=INK_SOFT, bold=True, font=FONT_MONO)
    text(s, 0.6, 6.05, 10, 0.4,
         "Three engineers. Three language models. One matching platform.",
         size=13, color=INK_FAINT, italic=True)

    footer(s, 1)

    # ════════════════════════════════════════════════════════════
    # 02 · THE PROBLEM
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "The Problem")

    title(s, "80% of trials miss\ntheir enrollment deadlines.",
          top=1.2, height=2.2, size=48, line_spacing=1.05, letter_spacing=-30)

    text(s, 0.6, 4.3, 9.5, 1.6,
         "Meanwhile 300,000 patients a year look for a trial and give up.\n"
         "Every trial publishes its eligibility as a wall of medical prose.\n"
         "65,081 actively recruiting studies. No patient reads 65,081 trials.",
         size=17, color=INK_SOFT, line_spacing=1.6)

    # Sample eligibility
    rect(s, 0.6, 6.2, 9.5, 0.6, PAPER_ALT, line=LINE_SOFT, rounded=True)
    text(s, 0.85, 6.28, 9.1, 0.22, "A TYPICAL ELIGIBILITY CRITERION",
         size=9, color=INK_FAINT, bold=True, letter_spacing=200)
    text(s, 0.85, 6.5, 9.1, 0.25,
         "ECOG 0–1 · eGFR ≥ 30 · no prior anti-PD-1 · no active autoimmune disease · HbA1c < 10.5%",
         size=10.5, color=INK_SOFT, font=FONT_MONO)

    footer(s, 2)

    # ════════════════════════════════════════════════════════════
    # 03 · WHAT WE BUILT
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "What We Built")

    title(s, "Read every trial, for you.", size=48, height=1.2)

    text(s, 0.6, 2.6, 10, 0.5,
         "One profile. Every trial screened. Ranked results. Plain-English explanations.",
         size=16, color=INK_MUTE)

    # Three pipeline stages
    stages = [
        ("01", "Profile",
         "Age · conditions · medications · labs · location. Three minutes. Browser-only."),
        ("02", "Match",
         "Scored against every actively-recruiting trial. Rule-based, deterministic, reproducible."),
        ("03", "Explain",
         "Every criterion shown. Every exclusion named. Narrative from an LLM."),
    ]
    w, gap, top, h = 3.1, 0.15, 4.2, 2.4
    for i, (n, t, b) in enumerate(stages):
        x = 0.6 + i * (w + gap)
        rect(s, x, top, w, h, WHITE, line=LINE_SOFT, rounded=True)
        text(s, x + 0.3, top + 0.3, w - 0.6, 0.6, n,
             size=36, color=ACCENT, bold=True, font=FONT_MONO, letter_spacing=-20)
        text(s, x + 0.3, top + 1.0, w - 0.6, 0.5, t,
             size=18, color=INK, bold=True)
        text(s, x + 0.3, top + 1.5, w - 0.6, 0.9, b,
             size=11.5, color=INK_MUTE, line_spacing=1.45)

    footer(s, 3)

    # ════════════════════════════════════════════════════════════
    # 04 · ARCHITECTURE
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "The Architecture")

    title(s, "LLMs read. Rules decide. Humans verify.",
          size=34, height=1.0, letter_spacing=-22)

    text(s, 0.6, 2.15, 10, 0.5,
         "Three layers, each doing the one thing it's best at.",
         size=15, color=INK_MUTE)

    cols = [
        ("LLMs READ",
         "Eligibility prose → structured fields.\nPatient questions → grounded answers.\nVerdicts → plain-English narrative.",
         ACCENT, WHITE),
        ("RULES DECIDE",
         "Age · gender · condition · medications · labs · proximity\n→ weighted composite score.\nSame input, same output, every time.",
         INK, WHITE),
        ("HUMANS VERIFY",
         "Trial investigators make the final call.\nOur output is ranked candidates — never a diagnosis.\nEvery criterion shown by name.",
         WARNING, WHITE),
    ]
    col_w = 3.1
    col_gap = 0.15
    col_top = 3.0
    col_h = 3.6
    for i, (label, body, bar_color, _) in enumerate(cols):
        x = 0.6 + i * (col_w + col_gap)
        rect(s, x, col_top, col_w, col_h, WHITE, line=LINE_SOFT, rounded=True)
        rect(s, x, col_top, col_w, 0.12, bar_color)
        text(s, x + 0.3, col_top + 0.35, col_w - 0.6, 0.4, label,
             size=11, color=bar_color, bold=True, letter_spacing=250)
        text(s, x + 0.3, col_top + 0.95, col_w - 0.6, 2.5, body,
             size=13, color=INK_SOFT, line_spacing=1.6)

    footer(s, 4)

    # ════════════════════════════════════════════════════════════
    # 05 · TEAM + SPLIT
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "The Team")

    title(s, "Three engineers. Three LLMs.",
          size=38, height=1.0, letter_spacing=-24)

    text(s, 0.6, 2.15, 10, 0.5,
         "Each of us built a distinct language model into the product.",
         size=15, color=INK_MUTE)

    # Three cards — each person + their LLM
    cards = [
        ("Aashish Patel",
         "LLM #1",
         "The Match Explainer",
         "Reads deterministic verdicts; writes a 2-sentence patient-facing narrative. Refusal-tuned."),
        ("Meet Gajjar",
         "LLM #2 + Frontend",
         "Chat Agent · LoRA fine-tune",
         "RAG chat grounded in each trial's text. Fine-tuned Llama 3.2 1B. The entire Next.js app."),
        ("Daksh Gupta",
         "LLM #3",
         "The Eligibility Parser",
         "Reads compound criteria, negation, paraphrase that regex can't. Feeds the same scorer."),
    ]
    w, gap, top, h = 3.1, 0.15, 3.1, 3.65
    for i, (who, tag, llm_title, body) in enumerate(cards):
        x = 0.6 + i * (w + gap)
        rect(s, x, top, w, h, WHITE, line=LINE_SOFT, rounded=True)
        text(s, x + 0.3, top + 0.3, w - 0.6, 0.35, tag,
             size=9.5, color=ACCENT, bold=True, letter_spacing=250)
        text(s, x + 0.3, top + 0.7, w - 0.6, 0.55, who,
             size=19, color=INK, bold=True, letter_spacing=-10)
        text(s, x + 0.3, top + 1.32, w - 0.6, 0.8, llm_title,
             size=13, color=INK_SOFT, bold=True, italic=True, line_spacing=1.35)
        text(s, x + 0.3, top + 2.15, w - 0.6, 1.3, body,
             size=11.5, color=INK_MUTE, line_spacing=1.55)

    footer(s, 5)

    # ════════════════════════════════════════════════════════════
    # 06 · AASHISH — MATCH EXPLAINER
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "Aashish Patel  ·  LLM #1")

    title(s, "The Match Explainer.",
          size=44, height=1.1, letter_spacing=-26)

    text(s, 0.6, 2.1, 10, 0.5,
         "A patient clicks \"Explain this match in plain English.\" The LLM narrates — grounded in the verdicts.",
         size=15, color=INK_MUTE, italic=True)

    # Pipeline
    stages = [
        ("Verdicts",      "deterministic\nscoring output"),
        ("Serialize",     "compact criteria\nstring"),
        ("LLM",           "Groq Llama 3.3 70B\nstreaming"),
        ("Narrative",     "≤ 80 words\npatient-facing"),
    ]
    sw, sgap, stop, sh = 2.25, 0.15, 3.2, 1.2
    total_w = len(stages) * sw + (len(stages) - 1) * sgap
    sleft = (SLIDE_W_IN - total_w) / 2
    for i, (lbl, sub) in enumerate(stages):
        x = sleft + i * (sw + sgap)
        rect(s, x, stop, sw, sh, WHITE, line=LINE_SOFT, rounded=True)
        text(s, x, stop + 0.25, sw, 0.4, lbl,
             size=15, color=INK, bold=True, align="center")
        text(s, x, stop + 0.65, sw, 0.5, sub,
             size=10.5, color=INK_MUTE, align="center", line_spacing=1.4)
        # arrow
        if i < len(stages) - 1:
            text(s, x + sw + 0.01, stop + 0.45, sgap - 0.02, 0.4, "›",
                 size=20, color=INK_FAINT, align="center")

    # Output example
    rect(s, 0.6, 4.9, 9.5, 1.8, WHITE, line=LINE_SOFT, rounded=True)
    text(s, 0.85, 5.05, 9.0, 0.3, "SAMPLE OUTPUT",
         size=9, color=INK_FAINT, bold=True, letter_spacing=200)
    text(s, 0.85, 5.35, 9.0, 1.3,
         "\u201CYou match on age, condition, and HbA1c — the trial accepts patients 40–75 with "
         "type 2 diabetes and HbA1c in range, which you meet. Your Warfarin use is on the "
         "trial's exclusion list; the protocol requires no current anticoagulant therapy.\u201D",
         size=13, color=INK_SOFT, italic=True, line_spacing=1.6)

    footer(s, 6)

    # ════════════════════════════════════════════════════════════
    # 07 · AASHISH — THE PROMPT
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "Aashish Patel  ·  Prompt Engineering")

    title(s, "80 words. Strongest positive first.",
          size=32, height=0.9, letter_spacing=-20)

    text(s, 0.6, 2.0, 10, 0.5,
         "A well-engineered prompt is a contract with the model — tight scope, explicit shape, no room to drift.",
         size=14, color=INK_MUTE, italic=True)

    # System prompt code block — centered, narrower for visual balance
    code_left = 1.55
    code_w = 7.55
    rect(s, code_left, 2.8, code_w, 3.6, PAPER_ALT, line=LINE_SOFT, rounded=True)
    text(s, code_left + 0.3, 2.95, code_w - 0.6, 0.3, "SYSTEM PROMPT (abridged)",
         size=9, color=INK_FAINT, bold=True, letter_spacing=200)
    prompt_lines = (
        "You are the CureMatch explainer.\n"
        "Given per-criterion verdicts (match / excluded /\n"
        "unknown), write ONE paragraph:\n\n"
        "  • 2–3 sentences, ≤ 80 words.\n"
        "  • Lead with the strongest positive match.\n"
        "  • Name exclusions specifically — e.g. \"Warfarin\n"
        "    is on the exclusion list\" — never generically.\n"
        "  • Close factually. No hype, no uncertainty\n"
        "    beyond what the verdicts show.\n"
        "  • Never fabricate criteria."
    )
    text(s, code_left + 0.3, 3.25, code_w - 0.6, 3.1, prompt_lines,
         size=11, color=INK, font=FONT_MONO, line_spacing=1.5)

    text(s, 0.6, 6.55, 10, 0.3,
         "Result: deterministic verdicts stay deterministic. The LLM never changes the match — it only translates.",
         size=11, color=INK_FAINT, italic=True, align="center")

    footer(s, 7)

    # ════════════════════════════════════════════════════════════
    # 08 · MEET — THE APP
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "Meet Gajjar  ·  Frontend")

    title(s, "The whole application.",
          size=44, height=1.1, letter_spacing=-26)

    text(s, 0.6, 2.1, 10, 0.5,
         "Next.js 14 · React Three Fiber · GSAP scroll storytelling · Leaflet maps · Recharts dashboard.",
         size=14, color=INK_MUTE)

    # Feature cards
    features = [
        ("Scroll storytelling",
         "/   landing page",
         "DNA helix, library, scan, verdict — GSAP ScrollTrigger narrates the product before a button is clicked."),
        ("3D results globe",
         "/results",
         "All matched trial sites plotted on a pulsing R3F globe. Geocoded via Nominatim + haversine proximity."),
        ("Live corpus dashboard",
         "/data",
         "Recharts visualizing 65,081 trials: phase distribution, top conditions, parser coverage, excluded-med frequencies."),
        ("Trial detail + chat",
         "/trial/[id]",
         "Match breakdown with real patient values vs trial requirements. Floating chat launcher. Streaming narratives."),
    ]
    w, h, gap = 4.7, 1.25, 0.15
    base_top = 3.0
    for i, (t, route, body) in enumerate(features):
        row, col = i // 2, i % 2
        x = 0.6 + col * (w + gap)
        y = base_top + row * (h + gap)
        rect(s, x, y, w, h, WHITE, line=LINE_SOFT, rounded=True)
        text(s, x + 0.25, y + 0.2, w - 2.0, 0.4, t,
             size=14, color=INK, bold=True)
        text(s, x + w - 2.0, y + 0.22, 1.8, 0.35, route,
             size=10, color=ACCENT, font=FONT_MONO, align="right")
        text(s, x + 0.25, y + 0.62, w - 0.45, 0.6, body,
             size=10.5, color=INK_MUTE, line_spacing=1.45)

    footer(s, 8)

    # ════════════════════════════════════════════════════════════
    # 09 · MEET — CHAT AGENT
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "Meet Gajjar  ·  LLM #2  ·  The Chat Agent")

    title(s, "Ask. Grounded. Refused when off-topic.",
          size=30, height=0.9, letter_spacing=-20)

    text(s, 0.6, 2.0, 10, 0.4,
         "Llama 3.3 70B via Groq · RAG over each trial's eligibility text · streaming at ~500 tokens/sec.",
         size=13, color=INK_MUTE)

    # Sample exchange, left
    ex_left = 0.6
    ex_w = 4.7
    ex_top = 2.75
    ex_h = 4.15

    rect(s, ex_left, ex_top, ex_w, ex_h, WHITE, line=LINE_SOFT, rounded=True)
    text(s, ex_left + 0.25, ex_top + 0.18, ex_w - 0.5, 0.3, "IN-CONTEXT",
         size=9, color=SUCCESS, bold=True, letter_spacing=200)
    text(s, ex_left + 0.25, ex_top + 0.5, ex_w - 0.5, 0.4,
         "\u201CCan I join if I'm on Warfarin?\u201D",
         size=13, color=INK, italic=True, bold=True)
    text(s, ex_left + 0.25, ex_top + 1.02, ex_w - 0.5, 1.3,
         "The trial's eligibility criteria list anticoagulants in the exclusions, so you "
         "would not qualify while taking Warfarin.",
         size=11.5, color=INK_SOFT, line_spacing=1.55)

    rect(s, ex_left + 0.25, ex_top + 2.3, ex_w - 0.5, 0.02, LINE_SOFT)

    text(s, ex_left + 0.25, ex_top + 2.5, ex_w - 0.5, 0.3, "OUT-OF-CONTEXT",
         size=9, color=WARNING, bold=True, letter_spacing=200)
    text(s, ex_left + 0.25, ex_top + 2.85, ex_w - 0.5, 0.4,
         "\u201CWhat's the weather in Tokyo?\u201D",
         size=13, color=INK, italic=True, bold=True)
    text(s, ex_left + 0.25, ex_top + 3.35, ex_w - 0.5, 0.7,
         "The trial's public information doesn't specify that.",
         size=11.5, color=INK_SOFT, line_spacing=1.55)

    # Right: how it works
    how_left = 5.55
    how_w = 4.55
    rect(s, how_left, ex_top, how_w, ex_h, PAPER_ALT, line=LINE_SOFT, rounded=True)
    text(s, how_left + 0.3, ex_top + 0.25, how_w - 0.6, 0.3, "HOW IT WORKS",
         size=9, color=INK_FAINT, bold=True, letter_spacing=200)

    steps = [
        ("1",  "Load trial's eligibility text from trials.db."),
        ("2",  "Inject it as retrieval context in the prompt."),
        ("3",  "Forbid answering outside the text; script refusal."),
        ("4",  "Append the user turn; stream from Groq."),
        ("5",  "Persist history per-NCT in localStorage."),
    ]
    step_gap = 0.66
    for i, (n, t) in enumerate(steps):
        y = ex_top + 0.8 + i * step_gap
        text(s, how_left + 0.3, y, 0.5, 0.4, n,
             size=15, color=ACCENT, bold=True, font=FONT_MONO)
        text(s, how_left + 0.75, y + 0.02, how_w - 0.95, 0.55, t,
             size=12, color=INK_SOFT, line_spacing=1.4)

    footer(s, 9)

    # ════════════════════════════════════════════════════════════
    # 10 · MEET — LoRA FINE-TUNE
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "Meet Gajjar  ·  Fine-Tune")

    title(s, "LoRA on Llama 3.2 1B.",
          size=40, height=1.0, letter_spacing=-24)

    text(s, 0.6, 2.05, 10, 0.4,
         "A controlled experiment: parser-grounded Q&A improves refusal behavior in a small model.",
         size=13, color=INK_MUTE)

    # Left: stats
    stats = [
        ("450",   "Q&A pairs auto-generated from parser output"),
        ("rank 16", "LoRA · 8M adapter params on 1B base"),
        ("3 epochs", "Colab T4 GPU · ~40 min runtime"),
        ("$0",    "total training cost · free tier"),
    ]
    card_left = 0.6
    card_w = 4.55
    card_h = 0.82
    card_top = 2.75
    for i, (n, label) in enumerate(stats):
        y = card_top + i * (card_h + 0.12)
        rect(s, card_left, y, card_w, card_h, WHITE, line=LINE_SOFT, rounded=True)
        text(s, card_left + 0.3, y + 0.14, 1.8, 0.6, n,
             size=22, color=ACCENT, bold=True, font=FONT_MONO, letter_spacing=-15)
        text(s, card_left + 2.15, y + 0.26, card_w - 2.3, 0.5, label,
             size=12, color=INK_MUTE, line_spacing=1.45)

    # Right: loss curve
    loss = PROJECT_ROOT / "loss_curve.png"
    if not loss.exists():
        loss = CHARTS_DIR / "loss_curve.png"
    if loss.exists():
        image(s, loss, left=5.45, top=2.75, width=4.7)
        text(s, 5.45, 6.4, 4.7, 0.3,
             "Training + eval loss across 3 epochs  ·  notebooks/finetune_curematch.ipynb",
             size=9, color=INK_FAINT, italic=True, align="center")
    else:
        rect(s, 5.45, 2.75, 4.7, 3.6, PAPER_ALT, line=LINE_SOFT, rounded=True)
        text(s, 5.45, 4.3, 4.7, 0.6,
             "loss_curve.png",
             size=13, color=INK_FAINT, italic=True, align="center", font=FONT_MONO)
        text(s, 5.65, 4.6, 4.3, 0.8,
             "run the Colab notebook,\ndrop the PNG in project root",
             size=10, color=INK_FAINT, align="center", line_spacing=1.5)

    text(s, 0.6, 6.85, 10, 0.3,
         "Production inference uses base Llama 3.3 70B via Groq. The 1B fine-tune proves the dataset-construction pipeline works.",
         size=10, color=INK_FAINT, italic=True, align="center")

    footer(s, 10)

    # ════════════════════════════════════════════════════════════
    # 11 · DAKSH — LLM PARSER
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "Daksh Gupta  ·  LLM #3  ·  The Parser")

    title(s, "Reading what regex can't.",
          size=40, height=1.0, letter_spacing=-24)

    text(s, 0.6, 2.05, 10, 0.5,
         "The rule parser covers 33% of trials. For the other 67%, the LLM reads compound criteria, negation, and paraphrase.",
         size=13, color=INK_MUTE, line_spacing=1.5)

    # Side-by-side: same eligibility text, two outputs
    # Input box on top
    rect(s, 0.6, 3.0, 9.5, 0.9, PAPER_ALT, line=LINE_SOFT, rounded=True)
    text(s, 0.85, 3.12, 9.0, 0.25, "INPUT  ·  one line from an eligibility criterion",
         size=9, color=INK_FAINT, bold=True, letter_spacing=200)
    text(s, 0.85, 3.4, 9.0, 0.45,
         "\"Creatinine clearance > 60 mL/min, unless on chronic dialysis, in which case any value is acceptable.\"",
         size=11.5, color=INK_SOFT, font=FONT_MONO)

    # Rule miss
    col_top = 4.1
    col_h = 2.5
    col_w = 4.65

    rect(s, 0.6, col_top, col_w, col_h, WHITE, line=LINE_SOFT, rounded=True)
    rect(s, 0.6, col_top, col_w, 0.12, RGBColor(0xFF, 0x3B, 0x30))
    text(s, 0.85, col_top + 0.3, col_w - 0.5, 0.3, "RULE PARSER",
         size=10, color=RGBColor(0xFF, 0x3B, 0x30), bold=True, letter_spacing=200)
    text(s, 0.85, col_top + 0.72, col_w - 0.5, 0.5, "{ missed the override }",
         size=14, color=INK, bold=True, font=FONT_MONO)
    text(s, 0.85, col_top + 1.25, col_w - 0.5, 1.1,
         "Matched \"creatinine > 60\" only. Missed the dialysis conditional — dialysis "
         "patients would be incorrectly excluded from the trial.",
         size=11, color=INK_MUTE, line_spacing=1.5)

    # LLM wins
    rect(s, 5.45, col_top, col_w, col_h, WHITE, line=LINE_SOFT, rounded=True)
    rect(s, 5.45, col_top, col_w, 0.12, SUCCESS)
    text(s, 5.7, col_top + 0.3, col_w - 0.5, 0.3, "LLM PARSER",
         size=10, color=SUCCESS, bold=True, letter_spacing=200)
    text(s, 5.7, col_top + 0.72, col_w - 0.5, 0.5, "{ extracted both }",
         size=14, color=INK, bold=True, font=FONT_MONO)
    text(s, 5.7, col_top + 1.25, col_w - 0.5, 1.1,
         "lab: creatinine_clearance, min: 60\n"
         "override: { if: on_dialysis, ignore_threshold: true }",
         size=11, color=INK_SOFT, line_spacing=1.6, font=FONT_MONO)

    footer(s, 11)

    # ════════════════════════════════════════════════════════════
    # 12 · DAKSH — SAME SCORER DOWNSTREAM
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "Daksh Gupta  ·  Scoring Engine")

    title(s, "LLM reads. Rule engine scores.",
          size=34, height=1.0, letter_spacing=-22)

    text(s, 0.6, 2.05, 10, 0.5,
         "Whether the structured fields came from rules or an LLM, the downstream scorer is the same — deterministic, auditable.",
         size=13, color=INK_MUTE, line_spacing=1.5)

    # Weight table
    weights = [
        ("Condition",    "35%"),
        ("Medications",  "20%"),
        ("Lab values",   "15%"),
        ("Age",          "12%"),
        ("Proximity",    "10%"),
        ("Gender",        "8%"),
    ]
    tbl_top = 3.0
    row_h = 0.45
    for i, (name, pct) in enumerate(weights):
        y = tbl_top + i * row_h
        text(s, 1.5, y, 3.5, 0.4, name,
             size=16, color=INK_SOFT)
        text(s, 5.2, y, 2.0, 0.4, pct,
             size=16, color=ACCENT, bold=True, font=FONT_MONO)
        rect(s, 1.5, y + 0.4, 8.2, 0.01, LINE_SOFT)

    # Audit verdict example
    rect(s, 0.6, 5.95, 9.5, 0.85, PAPER_ALT, line=LINE_SOFT, rounded=True)
    text(s, 0.85, 6.08, 9.0, 0.25, "AUDITABLE EXCLUSION",
         size=9, color=INK_FAINT, bold=True, letter_spacing=200)
    text(s, 0.85, 6.34, 9.0, 0.45,
         "You (HbA1c 6.2)  →  Required (≥ 7.5)  →  excluded.",
         size=16, color=INK, bold=True, font=FONT_MONO, letter_spacing=-8)

    footer(s, 12)

    # ════════════════════════════════════════════════════════════
    # 13 · IN NUMBERS
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "In Numbers")

    title(s, "What we shipped.",
          size=44, height=1.1, letter_spacing=-26)

    stats = [
        ("65,081",  "trials indexed"),
        ("411,042", "sites with lat/lng"),
        ("21,191",  "parsed exclusion lists"),
        ("19,062",  "parsed lab thresholds"),
        ("86 sec",  "full-corpus parse time"),
        ("$0",      "ongoing cost"),
    ]
    w, h, gap, top = 3.1, 1.35, 0.15, 3.0
    for i, (n, label) in enumerate(stats):
        row, col = i // 3, i % 3
        x = 0.6 + col * (w + gap)
        y = top + row * (h + 0.18)
        rect(s, x, y, w, h, WHITE, line=LINE_SOFT, rounded=True)
        text(s, x + 0.25, y + 0.22, w - 0.5, 0.7, n,
             size=30, color=ACCENT, bold=True, letter_spacing=-18, font=FONT_MONO)
        text(s, x + 0.25, y + 0.9, w - 0.5, 0.4, label,
             size=11, color=INK_MUTE, line_spacing=1.3)

    text(s, 0.6, 6.1, 10, 0.4,
         "Zero accounts · zero tracking · zero analytics · zero telemetry.",
         size=13, color=INK_MUTE, align="center", italic=True)

    footer(s, 13)

    # ════════════════════════════════════════════════════════════
    # 14 · LIMITATIONS
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, PAPER)
    eyebrow(s, "What's Not Solved", color=WARNING)

    title(s, "Limitations.",
          size=44, height=1.1, letter_spacing=-26)

    limits = [
        ("Research prototype.",
         "Not a medical device. Final eligibility is the trial investigators' call."),
        ("Parser coverage is partial.",
         "33% of trials for medications, 29% for labs. The LLM parser is the planned remediation."),
        ("LLM parser not yet in production.",
         "Schema and source column are ready. We've run it on samples, not the full corpus."),
        ("No published accuracy metric.",
         "Qualitative spot-checks only. An F1 score against hand-labeled ground truth is the next milestone."),
    ]
    item_top = 2.6
    for i, (t, body) in enumerate(limits):
        y = item_top + i * 0.95
        rect(s, 0.6, y + 0.1, 0.14, 0.14, WARNING, rounded=True, radius=0.5)
        text(s, 0.95, y - 0.05, 9, 0.4, t,
             size=16, color=INK, bold=True)
        text(s, 0.95, y + 0.35, 9, 0.55, body,
             size=12.5, color=INK_MUTE, line_spacing=1.5)

    footer(s, 14)

    # ════════════════════════════════════════════════════════════
    # 15 · CLOSING
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_bg(s, DEEP)

    text(s, 0.6, 1.6, 10, 1.1, "LLMs for language.",
         size=54, color=WHITE, bold=True, letter_spacing=-28)
    text(s, 0.6, 2.55, 10, 1.1, "Rules for decisions.",
         size=54, color=ACCENT_LT, bold=True, letter_spacing=-28)
    text(s, 0.6, 3.5, 10, 1.1, "Humans verify.",
         size=54, color=RGBColor(0xBF, 0x5A, 0xF2), bold=True, letter_spacing=-28)

    rect(s, 0.6, 4.9, 0.5, 0.04, ACCENT_LT)
    text(s, 0.6, 5.15, 10, 0.45, "CureMatch.",
         size=22, color=WHITE, bold=True)
    text(s, 0.6, 5.55, 10, 0.4, "github.com/meetgajjarx07/curematch",
         size=13, color=RGBColor(0x86, 0x86, 0x8B), font=FONT_MONO)
    text(s, 0.6, 6.2, 10, 0.5, "Thank you. Questions?",
         size=18, color=RGBColor(0xC6, 0xC6, 0xCB))

    footer(s, 15, dark=True)

    # ─── Save ───────────────────────────────────────────────────
    prs.save(out_path)
    print(f"\n✅ Presentation saved to: {out_path}")
    print(f"   {prs.slide_width / 914400:.2f}\" × {prs.slide_height / 914400:.2f}\" (16:9)")
    print(f"   {len(prs.slides)} slides")


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "CureMatch_Presentation.pptx"
    build(out)
