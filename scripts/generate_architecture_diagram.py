#!/usr/bin/env python3
"""
Generate architecture.png — a clean layered diagram of the CureMatch system.

Layers, top to bottom:
  User → Frontend (Next.js pages + client libs)
       → API routes (Next.js server)
       → Business logic (lib/)
       → Data (SQLite + JSON)

Off to the right: external services (Groq, Nominatim, ClinicalTrials.gov).
Off to the bottom: offline pipelines (fetch_trials.py, parse_rules.py, fine-tune).

Output: data/charts/architecture.png
"""

from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch


# ─── Palette (matches the deck) ─────────────────────────────────
INK       = "#1D1D1F"
INK_SOFT  = "#3B3B41"
INK_MUTE  = "#6E6E73"
INK_FAINT = "#86868B"
LINE      = "#D2D2D7"
LINE_SOFT = "#E8E8ED"
PAPER     = "#FBFBFD"
PAPER_ALT = "#F5F5F7"
WHITE     = "#FFFFFF"

ACCENT    = "#0071E3"
ACCENT_LT = "#E6F4FD"
SUCCESS   = "#30D158"
SUCCESS_LT = "#E6F7EB"
WARNING   = "#FF9F0A"
WARNING_LT = "#FFF4E0"
PURPLE    = "#BF5AF2"
PURPLE_LT = "#F6EDFD"


def box(ax, x, y, w, h, title, *, subtitle=None, fill=WHITE, accent=ACCENT,
        title_size=11, subtitle_size=9, title_weight="bold"):
    """Rounded rectangle with a thin top accent bar, title, optional subtitle."""
    # Accent bar
    ax.add_patch(FancyBboxPatch(
        (x, y + h - 0.10), w, 0.10,
        boxstyle="round,pad=0,rounding_size=0.06",
        facecolor=accent, edgecolor="none", zorder=3,
    ))
    # Main card
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0,rounding_size=0.06",
        facecolor=fill, edgecolor=LINE, linewidth=1.0, zorder=2,
    ))
    # Title
    if subtitle:
        ax.text(x + w / 2, y + h * 0.60, title,
                ha="center", va="center",
                fontsize=title_size, color=INK, fontweight=title_weight, zorder=4)
        ax.text(x + w / 2, y + h * 0.30, subtitle,
                ha="center", va="center",
                fontsize=subtitle_size, color=INK_MUTE, zorder=4)
    else:
        ax.text(x + w / 2, y + h / 2 - 0.05, title,
                ha="center", va="center",
                fontsize=title_size, color=INK, fontweight=title_weight, zorder=4)


def band(ax, x, y, w, h, label, *, fill=PAPER_ALT):
    """Subtle horizontal band behind a row of boxes. Label sits on top-left."""
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0,rounding_size=0.10",
        facecolor=fill, edgecolor="none", zorder=1,
    ))
    # Label floats ABOVE the band at its top-left, not inside
    ax.text(x + 0.05, y + h + 0.05, label.upper(),
            ha="left", va="bottom",
            fontsize=8.5, color=INK_FAINT, fontweight="bold", zorder=2)


def arrow(ax, x1, y1, x2, y2, *, color=INK_MUTE, style="-|>", lw=1.2,
          dashed=False, curvature=0.0):
    ls = "--" if dashed else "-"
    conn = f"arc3,rad={curvature}" if curvature else "arc3,rad=0"
    a = FancyArrowPatch(
        (x1, y1), (x2, y2),
        arrowstyle=style, color=color, lw=lw,
        mutation_scale=12, zorder=5, linestyle=ls,
        connectionstyle=conn,
    )
    ax.add_patch(a)


def render(out: Path):
    out.parent.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(14.5, 9.5), facecolor=PAPER, dpi=150)
    ax.set_facecolor(PAPER)
    ax.set_xlim(0, 20)
    ax.set_ylim(0, 13.5)
    ax.axis("off")

    # ── Title ──────────────────────────────────────────────────
    ax.text(0.3, 12.9, "CureMatch · system architecture",
            ha="left", va="bottom",
            fontsize=19, color=INK, fontweight="bold")
    ax.text(0.3, 12.5,
            "LLMs read. Rules decide. Humans verify. Three layers, one deterministic pipeline, two LLMs.",
            ha="left", va="bottom",
            fontsize=11, color=INK_MUTE, style="italic")

    # ══════════════════════════════════════════════════════════
    # BAND 1 — CLIENT (User + Frontend)
    # ══════════════════════════════════════════════════════════
    band(ax, 0.3, 10.0, 14.5, 1.9, "Client  ·  browser")

    # User
    box(ax, 0.8, 10.3, 1.9, 1.3, "Patient",
        subtitle="profile + Qs",
        fill=ACCENT_LT, accent=ACCENT,
        title_size=11, subtitle_size=9)

    # Frontend big card
    box(ax, 3.4, 10.3, 11.0, 1.3,
        "Next.js 14 · React Three Fiber · GSAP · Leaflet · Recharts",
        subtitle="/ · /match · /results · /trial/[id] · /data · /about · /saved",
        fill=WHITE, accent=ACCENT,
        title_size=11, subtitle_size=9)

    # ══════════════════════════════════════════════════════════
    # BAND 2 — SERVER: API ROUTES
    # ══════════════════════════════════════════════════════════
    band(ax, 0.3, 7.6, 14.5, 2.0, "Server  ·  /api/ routes (Next.js)")

    # Shorter labels — drop the /api/ prefix which is implied by the band title
    apis = [
        ("match",            "POST · rank 65k",        ACCENT),
        ("trials/[id]",      "GET · verdicts",         ACCENT),
        ("conditions",       "GET · autocomplete",     ACCENT),
        ("match/explain",    "LLM #1 · narrative",     WARNING),
        ("chat/[nctId]",     "LLM #2 · chat agent",    PURPLE),
        ("stats",            "GET · counts",           ACCENT),
    ]
    api_w = 2.25
    api_h = 1.5
    api_gap = 0.15
    api_top = 7.75
    total_w = len(apis) * api_w + (len(apis) - 1) * api_gap
    api_left = (14.5 - total_w) / 2 + 0.3
    for i, (title, sub, color) in enumerate(apis):
        x = api_left + i * (api_w + api_gap)
        box(ax, x, api_top, api_w, api_h,
            title, subtitle=sub,
            fill=WHITE, accent=color,
            title_size=12, subtitle_size=9,
            title_weight="bold")

    # Arrow from frontend band down to API band
    arrow(ax, 8.9, 10.25, 8.9, 9.42, lw=1.5)
    ax.text(9.05, 9.8, "HTTP / streaming",
            fontsize=8.5, color=INK_MUTE, style="italic", va="center")

    # ══════════════════════════════════════════════════════════
    # BAND 3 — BUSINESS LOGIC (lib/)
    # ══════════════════════════════════════════════════════════
    band(ax, 0.3, 5.2, 14.5, 2.1, "Business logic  ·  lib/")

    logic = [
        ("scoring.ts",    "6 criteria\nweighted composite",      ACCENT),
        ("db.ts",         "read-only trials.db\nsingleton",      SUCCESS),
        ("parsed-db.ts",  "derived parsed.db\nsingleton",        SUCCESS),
        ("llm.ts",        "pluggable client\nGroq · streaming",  PURPLE),
    ]
    l_w = 3.1
    l_h = 1.5
    l_gap = 0.25
    l_top = 5.5
    l_total = len(logic) * l_w + (len(logic) - 1) * l_gap
    l_left = (14.5 - l_total) / 2 + 0.3
    for i, (title, sub, color) in enumerate(logic):
        x = l_left + i * (l_w + l_gap)
        box(ax, x, l_top, l_w, l_h,
            title, subtitle=sub,
            fill=WHITE, accent=color,
            title_size=11, subtitle_size=9,
            title_weight="bold")

    # Arrow: APIs → business logic
    arrow(ax, 8.9, 7.82, 8.9, 7.02, lw=1.5)

    # ══════════════════════════════════════════════════════════
    # BAND 4 — DATA
    # ══════════════════════════════════════════════════════════
    band(ax, 0.3, 2.8, 14.5, 2.1, "Data  ·  SQLite + JSON")

    data_boxes = [
        ("trials.db",
         "65,081 trials\n411,042 locations\n236,300 interventions",
         ACCENT),
        ("parsed.db",
         "medications_excluded\nlab_thresholds · ecog\nsource · confidence",
         SUCCESS),
        ("corpus-stats.json",
         "pre-aggregated\nphase · conditions · countries\nparser coverage",
         WARNING),
        ("data/training/",
         "train.jsonl · eval.jsonl\n450 Q&A pairs\nLoRA fine-tune input",
         PURPLE),
    ]
    d_w = 3.1
    d_h = 1.6
    d_gap = 0.25
    d_top = 3.05
    d_total = len(data_boxes) * d_w + (len(data_boxes) - 1) * d_gap
    d_left = (14.5 - d_total) / 2 + 0.3
    for i, (title, sub, color) in enumerate(data_boxes):
        x = d_left + i * (d_w + d_gap)
        box(ax, x, d_top, d_w, d_h,
            title, subtitle=sub,
            fill=WHITE, accent=color,
            title_size=10.5, subtitle_size=8.8,
            title_weight="bold")

    # Arrow: logic → data
    arrow(ax, 8.9, 5.45, 8.9, 4.70, lw=1.5)

    # ══════════════════════════════════════════════════════════
    # RIGHT COLUMN — EXTERNAL SERVICES
    # ══════════════════════════════════════════════════════════
    ax.text(15.4, 12.5, "EXTERNAL  ·  third-party",
            fontsize=9, color=INK_FAINT, fontweight="bold",
            ha="left")

    ext_x = 15.4
    ext_w = 4.4
    ext_h = 1.3

    # Groq
    box(ax, ext_x, 10.0, ext_w, ext_h,
        "Groq",
        subtitle="Llama 3.3 70B Versatile\n~500 tokens/sec",
        fill=PURPLE_LT, accent=PURPLE,
        title_size=11, subtitle_size=9)
    # Nominatim
    box(ax, ext_x, 8.4, ext_w, ext_h,
        "OpenStreetMap Nominatim",
        subtitle="geocoding patient location",
        fill=SUCCESS_LT, accent=SUCCESS,
        title_size=11, subtitle_size=9)
    # CARTO
    box(ax, ext_x, 6.8, ext_w, ext_h,
        "CARTO basemap",
        subtitle="map tiles for Leaflet",
        fill=SUCCESS_LT, accent=SUCCESS,
        title_size=11, subtitle_size=9)
    # ClinicalTrials.gov
    box(ax, ext_x, 5.2, ext_w, ext_h,
        "ClinicalTrials.gov API v2",
        subtitle="source of truth (public domain)",
        fill=ACCENT_LT, accent=ACCENT,
        title_size=11, subtitle_size=9)

    # Dashed arrows from API band to external services
    # llm.ts → Groq
    arrow(ax, 14.0, 6.3, 15.35, 10.55, color=PURPLE, lw=1.2, dashed=True, curvature=-0.25)
    ax.text(15.0, 8.5, "LLM", color=PURPLE, fontsize=9, fontweight="bold",
            ha="center", va="center", rotation=0)

    # Frontend → Nominatim
    arrow(ax, 14.3, 10.9, 15.35, 9.05, color=SUCCESS, lw=1.1, dashed=True, curvature=0.2)

    # Data ← ClinicalTrials.gov (goes into trials.db via offline pipeline, shown in bottom)
    # Will draw below

    # ══════════════════════════════════════════════════════════
    # BOTTOM ROW — OFFLINE / BUILD-TIME PIPELINES
    # ══════════════════════════════════════════════════════════
    band(ax, 0.3, 0.4, 19.5, 2.1, "Offline pipelines  ·  Python + Colab · not on the request path")

    pipes = [
        ("fetch_trials.py",
         "ingest from ClinicalTrials.gov\n→ writes trials.db  (~20 min, one time)",
         ACCENT),
        ("scripts/parse_rules.py",
         "RxNorm + regex parser\n→ writes parsed.db  (86 sec)",
         SUCCESS),
        ("scripts/generate_stats.py\n+ generate_chart_images.py",
         "aggregates → corpus-stats.json\nrenders chart PNGs for deck",
         WARNING),
        ("scripts/build_training_dataset.py\n+ notebooks/finetune_curematch.ipynb",
         "450 Q&A pairs → LoRA fine-tune\nLlama 3.2 1B · rank 16 · 3 epochs",
         PURPLE),
    ]
    p_w = 4.65
    p_h = 1.55
    p_gap = 0.2
    p_top = 0.70
    p_total = len(pipes) * p_w + (len(pipes) - 1) * p_gap
    p_left = (19.5 - p_total) / 2 + 0.3
    for i, (title, sub, color) in enumerate(pipes):
        x = p_left + i * (p_w + p_gap)
        box(ax, x, p_top, p_w, p_h,
            title, subtitle=sub,
            fill=WHITE, accent=color,
            title_size=10, subtitle_size=8.7,
            title_weight="bold")

    # fetch_trials.py → trials.db (upward arrow into the data band)
    arrow(ax, p_left + p_w / 2, 2.25, 4.40, 3.05,
          color=ACCENT, lw=1.1, dashed=True, curvature=-0.15)
    # parse_rules.py → parsed.db
    arrow(ax, p_left + p_w * 1.5 + p_gap, 2.25,
          7.75, 3.05,
          color=SUCCESS, lw=1.1, dashed=True, curvature=0.0)
    # stats → corpus-stats.json
    arrow(ax, p_left + p_w * 2.5 + 2 * p_gap, 2.25,
          11.10, 3.05,
          color=WARNING, lw=1.1, dashed=True, curvature=0.05)
    # training + notebook → training/
    arrow(ax, p_left + p_w * 3.5 + 3 * p_gap, 2.25,
          14.45, 3.05,
          color=PURPLE, lw=1.1, dashed=True, curvature=0.1)

    # ClinicalTrials.gov → fetch_trials.py (dashed into the offline pipeline)
    arrow(ax, 15.4 + ext_w / 2, 5.15,
          p_left + p_w / 2, 2.25,
          color=ACCENT, lw=1.1, dashed=True, curvature=-0.25)

    # ── Legend / footer ────────────────────────────────────────
    legend_items = [
        (ACCENT,  "data + query path"),
        (PURPLE,  "LLM call"),
        (SUCCESS, "storage + geo"),
        (WARNING, "derived / pre-aggregated"),
    ]
    ly = 0.18
    lx = 0.35
    for color, label in legend_items:
        ax.add_patch(FancyBboxPatch(
            (lx, ly), 0.22, 0.14,
            boxstyle="round,pad=0,rounding_size=0.03",
            facecolor=color, edgecolor="none",
        ))
        ax.text(lx + 0.30, ly + 0.07, label,
                ha="left", va="center",
                fontsize=8.5, color=INK_MUTE)
        lx += len(label) * 0.09 + 0.9

    ax.text(19.7, 0.18, "github.com/meetgajjarx07/curematch",
            ha="right", va="center",
            fontsize=8.5, color=INK_FAINT, style="italic")

    fig.savefig(out, dpi=180, facecolor=PAPER, bbox_inches="tight", pad_inches=0.3)
    plt.close(fig)
    print(f"✓ {out}")


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parent.parent
    out = project_root / "data" / "charts" / "architecture.png"
    render(out)
