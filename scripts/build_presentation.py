#!/usr/bin/env python3
"""
Generate CureMatch_Presentation.pptx — a clean, Apple-style deck
with embedded data visualizations from the live corpus.

Run:
    python3 scripts/build_presentation.py
Output:
    CureMatch_Presentation.pptx in the project root
"""

from __future__ import annotations

from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from lxml import etree

# Chart asset directory — populated by generate_chart_images.py
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CHARTS_DIR = PROJECT_ROOT / "data" / "charts"


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
SUCCESS = RGBColor(0x30, 0xD1, 0x58)
WARNING = RGBColor(0xFF, 0x9F, 0x0A)
ERROR = RGBColor(0xFF, 0x3B, 0x30)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

FONT_SANS = "Helvetica Neue"  # 16:9 deck — use a font reliably present on macOS & Windows
FONT_MONO = "JetBrains Mono"


# ─── Helpers ────────────────────────────────────────────────────
def set_slide_bg(slide, color: RGBColor):
    """Fill entire slide background with a solid color."""
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_text_box(
    slide,
    left_in: float,
    top_in: float,
    width_in: float,
    height_in: float,
    text: str,
    *,
    font_size: int = 18,
    color: RGBColor = INK,
    bold: bool = False,
    italic: bool = False,
    font_name: str = FONT_SANS,
    align: str = "left",
    anchor: str = "top",
    line_spacing: float = 1.15,
    letter_spacing: float | None = None,
):
    tb = slide.shapes.add_textbox(
        Inches(left_in), Inches(top_in), Inches(width_in), Inches(height_in)
    )
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = 0
    tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = {
        "top": MSO_ANCHOR.TOP,
        "middle": MSO_ANCHOR.MIDDLE,
        "bottom": MSO_ANCHOR.BOTTOM,
    }[anchor]

    for i, line in enumerate(text.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = {
            "left": PP_ALIGN.LEFT,
            "center": PP_ALIGN.CENTER,
            "right": PP_ALIGN.RIGHT,
        }[align]
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


def add_rect(slide, left_in, top_in, width_in, height_in, fill: RGBColor, *, line: RGBColor | None = None, rounded: bool = False):
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE
    s = slide.shapes.add_shape(
        shape_type,
        Inches(left_in), Inches(top_in),
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
        # Small uniform corner radius
        s.adjustments[0] = 0.08
    return s


def add_line(slide, x1_in, y1_in, x2_in, y2_in, color: RGBColor, weight_pt: float = 1.0):
    line = slide.shapes.add_connector(1, Inches(x1_in), Inches(y1_in), Inches(x2_in), Inches(y2_in))
    line.line.color.rgb = color
    line.line.width = Pt(weight_pt)
    return line


def add_image(slide, path: Path, left_in: float, top_in: float, width_in: float | None = None, height_in: float | None = None):
    """Insert an image with fit-to-width or fit-to-height behavior."""
    if not path.exists():
        # Draw a neutral placeholder so the slide isn't empty
        w = width_in or 5
        h = height_in or 3
        add_rect(slide, left_in, top_in, w, h, PAPER_ALT, line=LINE_SOFT, rounded=True)
        add_text_box(slide, left_in, top_in + h / 2 - 0.2, w, 0.4,
                     f"[Missing chart: {path.name}]",
                     font_size=11, color=INK_FAINT, align="center", italic=True)
        return None
    kwargs = {}
    if width_in is not None:
        kwargs["width"] = Inches(width_in)
    if height_in is not None:
        kwargs["height"] = Inches(height_in)
    return slide.shapes.add_picture(str(path), Inches(left_in), Inches(top_in), **kwargs)


TOTAL_SLIDES = 16  # 13 original + 3 data slides


def add_footer(slide, page_no: int, total: int = TOTAL_SLIDES, *, dark_bg: bool = False):
    color = RGBColor(0xFF, 0xFF, 0xFF) if dark_bg else INK_FAINT
    if dark_bg:
        color = RGBColor(0x86, 0x86, 0x8B)
    # Left: CureMatch brand
    add_text_box(slide, 0.5, 7.05, 3, 0.3, "CureMatch", font_size=10, color=color, letter_spacing=100)
    # Right: page number
    add_text_box(slide, 9.5, 7.05, 0.9, 0.3, f"{page_no:02d} / {total:02d}", font_size=10, color=color, align="right", font_name=FONT_MONO)


def add_eyebrow(slide, left_in, top_in, text, *, color: RGBColor = ACCENT):
    add_text_box(
        slide, left_in, top_in, 10, 0.4,
        text.upper(),
        font_size=11, color=color, bold=True, letter_spacing=200,
    )


# ─── Build slides ───────────────────────────────────────────────
def build(out_path: Path):
    prs = Presentation()
    prs.slide_width = Inches(10.667)   # 16:9
    prs.slide_height = Inches(7.5)

    blank = prs.slide_layouts[6]

    # ════════════════════════════════════════════════════════════
    # SLIDE 1 — COVER
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    # Top eyebrow
    add_text_box(s, 0.6, 0.6, 10, 0.3, "CLINICAL TRIAL MATCHING PLATFORM",
                 font_size=11, color=INK_MUTE, bold=True, letter_spacing=300)

    # Big title
    add_text_box(s, 0.6, 2.2, 10, 1.5, "CureMatch.",
                 font_size=120, color=INK, bold=True, letter_spacing=-50)

    # Subtitle
    add_text_box(s, 0.6, 3.9, 10, 1.0,
                 "Finding clinical trials you qualify for — at the speed of scroll.",
                 font_size=28, color=INK_MUTE, line_spacing=1.2)

    # Divider
    add_rect(s, 0.6, 5.7, 0.6, 0.04, ACCENT)

    # Byline
    add_text_box(s, 0.6, 5.9, 10, 0.4,
                 "[Your names] · [Your institution]",
                 font_size=14, color=INK_SOFT)
    add_text_box(s, 0.6, 6.25, 10, 0.4,
                 "Final Presentation · April 2026",
                 font_size=12, color=INK_FAINT)

    add_footer(s, 1)

    # ════════════════════════════════════════════════════════════
    # SLIDE 2 — THE PROBLEM
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "The Problem")

    add_text_box(s, 0.6, 1.1, 10, 2.0,
                 "80% of clinical trials\nfail to meet enrollment.",
                 font_size=48, color=INK, bold=True, letter_spacing=-30, line_spacing=1.05)

    add_text_box(s, 0.6, 3.5, 9.5, 2,
                 "Eligibility criteria are buried in walls of medical prose — "
                 "dense, technical, written for clinicians. A patient searching for "
                 "a trial they might qualify for is, at present, expected to read "
                 "through 65,000 studies to find the handful that match their profile.",
                 font_size=18, color=INK_SOFT, line_spacing=1.5)

    # Criteria example box
    add_rect(s, 0.6, 5.6, 9.5, 1.1, PAPER_ALT, line=LINE_SOFT, rounded=True)
    add_text_box(s, 0.9, 5.75, 9.1, 0.3,
                 "TYPICAL ELIGIBILITY TEXT",
                 font_size=9, color=INK_FAINT, bold=True, letter_spacing=200)
    add_text_box(s, 0.9, 6.05, 9.1, 0.6,
                 "ECOG 0–1 · eGFR ≥ 30 · no prior anti-PD-1 therapy · no active autoimmune disease · HbA1c < 10.5%",
                 font_size=13, color=INK_SOFT, font_name=FONT_MONO)

    add_footer(s, 2)

    # ════════════════════════════════════════════════════════════
    # SLIDE 3 — WHAT WE BUILT
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "The Solution")

    add_text_box(s, 0.6, 1.1, 10, 1.4,
                 "Read every trial, for you.",
                 font_size=48, color=INK, bold=True, letter_spacing=-30)

    add_text_box(s, 0.6, 2.5, 9.5, 0.8,
                 "Enter your medical profile once. See every matching trial, with every criterion shown.",
                 font_size=18, color=INK_MUTE, line_spacing=1.4)

    # Three-step row
    steps = [
        ("01", "Enter profile", "Age · conditions · medications · lab values · location. Takes 3 minutes. Stays in your browser."),
        ("02", "Match instantly", "Compared against all 65,081 actively recruiting trials. Rule-based · deterministic · reproducible."),
        ("03", "See every verdict", "Per-criterion breakdown. Match · Excluded · Unknown. No black-box score."),
    ]

    step_width = 3.1
    step_gap = 0.15
    step_top = 4.0
    for i, (n, title, body) in enumerate(steps):
        left = 0.6 + i * (step_width + step_gap)
        add_rect(s, left, step_top, step_width, 2.5, WHITE, line=LINE_SOFT, rounded=True)
        add_text_box(s, left + 0.3, step_top + 0.25, step_width - 0.6, 0.5,
                     n, font_size=32, color=ACCENT, bold=True, font_name=FONT_MONO)
        add_text_box(s, left + 0.3, step_top + 0.9, step_width - 0.6, 0.5,
                     title, font_size=17, color=INK, bold=True)
        add_text_box(s, left + 0.3, step_top + 1.35, step_width - 0.6, 1.2,
                     body, font_size=12, color=INK_MUTE, line_spacing=1.4)

    add_footer(s, 3)

    # ════════════════════════════════════════════════════════════
    # SLIDE 4 — WHY THIS IS HARD
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "The Challenge")

    add_text_box(s, 0.6, 1.1, 10, 1.4,
                 "Some data is structured. Most isn't.",
                 font_size=40, color=INK, bold=True, letter_spacing=-25)

    add_text_box(s, 0.6, 2.5, 9.5, 0.5,
                 "The API gives us clean fields — but the criteria that matter most are free text.",
                 font_size=16, color=INK_MUTE)

    # Two columns
    col_top = 3.6
    col_height = 3.0

    # Left: structured
    add_rect(s, 0.6, col_top, 4.8, col_height, WHITE, line=SUCCESS, rounded=True)
    add_text_box(s, 0.85, col_top + 0.25, 4.3, 0.4,
                 "✓ STRUCTURED IN THE API",
                 font_size=10, color=SUCCESS, bold=True, letter_spacing=200)
    structured = ["Age bounds (min / max)", "Gender requirement", "Conditions (MeSH-tagged)", "Phase · enrollment count", "Locations with lat/lng"]
    for i, item in enumerate(structured):
        add_text_box(s, 0.85, col_top + 0.75 + i * 0.42, 4.3, 0.4,
                     "— " + item, font_size=15, color=INK_SOFT)

    # Right: free text
    add_rect(s, 5.65, col_top, 4.8, col_height, WHITE, line=WARNING, rounded=True)
    add_text_box(s, 5.9, col_top + 0.25, 4.3, 0.4,
                 "⚠ BURIED IN FREE TEXT",
                 font_size=10, color=WARNING, bold=True, letter_spacing=200)
    free_text = ["Excluded medications", "Lab value thresholds", "Performance status (ECOG)", "Prior treatment history", "Compound conditional rules"]
    for i, item in enumerate(free_text):
        add_text_box(s, 5.9, col_top + 0.75 + i * 0.42, 4.3, 0.4,
                     "— " + item, font_size=15, color=INK_SOFT)

    add_footer(s, 4)

    # ════════════════════════════════════════════════════════════
    # SLIDE 5 — ARCHITECTURE
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "Architecture")

    add_text_box(s, 0.6, 1.1, 10, 0.9,
                 "Four layers. One deliberate split.",
                 font_size=36, color=INK, bold=True, letter_spacing=-20)

    # Pipeline boxes
    # Layer 1: Source
    add_rect(s, 1.5, 2.3, 7.7, 0.65, PAPER_ALT, line=LINE_SOFT, rounded=True)
    add_text_box(s, 1.5, 2.45, 7.7, 0.4, "ClinicalTrials.gov API v2",
                 font_size=13, color=INK, align="center", bold=True)

    # Arrow
    add_text_box(s, 5.2, 2.95, 0.4, 0.3, "↓", font_size=18, color=INK_FAINT, align="center")

    # Layer 2: trials.db
    add_rect(s, 1.5, 3.3, 7.7, 0.65, WHITE, line=LINE, rounded=True)
    add_text_box(s, 1.5, 3.42, 7.7, 0.4,
                 "trials.db  ·  65,081 trials  ·  411,042 locations  ·  read-only",
                 font_size=13, color=INK, align="center", font_name=FONT_MONO)

    # Arrow branching
    add_text_box(s, 5.2, 3.95, 0.4, 0.3, "↓", font_size=18, color=INK_FAINT, align="center")

    # Layer 3: Rule parser → parsed.db
    add_rect(s, 1.5, 4.3, 7.7, 0.8, RGBColor(0xE6, 0xF4, 0xFD), line=ACCENT, rounded=True)
    add_text_box(s, 1.5, 4.4, 7.7, 0.4,
                 "Rule-based parser  (RxNorm + regex + scispaCy)",
                 font_size=13, color=ACCENT, align="center", bold=True)
    add_text_box(s, 1.5, 4.75, 7.7, 0.3,
                 "86 seconds · writes parsed.db (structured criteria)",
                 font_size=11, color=INK_MUTE, align="center")

    # Arrow
    add_text_box(s, 5.2, 5.1, 0.4, 0.3, "↓", font_size=18, color=INK_FAINT, align="center")

    # Layer 4: Matching engine
    add_rect(s, 1.5, 5.45, 7.7, 0.65, DARK, rounded=True)
    add_text_box(s, 1.5, 5.57, 7.7, 0.4,
                 "Matching engine  ·  deterministic  ·  no AI in the loop",
                 font_size=13, color=WHITE, align="center", bold=True)

    # Arrow
    add_text_box(s, 5.2, 6.1, 0.4, 0.3, "↓", font_size=18, color=INK_FAINT, align="center")

    # Layer 5: LLM
    add_rect(s, 1.5, 6.4, 7.7, 0.65, RGBColor(0xFF, 0xF4, 0xE0), line=WARNING, rounded=True)
    add_text_box(s, 1.5, 6.52, 7.7, 0.4,
                 "User-facing LLM  ·  chat + match explanations  ·  Groq Llama 3.3",
                 font_size=13, color=RGBColor(0xA6, 0x69, 0x0A), align="center", bold=True)

    add_footer(s, 5)

    # ════════════════════════════════════════════════════════════
    # SLIDE 6 — DESIGN DECISION
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "The Design Decision")

    add_text_box(s, 0.6, 1.1, 10, 1.4,
                 "LLMs for language.\nRules for decisions.",
                 font_size=44, color=INK, bold=True, letter_spacing=-28, line_spacing=1.05)

    # Comparison table
    table_top = 3.6
    headers = ["", "LLM-only parser", "Hybrid (ours)"]
    rows = [
        ("Runtime on 65k", "~50 hours", "86 seconds"),
        ("Cost to operate", "Compute or API $$", "$0"),
        ("Determinism", "No — drifts", "Yes"),
        ("Auditable", "Hard", "Trivial"),
        ("Language Q&A", "N/A (batch only)", "Separate LLM layer"),
    ]

    col_widths = [3.3, 3.3, 3.3]
    col_lefts = [0.6, 3.9, 7.2]
    row_height = 0.5

    # Header row
    for i, h in enumerate(headers):
        color = INK_FAINT if i == 0 else (RGBColor(0xA6, 0x69, 0x0A) if i == 1 else ACCENT)
        bold = i != 0
        add_text_box(s, col_lefts[i], table_top, col_widths[i], row_height,
                     h, font_size=12, color=color, bold=bold, letter_spacing=150)

    # Divider
    add_rect(s, 0.6, table_top + 0.5, 9.9, 0.03, INK)

    # Data rows
    for r, row in enumerate(rows):
        y = table_top + 0.65 + r * row_height
        for c, cell in enumerate(row):
            color = INK_MUTE if c == 0 else (INK if c != 0 else INK)
            bold = c == 0
            add_text_box(s, col_lefts[c], y, col_widths[c], row_height,
                         cell, font_size=14, color=color, bold=bold)
        # Light divider
        add_rect(s, 0.6, y + 0.45, 9.9, 0.01, LINE_SOFT)

    add_footer(s, 6)

    # ════════════════════════════════════════════════════════════
    # SLIDE 7 — LIVE DEMO
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, DEEP)

    add_eyebrow(s, 0.6, 0.6, "Demo Time", color=ACCENT_LIGHT)

    # Big title
    add_text_box(s, 0.6, 1.3, 10, 2.5, "Let's see it.",
                 font_size=100, color=WHITE, bold=True, letter_spacing=-50, anchor="top")

    # URL box
    add_rect(s, 2.5, 4.5, 5.5, 1.0, RGBColor(0x1A, 0x25, 0x40), line=None, rounded=True)
    add_text_box(s, 2.5, 4.75, 5.5, 0.5,
                 "localhost:3000",
                 font_size=28, color=WHITE, align="center", font_name=FONT_MONO)

    add_text_box(s, 0.6, 6.1, 10, 0.5,
                 "Demo flow: T2 Diabetes patient → Match → Trial detail → Explainer → Chat → Warfarin exclusion",
                 font_size=12, color=RGBColor(0x86, 0x86, 0x8B), align="center", italic=True)

    add_footer(s, 7, dark_bg=True)

    # ════════════════════════════════════════════════════════════
    # SLIDE 8 — WHAT RUNS WHERE
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "Separation Of Concerns")

    add_text_box(s, 0.6, 1.1, 10, 1.0,
                 "Three layers. Each does what it's best at.",
                 font_size=32, color=INK, bold=True, letter_spacing=-20)

    # Three concentric / stacked boxes
    y = 3.0
    layers = [
        ("65,081 trials · 411k sites · static source of truth", "DATA", PAPER_ALT, INK, INK_MUTE),
        ("Age · gender · condition · medication · lab · proximity → weighted score", "DETERMINISTIC MATCHING", WHITE, INK, ACCENT),
        ("Chat Q&A · match explanations · plain-English narratives", "LLM — USER-FACING LANGUAGE", RGBColor(0xFF, 0xF4, 0xE0), RGBColor(0xA6, 0x69, 0x0A), WARNING),
    ]
    for i, (body, label, fill, text_color, accent) in enumerate(layers):
        top = y + i * 1.3
        add_rect(s, 0.8, top, 9.5, 1.1, fill, line=accent, rounded=True)
        add_text_box(s, 1.1, top + 0.2, 9, 0.4,
                     label, font_size=10, color=accent, bold=True, letter_spacing=250)
        add_text_box(s, 1.1, top + 0.55, 9, 0.5,
                     body, font_size=15, color=text_color)

    add_footer(s, 8)

    # ════════════════════════════════════════════════════════════
    # SLIDE 9 — DESIGN PRINCIPLES
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "Design")

    add_text_box(s, 0.6, 1.1, 10, 1.4,
                 "Three principles.",
                 font_size=42, color=INK, bold=True, letter_spacing=-25)

    principles = [
        ("01",
         "Show. Don't just tell.",
         "3D scroll storytelling on the landing page walks a patient through the matching story — chaos, library, scan, verdict. The product explains itself before anyone reads a button."),
        ("02",
         "Every criterion visible.",
         "No black-box match scores. If a trial ranks 94%, we show exactly which 6 of 6 criteria contributed, and the parsed requirement each was compared against. Transparency is a feature."),
        ("03",
         "Patients shouldn't need a dictionary.",
         "The chat agent and match explainer translate clinical jargon into plain English — always grounded in that specific trial's text, never hallucinating."),
    ]

    card_top = 2.9
    for i, (num, title, body) in enumerate(principles):
        y = card_top + i * 1.35
        add_rect(s, 0.6, y, 9.8, 1.2, WHITE, line=LINE_SOFT, rounded=True)
        add_text_box(s, 0.9, y + 0.25, 0.6, 0.6,
                     num, font_size=24, color=ACCENT, bold=True, font_name=FONT_MONO)
        add_text_box(s, 1.7, y + 0.2, 7.9, 0.5,
                     title, font_size=17, color=INK, bold=True)
        add_text_box(s, 1.7, y + 0.6, 7.9, 0.7,
                     body, font_size=11.5, color=INK_MUTE, line_spacing=1.4)

    add_footer(s, 9)

    # ════════════════════════════════════════════════════════════
    # SLIDE 10 — LLM STRATEGY
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "LLM Strategy")

    add_text_box(s, 0.6, 1.1, 10, 1.4,
                 "Where only an LLM wins.",
                 font_size=42, color=INK, bold=True, letter_spacing=-25)

    add_text_box(s, 0.6, 2.4, 9.5, 0.5,
                 "Not for matching. Not for scoring. Only for language the rule engine can't handle.",
                 font_size=15, color=INK_MUTE)

    # Three cards
    cards = [
        ("Chat agent",
         "\"Can I join if I'm on warfarin?\"",
         "RAG over the trial's eligibility text. Grounds strictly in the published criteria. Refuses out-of-context questions."),
        ("Match explainer",
         "\"Explain in plain English.\"",
         "Takes deterministic verdicts, writes a 2-sentence narrative citing the exclusion by name — \"your Warfarin is on the exclusion list.\""),
        ("Query expansion",
         "\"heart problems\" → MeSH",
         "Translates patient-lay terms into standard medical concepts. Planned — pipeline ready, not yet shipped."),
    ]

    card_width = 3.1
    card_gap = 0.15
    card_top = 3.4
    card_height = 3.0

    for i, (title, example, body) in enumerate(cards):
        left = 0.6 + i * (card_width + card_gap)
        add_rect(s, left, card_top, card_width, card_height, WHITE, line=LINE_SOFT, rounded=True)

        # Icon bar
        add_rect(s, left, card_top, card_width, 0.12, ACCENT if i < 2 else INK_FAINT)

        add_text_box(s, left + 0.3, card_top + 0.3, card_width - 0.6, 0.5,
                     title, font_size=16, color=INK, bold=True)
        add_text_box(s, left + 0.3, card_top + 0.85, card_width - 0.6, 0.5,
                     example, font_size=11, color=ACCENT, italic=True, font_name=FONT_MONO)
        add_text_box(s, left + 0.3, card_top + 1.5, card_width - 0.6, 1.4,
                     body, font_size=11, color=INK_MUTE, line_spacing=1.45)

    add_footer(s, 10)

    # ════════════════════════════════════════════════════════════
    # SLIDE 11 — RESULTS
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "In Numbers")

    add_text_box(s, 0.6, 1.1, 10, 1.4,
                 "What we shipped.",
                 font_size=42, color=INK, bold=True, letter_spacing=-25)

    stats = [
        ("65,081", "trials indexed"),
        ("411,042", "trial sites with lat/lng"),
        ("21,191", "trials with parsed medication exclusions"),
        ("19,062", "trials with parsed lab thresholds"),
        ("86 sec", "to parse the entire corpus"),
        ("$0", "ongoing cost to operate"),
    ]

    cols = 3
    stat_width = 3.1
    stat_height = 1.4
    stat_gap = 0.15
    stat_top = 3.2

    for i, (n, label) in enumerate(stats):
        row = i // cols
        col = i % cols
        left = 0.6 + col * (stat_width + stat_gap)
        top = stat_top + row * (stat_height + 0.15)

        add_rect(s, left, top, stat_width, stat_height, WHITE, line=LINE_SOFT, rounded=True)
        add_text_box(s, left + 0.25, top + 0.2, stat_width - 0.5, 0.7,
                     n, font_size=32, color=ACCENT, bold=True, letter_spacing=-20, font_name=FONT_MONO)
        add_text_box(s, left + 0.25, top + 0.95, stat_width - 0.5, 0.4,
                     label, font_size=11, color=INK_MUTE, line_spacing=1.3)

    add_text_box(s, 0.6, 6.3, 10, 0.5,
                 "Zero accounts · zero tracking · zero analytics · zero telemetry.",
                 font_size=14, color=INK_MUTE, align="center", italic=True)

    add_footer(s, 11)

    # ════════════════════════════════════════════════════════════
    # SLIDE 12 — DATA VIZ: The Corpus (phase + conditions)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.4, "The Corpus, Visualized")
    add_text_box(s, 0.6, 0.85, 10, 0.9,
                 "What the agent is grounded in.",
                 font_size=32, color=INK, bold=True, letter_spacing=-20)

    # Two charts side by side
    add_image(s, CHARTS_DIR / "phase_donut.png",
              left_in=0.3, top_in=2.0, height_in=4.5)
    add_image(s, CHARTS_DIR / "top_conditions.png",
              left_in=5.2, top_in=2.0, height_in=4.5)

    add_text_box(s, 0.6, 6.85, 10, 0.3,
                 "Phase distribution across 65,081 actively recruiting trials  ·  top 10 conditions by MeSH tag count",
                 font_size=10, color=INK_FAINT, align="center", italic=True)
    add_footer(s, 12)

    # ════════════════════════════════════════════════════════════
    # SLIDE 13 — DATA VIZ: Parser output
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.4, "What The Parser Extracted")
    add_text_box(s, 0.6, 0.85, 10, 0.9,
                 "Structured criteria from free-text eligibility.",
                 font_size=30, color=INK, bold=True, letter_spacing=-20)

    # Top half: coverage bars, full width
    add_image(s, CHARTS_DIR / "parser_coverage.png",
              left_in=0.3, top_in=1.9, width_in=10)

    # Bottom half: most-excluded meds
    add_image(s, CHARTS_DIR / "top_excluded_meds.png",
              left_in=0.3, top_in=4.1, width_in=10)

    add_footer(s, 13)

    # ════════════════════════════════════════════════════════════
    # SLIDE 14 — DATA VIZ: Funnel + agent decision flow
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.4, "The Agentic Layer")
    add_text_box(s, 0.6, 0.85, 10, 0.9,
                 "How the agent decides. How the funnel narrows.",
                 font_size=28, color=INK, bold=True, letter_spacing=-20)

    # Funnel left, decision flow right
    add_image(s, CHARTS_DIR / "funnel.png",
              left_in=0.3, top_in=2.0, height_in=4.5)
    add_image(s, CHARTS_DIR / "agent_decision.png",
              left_in=5.3, top_in=2.0, height_in=4.5)

    add_text_box(s, 0.6, 6.85, 10, 0.3,
                 "Left: SQL pre-filter → scoring → top matches  ·  Right: chat agent grounded-refusal decision flow",
                 font_size=10, color=INK_FAINT, align="center", italic=True)
    add_footer(s, 14)

    # ════════════════════════════════════════════════════════════
    # SLIDE 15 — LIMITATIONS  (was 12)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, PAPER)

    add_eyebrow(s, 0.6, 0.6, "Honest About What's Not Solved", color=WARNING)

    add_text_box(s, 0.6, 1.1, 10, 1.2,
                 "Limitations.",
                 font_size=42, color=INK, bold=True, letter_spacing=-25)

    limits = [
        ("Research prototype.",
         "Not a medical device. Final eligibility is the trial investigators' call."),
        ("Parser coverage is partial.",
         "~33% of trials have medication exclusions extracted, ~29% have lab thresholds. Unusual phrasings slip through."),
        ("No LLM fallback yet.",
         "Low-confidence rule-parsed trials could be re-parsed by an LLM. Schema is ready; we haven't run it."),
        ("Formal evaluation pending.",
         "Qualitative spot-checks via CSV. No published F1 score against hand-labeled ground truth yet."),
    ]

    item_top = 2.8
    for i, (title, body) in enumerate(limits):
        y = item_top + i * 0.9
        # Warning dot
        add_rect(s, 0.6, y + 0.15, 0.15, 0.15, WARNING, rounded=True)
        add_text_box(s, 0.95, y, 9, 0.4,
                     title, font_size=16, color=INK, bold=True)
        add_text_box(s, 0.95, y + 0.4, 9, 0.5,
                     body, font_size=12.5, color=INK_MUTE, line_spacing=1.4)

    add_footer(s, 15)

    # ════════════════════════════════════════════════════════════
    # SLIDE 16 — CLOSING  (was 13)
    # ════════════════════════════════════════════════════════════
    s = prs.slides.add_slide(blank)
    set_slide_bg(s, DEEP)

    # Big tagline
    add_text_box(s, 0.6, 2.0, 10, 1.5,
                 "LLMs for language.",
                 font_size=60, color=WHITE, bold=True, letter_spacing=-30)
    add_text_box(s, 0.6, 3.0, 10, 1.5,
                 "Rules for decisions.",
                 font_size=60, color=ACCENT_LIGHT, bold=True, letter_spacing=-30)

    # Divider
    add_rect(s, 0.6, 4.5, 0.6, 0.04, ACCENT_LIGHT)

    # Bottom line
    add_text_box(s, 0.6, 4.8, 10, 0.5,
                 "CureMatch.",
                 font_size=22, color=WHITE, bold=True)
    add_text_box(s, 0.6, 5.2, 10, 0.5,
                 "Thank you. Questions?",
                 font_size=18, color=RGBColor(0x86, 0x86, 0x8B))

    add_footer(s, 16, dark_bg=True)

    # ════════════════════════════════════════════════════════════
    prs.save(out_path)
    print(f"\n✅ Presentation saved to: {out_path}")
    print(f"   {prs.slide_width / 914400:.2f}\" × {prs.slide_height / 914400:.2f}\" (16:9)")
    print(f"   {len(prs.slides)} slides")


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "CureMatch_Presentation.pptx"
    build(out)
