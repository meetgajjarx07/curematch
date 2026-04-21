#!/usr/bin/env python3
"""
Generate chart PNGs matching the Apple-style deck design,
sourced from corpus-stats.json. Saves to data/charts/.

Run:
    python3 scripts/generate_chart_images.py
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch


# ─── Palette (matches the deck) ─────────────────────────────────
INK = "#1D1D1F"
INK_MUTE = "#6E6E73"
INK_FAINT = "#86868B"
LINE = "#E8E8ED"
PAPER = "#FBFBFD"
WHITE = "#FFFFFF"
ACCENT = "#0071E3"
ACCENT_LIGHT = "#2997FF"
SUCCESS = "#30D158"
WARNING = "#FF9F0A"
ERROR = "#FF3B30"

PHASE_COLORS = [ACCENT, ACCENT_LIGHT, SUCCESS, WARNING, ERROR, "#A78BFA", "#6E6E73"]

# Global matplotlib style
plt.rcParams.update({
    "font.family": ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
    "font.size": 11,
    "axes.edgecolor": LINE,
    "axes.labelcolor": INK_MUTE,
    "axes.titlecolor": INK,
    "axes.titlesize": 14,
    "axes.titleweight": "bold",
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.spines.left": False,
    "axes.spines.bottom": False,
    "xtick.color": INK_FAINT,
    "ytick.color": INK_MUTE,
    "xtick.labelsize": 9,
    "ytick.labelsize": 10,
    "text.color": INK,
    "figure.facecolor": WHITE,
    "axes.facecolor": WHITE,
    "savefig.facecolor": WHITE,
    "savefig.edgecolor": "none",
})


def save(fig, out: Path, dpi: int = 220):
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, dpi=dpi, bbox_inches="tight", pad_inches=0.15)
    plt.close(fig)
    print(f"  ✓ {out.name}")


# ─── Charts ─────────────────────────────────────────────────────
def chart_phase_donut(stats: dict, out_dir: Path):
    """Donut chart — trials by phase."""
    data = stats["phase_distribution"]
    names = [d["name"] for d in data]
    counts = [d["count"] for d in data]

    fig, ax = plt.subplots(figsize=(7, 6))

    wedges, _ = ax.pie(
        counts,
        colors=PHASE_COLORS[: len(counts)],
        startangle=90,
        counterclock=False,
        wedgeprops=dict(width=0.28, edgecolor=WHITE, linewidth=3),
    )

    # Center text
    total = sum(counts)
    ax.text(0, 0.12, f"{total:,}", ha="center", va="center",
            fontsize=32, fontweight="bold", color=INK)
    ax.text(0, -0.18, "total trials", ha="center", va="center",
            fontsize=10, color=INK_MUTE, weight="semibold")

    # Legend off to the side
    legend_labels = [f"{n}  ·  {c:,}  ({d['pct']}%)" for n, c, d in zip(names, counts, data)]
    ax.legend(
        wedges, legend_labels,
        loc="center left",
        bbox_to_anchor=(1.05, 0.5),
        frameon=False,
        fontsize=10,
        labelcolor=INK,
        handlelength=1.2,
        handleheight=1.2,
    )

    ax.set_title("Trials by phase", fontsize=15, pad=20, loc="left", x=-0.05)
    fig.subplots_adjust(left=0, right=0.75)

    save(fig, out_dir / "phase_donut.png")


def chart_top_conditions(stats: dict, out_dir: Path):
    """Horizontal bar — most studied conditions."""
    data = stats["top_conditions"][:10]
    names = [d["name"] for d in data][::-1]
    counts = [d["count"] for d in data][::-1]

    fig, ax = plt.subplots(figsize=(9, 5.5))

    bars = ax.barh(names, counts, color=ACCENT, height=0.7, edgecolor="none")

    for bar, c in zip(bars, counts):
        ax.text(
            bar.get_width() + max(counts) * 0.01,
            bar.get_y() + bar.get_height() / 2,
            f"{c:,}",
            va="center", ha="left",
            fontsize=10, color=INK_MUTE, fontweight="semibold",
        )

    ax.set_xlim(0, max(counts) * 1.12)
    ax.tick_params(axis="x", labelbottom=False, length=0)
    ax.tick_params(axis="y", length=0, pad=8)
    for label in ax.get_yticklabels():
        label.set_fontsize(11)
        label.set_color(INK)

    ax.set_title("Most-studied conditions", fontsize=15, loc="left", pad=16)

    save(fig, out_dir / "top_conditions.png")


def chart_top_countries(stats: dict, out_dir: Path):
    """Horizontal bar — top countries by trial site count."""
    data = stats["top_countries"]
    names = [d["name"] for d in data][::-1]
    counts = [d["count"] for d in data][::-1]

    fig, ax = plt.subplots(figsize=(9, 5))

    bars = ax.barh(names, counts, color=ACCENT_LIGHT, height=0.7, edgecolor="none")

    for bar, c in zip(bars, counts):
        ax.text(
            bar.get_width() + max(counts) * 0.01,
            bar.get_y() + bar.get_height() / 2,
            f"{c:,}",
            va="center", ha="left",
            fontsize=10, color=INK_MUTE, fontweight="semibold",
        )

    ax.set_xlim(0, max(counts) * 1.12)
    ax.tick_params(axis="x", labelbottom=False, length=0)
    ax.tick_params(axis="y", length=0, pad=8)
    for label in ax.get_yticklabels():
        label.set_fontsize(11)
        label.set_color(INK)

    ax.set_title("Top countries by trial-site count", fontsize=15, loc="left", pad=16)

    save(fig, out_dir / "top_countries.png")


def chart_parser_coverage(stats: dict, out_dir: Path):
    """Three progress-bar style rows for parser coverage."""
    cov = stats["parser_coverage"]
    total = cov["parsed_total"]

    items = [
        ("Medications excluded", cov["medications_excluded"], ACCENT),
        ("Lab thresholds",       cov["lab_thresholds"],       SUCCESS),
        ("ECOG performance",     cov["ecog"],                 WARNING),
    ]

    fig, ax = plt.subplots(figsize=(9, 4.5))
    ax.set_xlim(0, 100)
    ax.set_ylim(-0.5, len(items) - 0.5)
    ax.invert_yaxis()
    ax.set_xticks([])
    ax.set_yticks([])
    ax.spines[:].set_visible(False)

    bar_h = 0.35
    for i, (label, bucket, color) in enumerate(items):
        # Track
        ax.add_patch(FancyBboxPatch(
            (0, i - bar_h / 2), 100, bar_h,
            boxstyle="round,pad=0,rounding_size=0.12",
            facecolor="#F5F5F7", edgecolor="none",
        ))
        # Fill
        ax.add_patch(FancyBboxPatch(
            (0, i - bar_h / 2), bucket["pct"], bar_h,
            boxstyle="round,pad=0,rounding_size=0.12",
            facecolor=color, edgecolor="none",
        ))
        # Label above
        ax.text(0, i - bar_h - 0.1, label,
                ha="left", va="bottom",
                fontsize=12, fontweight="semibold", color=INK)
        # Value right
        ax.text(100, i - bar_h - 0.1,
                f'{bucket["count"]:,} / {total:,}   ·   {bucket["pct"]}%',
                ha="right", va="bottom",
                fontsize=10, color=INK_MUTE)

    ax.set_title("Parser extraction coverage  ·  86 seconds across the full corpus",
                 fontsize=14, loc="left", pad=20)

    save(fig, out_dir / "parser_coverage.png")


def chart_excluded_meds(stats: dict, out_dir: Path):
    """Horizontal bar — most excluded medications / classes."""
    data = stats.get("top_excluded_meds", [])[:10]
    if not data:
        return
    names = [d["name"] for d in data][::-1]
    counts = [d["count"] for d in data][::-1]

    fig, ax = plt.subplots(figsize=(9, 5.5))

    bars = ax.barh(names, counts, color=WARNING, height=0.7, edgecolor="none")

    for bar, c in zip(bars, counts):
        ax.text(
            bar.get_width() + max(counts) * 0.01,
            bar.get_y() + bar.get_height() / 2,
            f"{c:,}",
            va="center", ha="left",
            fontsize=10, color=INK_MUTE, fontweight="semibold",
        )

    ax.set_xlim(0, max(counts) * 1.12)
    ax.tick_params(axis="x", labelbottom=False, length=0)
    ax.tick_params(axis="y", length=0, pad=8)
    for label in ax.get_yticklabels():
        label.set_fontsize(11)
        label.set_color(INK)

    ax.set_title("Most-excluded medications & drug classes", fontsize=15, loc="left", pad=16)

    save(fig, out_dir / "top_excluded_meds.png")


def chart_funnel(stats: dict, out_dir: Path):
    """Horizontal funnel — 65k → candidates → matches → top 5.

    Uses a visual tapering (fixed width ratios) rather than raw count ratios
    so every stage remains legible — the relevant story is the ordering, not
    the exact proportional shrinkage (which would make the last stage invisible).
    """
    stages = [
        ("Indexed corpus",    stats["totals"]["trials"], "trials in SQLite",                  ACCENT,       1.00),
        ("SQL pre-filter",    1572,                      "by distinctive condition words",    ACCENT_LIGHT, 0.72),
        ("Scored candidates", 147,                       "6 criteria · weighted composite",   SUCCESS,      0.48),
        ("Top 5 presented",   5,                         "highest-scoring matches",           WARNING,      0.28),
    ]

    # Give each row 1.4 units of vertical space: 0.2 pad · 0.2 label · 0.8 bar · 0.2 pad
    row_pitch = 1.4
    bar_h = 0.8
    fig, ax = plt.subplots(figsize=(11, 7.0))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, len(stages) * row_pitch)
    ax.invert_yaxis()
    ax.axis("off")

    for i, (label, count, sub, color, width) in enumerate(stages):
        row_top = i * row_pitch
        left = (1 - width) / 2
        # Stage label, sits just below row_top with padding
        ax.text(0.5, row_top + 0.15, label.upper(),
                ha="center", va="center",
                fontsize=10, color=INK_MUTE, fontweight="bold")
        # Bar
        bar_top = row_top + 0.35
        ax.add_patch(FancyBboxPatch(
            (left, bar_top), width, bar_h,
            boxstyle="round,pad=0,rounding_size=0.1",
            facecolor=color, edgecolor="none",
        ))
        # Big number centered vertically in bar
        ax.text(0.5, bar_top + bar_h / 2 - 0.08, f"{count:,}",
                ha="center", va="center",
                fontsize=26, color=WHITE, fontweight="bold")
        # Subtitle below number
        ax.text(0.5, bar_top + bar_h / 2 + 0.22, sub,
                ha="center", va="center",
                fontsize=10, color=WHITE, alpha=0.88)

    # Arrows between stages — sit in the pad between bar bottom and next label
    for i in range(len(stages) - 1):
        y_top = i * row_pitch + 0.35 + bar_h + 0.02
        y_bot = (i + 1) * row_pitch + 0.02
        ax.annotate(
            "", xy=(0.5, y_bot), xytext=(0.5, y_top),
            arrowprops=dict(arrowstyle="->", color=INK_FAINT, lw=1.5),
        )

    ax.set_title("From 65,081 trials to the right five   ·   total latency: ~250 ms",
                 fontsize=15, loc="left", pad=18, x=-0.02)

    save(fig, out_dir / "funnel.png")


def chart_decision_tree(out_dir: Path):
    """Simple decision tree — how the chat agent decides to answer vs refuse."""
    fig, ax = plt.subplots(figsize=(10, 5.5))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis("off")

    def box(x, y, w, h, text, bg, fg=INK, bold=False):
        ax.add_patch(FancyBboxPatch(
            (x, y), w, h,
            boxstyle="round,pad=0.05,rounding_size=0.15",
            facecolor=bg, edgecolor=LINE, linewidth=1,
        ))
        ax.text(x + w / 2, y + h / 2, text,
                ha="center", va="center",
                fontsize=11, color=fg,
                fontweight="bold" if bold else "normal",
                wrap=True)

    def arrow(x1, y1, x2, y2, label=None):
        ax.annotate(
            "", xy=(x2, y2), xytext=(x1, y1),
            arrowprops=dict(arrowstyle="->", color=INK_MUTE, lw=1.3),
        )
        if label:
            ax.text((x1 + x2) / 2 + 0.1, (y1 + y2) / 2, label,
                    fontsize=9, color=INK_MUTE, fontweight="semibold",
                    ha="left", va="center")

    # Top: patient question
    box(3.5, 5.0, 3, 0.75, "Patient question", ACCENT, WHITE, bold=True)

    # Middle: retrieval
    box(3.5, 3.6, 3, 0.75, "Grounded in trial text?", "#F5F5F7")

    arrow(5.0, 5.0, 5.0, 4.35)

    # Two paths
    box(1.0, 2.0, 3, 0.75, "Yes — in eligibility", "#E6F7EB")
    box(6.0, 2.0, 3, 0.75, "No — out of scope", "#FFF4E0")

    arrow(4.0, 3.6, 2.5, 2.75, "YES")
    arrow(6.0, 3.6, 7.5, 2.75, "NO")

    # Leaves
    box(0.5, 0.3, 4, 0.9, "Answer with citation\nto trial text", SUCCESS, WHITE, bold=True)
    box(5.5, 0.3, 4, 0.9, "Refuse — \"The trial's public\ninformation doesn't specify\"", WARNING, WHITE, bold=True)

    arrow(2.5, 2.0, 2.5, 1.2)
    arrow(7.5, 2.0, 7.5, 1.2)

    ax.set_title("Agent decision flow  ·  per-question grounding check", fontsize=14, loc="left", pad=14, x=0)
    save(fig, out_dir / "agent_decision.png")


def chart_rules_vs_llm(out_dir: Path):
    """Paired bar — runtime comparison (86s vs ~180,000s)."""
    fig, ax = plt.subplots(figsize=(9, 4))

    labels = ["Rule-based parser (ours)", "LLM-only (Gemma 4 26B)"]
    values = [86, 180000]  # seconds
    colors = [ACCENT, INK_FAINT]

    # Log scale works badly here — use a compressed representation with labels
    bars = ax.barh(labels, [1, values[1] / values[0]],
                   color=colors, height=0.5, edgecolor="none")

    # Add value labels
    ax.text(0.02, 0, "86 seconds",
            va="center", ha="left",
            fontsize=14, color=WHITE, fontweight="bold")
    ax.text(0.02, 1, "~50 hours",
            va="center", ha="left",
            fontsize=14, color=WHITE, fontweight="bold")

    ax.tick_params(axis="both", length=0)
    ax.set_xticks([])
    ax.set_xlim(0, (values[1] / values[0]) * 1.05)
    for label in ax.get_yticklabels():
        label.set_fontsize(11)
        label.set_color(INK)

    ax.set_title("Full-corpus parse time   ·   same 65,081 trials",
                 fontsize=14, loc="left", pad=16)

    save(fig, out_dir / "rules_vs_llm.png")


def main() -> int:
    project_root = Path(__file__).resolve().parent.parent
    stats_path = project_root / "frontend" / "public" / "corpus-stats.json"
    out_dir = project_root / "data" / "charts"

    if not stats_path.exists():
        print(f"corpus-stats.json not found at {stats_path}")
        print("Run: python3 scripts/generate_stats.py")
        return 2

    stats = json.loads(stats_path.read_text())
    print(f"Generating charts from {stats_path.name}…")

    chart_phase_donut(stats, out_dir)
    chart_top_conditions(stats, out_dir)
    chart_top_countries(stats, out_dir)
    chart_parser_coverage(stats, out_dir)
    chart_excluded_meds(stats, out_dir)
    chart_funnel(stats, out_dir)
    chart_decision_tree(out_dir)
    chart_rules_vs_llm(out_dir)

    print(f"\n✅ Charts saved to {out_dir}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
