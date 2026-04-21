#!/usr/bin/env python3
"""
Generate architecture.png — a C4-style container diagram for CureMatch.

One primary container row (BROWSER · SERVER · DATA) shows the runtime
request flow; external services (Groq, Nominatim, CT.gov) sit as
dashed callouts; the build-time pipeline runs as a linear sequence
across the bottom.

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

ACCENT     = "#0071E3"
ACCENT_LT  = "#E6F4FD"
SUCCESS    = "#30D158"
SUCCESS_LT = "#E6F7EB"
WARNING    = "#FF9F0A"
WARNING_LT = "#FFF4E0"
PURPLE     = "#8B5CF6"
PURPLE_LT  = "#F3EDFE"


# ─── Drawing primitives ─────────────────────────────────────────
def card(ax, x, y, w, h, *, fill=WHITE, stroke=LINE, stroke_w=1.0, radius=0.14, zorder=2):
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h,
        boxstyle=f"round,pad=0,rounding_size={radius}",
        facecolor=fill, edgecolor=stroke, linewidth=stroke_w, zorder=zorder,
    ))


def accent_strip(ax, x, y, w, color, *, thickness=0.08, zorder=3):
    ax.add_patch(FancyBboxPatch(
        (x + 0.1, y), w - 0.2, thickness,
        boxstyle="round,pad=0,rounding_size=0.04",
        facecolor=color, edgecolor="none", zorder=zorder,
    ))


def text(ax, x, y, body, *, size=10, color=INK, weight="normal",
         ha="left", va="center", style="normal", family=None):
    kw = {}
    if family:
        kw["family"] = family
    ax.text(x, y, body, fontsize=size, color=color,
            fontweight=weight, ha=ha, va=va, fontstyle=style,
            zorder=6, **kw)


def arrow(ax, x1, y1, x2, y2, *, color=INK_MUTE, lw=1.6,
          dashed=False, curve=0.0, head=14):
    ls = (0, (4, 3)) if dashed else "-"
    ax.add_patch(FancyArrowPatch(
        (x1, y1), (x2, y2),
        arrowstyle="-|>",
        color=color, lw=lw,
        linestyle=ls,
        mutation_scale=head,
        zorder=5,
        connectionstyle=f"arc3,rad={curve}",
    ))


def badge(ax, x, y, label, *, fill=ACCENT, color=WHITE, r=0.17):
    """Small numbered circle label for arrow sequences."""
    ax.add_patch(plt.Circle((x, y), r, facecolor=fill, edgecolor="none", zorder=7))
    text(ax, x, y, label, size=9, color=color, weight="bold",
         ha="center", va="center")


# ─── Render ─────────────────────────────────────────────────────
def render(out: Path):
    out.parent.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(18, 11), facecolor=PAPER, dpi=150)
    ax.set_facecolor(PAPER)
    ax.set_xlim(0, 18)
    ax.set_ylim(0, 11)
    ax.axis("off")

    # ── Title ─────────────────────────────────────────────────
    text(ax, 0.5, 10.55, "CureMatch · system architecture",
         size=22, color=INK, weight="bold", va="bottom")
    text(ax, 0.5, 10.15,
         "Runtime request flow for a patient matching against 65,081 trials.",
         size=12, color=INK_MUTE, va="bottom", style="italic")

    # ══════════════════════════════════════════════════════════
    # Row 1 — RUNTIME:   BROWSER  ·  NEXT.JS SERVER  ·  DATA
    # ══════════════════════════════════════════════════════════

    # ── BROWSER container ─────────────────────────────────────
    bx, by, bw, bh = 0.5, 3.7, 4.3, 5.5
    card(ax, bx, by, bw, bh, fill=WHITE, stroke=LINE, stroke_w=1.4)
    accent_strip(ax, bx, by + bh - 0.14, bw, ACCENT)

    text(ax, bx + 0.3, by + bh - 0.45, "BROWSER",
         size=10, color=ACCENT, weight="bold")
    text(ax, bx + 0.3, by + bh - 0.85, "Patient's laptop or phone",
         size=11, color=INK, weight="bold")

    # Patient pill
    card(ax, bx + 0.3, by + bh - 1.85, bw - 0.6, 0.75,
         fill=ACCENT_LT, stroke=ACCENT, stroke_w=1.0, radius=0.1)
    text(ax, bx + bw / 2, by + bh - 1.47, "Patient",
         size=12, color=INK, weight="bold", ha="center")

    # Stack: tech list
    text(ax, bx + 0.3, by + bh - 2.4, "Next.js 14 React app",
         size=10, color=INK_SOFT, weight="bold")
    tech_lines = [
        "React Three Fiber  ·  3D scenes",
        "GSAP + Lenis  ·  scroll motion",
        "Leaflet  ·  map + geocoding UI",
        "Recharts  ·  /data dashboard",
    ]
    for i, line in enumerate(tech_lines):
        text(ax, bx + 0.3, by + bh - 2.85 - i * 0.32, line,
             size=10, color=INK_MUTE)

    text(ax, bx + 0.3, by + 0.75, "Pages",
         size=9, color=INK_FAINT, weight="bold")
    text(ax, bx + 0.3, by + 0.45,
         "/   /match   /results   /trial/[id]",
         size=9, color=INK_MUTE, family="monospace")
    text(ax, bx + 0.3, by + 0.18,
         "/data   /about   /saved",
         size=9, color=INK_MUTE, family="monospace")

    # ── SERVER container (middle, largest) ────────────────────
    sx, sy, sw, sh = 5.3, 3.7, 8.3, 5.5
    card(ax, sx, sy, sw, sh, fill=WHITE, stroke=LINE, stroke_w=1.4)
    accent_strip(ax, sx, sy + sh - 0.14, sw, INK)

    text(ax, sx + 0.3, sy + sh - 0.45, "NEXT.JS SERVER",
         size=10, color=INK, weight="bold")
    text(ax, sx + 0.3, sy + sh - 0.85, "API routes + business logic + LLM client",
         size=11, color=INK, weight="bold")

    # Sub-card: API routes
    api_x, api_y, api_w, api_h = sx + 0.3, sy + sh - 3.25, sw - 0.6, 2.15
    card(ax, api_x, api_y, api_w, api_h, fill=PAPER_ALT, stroke=LINE_SOFT, radius=0.1)
    text(ax, api_x + 0.2, api_y + api_h - 0.28, "API ROUTES  ·  /api/*",
         size=9, color=INK_FAINT, weight="bold")

    # 6 API chips in 2 rows × 3 cols
    chips = [
        ("match",         "POST · rank",         ACCENT,  "deterministic"),
        ("trials/[id]",   "GET · verdicts",      ACCENT,  "deterministic"),
        ("conditions",    "GET · autocomplete",  ACCENT,  "deterministic"),
        ("match/explain", "POST · narrative",    WARNING, "LLM #1"),
        ("chat/[nctId]",  "POST · chat agent",   PURPLE,  "LLM #2"),
        ("stats",         "GET · counts",        ACCENT,  "deterministic"),
    ]
    cw, ch, cgap = 2.35, 0.72, 0.10
    col_x0 = api_x + 0.2
    row_y_top = api_y + api_h - 0.70
    for i, (name, verb, color, _) in enumerate(chips):
        r, c = i // 3, i % 3
        cx = col_x0 + c * (cw + cgap)
        cy = row_y_top - r * (ch + cgap)
        card(ax, cx, cy, cw, ch, fill=WHITE, stroke=LINE_SOFT, radius=0.08)
        accent_strip(ax, cx, cy + ch - 0.08, cw, color, thickness=0.06)
        text(ax, cx + 0.15, cy + ch - 0.28, name,
             size=10, color=INK, weight="bold", family="monospace")
        text(ax, cx + 0.15, cy + 0.18, verb,
             size=8.5, color=INK_MUTE)

    # Sub-card: Business logic (lib/)
    lib_x, lib_y, lib_w, lib_h = sx + 0.3, sy + 0.25, sw - 0.6, 1.15
    card(ax, lib_x, lib_y, lib_w, lib_h, fill=PAPER_ALT, stroke=LINE_SOFT, radius=0.1)
    text(ax, lib_x + 0.2, lib_y + lib_h - 0.28, "BUSINESS LOGIC  ·  lib/",
         size=9, color=INK_FAINT, weight="bold")

    libs = [
        ("scoring.ts",     "6-criterion weighted score",   ACCENT),
        ("db.ts",          "read-only trials.db",          SUCCESS),
        ("parsed-db.ts",   "derived parsed.db",            SUCCESS),
        ("llm.ts",         "Groq client · streaming",      PURPLE),
    ]
    lw_col = (lib_w - 0.4 - 3 * 0.08) / 4
    for i, (name, note, color) in enumerate(libs):
        lx = lib_x + 0.2 + i * (lw_col + 0.08)
        ly = lib_y + 0.1
        card(ax, lx, ly, lw_col, 0.58, fill=WHITE, stroke=LINE_SOFT, radius=0.07)
        accent_strip(ax, lx, ly + 0.48, lw_col, color, thickness=0.05)
        text(ax, lx + 0.12, ly + 0.32, name,
             size=9.5, color=INK, weight="bold", family="monospace")
        text(ax, lx + 0.12, ly + 0.11, note,
             size=8.3, color=INK_MUTE)

    # ── DATA container ────────────────────────────────────────
    dx, dy, dw, dh = 14.1, 3.7, 3.4, 5.5
    card(ax, dx, dy, dw, dh, fill=WHITE, stroke=LINE, stroke_w=1.4)
    accent_strip(ax, dx, dy + dh - 0.14, dw, SUCCESS)

    text(ax, dx + 0.3, dy + dh - 0.45, "DATA",
         size=10, color=SUCCESS, weight="bold")
    text(ax, dx + 0.3, dy + dh - 0.85, "Local SQLite + static JSON",
         size=11, color=INK, weight="bold")

    data_items = [
        ("trials.db",
         "65,081 trials\n411,042 locations\n236,300 interventions",
         ACCENT),
        ("parsed.db",
         "medications_excluded\nlab_thresholds · ecog\nsource · confidence",
         SUCCESS),
        ("corpus-stats.json",
         "phase · conditions\ntop countries\nparser coverage",
         WARNING),
    ]
    di_h = 1.35
    di_gap = 0.15
    di_top = dy + dh - 1.15
    for i, (name, body, color) in enumerate(data_items):
        iy = di_top - (i + 1) * di_h - i * di_gap
        card(ax, dx + 0.3, iy, dw - 0.6, di_h, fill=WHITE, stroke=LINE_SOFT, radius=0.08)
        accent_strip(ax, dx + 0.3, iy + di_h - 0.08, dw - 0.6, color, thickness=0.06)
        text(ax, dx + 0.45, iy + di_h - 0.32, name,
             size=10, color=INK, weight="bold", family="monospace")
        body_lines = body.split("\n")
        for bi, ln in enumerate(body_lines):
            text(ax, dx + 0.45, iy + di_h - 0.58 - bi * 0.22, ln,
                 size=8.5, color=INK_MUTE)

    # ══════════════════════════════════════════════════════════
    # Arrows — numbered request flow
    # ══════════════════════════════════════════════════════════

    # 1 · Browser → Server (HTTP)
    arrow(ax, bx + bw, by + bh / 2 + 0.3,
          sx, by + bh / 2 + 0.3, lw=1.8)
    badge(ax, (bx + bw + sx) / 2, by + bh / 2 + 0.68, "1")
    text(ax, (bx + bw + sx) / 2, by + bh / 2 - 0.1, "HTTP / JSON",
         size=8, color=INK_MUTE, ha="center", style="italic")

    # 2 · Server → Data (SQL)
    arrow(ax, sx + sw, by + bh / 2 + 0.3,
          dx, by + bh / 2 + 0.3, lw=1.8)
    badge(ax, (sx + sw + dx) / 2, by + bh / 2 + 0.68, "2")
    text(ax, (sx + sw + dx) / 2, by + bh / 2 - 0.1, "SQL",
         size=8, color=INK_MUTE, ha="center", style="italic")

    # 3 · Data → Server (result rows)
    arrow(ax, dx, by + bh / 2 - 0.3,
          sx + sw, by + bh / 2 - 0.3,
          lw=1.4, color=SUCCESS)
    badge(ax, (sx + sw + dx) / 2, by + bh / 2 - 0.68, "3", fill=SUCCESS)
    text(ax, (sx + sw + dx) / 2, by + bh / 2 - 1.0, "rows",
         size=8, color=SUCCESS, ha="center", style="italic")

    # 4 · Server → Browser (JSON + streaming)
    arrow(ax, sx, by + bh / 2 - 0.3,
          bx + bw, by + bh / 2 - 0.3,
          lw=1.4, color=ACCENT)
    badge(ax, (bx + bw + sx) / 2, by + bh / 2 - 0.68, "4", fill=ACCENT)
    text(ax, (bx + bw + sx) / 2, by + bh / 2 - 1.0, "ranked matches",
         size=8, color=ACCENT, ha="center", style="italic")

    # ══════════════════════════════════════════════════════════
    # External services — floating above the server card
    # ══════════════════════════════════════════════════════════
    # Groq callout, top-right area
    gx, gy, gw, gh = 14.1, 9.35, 3.4, 1.35
    card(ax, gx, gy, gw, gh, fill=PURPLE_LT, stroke=PURPLE, stroke_w=1.1, radius=0.1)
    text(ax, gx + 0.25, gy + gh - 0.32, "EXTERNAL  ·  Groq",
         size=9, color=PURPLE, weight="bold")
    text(ax, gx + 0.25, gy + gh - 0.68, "Llama 3.3 70B Versatile",
         size=11, color=INK, weight="bold")
    text(ax, gx + 0.25, gy + 0.3, "~500 tokens/sec streaming",
         size=9, color=INK_MUTE, style="italic")

    # Dashed arrow: Server (LLM routes) → Groq
    arrow(ax, sx + sw - 2.1, sy + sh - 1.4,
          gx + gw / 2, gy,
          color=PURPLE, lw=1.5, dashed=True, curve=0.15)
    badge(ax, 14.0, 9.05, "5", fill=PURPLE)
    text(ax, 13.8, 9.0, "LLM call",
         size=8.5, color=PURPLE, ha="right", va="center", style="italic")

    # Nominatim callout, top-left area
    nx, ny, nw, nh = 0.5, 9.35, 4.3, 1.35
    card(ax, nx, ny, nw, nh, fill=SUCCESS_LT, stroke=SUCCESS, stroke_w=1.0, radius=0.1)
    text(ax, nx + 0.25, ny + nh - 0.32, "EXTERNAL  ·  OpenStreetMap",
         size=9, color=SUCCESS, weight="bold")
    text(ax, nx + 0.25, ny + nh - 0.68, "Nominatim · CARTO tiles",
         size=11, color=INK, weight="bold")
    text(ax, nx + 0.25, ny + 0.3, "geocode patient address  ·  map basemap",
         size=9, color=INK_MUTE, style="italic")

    # Dashed arrow: Browser → Nominatim
    arrow(ax, bx + bw / 2, by + bh,
          nx + nw / 2, ny,
          color=SUCCESS, lw=1.3, dashed=True, curve=-0.15)

    # ══════════════════════════════════════════════════════════
    # BUILD-TIME PIPELINE — linear sequence across the bottom
    # ══════════════════════════════════════════════════════════
    pipe_y = 1.4
    pipe_h = 1.7

    # Band background
    card(ax, 0.5, 0.3, 17.0, 2.8, fill=PAPER_ALT, stroke=LINE_SOFT, radius=0.12)
    text(ax, 0.75, 3.0 - 0.18, "BUILD-TIME PIPELINE",
         size=9, color=INK_FAINT, weight="bold", va="top")
    text(ax, 0.75, 2.66, "Offline · Python · not on the request path",
         size=10.5, color=INK_MUTE, va="top", style="italic")

    pipe = [
        ("ClinicalTrials.gov", "public API v2",           ACCENT_LT, ACCENT),
        ("fetch_trials.py",    "~20 min · one-time",      WHITE,     ACCENT),
        ("trials.db",          "65,081 trials",           WHITE,     ACCENT),
        ("parse_rules.py",     "RxNorm + regex · 86 s",   WHITE,     SUCCESS),
        ("parsed.db",          "extracted fields",        WHITE,     SUCCESS),
        ("build_training\n_dataset.py",
                               "450 Q&A pairs",           WHITE,     PURPLE),
        ("finetune.ipynb",     "LoRA · Llama 3.2 1B",     WHITE,     PURPLE),
    ]
    slot_w = (17.0 - 0.5) / len(pipe)
    slot_h = 1.1
    slot_y = 0.6
    for i, (name, sub, fill, accent) in enumerate(pipe):
        x0 = 0.75 + i * slot_w
        card(ax, x0, slot_y, slot_w - 0.35, slot_h,
             fill=fill, stroke=accent, stroke_w=1.0, radius=0.08)
        text(ax, x0 + (slot_w - 0.35) / 2, slot_y + slot_h - 0.32,
             name, size=10, color=INK, weight="bold", ha="center",
             family="monospace")
        text(ax, x0 + (slot_w - 0.35) / 2, slot_y + 0.25,
             sub, size=8.5, color=INK_MUTE, ha="center")
        # connecting arrow to next
        if i < len(pipe) - 1:
            arrow(ax, x0 + slot_w - 0.35, slot_y + slot_h / 2,
                  x0 + slot_w, slot_y + slot_h / 2,
                  color=INK_FAINT, lw=1.2, head=10)

    # ══════════════════════════════════════════════════════════
    # Legend  ·  footer
    # ══════════════════════════════════════════════════════════
    legend = [
        (ACCENT,  "deterministic request path"),
        (PURPLE,  "LLM inference"),
        (SUCCESS, "storage · geocoding"),
        (WARNING, "derived · pre-aggregated"),
    ]
    lx = 0.5
    ly = 0.05
    for color, label in legend:
        ax.add_patch(FancyBboxPatch(
            (lx, ly), 0.22, 0.14,
            boxstyle="round,pad=0,rounding_size=0.04",
            facecolor=color, edgecolor="none",
        ))
        text(ax, lx + 0.32, ly + 0.07, label,
             size=9, color=INK_MUTE)
        lx += 0.35 + len(label) * 0.09

    text(ax, 17.5, 0.10, "github.com/meetgajjarx07/curematch",
         size=9, color=INK_FAINT, ha="right", style="italic")

    fig.savefig(out, dpi=180, facecolor=PAPER, bbox_inches="tight", pad_inches=0.25)
    plt.close(fig)
    print(f"✓ {out}")


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parent.parent
    out = project_root / "data" / "charts" / "architecture.png"
    render(out)
