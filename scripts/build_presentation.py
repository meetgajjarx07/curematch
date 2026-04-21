#!/usr/bin/env python3
"""
Generate CureMatch_Presentation.pptx — Apple-style deck
structured around the 3-person speaker split.

Run:
    python3 scripts/build_presentation.py

Output:
    CureMatch_Presentation.pptx in the project root.
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
NOTEBOOKS_DIR = PROJECT_ROOT / "notebooks"


# ─── Design tokens ──────────────────────────────────────────────
INK = RGBColor(0x1D, 0x1D, 0x1F)
INK_SOFT = RGBColor(0x3B, 0x3B, 0x41)
INK_MUTE = RGBColor(0x6E, 0x6E, 0x73)
INK_FAINT = RGBColor(0x86, 0x86, 0x8B)
LINE = RGBColor(0xD2, 0xD2, 0xD7)
LINE_SOFT = RGBColor(0xE8, 0xE8, 0xED)
PAPER = RGBColor(0xFB, 0xFB, 0xFD)
PAPER_ALT = RGBColor(0xF5, 0xF5, 0xF7)
DARK = RGBColor(0x1D, 0x1D, 0x1F)
DEEP = RGBColor(0x05, 0x07, 0x0F)
ACCENT = RGBColor(0x00, 0x71, 0xE3)
ACCENT_LIGHT = RGBColor(0x29, 0x97, 0xFF)
ACCENT_SOFT = RGBColor(0xE6, 0xF4, 0xFD)
SUCCESS = RGBColor(0x30, 0xD1, 0x58)
WARNING = RGBColor(0xFF, 0x9F, 0x0A)
WARNING_SOFT = RGBColor(0xFF, 0xF4, 0xE0)
ERROR = RGBColor(0xFF, 0x3B, 0x30)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

# Speaker colors — used for per-speaker eyebrows
PERSON_A = RGBColor(0x00, 0x71, 0xE3)   # blue
PERSON_B = RGBColor(0xBF, 0x5A, 0xF2)   # purple
PERSON_C = RGBColor(0xFF, 0x9F, 0x0A)   # amber

FONT_SANS = "Helvetica Neue"
FONT_MONO = "JetBrains Mono"


# ─── Helpers ────────────────────────────────────────────────────
def set_slide_bg(slide, color: RGBColor):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_text_box(
    slide, left_in, top_in, width_in, height_in, text,
    *, font_size=18, color=INK, bold=False, italic=False,
    font_name=FONT_SANS, align="left", anchor="top",
    line_spacing=1.15, letter_spacing=None,
):
    tb = slide.shapes.add_textbox(
        Inches(left_in), Inches(top_in), Inches(width_in), Inches(height_in)
    )
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = 0
    tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = {
        "top": MSO_ANCHOR.TOP, "middle": MSO_ANCHOR.MIDDLE, "bottom": MSO_ANCHOR.BOTTOM,
    }[anchor]
    for i, line in enumerate(text.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT}[align]
        p.line_spacing = line_spacing
        run = p.add_run()
        run.text = line
        run.font.size = Pt(font_size)
        run.font.color.rgb = color
        run.font.bold = bold
        run.font.italic = italic
        run.font.name = font_name
        if letter_spacing is not None:
            rPr = run._r.get_or_add_rPr()
            rPr.set("spc", str(letter_spacing))
    return tb


def add_rect(slide, left_in, top_in, width_in, height_in, fill,
             *, line=None, rounded=False):
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE
    s = slide.shapes.add_shape(
        shape_type, Inches(left_in), Inches(top_in),
        Inches(width_in), Inches(height_in),
    )
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(0.75)
    s.shadow.inherit = False
    if rounded:
        s.adjustments[0] = 0.08
    return s


def add_image(slide, path: Path, *, left_in, top_in, width_in=None, height_in=None):
    if not path.exists():
        w = width_in or 5
        h = height_in or 3
        add_rect(slide, left_in, top_in, w, h, PAPER_ALT, line=LINE_SOFT, rounded=True)
        add_text_box(slide, left_in, top_in + h / 2 - 0.2, w, 0.4,
                     f"[Missing: {path.name}]",
                     font_size=11, color=INK_FAINT, align="center", italic=True)
        return None
    kwargs = {}
    if width_in is not None:
        kwargs["width"] = Inches(width_in)
    if height_in is not None:
        kwargs["height"] = Inches(height_in)
    return slide.shapes.add_picture(str(path), Inches(left_in), Inches(top_in), **kwargs)


TOTAL_SLIDES = 17


def add_footer(slide, page_no, total=TOTAL_SLIDES, *, dark_bg=False):
    color = RGBColor(0x86, 0x86, 0x8B) if dark_bg else INK_FAINT
    add_text_box(slide, 0.5, 7.05, 3, 0.3, "CureMatch",
                 font_size=10, color=color, letter_spacing=100)
    add_text_box(slide, 9.5, 7.05, 0.9, 0.3, f"{page_no:02d} / {total:02d}",
                 font_size=10, color=color, align="right", font_name=FONT_MONO)


def add_eyebrow(slide, left_in, top_in, text, *, color=ACCENT):
    add_text_box(
        slide, left_in, top_in, 10, 0.4,
        text.upper(), font_size=11, color=color, bold=True, letter_spacing=200,
    )


def add_speaker_tag(slide, left_in, top_in, who: str, section: str, color: RGBColor):
    """Small pill at the top indicating which speaker owns this slide."""
    # Speaker pill
    add_rect(slide, left_in, top_in, 1.6, 0.28, color, rounded=True)
    add_text_box(slide, left_in, top_in + 0.02, 1.6, 0.26,
                 who.upper(), font_size=9, color=WHITE, align="center",
                 bold=True, letter_spacing=180)
    # Section label
    add_text_box(slide, left_in + 1.8, top_in, 8, 0.28,
                 section.upper(), font_size=10, color=INK_MUTE,
                 bold=True, letter_spacing=200, anchor="middle")


# ─── Build slides ───────────────────────────────────────────────
def build(out_path: Path):
    prs = Presentation()
    prs.slide_width = Inches(10.667)
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]

    # ════════════════════════════════════════════════════════════
    # SLIDE 1 — COVER
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_text_box(s, 0.6, 0.6, 10, 0.3, "FINAL GROUP PRESENTATION · APRIL 2026",
                 font_size=11, color=INK_MUTE, bold=True, letter_spacing=300)

    add_text_box(s, 0.6, 1.9, 10, 1.5, "CureMatch.",
                 font_size=120, color=INK, bold=True, letter_spacing=-50)

    add_text_box(s, 0.6, 3.6, 10, 0.8,
                 "Matching clinical trials with large language models.",
                 font_size=28, color=INK_MUTE, line_spacing=1.2)

    add_rect(s, 0.6, 5.4, 0.6, 0.04, ACCENT)

    add_text_box(s, 0.6, 5.6, 10, 0.4,
                 "Team of three  ·  one codebase  ·  65,081 real trials",
                 font_size=14, color=INK_SOFT)
    add_text_box(s, 0.6, 5.95, 10, 0.4,
                 "[Person A]  ·  [Person B]  ·  [Person C]",
                 font_size=13, color=INK_FAINT, font_name=FONT_MONO)

    add_footer(s, 1)

    # ════════════════════════════════════════════════════════════
    # SLIDE 2 — TEAM + SPLIT
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "Team + Split")

    add_text_box(s, 0.6, 1.1, 10, 1.4, "Three people.\nThree LLM contributions.",
                 font_size=40, color=INK, bold=True, letter_spacing=-25, line_spacing=1.05)

    cards = [
        ("Person A", "Product · Chat Agent", PERSON_A,
         "Built the patient-facing chat agent and the match explainer. RAG grounding, streaming, refusal behavior."),
        ("Person B", "Data · Fine-Tune", PERSON_B,
         "Built the 450-pair Q&A dataset, trained a LoRA adapter on Llama 3.2 1B, evaluated before/after refusal."),
        ("Person C", "Pipeline · Matching", PERSON_C,
         "Built the rule-based parser, the deterministic scoring engine, and the condition-disambiguation that prevents false matches."),
    ]
    card_top = 3.5
    card_w = 3.15
    card_gap = 0.15
    card_h = 3.1
    for i, (who, section, color, body) in enumerate(cards):
        left = 0.6 + i * (card_w + card_gap)
        add_rect(s, left, card_top, card_w, card_h, WHITE, line=LINE_SOFT, rounded=True)
        add_rect(s, left, card_top, card_w, 0.15, color)
        add_text_box(s, left + 0.3, card_top + 0.35, card_w - 0.6, 0.5,
                     who, font_size=22, color=INK, bold=True, letter_spacing=-15)
        add_text_box(s, left + 0.3, card_top + 0.95, card_w - 0.6, 0.4,
                     section, font_size=11, color=color, bold=True, letter_spacing=200)
        add_text_box(s, left + 0.3, card_top + 1.5, card_w - 0.6, 1.5,
                     body, font_size=12, color=INK_MUTE, line_spacing=1.45)

    add_footer(s, 2)

    # ════════════════════════════════════════════════════════════
    # SLIDE 3 — THE PROBLEM (Person A)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_speaker_tag(s, 0.6, 0.5, "Person A", "The Problem", PERSON_A)

    add_text_box(s, 0.6, 1.4, 10, 2.2,
                 "80% of trials miss\ntheir enrollment deadlines.",
                 font_size=46, color=INK, bold=True, letter_spacing=-28, line_spacing=1.05)

    add_text_box(s, 0.6, 4.4, 9.5, 1.5,
                 "Meanwhile 300,000 patients a year look for a trial and give up — "
                 "because every trial publishes its eligibility as a wall of medical "
                 "prose. There are 65,081 actively recruiting trials right now. "
                 "No patient reads 65,081 trials.",
                 font_size=17, color=INK_SOFT, line_spacing=1.5)

    add_rect(s, 0.6, 6.1, 9.5, 0.65, PAPER_ALT, line=LINE_SOFT, rounded=True)
    add_text_box(s, 0.9, 6.18, 9.1, 0.3, "TYPICAL ELIGIBILITY TEXT",
                 font_size=9, color=INK_FAINT, bold=True, letter_spacing=200)
    add_text_box(s, 0.9, 6.44, 9.1, 0.28,
                 "ECOG 0–1 · eGFR ≥ 30 · no prior anti-PD-1 · no active autoimmune · HbA1c < 10.5%",
                 font_size=11, color=INK_SOFT, font_name=FONT_MONO)

    add_footer(s, 3)

    # ════════════════════════════════════════════════════════════
    # SLIDE 4 — WHAT WE BUILT (Person A)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_speaker_tag(s, 0.6, 0.5, "Person A", "What We Built", PERSON_A)

    add_text_box(s, 0.6, 1.4, 10, 1.4, "Read every trial, for you.",
                 font_size=46, color=INK, bold=True, letter_spacing=-28)

    add_text_box(s, 0.6, 2.9, 10, 0.5,
                 "One profile. 65,081 trials screened. Ranked matches in seconds, with every criterion shown.",
                 font_size=17, color=INK_MUTE)

    steps = [
        ("01", "Enter profile", "Age · conditions · medications · lab values · location. 3 minutes. Stays in your browser."),
        ("02", "Match instantly", "Scored against every actively-recruiting trial. Rule-based · deterministic · reproducible."),
        ("03", "See the verdict", "Per-criterion breakdown. No black-box score. Every exclusion shown by name."),
    ]
    w, gap, top = 3.1, 0.15, 4.2
    for i, (n, t, b) in enumerate(steps):
        left = 0.6 + i * (w + gap)
        add_rect(s, left, top, w, 2.4, WHITE, line=LINE_SOFT, rounded=True)
        add_text_box(s, left + 0.3, top + 0.25, w - 0.6, 0.5, n,
                     font_size=30, color=PERSON_A, bold=True, font_name=FONT_MONO)
        add_text_box(s, left + 0.3, top + 0.85, w - 0.6, 0.5, t,
                     font_size=16, color=INK, bold=True)
        add_text_box(s, left + 0.3, top + 1.3, w - 0.6, 1.1, b,
                     font_size=11.5, color=INK_MUTE, line_spacing=1.45)

    add_footer(s, 4)

    # ════════════════════════════════════════════════════════════
    # SLIDE 5 — LIVE DEMO #1 (Person A demo cue)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, DEEP)

    add_speaker_tag(s, 0.6, 0.5, "Person A", "Live Demo · Happy Path", PERSON_A)

    add_text_box(s, 0.6, 1.4, 10, 2.3, "Let's see it.",
                 font_size=100, color=WHITE, bold=True, letter_spacing=-50)

    add_rect(s, 2.5, 4.3, 5.5, 1.0, RGBColor(0x1A, 0x25, 0x40), rounded=True)
    add_text_box(s, 2.5, 4.55, 5.5, 0.5, "localhost:3000",
                 font_size=28, color=WHITE, align="center", font_name=FONT_MONO)

    add_text_box(s, 0.6, 5.75, 10, 0.35,
                 "Demo flow:  T2 diabetes profile  →  /match  →  147 results  →  top trial  →  explain.",
                 font_size=13, color=RGBColor(0x86, 0x86, 0x8B), align="center", italic=True)
    add_text_box(s, 0.6, 6.1, 10, 0.35,
                 "Hit the \"Explain this match\" button. Watch the LLM narrate the verdicts live.",
                 font_size=13, color=ACCENT_LIGHT, align="center", italic=True)

    add_footer(s, 5, dark_bg=True)

    # ════════════════════════════════════════════════════════════
    # SLIDE 6 — THE CORPUS (Person B — data viz)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_speaker_tag(s, 0.6, 0.4, "Person B", "The Corpus", PERSON_B)

    add_text_box(s, 0.6, 0.95, 10, 0.9, "65,081 trials. All real.",
                 font_size=34, color=INK, bold=True, letter_spacing=-22)

    add_image(s, CHARTS_DIR / "phase_donut.png",
              left_in=0.3, top_in=1.9, height_in=4.4)
    add_image(s, CHARTS_DIR / "top_conditions.png",
              left_in=5.2, top_in=1.9, height_in=4.4)

    add_text_box(s, 0.6, 6.65, 10, 0.3,
                 "Phase distribution across actively-recruiting studies  ·  top 10 conditions by MeSH tag count.",
                 font_size=10, color=INK_FAINT, align="center", italic=True)
    add_footer(s, 6)

    # ════════════════════════════════════════════════════════════
    # SLIDE 7 — RULE PARSER (Person B)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_speaker_tag(s, 0.6, 0.4, "Person B", "The Rule Parser", PERSON_B)

    add_text_box(s, 0.6, 0.95, 10, 0.9,
                 "RxNorm + regex  →  86 seconds for 65k trials.",
                 font_size=28, color=INK, bold=True, letter_spacing=-20)

    # Parser coverage image
    add_image(s, CHARTS_DIR / "parser_coverage.png",
              left_in=0.3, top_in=2.0, width_in=10)

    add_text_box(s, 0.6, 5.3, 9.5, 1.4,
                 "The parser reads each trial's eligibility text and extracts structured "
                 "fields — excluded medications, lab thresholds, ECOG ranges. Rules win on "
                 "the narrow checks (~85% recall) and cost nothing to run. Compound criteria, "
                 "negation, and paraphrase are where the LLM takes over — shown in two slides.",
                 font_size=13, color=INK_MUTE, line_spacing=1.5)

    add_footer(s, 7)

    # ════════════════════════════════════════════════════════════
    # SLIDE 8 — LORA FINE-TUNE (Person B)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_speaker_tag(s, 0.6, 0.4, "Person B", "The Fine-Tune", PERSON_B)

    add_text_box(s, 0.6, 0.95, 10, 0.9, "LoRA on Llama 3.2 1B.",
                 font_size=34, color=INK, bold=True, letter_spacing=-22)

    # Left: claim cards
    card_w = 4.6
    card_h = 0.9
    card_left = 0.6
    card_top = 2.1
    claims = [
        ("450", "Q&A pairs auto-generated from parser output"),
        ("rank 16", "LoRA · 8M trainable params on 1B base"),
        ("3 epochs", "on a free Colab T4 · 40-min runtime"),
        ("$0", "cost · before/after eval on 50 holdouts"),
    ]
    for i, (n, label) in enumerate(claims):
        top = card_top + i * (card_h + 0.12)
        add_rect(s, card_left, top, card_w, card_h, WHITE, line=LINE_SOFT, rounded=True)
        add_text_box(s, card_left + 0.3, top + 0.12, 1.7, 0.7,
                     n, font_size=24, color=PERSON_B, bold=True, letter_spacing=-18, font_name=FONT_MONO)
        add_text_box(s, card_left + 2.05, top + 0.25, card_w - 2.2, 0.5,
                     label, font_size=11.5, color=INK_MUTE, line_spacing=1.4)

    # Right: loss curve (if present)
    loss_curve = PROJECT_ROOT / "loss_curve.png"
    if not loss_curve.exists():
        loss_curve = CHARTS_DIR / "loss_curve.png"
    if loss_curve.exists():
        add_image(s, loss_curve, left_in=5.4, top_in=2.1, width_in=4.9)
        add_text_box(s, 5.4, 6.15, 4.9, 0.3,
                     "Training + eval loss across 3 epochs  ·  from notebooks/finetune_curematch.ipynb",
                     font_size=9, color=INK_FAINT, italic=True, align="center")
    else:
        add_rect(s, 5.4, 2.1, 4.9, 3.8, PAPER_ALT, line=LINE_SOFT, rounded=True)
        add_text_box(s, 5.6, 3.5, 4.5, 0.6,
                     "[ run notebooks/finetune_curematch.ipynb →\n  drop loss_curve.png into project root ]",
                     font_size=11, color=INK_FAINT, align="center", italic=True)

    add_text_box(s, 0.6, 6.55, 10, 0.3,
                 "Production uses base Llama 3.3 70B via Groq. The 1B fine-tune is our proof that parser-grounded training data improves refusal behavior.",
                 font_size=10, color=INK_FAINT, align="center", italic=True)

    add_footer(s, 8)

    # ════════════════════════════════════════════════════════════
    # SLIDE 9 — THE CHAT AGENT (Person B demo cue)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_speaker_tag(s, 0.6, 0.4, "Person B", "Demo #2 · The Agent", PERSON_B)

    add_text_box(s, 0.6, 0.95, 10, 1.4, "The patient-facing chat agent.",
                 font_size=34, color=INK, bold=True, letter_spacing=-22)

    add_text_box(s, 0.6, 2.35, 10, 0.5,
                 "Llama 3.3 70B via Groq  ·  streams at ~500 tokens/sec  ·  grounded in the trial's eligibility text.",
                 font_size=14, color=INK_MUTE)

    # Agent decision chart
    add_image(s, CHARTS_DIR / "agent_decision.png",
              left_in=0.3, top_in=3.0, height_in=3.8)

    # Right side — sample exchange
    exch_left = 5.5
    exch_top = 3.0
    add_rect(s, exch_left, exch_top, 4.8, 3.8, WHITE, line=LINE_SOFT, rounded=True)

    add_text_box(s, exch_left + 0.2, exch_top + 0.2, 4.4, 0.3,
                 "SAMPLE EXCHANGE", font_size=9, color=INK_FAINT, bold=True, letter_spacing=200)

    add_text_box(s, exch_left + 0.2, exch_top + 0.55, 4.4, 0.4,
                 "\"Can I join if I'm taking Warfarin?\"",
                 font_size=12, color=INK, italic=True, bold=True)
    add_text_box(s, exch_left + 0.2, exch_top + 1.0, 4.4, 1.0,
                 "→ The trial's eligibility lists anticoagulants in the exclusions, so you would not qualify while taking Warfarin.",
                 font_size=11, color=PERSON_B, line_spacing=1.4)

    add_text_box(s, exch_left + 0.2, exch_top + 2.1, 4.4, 0.4,
                 "\"What's the weather in Tokyo?\"",
                 font_size=12, color=INK, italic=True, bold=True)
    add_text_box(s, exch_left + 0.2, exch_top + 2.55, 4.4, 1.0,
                 "→ The trial's public information doesn't specify that — you'll want to ask the study team directly.",
                 font_size=11, color=WARNING, line_spacing=1.4)

    add_footer(s, 9)

    # ════════════════════════════════════════════════════════════
    # SLIDE 10 — THE DESIGN DECISION (Person C)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_speaker_tag(s, 0.6, 0.5, "Person C", "The Design Decision", PERSON_C)

    add_text_box(s, 0.6, 1.4, 10, 1.5,
                 "LLMs for language.\nRules for decisions.",
                 font_size=46, color=INK, bold=True, letter_spacing=-28, line_spacing=1.05)

    add_text_box(s, 0.6, 4.0, 10, 0.8,
                 "Medical matching has to be deterministic. If someone asks \"why was this patient excluded?\" we need to point at a rule — not shrug.",
                 font_size=15, color=INK_MUTE, italic=True, line_spacing=1.5)

    # Example verdict
    add_rect(s, 0.6, 5.4, 9.5, 1.4, WHITE, line=LINE_SOFT, rounded=True)
    add_text_box(s, 0.85, 5.55, 9, 0.3, "AUDITABLE VERDICT",
                 font_size=9, color=INK_FAINT, bold=True, letter_spacing=200)
    add_text_box(s, 0.85, 5.85, 9, 0.85,
                 "You (HbA1c 6.2)  →  Required (≥ 7.5)  →  excluded.",
                 font_size=22, color=INK, bold=True, font_name=FONT_MONO, letter_spacing=-10)

    add_footer(s, 10)

    # ════════════════════════════════════════════════════════════
    # SLIDE 11 — SCORING ENGINE (Person C)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_speaker_tag(s, 0.6, 0.4, "Person C", "The Scoring Engine", PERSON_C)

    add_text_box(s, 0.6, 0.95, 10, 0.9, "Six criteria. One weighted score.",
                 font_size=30, color=INK, bold=True, letter_spacing=-20)

    # Weight table, left
    weights = [
        ("Condition",     "35%", "Distinctive-word overlap. Generic terms (\"disease\") filtered out."),
        ("Medications",   "20%", "RxNorm lookup + drug-class map. Warfarin hits \"anticoagulants.\""),
        ("Lab values",    "15%", "HbA1c, eGFR, platelets, etc. vs trial's required range."),
        ("Age",           "12%", "Parse min_age / max_age. In-range check."),
        ("Proximity",     "10%", "Haversine to nearest study site vs searchRadius."),
        ("Gender",        "8%",  "Trial sex vs patient gender. Pre-filter."),
    ]
    row_h = 0.62
    row_top = 2.0
    table_left = 0.6
    for i, (name, pct, note) in enumerate(weights):
        y = row_top + i * row_h
        add_text_box(s, table_left, y, 1.9, 0.4, name,
                     font_size=14, color=INK, bold=True)
        add_text_box(s, table_left + 2.0, y, 1.0, 0.4, pct,
                     font_size=14, color=PERSON_C, bold=True, font_name=FONT_MONO)
        add_text_box(s, table_left + 3.2, y, 6.8, 0.55, note,
                     font_size=11.5, color=INK_MUTE, line_spacing=1.4)
        if i < len(weights) - 1:
            add_rect(s, table_left, y + 0.55, 9.8, 0.01, LINE_SOFT)

    add_text_box(s, 0.6, 6.15, 10, 0.6,
                 "Same input → same output. Every time. Auditable per criterion.",
                 font_size=14, color=INK, italic=True, bold=True, align="center")

    add_footer(s, 11)

    # ════════════════════════════════════════════════════════════
    # SLIDE 12 — WHERE LLMS EXPAND MATCHING (Person C)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_speaker_tag(s, 0.6, 0.4, "Person C", "Where LLMs Expand Matching", PERSON_C)

    add_text_box(s, 0.6, 0.95, 10, 0.9,
                 "Rules cover 33%. LLMs read the rest.",
                 font_size=30, color=INK, bold=True, letter_spacing=-20)

    add_text_box(s, 0.6, 2.0, 10, 0.5,
                 "Compound criteria, negation, paraphrase — language that regex can't parse.",
                 font_size=14, color=INK_MUTE)

    # Side-by-side comparison
    col_w = 4.75
    col_h = 3.7
    col_top = 2.95

    # Left — rule parser struggles
    add_rect(s, 0.6, col_top, col_w, col_h, WHITE, line=LINE_SOFT, rounded=True)
    add_rect(s, 0.6, col_top, col_w, 0.15, ERROR)
    add_text_box(s, 0.85, col_top + 0.3, col_w - 0.5, 0.4,
                 "RULE PARSER", font_size=10, color=ERROR, bold=True, letter_spacing=200)
    add_text_box(s, 0.85, col_top + 0.7, col_w - 0.5, 0.5,
                 "{ missed }", font_size=18, color=INK, bold=True, font_name=FONT_MONO)
    add_text_box(s, 0.85, col_top + 1.3, col_w - 0.5, 2.4,
                 "Input: \"creatinine clearance > 60 mL/min, unless on chronic dialysis, in which case any value is acceptable\"\n\n"
                 "Regex matched \"creatinine > 60\" — missed the conditional. "
                 "Dialysis patients would be incorrectly excluded.",
                 font_size=11, color=INK_MUTE, line_spacing=1.5)

    # Right — LLM parser wins
    add_rect(s, 5.45, col_top, col_w, col_h, WHITE, line=LINE_SOFT, rounded=True)
    add_rect(s, 5.45, col_top, col_w, 0.15, SUCCESS)
    add_text_box(s, 5.7, col_top + 0.3, col_w - 0.5, 0.4,
                 "LLM PARSER", font_size=10, color=SUCCESS, bold=True, letter_spacing=200)
    add_text_box(s, 5.7, col_top + 0.7, col_w - 0.5, 0.5,
                 "{ extracted }", font_size=18, color=INK, bold=True, font_name=FONT_MONO)
    add_text_box(s, 5.7, col_top + 1.3, col_w - 0.5, 2.4,
                 "lab: creatinine_clearance, min: 60\n"
                 "override: { if: on_dialysis, ignore_threshold: true }\n\n"
                 "Same downstream scorer. Same determinism. "
                 "But the LLM read what regex couldn't.",
                 font_size=11, color=INK_MUTE, line_spacing=1.5, font_name=FONT_MONO)

    add_footer(s, 12)

    # ════════════════════════════════════════════════════════════
    # SLIDE 13 — RULES VS LLM (chart)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_speaker_tag(s, 0.6, 0.4, "Person C", "Rules vs LLM · the tradeoff", PERSON_C)

    add_text_box(s, 0.6, 0.95, 10, 0.9, "Use each where each wins.",
                 font_size=30, color=INK, bold=True, letter_spacing=-20)

    add_image(s, CHARTS_DIR / "rules_vs_llm.png",
              left_in=0.5, top_in=2.0, width_in=9.7)

    add_text_box(s, 0.6, 6.55, 10, 0.3,
                 "Rules for narrow decisions. LLMs for messy prose. Wrong tool for wrong job = bad system.",
                 font_size=11, color=INK_FAINT, align="center", italic=True)

    add_footer(s, 13)

    # ════════════════════════════════════════════════════════════
    # SLIDE 14 — FUNNEL (the end-to-end flow)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.4, "End-to-End")

    add_text_box(s, 0.6, 0.95, 10, 0.9,
                 "65,081  →  1,500  →  147  →  top 1.",
                 font_size=30, color=INK, bold=True, letter_spacing=-20, font_name=FONT_MONO)

    add_image(s, CHARTS_DIR / "funnel.png",
              left_in=0.3, top_in=2.0, height_in=4.5)
    add_image(s, CHARTS_DIR / "top_excluded_meds.png",
              left_in=5.2, top_in=2.0, height_in=4.5)

    add_text_box(s, 0.6, 6.85, 10, 0.3,
                 "Left: SQL pre-filter → scoring → ranked matches.  Right: most-excluded medications across the corpus.",
                 font_size=10, color=INK_FAINT, align="center", italic=True)

    add_footer(s, 14)

    # ════════════════════════════════════════════════════════════
    # SLIDE 15 — IN NUMBERS
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "What We Shipped")

    add_text_box(s, 0.6, 1.1, 10, 1.4, "In numbers.",
                 font_size=42, color=INK, bold=True, letter_spacing=-25)

    stats = [
        ("65,081", "trials indexed"),
        ("411,042", "sites with lat/lng"),
        ("21,191", "parsed exclusion lists"),
        ("19,062", "parsed lab thresholds"),
        ("86 sec", "full-corpus parse time"),
        ("$0", "ongoing cost"),
    ]
    w, h, gap, top = 3.1, 1.4, 0.15, 3.0
    for i, (n, label) in enumerate(stats):
        row, col = i // 3, i % 3
        left = 0.6 + col * (w + gap)
        y = top + row * (h + 0.15)
        add_rect(s, left, y, w, h, WHITE, line=LINE_SOFT, rounded=True)
        add_text_box(s, left + 0.25, y + 0.2, w - 0.5, 0.7, n,
                     font_size=32, color=ACCENT, bold=True, letter_spacing=-20, font_name=FONT_MONO)
        add_text_box(s, left + 0.25, y + 0.95, w - 0.5, 0.4, label,
                     font_size=11, color=INK_MUTE, line_spacing=1.3)

    add_text_box(s, 0.6, 6.3, 10, 0.5,
                 "Zero accounts · zero tracking · zero analytics · zero telemetry.",
                 font_size=14, color=INK_MUTE, align="center", italic=True)

    add_footer(s, 15)

    # ════════════════════════════════════════════════════════════
    # SLIDE 16 — LIMITATIONS (honesty)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "What's Not Solved", color=WARNING)

    add_text_box(s, 0.6, 1.1, 10, 1.2, "Limitations.",
                 font_size=42, color=INK, bold=True, letter_spacing=-25)

    limits = [
        ("Research prototype.",
         "Not a medical device. Final eligibility is the trial investigators' call."),
        ("Parser coverage is partial.",
         "33% for medications, 29% for labs. That's why the LLM parser is the next step."),
        ("LLM parser not yet in production.",
         "Schema and source column are ready. We've run it on samples, not the full 65k."),
        ("Formal evaluation pending.",
         "Spot-check CSV sampled. No published F1 against hand-labeled ground truth yet."),
    ]
    item_top = 2.7
    for i, (title, body) in enumerate(limits):
        y = item_top + i * 0.95
        add_rect(s, 0.6, y + 0.15, 0.15, 0.15, WARNING, rounded=True)
        add_text_box(s, 0.95, y, 9, 0.4, title, font_size=16, color=INK, bold=True)
        add_text_box(s, 0.95, y + 0.4, 9, 0.5, body,
                     font_size=12.5, color=INK_MUTE, line_spacing=1.4)

    add_footer(s, 16)

    # ════════════════════════════════════════════════════════════
    # SLIDE 17 — CLOSING
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, DEEP)

    add_text_box(s, 0.6, 1.6, 10, 1.4, "LLMs for language.",
                 font_size=56, color=WHITE, bold=True, letter_spacing=-28)
    add_text_box(s, 0.6, 2.5, 10, 1.4, "Rules for decisions.",
                 font_size=56, color=ACCENT_LIGHT, bold=True, letter_spacing=-28)
    add_text_box(s, 0.6, 3.4, 10, 1.4, "Humans verify.",
                 font_size=56, color=RGBColor(0xBF, 0x5A, 0xF2), bold=True, letter_spacing=-28)

    add_rect(s, 0.6, 4.7, 0.6, 0.04, ACCENT_LIGHT)

    add_text_box(s, 0.6, 4.95, 10, 0.4, "CureMatch.",
                 font_size=22, color=WHITE, bold=True)
    add_text_box(s, 0.6, 5.35, 10, 0.4,
                 "github.com/meetgajjarx07/curematch",
                 font_size=13, color=RGBColor(0x86, 0x86, 0x8B), font_name=FONT_MONO)
    add_text_box(s, 0.6, 5.95, 10, 0.5, "Thank you. Questions?",
                 font_size=20, color=RGBColor(0xC6, 0xC6, 0xCB))

    add_footer(s, 17, dark_bg=True)

    prs.save(out_path)
    print(f"\n✅ Presentation saved to: {out_path}")
    print(f"   {prs.slide_width / 914400:.2f}\" × {prs.slide_height / 914400:.2f}\" (16:9)")
    print(f"   {len(prs.slides)} slides")


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "CureMatch_Presentation.pptx"
    build(out)
