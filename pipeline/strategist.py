"""
Strategist Agent Module
=======================
Extracted directly from agents/test/strategist_agent.ipynb

Pipeline:
1. extract_candidate_skills()   — parse skills from resume JSON
2. extract_jd_requirements()    — parse JD by priority tier
3. calculate_match_score()      — weighted scoring (required=1.0, preferred=0.5, nice=0.25)
4. generate_roadmap()           — Mistral LLM → 30-day learning plan
5. generate_charts()            — donut gauge, tier bar, matched/missing bar, radar
6. generate_pdf_report()        — multi-page PDF with charts + roadmap
7. run_strategist_agent()       — full pipeline entry point
"""

import json
import os
import re
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

import matplotlib
matplotlib.use("Agg")   # non-interactive backend (safe for server use)
import matplotlib.pyplot as plt
import numpy as np
from dotenv import load_dotenv
from fpdf import FPDF
from fpdf.enums import XPos, YPos
from mistralai import Mistral

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv()

MISTRAL_API_KEY = (os.getenv("MISTRAL_API_KEY") or "").strip().strip('"').strip("'")
MODEL = "mistral-small-latest"

if not MISTRAL_API_KEY:
    raise ValueError("MISTRAL_API_KEY not found in environment.")

client = Mistral(api_key=MISTRAL_API_KEY)

# ── Color palette — ink-on-paper professional ─────────────────────────────────
COLORS = {
    # Core ink tones
    "ink":            "#111111",   
    "primary":        "#1A2B3C",   
    "accent":         "#2563A8",  
    "rule":           "#CCCCCC",   
    # Semantic
    "success":        "#1A7A4A",   
    "warning":        "#B45309",   
    "danger":         "#B91C1C",   
    # Grays
    "light_gray":     "#F3F3F3",   
    "mid_gray":       "#AAAAAA",  
    "dark_gray":      "#333333",   
    "white":          "#FFFFFF",
    "surface":        "#F7F7F7",   
    "text_light":     "#777777",   
    # Tier badges (muted)
    "tier_required":  "#B91C1C",
    "tier_preferred": "#B45309",
    "tier_nice":      "#1A7A4A",
    # Table / TOC
    "toc_row_alt":    "#F0F0F0",
    "table_header":   "#EBEBEB",
    "table_row_alt":  "#F7F7F7",
    "section_line":   "#CCCCCC",
    # Legacy aliases kept so nothing else breaks
    "cover_band":     "#1A2B3C",
    "accent2":        "#1A7A4A",
}


def hex_to_rgb(hex_color: str) -> tuple:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hex_to_float_rgb(hex_color: str) -> tuple:
    r, g, b = hex_to_rgb(hex_color)
    return (r / 255, g / 255, b / 255)


# ── Known skill keywords  ─────────────────────────────
SKILL_KEYWORDS = {
    "python", "r", "sql", "java", "scala", "go", "rust", "c++",
    "machine learning", "deep learning", "data analysis", "data science",
    "pytorch", "tensorflow", "keras", "scikit-learn",
    "apache spark", "apache beam", "apache kafka", "apache airflow",
    "docker", "kubernetes", "terraform", "ci/cd pipelines", "ci/cd",
    "aws", "aws glue", "aws sagemaker", "azure", "gcp",
    "mlflow", "mlops", "rest apis", "fastapi", "flask",
    "database administration", "data pipelines", "etl",
    "communication", "team management", "leadership",
    "llm fine-tuning", "natural language processing", "nlp",
    "computer vision", "graph neural networks",
    "a/b testing", "statistical analysis", "hypothesis testing",
    "recommendation systems", "clustering", "predictive models",
    "customer segmentation", "churn prediction",
}

WEIGHTS = {"required": 1.00, "preferred": 0.50, "nice_to_have": 0.25}

SYSTEM_PROMPT = (
    "You are an expert AI Career Strategist. Your specialty is analyzing skills gaps between "
    "candidates and job descriptions, then creating actionable, realistic learning roadmaps. "
    "You prioritize REQUIRED skills first, then PREFERRED, then NICE-TO-HAVE. "
    "Your roadmaps are practical, include specific free/paid resources, "
    "and have clear milestones. Be encouraging but realistic about timelines."
)


# ── Step 1 — Skills extraction  ───────────────────────
def _normalize(skill: str) -> str:
    return skill.strip().lower()


def _extract_skills_from_text(text: str, known_skills: set) -> set:
    text_lower = text.lower()
    found = set()
    for skill in known_skills:
        if len(skill) <= 2:
            if re.search(rf"\b{re.escape(skill)}\b", text_lower):
                found.add(skill)
        else:
            if skill in text_lower:
                found.add(skill)
    return found


def extract_candidate_skills(resume: dict) -> set:
    """
    Extract candidate skills from resume JSON.
    Handles BOTH the notebook's mock_resume format AND the LLM-structured format
    produced by the OCR pipeline.
    """
    skills = set()
    sections = resume.get("sections", {})

    # ── LLM-structured format (from ocr.py parse_resume_with_llm) ────────────
    # sections.skills is a list of strings
    if isinstance(sections.get("skills"), list):
        for s in sections["skills"]:
            if isinstance(s, str):
                skills.add(_normalize(s))

    # ── Notebook mock_resume format ───────────────────────────────────────────
    
    elif isinstance(sections.get("skills"), dict):
        for s in sections["skills"].get("bullet_points", []):
            skills.add(_normalize(s))

    # ── Experience ─────────────────────────────────────────────────────────────
    experience = sections.get("experience", [])
    if isinstance(experience, list):
        # LLM format: list of dicts
        for entry in experience:
            if isinstance(entry, dict):
                for field in ("description", "title", "organisation"):
                    if entry.get(field):
                        skills |= _extract_skills_from_text(str(entry[field]), SKILL_KEYWORDS)
                for bullet in entry.get("bullets", []):
                    skills |= _extract_skills_from_text(str(bullet), SKILL_KEYWORDS)
    elif isinstance(experience, dict):
        # Notebook mock format
        for role, content in experience.get("subsections", {}).items():
            for bp in content.get("bullet_points", []):
                skills |= _extract_skills_from_text(bp, SKILL_KEYWORDS)
            for para in content.get("paragraphs", []):
                skills |= _extract_skills_from_text(para, SKILL_KEYWORDS)

    # ── Projects ───────────────────────────────────────────────────────────────
    projects = sections.get("projects", [])
    if isinstance(projects, list):
        for proj in projects:
            if isinstance(proj, dict):
                for tech in proj.get("technologies", []):
                    skills |= _extract_skills_from_text(str(tech), SKILL_KEYWORDS)
                if proj.get("description"):
                    skills |= _extract_skills_from_text(str(proj["description"]), SKILL_KEYWORDS)
    elif isinstance(projects, dict):
        for proj, content in projects.get("subsections", {}).items():
            for bp in content.get("bullet_points", []):
                skills |= _extract_skills_from_text(bp, SKILL_KEYWORDS)

    return skills


def _build_jd_prompt(jd_text: str) -> str:
    return (
        "You are an expert technical recruiter and job analyst.\n\n"
        "Read the job description below and extract:\n"
        "1. The exact job title (key: job_title, string).\n"
        "2. Skills/requirements categorized into three tiers: Required, Preferred, Nice-to-have.\n\n"
        "RULES:\n"
        "1. Required: Essential skills, minimum qualifications, 'must-have'.\n"
        "2. Preferred: 'Plus', 'experience with X is a bonus', 'ideal candidate has'.\n"
        "3. Nice-to-have: Soft skills, secondary tools, or minor preferences.\n\n"
        "4. Standardize skill names (e.g., 'Python' not 'Python programming').\n"
        "5. Return ONLY a valid JSON object with keys: job_title, required, preferred, nice_to_have.\n"
        "   job_title is a string; the others are lists of strings.\n"
        "6. No markdown fences, no extra text.\n\n"
        f"JOB DESCRIPTION:\n{jd_text}\n\n"
        "Return only JSON:"
    )


def parse_jd_with_llm(jd_text: str, progress_cb=None) -> dict:
    """Call Mistral to extract job title + structured skills from raw JD text."""
    if not jd_text or not jd_text.strip():
        return {"required": [], "preferred": [], "nice_to_have": []}

    _log(progress_cb, "Sending raw JD to Mistral for dynamic skill categorization...")
    prompt = _build_jd_prompt(jd_text)
    try:
        response = client.chat.complete(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        raw = response.choices[0].message.content.strip()

        # Simple JSON extraction logic similar to ocr.py
        cleaned = re.sub(r"^```[a-zA-Z]*\s*", "", raw, flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()
        data = json.loads(cleaned)

        _log(progress_cb, "JD parsed successfully via LLM.")
        return {
            "job_title":    data.get("job_title", ""),
            "required":     {_normalize(s) for s in data.get("required", [])},
            "preferred":    {_normalize(s) for s in data.get("preferred", [])},
            "nice_to_have": {_normalize(s) for s in data.get("nice_to_have", [])},
        }
    except Exception as exc:
        _log(progress_cb, f"LLM JD parsing failed: {exc}. Falling back to keyword scanning.")
        return None


def extract_jd_requirements(jd: dict, progress_cb=None) -> dict:
    """Extract JD requirements organized by tier.

    Uses Mistral LLM to dynamically categorize skills if only raw text is provided.
    Also extracts job_title from the description via LLM and writes it back into jd.
    Falls back to SKILL_KEYWORDS scanning if LLM fails.
    """
    reqs = jd.get("requirements", {})
    required     = {_normalize(s) for s in reqs.get("required_skills",  [])}
    preferred    = {_normalize(s) for s in reqs.get("preferred_skills",  [])}
    nice_to_have = {_normalize(s) for s in reqs.get("nice_to_have",      [])}

    # If no structured requirements, try LLM or keyword fallback
    if not required and not preferred and not nice_to_have:
        description = jd.get("description", "")
        if description:
            # 1. Try LLM first
            llm_reqs = parse_jd_with_llm(description, progress_cb)
            if llm_reqs:
                # Write extracted job title back into jd if not already set
                if not jd.get("job_title") and llm_reqs.get("job_title"):
                    jd["job_title"] = llm_reqs["job_title"]
                return {
                    "required":     llm_reqs["required"],
                    "preferred":    llm_reqs["preferred"],
                    "nice_to_have": llm_reqs["nice_to_have"],
                }

            # 2. Fallback to keyword scanning
            required = _extract_skills_from_text(description, SKILL_KEYWORDS)

    return {
        "required":     required,
        "preferred":    preferred,
        "nice_to_have": nice_to_have,
    }


# ── Step 2 — Weighted match score  ────────────────────
def _fuzzy_match(candidate_skill: str, jd_skill: str) -> bool:
    a, b = _normalize(candidate_skill), _normalize(jd_skill)
    if a == b:
        return True
    if a in b or b in a:
        return True
    a_words = {w for w in a.split() if len(w) >= 3}
    b_words = {w for w in b.split() if len(w) >= 3}
    if a_words and b_words and a_words & b_words:
        return True
    return False


def calculate_match_score(candidate_skills: set, jd_requirements: dict) -> dict:
    """Compute weighted match score across required / preferred / nice_to_have tiers."""
    breakdown = {}
    total_weighted = 0
    max_weighted = 0
    all_missing = []

    for tier, jd_skills in jd_requirements.items():
        weight = WEIGHTS[tier]
        matched, missing = [], []

        for jd_skill in sorted(jd_skills):
            found = any(_fuzzy_match(cs, jd_skill) for cs in candidate_skills)
            (matched if found else missing).append(jd_skill)

        tier_max = len(jd_skills) * weight
        tier_score = len(matched) * weight
        tier_pct = (len(matched) / len(jd_skills) * 100) if jd_skills else 0

        total_weighted += tier_score
        max_weighted += tier_max

        breakdown[tier] = {
            "matched":       matched,
            "missing":       missing,
            "weight":        weight,
            "matched_count": len(matched),
            "total_count":   len(jd_skills),
            "tier_pct":      round(tier_pct, 1),
        }
        all_missing.extend([(s, tier, weight) for s in missing])

    overall = (total_weighted / max_weighted * 100) if max_weighted else 0
    return {
        "overall_score":      round(overall, 1),
        "max_possible_score": max_weighted,
        "raw_weighted_score": total_weighted,
        "breakdown":          breakdown,
        "all_missing":        all_missing,
    }


# ── Step 3 — Roadmap generation (verbatim from notebook) ──────────────────────
def _build_roadmap_prompt(resume: dict, jd: dict, score_result: dict) -> str:
    missing_by_tier = {}
    for skill, tier, weight in score_result["all_missing"]:
        missing_by_tier.setdefault(tier, []).append(skill.title())

    missing_section = ""
    for tier in ["required", "preferred", "nice_to_have"]:
        if tier in missing_by_tier:
            label = tier.replace("_", " ").title()
            missing_section += f"  - {label}: {', '.join(missing_by_tier[tier])}\n"

    matched_skills = []
    for tier_data in score_result["breakdown"].values():
        matched_skills.extend(s.title() for s in tier_data["matched"])

    # Support both mock format and LLM-structured format
    name = resume.get("name", "Candidate")
    title = resume.get("title", resume.get("contact", {}).get("headline", "Professional"))

    return f"""## Candidate Profile
- **Name**: {name}
- **Current Title**: {title}
- **Existing Skills**: {', '.join(matched_skills)}
- **Match Score**: {score_result['overall_score']}%

## Target Role
- **Position**: {jd.get('job_title', jd.get('title', 'N/A'))}
- **Company**: {jd.get('company', 'N/A')}

## Skills Gap (Missing Skills)
{missing_section}
## Task
Based on the candidate's existing skills and the missing skills above,
generate a **detailed 30-day learning roadmap** to close the gap.

Structure your response EXACTLY as follows:

### Gap Analysis Summary
A brief analysis of the candidate's strengths vs. the role's requirements.

### 30-Day Learning Roadmap

#### Week 1: [Theme]
- Day 1-2: [Topic] — [specific activities, resources]
- Day 3-5: [Topic] — [specific activities, resources]
- Day 6-7: [Hands-on project or review]

#### Week 2: [Theme]
(same format)

#### Week 3: [Theme]
(same format)

#### Week 4: [Theme]
(same format)

### Milestones & Success Metrics
- End of Week 1: [measurable outcome]
- End of Week 2: [measurable outcome]
- End of Week 3: [measurable outcome]
- End of Week 4: [measurable outcome]

### Recommended Resources
Top courses, books, and tools for each missing skill.

### Daily Time Commitment
Suggested hours per day and optimal schedule.
"""


def generate_roadmap(resume: dict, jd: dict, score_result: dict) -> str:
    """Call Mistral to generate the 30-day roadmap."""
    user_prompt = _build_roadmap_prompt(resume, jd, score_result)
    response = client.chat.complete(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=4096,
    )
    return response.choices[0].message.content


# ── Step 4 — Chart generation (verbatim from notebook) ────────────────────────
def generate_charts(score_result: dict, candidate_skills: set, tmp_dir: str) -> dict:
    """
    Generate all 4 charts and save them to tmp_dir.
    Returns dict with paths: donut, tier_bar, matched_missing, radar
    """
    s = score_result["overall_score"]
    bd = score_result["breakdown"]
    paths = {}

    # 1. Donut gauge
    fig, ax = plt.subplots(figsize=(5, 5), subplot_kw=dict(aspect="equal"))
    fig.patch.set_alpha(0)
    donut_color = (
        COLORS["success"] if s >= 80
        else (COLORS["warning"] if s >= 60 else COLORS["danger"])
    )
    ax.pie(
        [s, 100 - s],
        colors=[hex_to_float_rgb(donut_color), hex_to_float_rgb(COLORS["light_gray"])],
        startangle=90,
        counterclock=False,
        wedgeprops=dict(width=0.35, edgecolor="white", linewidth=2),
    )
    ax.text(0,  0.05, f"{s}%",       ha="center", va="center", fontsize=36, fontweight="bold",
            color=hex_to_float_rgb(COLORS["dark_gray"]))
    ax.text(0, -0.20, "Match Score", ha="center", va="center", fontsize=12,
            color=hex_to_float_rgb(COLORS["mid_gray"]))
    ax.set_title("Overall Match Score", fontsize=14, fontweight="bold", pad=20)
    plt.tight_layout()
    donut_path = os.path.join(tmp_dir, "donut.png")
    fig.savefig(donut_path, dpi=200, bbox_inches="tight", transparent=True)
    plt.close(fig)
    paths["donut"] = donut_path

    # 2. Tier coverage bar chart
    tier_color_map = {
        "required":    COLORS["tier_required"],
        "preferred":   COLORS["tier_preferred"],
        "nice_to_have": COLORS["tier_nice"],
    }
    tier_labels, coverage_values, bar_colors = [], [], []
    for tier in ["required", "preferred", "nice_to_have"]:
        if tier in bd:
            tier_labels.append(tier.replace("_", " ").title())
            coverage_values.append(bd[tier]["tier_pct"])
            bar_colors.append(hex_to_float_rgb(tier_color_map[tier]))

    fig, ax = plt.subplots(figsize=(8, 3))
    fig.patch.set_facecolor("white")
    y_pos = np.arange(len(tier_labels))
    ax.barh(y_pos, [100] * len(tier_labels), height=0.5,
            color=hex_to_float_rgb(COLORS["light_gray"]), zorder=2)
    ax.barh(y_pos, coverage_values, height=0.5,
            color=bar_colors, edgecolor="white", linewidth=1.5, zorder=3)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(tier_labels, fontsize=11, fontweight="bold")
    ax.set_xlim(0, 115)
    ax.set_xlabel("Coverage (%)", fontsize=10)
    ax.set_title("Skills Coverage by Tier", fontsize=14, fontweight="bold", pad=15)
    for i, v in enumerate(coverage_values):
        ax.text(v + 2, i, f"{v:.1f}%", va="center", ha="left", fontsize=11, fontweight="bold",
                color=hex_to_float_rgb(COLORS["dark_gray"]))
    for spine in ["top", "right", "left"]:
        ax.spines[spine].set_visible(False)
    ax.tick_params(left=False)
    ax.xaxis.grid(True, alpha=0.3, linestyle="--")
    plt.tight_layout()
    tier_bar_path = os.path.join(tmp_dir, "tier_bar.png")
    fig.savefig(tier_bar_path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    paths["tier_bar"] = tier_bar_path

    # 3. Matched vs Missing grouped bar
    tiers = ["required", "preferred", "nice_to_have"]
    labels = [t.replace("_", " ").title() for t in tiers]
    matched_counts = [len(bd[t]["matched"]) for t in tiers if t in bd]
    missing_counts = [len(bd[t]["missing"]) for t in tiers if t in bd]
    labels = [t.replace("_", " ").title() for t in tiers if t in bd]
    x, width = np.arange(len(labels)), 0.35

    fig, ax = plt.subplots(figsize=(7, 4))
    fig.patch.set_facecolor("white")
    bars1 = ax.bar(x - width / 2, matched_counts, width, label="Matched",
                   color=hex_to_float_rgb(COLORS["success"]), edgecolor="white", linewidth=1.5, zorder=3)
    bars2 = ax.bar(x + width / 2, missing_counts, width, label="Missing",
                   color=hex_to_float_rgb(COLORS["danger"]),  edgecolor="white", linewidth=1.5, zorder=3)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=11, fontweight="bold")
    ax.set_ylabel("Number of Skills", fontsize=10)
    ax.set_title("Matched vs Missing Skills", fontsize=14, fontweight="bold", pad=15)
    ax.legend(fontsize=10, loc="upper right")
    for bar in list(bars1) + list(bars2):
        h = bar.get_height()
        if h > 0:
            ax.text(bar.get_x() + bar.get_width() / 2., h + 0.1, str(int(h)),
                    ha="center", va="bottom", fontweight="bold", fontsize=10)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.yaxis.grid(True, alpha=0.3, linestyle="--")
    ax.set_axisbelow(True)
    plt.tight_layout()
    matched_missing_path = os.path.join(tmp_dir, "matched_missing.png")
    fig.savefig(matched_missing_path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    paths["matched_missing"] = matched_missing_path

    # 4. Skills radar chart
    skills_list = sorted(list(candidate_skills))[:12]
    N = len(skills_list)
    if N >= 3:
        angles = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
        values = [1.0] * N
        angles += angles[:1]
        values += values[:1]

        fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))
        fig.patch.set_facecolor("white")
        ax.plot(angles, values, "o-", linewidth=2, color=hex_to_float_rgb(COLORS["accent"]))
        ax.fill(angles, values, alpha=0.15, color=hex_to_float_rgb(COLORS["accent"]))
        ax.set_xticks(angles[:-1])
        ax.set_xticklabels([s.title() for s in skills_list], fontsize=8, fontweight="bold")
        ax.set_ylim(0, 1.3)
        ax.set_yticklabels([])
        ax.grid(color=hex_to_float_rgb(COLORS["mid_gray"]), linestyle="--", alpha=0.5)
        ax.set_title("Candidate Skills Overview", fontsize=14, fontweight="bold", pad=20)
        plt.tight_layout()
        radar_path = os.path.join(tmp_dir, "radar.png")
        fig.savefig(radar_path, dpi=200, bbox_inches="tight")
        plt.close(fig)
        paths["radar"] = radar_path

    return paths


# ── PDF helpers ───────────────────────────────────────────────────────────────

def _sanitize_text(text: str) -> str:
    """Replace non-latin-1 characters so fpdf2 Helvetica can render them."""
    replacements = {
        "\u2014": "-", "\u2013": "-",
        "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"',
        "\u2022": "*", "\u2026": "...",
        "\u2192": "->", "\u2190": "<-",
        "\u00b7": "*",
    }
    result = []
    for ch in str(text):
        ch = replacements.get(ch, ch)
        try:
            ch.encode("latin-1")
            result.append(ch)
        except UnicodeEncodeError:
            result.append("")
    return "".join(result)


def _clean_markdown_text(text: str) -> str:
    """Strip common Markdown syntax for plain text rendering."""
    text = re.sub(r"\*\*([^*]+)\*\*",      r"\1", text)
    text = re.sub(r"\*([^*]+)\*",           r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"`([^`]*)`",             r"\1", text)
    text = text.replace("`", "")
    return text.strip()


def _parse_inline_bold(text: str) -> list:
    """
    Parse a string with **bold** markers into a list of (segment, is_bold) tuples.
    Used for rich inline rendering.
    """
    parts = []
    pattern = re.compile(r"\*\*(.+?)\*\*")
    last = 0
    for m in pattern.finditer(text):
        if m.start() > last:
            plain = text[last:m.start()]
            # also clean single * and backticks from plain segments
            plain = re.sub(r"\*([^*]+)\*", r"\1", plain)
            plain = plain.replace("`", "")
            parts.append((_sanitize_text(plain), False))
        parts.append((_sanitize_text(m.group(1)), True))
        last = m.end()
    if last < len(text):
        tail = text[last:]
        tail = re.sub(r"\*([^*]+)\*", r"\1", tail)
        tail = tail.replace("`", "")
        parts.append((_sanitize_text(tail), False))
    return parts


def _parse_roadmap_markdown(roadmap_text: str) -> list:
    """Parse the LLM roadmap markdown into a list of structured section dicts.
    Items preserve inline bold markers (**text**) for rich rendering.
    """
    sections = []
    current_section = None
    current_subsection = None

    for raw_line in roadmap_text.split("\n"):
        stripped = raw_line.strip()
        if not stripped:
            continue

        if stripped.startswith("### "):
            if current_subsection and current_section:
                current_section["subsections"].append(current_subsection)
                current_subsection = None
            if current_section:
                sections.append(current_section)
            current_section = {
                "title": _clean_markdown_text(stripped[4:]),
                "items": [],
                "subsections": [],
            }
        elif stripped.startswith("#### "):
            if current_subsection and current_section:
                current_section["subsections"].append(current_subsection)
            current_subsection = {
                "title": _clean_markdown_text(stripped[5:]),
                "items": [],
            }
        elif stripped.startswith("- ") or stripped.startswith("* "):
            # Preserve raw content (with **bold**) for rich rendering
            content = stripped[2:]
            # Clean only link syntax and backticks; keep **bold**
            content = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", content)
            content = content.replace("`", "").strip()
            if current_subsection:
                current_subsection["items"].append(content)
            elif current_section:
                current_section["items"].append(content)
        else:
            content = stripped
            content = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", content)
            content = content.replace("`", "").strip()
            if content:
                if current_subsection:
                    current_subsection["items"].append(content)
                elif current_section:
                    current_section["items"].append(content)

    if current_subsection and current_section:
        current_section["subsections"].append(current_subsection)
    if current_section:
        sections.append(current_section)

    return sections


def _extract_gap_summary(roadmap_text: str) -> str:
    """Pull the Gap Analysis Summary paragraph from the LLM roadmap markdown.

    Also strips any JD metadata lines the LLM may have echoed verbatim
    (e.g. "Location: Remote", "Department: …", "Experience Level: …").
    """
    m = re.search(
        r"### Gap Analysis Summary\s*\n(.*?)(?:\n###|\Z)",
        roadmap_text,
        re.DOTALL,
    )
    if not m:
        return ""

    raw = m.group(1).strip()

    # Strip lines that are bare JD-metadata key: value echoes from the LLM
    # (lines like "Location: Remote / Hybrid", "Department: Data & AI", etc.)
    _JD_META_KEYS = re.compile(
        r"^(location|department|experience\s*level|employment\s*type|"
        r"job\s*type|work\s*type|salary|compensation|posted|deadline|"
        r"industry|sector|team|headcount)\s*:",
        re.IGNORECASE,
    )
    cleaned_lines = [
        line for line in raw.splitlines()
        if not _JD_META_KEYS.match(line.strip())
    ]
    cleaned = "\n".join(cleaned_lines).strip()

    return _clean_markdown_text(cleaned)


# ── Upgraded PDF class ────────────────────────────────────────────────────────

class CareerReportPDF(FPDF):
    """
    Fully modular, professionally structured career analysis PDF report.

    Section render order
    --------------------
    1.  _render_cover()          — Title page with color band, match score donut
    2.  _render_toc()            — Table of contents
    3.  _render_executive_summary() — Gap summary + key highlights
    4.  _render_candidate_profile() — Contact details, title, location
    5.  _render_skills_analysis()   — Tier match table + full skills inventory
    6.  _render_experience()        — Work history with bullets
    7.  _render_projects()          — Projects with technologies
    8.  _render_education()         — Degrees / courses
    9.  _render_certifications()    — Certifications (if present)
    10. _render_ai_analysis()       — JD match breakdown table + gaps
    11. _render_skill_visualization() — Charts (radar, tier bar, matched/missing)
    12. _render_roadmap()           — 30-day roadmap parsed from markdown
    """

    # ── Page geometry ─────────────────────────────────────────────────────────
    PAGE_W   = 210   # A4 width  mm
    PAGE_H   = 297   # A4 height mm
    MARGIN   = 15
    CONTENT_W = PAGE_W - 2 * MARGIN   # 180 mm

    def __init__(
        self,
        candidate_name: str = "",
        target_role: str = "",
    ):
        super().__init__("P", "mm", "A4")
        self.candidate_name = candidate_name
        self.target_role    = target_role
        self.set_margins(self.MARGIN, self.MARGIN, self.MARGIN)
        self.set_auto_page_break(auto=True, margin=22)
        # TOC entries filled during render: [(title, page_no)]
        self._toc_entries: list = []
        # Map section title -> page placeholder index for deferred TOC
        self._section_pages: dict = {}

    # ── FPDF hooks ────────────────────────────────────────────────────────────

    def header(self):
        """Running header on all pages except cover + TOC."""
        if self.page_no() <= 2:
            return
        # Single hairline rule across top
        r, g, b = hex_to_rgb(COLORS["rule"])
        self.set_draw_color(r, g, b)
        self.set_line_width(0.25)
        self.line(self.MARGIN, 13, self.PAGE_W - self.MARGIN, 13)
        # Left: app name in small spaced caps style
        ra, ga, ba = hex_to_rgb(COLORS["accent"])
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(ra, ga, ba)
        self.set_xy(self.MARGIN, 6)
        self.cell(60, 5, "AI CAREER ASSISTANT", align="L")
        # Centre: candidate name
        rp, gp, bp = hex_to_rgb(COLORS["primary"])
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(rp, gp, bp)
        self.set_xy(self.MARGIN + 60, 6)
        self.cell(self.CONTENT_W - 120, 5, _sanitize_text(self.candidate_name), align="C")
        # Right: page number
        rm, gm, bm = hex_to_rgb(COLORS["text_light"])
        self.set_font("Helvetica", "", 7)
        self.set_text_color(rm, gm, bm)
        self.set_xy(self.PAGE_W - self.MARGIN - 60, 6)
        self.cell(60, 5, f"Page {self.page_no()}", align="R")
        self.ln(8)

    def footer(self):
        """Footer: single hairline rule, centred label, page fraction right."""
        self.set_y(-14)
        r, g, b = hex_to_rgb(COLORS["rule"])
        self.set_draw_color(r, g, b)
        self.set_line_width(0.25)
        self.line(self.MARGIN, self.PAGE_H - 14, self.PAGE_W - self.MARGIN, self.PAGE_H - 14)
        # Left: subtle label
        ra, ga, ba = hex_to_rgb(COLORS["text_light"])
        self.set_font("Helvetica", "", 6.5)
        self.set_text_color(ra, ga, ba)
        self.set_x(self.MARGIN)
        self.cell(self.CONTENT_W / 2, 7, "Career Analysis Report  |  Skillora",
                  align="L")
        # Right: page / total
        rp, gp, bp = hex_to_rgb(COLORS["rule_dark"])
        self.set_font("Helvetica", "", 6.5)
        self.set_text_color(rp, gp, bp)
        self.set_x(self.MARGIN + self.CONTENT_W / 2)
        self.cell(self.CONTENT_W / 2, 7, f"Page {self.page_no()} of {{nb}}",
                  align="R")

    # ── Low-level drawing helpers ─────────────────────────────────────────────

    def _set_color(self, hex_color: str, what: str = "text"):
        r, g, b = hex_to_rgb(hex_color)
        if what == "text":
            self.set_text_color(r, g, b)
        elif what == "draw":
            self.set_draw_color(r, g, b)
        elif what == "fill":
            self.set_fill_color(r, g, b)

    def _section_heading(self, number: str, title: str):
        """Clean section heading: section number muted left + bold title + full-width rule."""
        self.ln(7)
        y0 = self.get_y()

        # Left: small muted section number
        self.set_font("Helvetica", "B", 8)
        r_m, g_m, b_m = hex_to_rgb(COLORS["mid_gray"])
        self.set_text_color(r_m, g_m, b_m)
        self.set_xy(self.MARGIN, y0)
        self.cell(10, 9, _sanitize_text(str(number)), new_x=XPos.RIGHT, new_y=YPos.TOP)

        # Section title — bold 13pt, primary ink
        self.set_font("Helvetica", "B", 13)
        rp, gp, bp = hex_to_rgb(COLORS["primary"])
        self.set_text_color(rp, gp, bp)
        self.cell(self.CONTENT_W - 10, 9, _sanitize_text(title),
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Full-width hairline rule underneath — accent color
        ra, ga, ba = hex_to_rgb(COLORS["accent"])
        self.set_draw_color(ra, ga, ba)
        self.set_line_width(0.5)
        self.line(self.MARGIN, self.get_y(), self.PAGE_W - self.MARGIN, self.get_y())
        # Thin secondary rule offset slightly
        rr, gr, br = hex_to_rgb(COLORS["rule"])
        self.set_draw_color(rr, gr, br)
        self.set_line_width(0.2)
        self.line(self.MARGIN, self.get_y() + 0.8, self.PAGE_W - self.MARGIN, self.get_y() + 0.8)

        self.ln(5)

    def _sub_heading(self, title: str):
        """Sub-heading: bold spaced-caps 10pt + short accent rule underneath."""
        self.ln(1)
        self.set_font("Helvetica", "B", 10)
        rp, gp, bp = hex_to_rgb(COLORS["primary"])
        self.set_text_color(rp, gp, bp)
        self.set_x(self.MARGIN)
        self.cell(0, 8, _sanitize_text(title.upper()), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        # Short accent rule
        ra, ga, ba = hex_to_rgb(COLORS["accent"])
        self.set_draw_color(ra, ga, ba)
        self.set_line_width(0.4)
        self.line(self.MARGIN, self.get_y(), self.MARGIN + 50, self.get_y())
        self.ln(3)

    def _body(self, text: str, indent: float = 0, line_h: float = 5.5):
        self.set_font("Helvetica", "", 10)
        self._set_color(COLORS["dark_gray"])
        if indent:
            self.set_x(self.MARGIN + indent)
        self.multi_cell(self.CONTENT_W - indent, line_h, _sanitize_text(text))
        self.ln(1)

    def _bullet(self, text: str, indent: float = 6):
        self.set_font("Helvetica", "", 10)
        self._set_color(COLORS["dark_gray"])
        x0 = self.MARGIN + indent
        self.set_x(x0)
        # En-dash bullet marker
        self.set_font("Helvetica", "B", 10)
        r, g, b = hex_to_rgb(COLORS["accent"])
        self.set_text_color(r, g, b)
        self.cell(5, 5.5, "-", new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_font("Helvetica", "", 10)
        self._set_color(COLORS["dark_gray"])
        self.multi_cell(self.CONTENT_W - indent - 5, 5.5, _sanitize_text(text))
        self.ln(0.5)

    def _bullet_rich(self, raw_text: str, indent: float = 6):
        """Bullet with inline bold support. raw_text may contain **bold** markers.

        Strategy: always use multi_cell so that Y advances correctly after every
        bullet regardless of whether the text wraps.  Bold segments are rendered
        by splitting the text at the first '**…**' boundary, printing the bold
        prefix with set_font B then continuing normally — this avoids the
        cell()/YPos.TOP trap that kept Y frozen and caused lines to overlap.
        """
        line_h = 5.5
        x0 = self.MARGIN + indent
        avail_w = self.CONTENT_W - indent - 5

        # En-dash bullet marker in accent color
        y_before = self.get_y()
        r, g, b = hex_to_rgb(COLORS["accent"])
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(r, g, b)
        self.set_xy(x0, y_before)
        self.cell(5, line_h, "-", new_x=XPos.RIGHT, new_y=YPos.TOP)

        self._set_color(COLORS["dark_gray"])
        parts = _parse_inline_bold(raw_text)
        has_bold = any(bold for _, bold in parts)

        if not has_bold:
            # Simple path: one multi_cell, Y always advances correctly
            plain = "".join(seg for seg, _ in parts)
            self.set_font("Helvetica", "", 10)
            self.set_xy(x0 + 5, y_before)
            self.multi_cell(avail_w, line_h, _sanitize_text(plain))
        else:
            # Rich path: write each segment with write() which advances X and
            # wraps automatically — Y is correctly updated after the last segment.
            # We position at the text start, then use write() for each part.
            self.set_xy(x0 + 5, y_before)
            for seg, is_bold in parts:
                if not seg:
                    continue
                self.set_font("Helvetica", "B" if is_bold else "", 10)
                self.write(line_h, _sanitize_text(seg))
            # After write() the cursor is at the end of the last character on
            # the current line — move to the next line explicitly.
            self.ln(line_h)

        self.ln(1.0)

    def _info_row(self, label: str, value: str, label_w: float = 45):
        self.set_font("Helvetica", "B", 10)
        self._set_color(COLORS["primary"])
        self.cell(label_w, 7, _sanitize_text(label), new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_font("Helvetica", "", 10)
        self._set_color(COLORS["dark_gray"])
        self.multi_cell(self.CONTENT_W - label_w, 7, _sanitize_text(value))

    def _table_header_row(self, cols: list, widths: list):
        """Header row: light gray fill (#EBEBEB), dark ink text, hairline bottom rule."""
        self.set_fill_color(235, 235, 235)   # #EBEBEB
        self._set_color(COLORS["ink"])
        self.set_font("Helvetica", "B", 9)
        row_h = 8
        x_start = self.get_x()
        y_start = self.get_y()
        for text, w in zip(cols, widths):
            self.cell(w, row_h, _sanitize_text(str(text)), border=0, fill=True,
                      new_x=XPos.RIGHT, new_y=YPos.TOP, align="C")
        # Hairline bottom rule in rule_dark colour
        rd, gd, bd = hex_to_rgb(COLORS["rule_dark"])
        self.set_draw_color(rd, gd, bd)
        self.set_line_width(0.3)
        self.line(x_start, y_start + row_h,
                  x_start + sum(widths), y_start + row_h)
        self.ln(row_h)

    def _table_data_row(self, cols: list, widths: list, alt: bool = False):
        """Data row: white or very-light-gray alt fill, hairline bottom rule."""
        if alt:
            self.set_fill_color(250, 250, 250)   # barely-there tint
        else:
            self.set_fill_color(255, 255, 255)
        row_h = 7
        x_start = self.get_x()
        y_start = self.get_y()
        self.set_font("Helvetica", "", 9)
        self._set_color(COLORS["dark_gray"])
        for i, (text, w) in enumerate(zip(cols, widths)):
            align = "L" if i == 0 else "C"
            self.cell(w, row_h, _sanitize_text(str(text)), border=0, fill=True,
                      new_x=XPos.RIGHT, new_y=YPos.TOP, align=align)
        # Hairline bottom rule
        rt, gt, bt = hex_to_rgb(COLORS["rule"])
        self.set_draw_color(rt, gt, bt)
        self.set_line_width(0.1)
        self.line(x_start, y_start + row_h,
                  x_start + sum(widths), y_start + row_h)
        self.ln(row_h)

    def _progress_bar(self, label: str, pct: float, bar_w: float = 90):
        """Labeled percentage bar — outlined rect track, solid fill, pct label right."""
        bar_h = 5
        self.set_font("Helvetica", "", 9)
        self._set_color(COLORS["dark_gray"])
        self.cell(50, bar_h + 2, _sanitize_text(label), new_x=XPos.RIGHT, new_y=YPos.TOP)
        x0 = self.get_x()
        y0 = self.get_y() + 1

        # Outlined background track
        rt, gt, bt = hex_to_rgb(COLORS["rule"])
        self.set_draw_color(rt, gt, bt)
        self.set_line_width(0.2)
        self.rect(x0, y0, bar_w, bar_h, style="D")

        # Solid fill for completed portion
        fill_w = max(0, min(bar_w, bar_w * pct / 100))
        color = COLORS["success"] if pct >= 70 else (COLORS["warning"] if pct >= 40 else COLORS["danger"])
        r, g, b = hex_to_rgb(color)
        if fill_w > 0:
            self.set_fill_color(r, g, b)
            self.rect(x0, y0, fill_w, bar_h, style="F")

        # Percentage label right of track
        pct_text = f"{pct:.0f}%"
        self.set_font("Helvetica", "B", 8)
        self._set_color(COLORS["dark_gray"])
        self.set_xy(x0 + bar_w + 2, y0 - 0.5)
        self.cell(14, bar_h + 1, pct_text, new_x=XPos.RIGHT, new_y=YPos.TOP)

        self.ln(bar_h + 3)

    def _render_skill_pills(self, skills: list, color_hex: str):
        """Render skills as outlined rectangular tags — thin border, dark text, no fill."""
        tag_h    = 6.5
        pad_x    = 3.5   # horizontal padding inside tag
        gap_x    = 3.0   # gap between tags
        gap_y    = 2.5   # gap between rows
        x_cursor = self.MARGIN + 2
        y_cursor = self.get_y() + 2
        max_x    = self.MARGIN + self.CONTENT_W

        # Border colour derived from color_hex but darkened for readability
        rd, gd, bd = hex_to_rgb(COLORS["rule_dark"])

        self.set_font("Helvetica", "", 8)

        for skill in skills:
            label = _sanitize_text(skill.title())
            text_w = self.get_string_width(label)
            tag_w = text_w + pad_x * 2

            # Wrap to next row if tag doesn't fit
            if x_cursor + tag_w > max_x and x_cursor > self.MARGIN + 2:
                x_cursor = self.MARGIN + 2
                y_cursor += tag_h + gap_y
                if y_cursor + tag_h > self.PAGE_H - 25:
                    self.set_y(y_cursor)
                    self.add_page()
                    y_cursor = self.get_y() + 2
                    x_cursor = self.MARGIN + 2

            # Outlined rectangle tag (white fill, dark border)
            self.set_fill_color(255, 255, 255)
            self.set_draw_color(rd, gd, bd)
            self.set_line_width(0.25)
            self.rect(x_cursor, y_cursor, tag_w, tag_h, style="FD")

            # Tag text (dark ink)
            self._set_color(COLORS["ink"])
            self.set_xy(x_cursor + pad_x, y_cursor)
            self.cell(text_w, tag_h, label, align="C",
                      new_x=XPos.RIGHT, new_y=YPos.TOP)

            x_cursor += tag_w + gap_x

        # Advance cursor past last row
        self.set_y(y_cursor + tag_h + 4)

    def _page_break_if_needed(self, needed_mm: float = 30):
        # Only break if we are past the top zone of the current page
        # (avoids breaking on a page that was just started, which would leave it blank)
        if self.get_y() > 55 and self.get_y() + needed_mm > self.PAGE_H - 25:
            self.add_page()

    # ── Section 1: Cover page ─────────────────────────────────────────────────

    def _render_cover(
        self,
        candidate: dict,
        target_role: dict,
        overall_score: float,
        chart_paths: dict,
        jd: dict | None = None,
    ):
        self.add_page()

        W = self.PAGE_W
        M = self.MARGIN

        # ── Top header band ───────────────────────────────────────────────────
        band_h = 38
        rp, gp, bp = hex_to_rgb(COLORS["primary"])
        self.set_fill_color(rp, gp, bp)
        self.rect(0, 0, W, band_h, style="F")

        # "AI CAREER ASSISTANT" label — spaced caps, accent blue, top-left
        ra, ga, ba = hex_to_rgb(COLORS["accent"])
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(ra, ga, ba)
        self.set_xy(M, 7)
        self.cell(W / 2, 5, "AI  CAREER  ASSISTANT",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Date — top-right
        self.set_font("Helvetica", "", 8)
        self.set_text_color(180, 200, 220)
        self.set_xy(W / 2, 7)
        self.cell(W / 2 - M, 5,
                  _sanitize_text(datetime.now().strftime("%B %d, %Y")),
                  align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Candidate name — large white, in band
        name = candidate.get("name", "")
        if name:
            self.set_font("Helvetica", "B", 22)
            self.set_text_color(255, 255, 255)
            self.set_xy(M, 16)
            self.cell(W - 2 * M, 12, _sanitize_text(name),
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Accent hairline rule at bottom of band
        self.set_draw_color(ra, ga, ba)
        self.set_line_width(0.6)
        self.line(0, band_h, W, band_h)
        self.set_line_width(0.2)
        self.line(0, band_h + 1.2, W, band_h + 1.2)

        # ── Subtitle row below band ───────────────────────────────────────────
        self.set_font("Helvetica", "I", 10)
        self.set_text_color(80, 100, 130)
        self.set_xy(M, band_h + 6)
        self.cell(W - 2 * M, 7, "Skillora — Career Analysis Report",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        self.set_font("Helvetica", "", 8)
        self.set_text_color(140, 155, 175)
        self.set_xy(M, band_h + 13)
        self.cell(W - 2 * M, 5,
                  "AI-Powered Skills Gap Analysis and Learning Roadmap",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # ── Score badge ───────────────────────────────────────────────────────
        badge_y = band_h + 26
        score_color = (
            COLORS["success"] if overall_score >= 80
            else (COLORS["warning"] if overall_score >= 60 else COLORS["danger"])
        )
        label_text = (
            "Excellent Match" if overall_score >= 80
            else ("Good Match" if overall_score >= 60 else "Needs Work")
        )
        rb, gb2, bb = hex_to_rgb(score_color)
        badge_w = 70
        badge_h = 16
        badge_x = W - M - badge_w
        # Outlined rect badge
        self.set_draw_color(rb, gb2, bb)
        self.set_line_width(0.5)
        self.rect(badge_x, badge_y, badge_w, badge_h, style="D")
        # Score number
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(rb, gb2, bb)
        self.set_xy(badge_x, badge_y + 1)
        self.cell(badge_w, 8, _sanitize_text(f"{overall_score}%"), align="C",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        # Label below score
        self.set_font("Helvetica", "", 7.5)
        self.set_text_color(100, 120, 150)
        self.set_xy(badge_x, badge_y + 9)
        self.cell(badge_w, 6,
                  _sanitize_text(f"Overall Match  |  {label_text}"),
                  align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Skills count (left of badge)
        skills_n = str(candidate.get("skills_count", 0))
        self.set_font("Helvetica", "B", 22)
        self._set_color(COLORS["primary"])
        self.set_xy(M, badge_y)
        self.cell(badge_x - M - 4, 12, skills_n, align="L",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(120, 140, 170)
        self.set_xy(M, badge_y + 11)
        self.cell(badge_x - M - 4, 5, "SKILLS FOUND", align="L",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # ── Target company + target role cards (side by side) ────────────────
        card_y = badge_y + badge_h + 10
        card_w = W - 2 * M
        jd_safe = jd or {}
        rt2, gt2, bt2 = hex_to_rgb(COLORS["rule"])

        company_val = _sanitize_text(target_role.get("company", jd_safe.get("company", "N/A")))
        role_val    = _sanitize_text(target_role.get("title",   jd_safe.get("job_title", "N/A")))

        half_w   = (card_w - 4) / 2   # 4 mm gutter between cards
        card_h   = 22                  # fixed — single-line values, no wrapping needed
        gutter   = 4
        left_x   = M
        right_x  = M + half_w + gutter

        def _mini_card(cx, cy, cw, ch, label, value):
            """Draw a single labeled mini-card at (cx, cy)."""
            # Border
            self.set_draw_color(rt2, gt2, bt2)
            self.set_line_width(0.25)
            self.rect(cx, cy, cw, ch, style="D")
            # Label (spaced caps, accent blue)
            self.set_font("Helvetica", "B", 7)
            self.set_text_color(ra, ga, ba)
            self.set_xy(cx + 4, cy + 3)
            self.cell(cw - 8, 4.5, label, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            # Hairline separator
            self.set_draw_color(rt2, gt2, bt2)
            self.set_line_width(0.15)
            self.line(cx, cy + 8.5, cx + cw, cy + 8.5)
            # Value (bold, primary ink)
            self.set_font("Helvetica", "B", 10)
            self._set_color(COLORS["primary"])
            self.set_xy(cx + 4, cy + 10)
            self.cell(cw - 8, 7, value, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        _mini_card(left_x,  card_y, half_w, card_h, "TARGET COMPANY", company_val)
        _mini_card(right_x, card_y, half_w, card_h, "TARGET ROLE",    role_val)

        card_bottom = card_y + card_h

        # ── Donut chart (if available) ────────────────────────────────────────
        chart_y = card_bottom + 10
        if "donut" in chart_paths and os.path.exists(chart_paths["donut"]):
            donut_sz = 70
            self.image(chart_paths["donut"],
                       x=(W - donut_sz) / 2,
                       y=chart_y,
                       w=donut_sz)
            chart_y += donut_sz + 4

        # ── Report metadata line at page bottom ───────────────────────────────
        self.set_auto_page_break(auto=False)
        self.set_font("Helvetica", "", 7.5)
        self.set_text_color(160, 170, 185)
        self.set_xy(M, self.PAGE_H - 12)
        self.cell(W - 2 * M, 6,
                  _sanitize_text(
                       f"Skillora  |  Report generated {datetime.now().strftime('%B %d, %Y')}"
                  ),
                  align="C")
        self.set_auto_page_break(auto=True, margin=22)

    # ── Section 2: Table of Contents ─────────────────────────────────────────

    def _render_toc(self, entries: list):
        """
        entries: list of (section_number, title, page_number)
        Academic LaTeX-style TOC — white background, dot leaders, no row fills.
        """
        self.add_page()

        # Title
        self.set_font("Helvetica", "B", 16)
        self._set_color(COLORS["primary"])
        self.set_xy(self.MARGIN, 20)
        self.cell(0, 10, "Table of Contents", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Full-width rule under title
        rd, gd, bd = hex_to_rgb(COLORS["rule_dark"])
        self.set_draw_color(rd, gd, bd)
        self.set_line_width(0.4)
        self.line(self.MARGIN, self.get_y(), self.MARGIN + self.CONTENT_W, self.get_y())
        self.ln(6)

        for num, title, pg in entries:
            row_h = 8
            y_row = self.get_y()

            # Section number — muted, small
            self.set_font("Helvetica", "B" if num else "", 9)
            self._set_color(COLORS["mid_gray"] if not num else COLORS["accent"])
            self.set_xy(self.MARGIN, y_row)
            self.cell(10, row_h, _sanitize_text(str(num)) if num else "",
                      new_x=XPos.RIGHT, new_y=YPos.TOP)

            # Title
            title_text = _sanitize_text(title)
            self.set_font("Helvetica", "B" if num else "", 10)
            self._set_color(COLORS["primary"] if num else COLORS["dark_gray"])
            title_w = self.get_string_width(title_text)
            self.cell(title_w + 2, row_h, title_text,
                      new_x=XPos.RIGHT, new_y=YPos.TOP)

            # Dot leaders
            dots_x = self.get_x() + 2
            pg_x   = self.MARGIN + self.CONTENT_W - 18
            dots_w = max(0, pg_x - dots_x - 2)
            self.set_font("Helvetica", "", 9)
            rt, gt, bt = hex_to_rgb(COLORS["rule"])
            self.set_text_color(rt, gt, bt)
            if dots_w > 0:
                self.set_xy(dots_x, y_row)
                self.cell(dots_w, row_h, "." * int(dots_w / 1.8),
                          new_x=XPos.RIGHT, new_y=YPos.TOP)

            # Page number
            self.set_font("Helvetica", "B" if num else "", 10)
            self._set_color(COLORS["accent"] if num else COLORS["mid_gray"])
            self.set_xy(pg_x, y_row)
            self.cell(18, row_h, str(pg), align="R",
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Full-width rule below last entry
        self.set_draw_color(rd, gd, bd)
        self.set_line_width(0.3)
        self.line(self.MARGIN, self.get_y() + 2,
                  self.MARGIN + self.CONTENT_W, self.get_y() + 2)
        self.ln(6)

    # ── Section 3: Executive Summary ─────────────────────────────────────────

    def _render_executive_summary(
        self,
        gap_summary: str,
        overall_score: float,
        matched_skills: list,
        missing_skills: list,
        candidate: dict,
    ):
        self._section_heading("1", "Executive Summary")

        # Score callout — outlined rect, coloured text, no fill
        score_color = (
            COLORS["success"] if overall_score >= 80
            else (COLORS["warning"] if overall_score >= 60 else COLORS["danger"])
        )
        r, g, b = hex_to_rgb(score_color)
        label = "Excellent Match" if overall_score >= 80 else ("Good Match" if overall_score >= 60 else "Needs Work")
        self.set_draw_color(r, g, b)
        self.set_line_width(0.4)
        self.rect(self.MARGIN, self.get_y(), self.CONTENT_W, 8, style="D")
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(r, g, b)
        self.set_x(self.MARGIN)
        self.cell(self.CONTENT_W, 8,
                  _sanitize_text(f"Overall Match Score: {overall_score}%   |   {label}"),
                  align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(5)

        # Gap summary paragraph (from LLM)
        if gap_summary:
            self._body(gap_summary)
            self.ln(2)

        # ── Two-column layout: Strengths (left) then Gaps (right) ────────────
        # Each column is rendered sequentially so the shared Y cursor never
        # bleeds across columns.  We snapshot top_y before each column and
        # restore it before starting the next one.  The border is drawn AFTER
        # the content so its height matches the actual rendered text.

        col_w   = self.CONTENT_W / 2 - 3
        gap_x   = 6          # horizontal gap between the two columns
        right_x = self.MARGIN + col_w + gap_x
        line_h  = 5.5        # bullet line height
        hdr_h   = 10         # header area height (label + rule)
        pad_b   = 4          # bottom padding inside box

        def _render_column(x0: float, title: str, skills: list,
                           title_rgb: tuple) -> float:
            """
            Render one column starting at (x0, top_y).
            Returns the Y coordinate of the bottom of the last line rendered.
            The cursor Y is left at that position when done.
            """
            col_top = self.get_y()

            # Header label
            self.set_font("Helvetica", "B", 9)
            self.set_text_color(*title_rgb)
            self.set_xy(x0 + 3, col_top + 2)
            self.cell(col_w - 6, 7, title,
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)

            # Thin rule under header
            self.set_draw_color(*title_rgb)
            self.set_line_width(0.2)
            self.line(x0, col_top + hdr_h, x0 + col_w, col_top + hdr_h)

            # Bullet items — all skills, no cap
            cursor_y = col_top + hdr_h + 1
            self.set_font("Helvetica", "", 9)
            for skill in sorted(skills):
                # dash marker in title colour
                self.set_text_color(*title_rgb)
                self.set_xy(x0 + 3, cursor_y)
                self.cell(5, line_h, "-",
                          new_x=XPos.RIGHT, new_y=YPos.TOP)
                # skill text in dark ink, wrapping inside column
                ri, gi, bi = hex_to_rgb(COLORS["dark_gray"])
                self.set_text_color(ri, gi, bi)
                # Use get_string_width to check if it fits on one line
                text = _sanitize_text(skill.title())
                avail_w = col_w - 10
                if self.get_string_width(text) <= avail_w:
                    self.set_xy(x0 + 8, cursor_y)
                    self.cell(avail_w, line_h, text,
                              new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                    cursor_y += line_h
                else:
                    # multi_cell will advance Y itself; sync cursor_y after
                    self.set_xy(x0 + 8, cursor_y)
                    self.multi_cell(avail_w, line_h, text)
                    cursor_y = self.get_y()
                cursor_y += 0.5   # small inter-item gap

            bottom_y = cursor_y + pad_b
            return bottom_y

        # ── Render LEFT column (Strengths) ────────────────────────────────────
        top_y = self.get_y()
        rg, gg, bg = hex_to_rgb(COLORS["success"])
        self.set_y(top_y)
        left_bottom = _render_column(self.MARGIN, "Key Strengths",
                                     matched_skills, (rg, gg, bg))

        # ── Render RIGHT column (Gaps) — reset Y to top_y first ───────────────
        rd2, gd2, bd2 = hex_to_rgb(COLORS["danger"])
        self.set_y(top_y)
        right_bottom = _render_column(right_x, "Key Gaps to Close",
                                      missing_skills, (rd2, gd2, bd2))

        # ── Draw borders now that we know each column's real height ───────────
        left_h  = left_bottom  - top_y
        right_h = right_bottom - top_y

        self.set_draw_color(rg, gg, bg)
        self.set_line_width(0.3)
        self.rect(self.MARGIN, top_y, col_w, left_h, style="D")

        self.set_draw_color(rd2, gd2, bd2)
        self.set_line_width(0.3)
        self.rect(right_x, top_y, col_w, right_h, style="D")

        # Advance cursor past the taller of the two columns
        self.set_y(max(left_bottom, right_bottom) + 4)

    # ── Section 4: Candidate Profile ─────────────────────────────────────────

    def _render_candidate_profile(self, candidate: dict, sections: dict):
        self._page_break_if_needed(60)
        self._section_heading("2", "Candidate Profile")

        contact = candidate.get("contact_raw", {})

        rows = [
            ("Full Name:",    candidate.get("name", "N/A")),
            ("Professional Title:", candidate.get("title", "")),
            ("Email:",        candidate.get("email", "")),
            ("Phone:",        candidate.get("phone", "")),
            ("Location:",     candidate.get("location", "")),
            ("LinkedIn:",     candidate.get("linkedin", "")),
        ]
        for label, value in rows:
            if not value:
                continue
            self._info_row(label, value)
            self.ln(1)

        # Professional summary
        summary = sections.get("summary", "") or sections.get("objective", "")
        if isinstance(summary, str) and summary.strip():
            self.ln(3)
            self._sub_heading("Professional Summary")
            self._body(summary)

    # ── Section 5: Skills Analysis ────────────────────────────────────────────

    def _render_skills_analysis(
        self,
        candidate_skills: list,
        score_breakdown: dict,
    ):
        self._page_break_if_needed(50)
        self._section_heading("3", "Skills Analysis")

        # Tier match table
        self._sub_heading("Match Coverage by Tier")
        cols   = ["Tier", "Matched", "Total", "Coverage %", "Weight"]
        widths = [46, 26, 22, 56, 30]
        self._table_header_row(cols, widths)
        tier_order = ["required", "preferred", "nice_to_have"]
        tier_labels = {"required": "Required", "preferred": "Preferred", "nice_to_have": "Nice to Have"}
        weight_labels = {"required": "1.00 (Critical)", "preferred": "0.50 (Important)", "nice_to_have": "0.25 (Bonus)"}

        tier_colors = {
            "required":    COLORS["tier_required"],
            "preferred":   COLORS["tier_preferred"],
            "nice_to_have": COLORS["tier_nice"],
        }
        for i, tier in enumerate(tier_order):
            if tier not in score_breakdown:
                continue
            d   = score_breakdown[tier]
            pct = d.get("tier_pct", 0)
            alt = (i % 2 == 1)

            # Draw first 4 cells normally, then draw coverage bar inline
            row_h = 8
            r_alt, g_alt, b_alt = hex_to_rgb(COLORS["table_row_alt"])
            if alt:
                self.set_fill_color(r_alt, g_alt, b_alt)
            else:
                r_alt, g_alt, b_alt = 255, 255, 255
                self.set_fill_color(255, 255, 255)

            x_start = self.get_x()
            y_start = self.get_y()

            self.set_font("Helvetica", "", 9)
            self._set_color(COLORS["dark_gray"])
            cells = [
                (tier_labels.get(tier, tier), widths[0], "L"),
                (str(d.get("matched_count", len(d.get("matched", [])))), widths[1], "C"),
                (str(d.get("total_count", len(d.get("matched", [])) + len(d.get("missing", [])))), widths[2], "C"),
            ]
            for text, w, align in cells:
                self.cell(w, row_h, _sanitize_text(text), border=0, fill=True,
                          new_x=XPos.RIGHT, new_y=YPos.TOP, align=align)

            # Coverage column: draw mini bar inside cell
            bar_cell_x = self.get_x()
            bar_cell_w = widths[3]
            bar_h_inner = 4
            bar_y = y_start + (row_h - bar_h_inner) / 2

            # Cell background
            self.rect(bar_cell_x, y_start, bar_cell_w, row_h, style="F")

            # Background track
            track_x = bar_cell_x + 2
            track_w = bar_cell_w - 18
            r_track, g_track, b_track = hex_to_rgb(COLORS["light_gray"])
            self.set_fill_color(r_track, g_track, b_track)
            self.rect(track_x, bar_y, track_w, bar_h_inner, style="F")

            # Filled bar
            r_bar, g_bar, b_bar = hex_to_rgb(tier_colors.get(tier, COLORS["accent"]))
            self.set_fill_color(r_bar, g_bar, b_bar)
            fill_w = max(0, min(track_w, track_w * pct / 100))
            if fill_w > 0:
                self.rect(track_x, bar_y, fill_w, bar_h_inner, style="F")

            # Pct label
            self.set_font("Helvetica", "B", 8)
            self._set_color(COLORS["dark_gray"])
            self.set_xy(track_x + track_w + 1, y_start)
            self.cell(14, row_h, f"{pct:.0f}%", align="C",
                      new_x=XPos.RIGHT, new_y=YPos.TOP)

            # Weight cell
            self.set_fill_color(r_alt, g_alt, b_alt)
            self.set_font("Helvetica", "", 8)
            self._set_color(COLORS["dark_gray"])
            self.cell(widths[4], row_h, _sanitize_text(weight_labels.get(tier, "")),
                      border=0, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")

            # Bottom divider
            r_mid, g_mid, b_mid = hex_to_rgb(COLORS["mid_gray"])
            self.set_draw_color(r_mid, g_mid, b_mid)
            self.set_line_width(0.1)
            self.line(x_start, y_start + row_h, x_start + sum(widths), y_start + row_h)

        self.ln(5)

        # Matched skills by tier
        any_matched = any(score_breakdown.get(t, {}).get("matched") for t in tier_order)
        if any_matched:
            self._sub_heading("Matched Skills")
            for tier in tier_order:
                d = score_breakdown.get(tier, {})
                matched = d.get("matched", [])
                if not matched:
                    continue
                self.set_font("Helvetica", "B", 9)
                self._set_color(COLORS["primary"])
                self.cell(0, 6, _sanitize_text(f"  {tier_labels.get(tier, tier)}:"),
                          new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                self._render_skill_pills(sorted(matched), COLORS["success"])
            self.ln(2)

        # Missing skills by tier
        any_missing = any(score_breakdown.get(t, {}).get("missing") for t in tier_order)
        if any_missing:
            self._page_break_if_needed(30)
            self._sub_heading("Skills Gap (Missing)")
            for tier in tier_order:
                d = score_breakdown.get(tier, {})
                missing = d.get("missing", [])
                if not missing:
                    continue
                self.set_font("Helvetica", "B", 9)
                self._set_color(COLORS["primary"])
                self.cell(0, 6, _sanitize_text(f"  {tier_labels.get(tier, tier)}:"),
                          new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                self._render_skill_pills(sorted(missing), COLORS["danger"])
            self.ln(2)

        # Full candidate skills inventory
        if candidate_skills:
            self._page_break_if_needed(25)
            self._sub_heading(f"Complete Skills Inventory  ({len(candidate_skills)} skills)")
            self._render_skill_pills(sorted(candidate_skills), COLORS["dark_gray"])
            self.ln(8)

    # ── Section 6: Experience ─────────────────────────────────────────────────

    def _render_experience(self, experience: list):
        if not experience:
            return
        self._page_break_if_needed(40)
        self._section_heading("4", "Work Experience")

        for entry in experience:
            if not isinstance(entry, dict):
                continue
            self._page_break_if_needed(25)

            title   = entry.get("title", entry.get("role", ""))
            org     = entry.get("organisation", entry.get("company", ""))
            start   = entry.get("start_date", "")
            end     = entry.get("end_date", "Present")
            desc    = entry.get("description", "")
            bullets = entry.get("bullets", [])
            loc     = entry.get("location", "")

            date_str = f"{start} - {end}" if start else end

            # Role title (bold) + date right-aligned
            self.set_font("Helvetica", "B", 10)
            self._set_color(COLORS["primary"])
            self.set_x(self.MARGIN)
            self.cell(self.CONTENT_W - 40, 7, _sanitize_text(title),
                      new_x=XPos.RIGHT, new_y=YPos.TOP)
            self.set_font("Helvetica", "I", 9)
            self._set_color(COLORS["mid_gray"])
            self.cell(40, 7, _sanitize_text(date_str), align="R",
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)

            # Thin rule under title row
            rt, gt, bt = hex_to_rgb(COLORS["rule"])
            self.set_draw_color(rt, gt, bt)
            self.set_line_width(0.2)
            self.line(self.MARGIN, self.get_y(), self.MARGIN + self.CONTENT_W, self.get_y())
            self.ln(1)

            # Organisation + location
            if org:
                self.set_font("Helvetica", "I", 9)
                self._set_color(COLORS["accent"])
                loc_part = f"  |  {loc}" if loc else ""
                self.set_x(self.MARGIN)
                self.cell(0, 5.5, _sanitize_text(f"{org}{loc_part}"),
                          new_x=XPos.LMARGIN, new_y=YPos.NEXT)

            if desc:
                self._body(desc, indent=4)
            for b in bullets:
                self._bullet(b, indent=4)
            self.ln(4)

    # ── Section 7: Projects ───────────────────────────────────────────────────

    def _render_projects(self, projects: list):
        if not projects:
            return
        self._page_break_if_needed(40)
        self._section_heading("5", "Projects")

        for proj in projects:
            if not isinstance(proj, dict):
                continue
            self._page_break_if_needed(20)

            title = proj.get("title", proj.get("name", "Untitled Project"))
            desc  = proj.get("description", "")
            techs = proj.get("technologies", [])
            url   = proj.get("url", proj.get("link", ""))
            start = proj.get("start_date", "")
            end   = proj.get("end_date", "")

            self.set_font("Helvetica", "B", 10)
            self._set_color(COLORS["primary"])
            date_str = ""
            if start or end:
                date_str = f"{start} - {end}" if start else end
            self.cell(self.CONTENT_W - 35, 7, _sanitize_text(title),
                      new_x=XPos.RIGHT, new_y=YPos.TOP)
            if date_str:
                self.set_font("Helvetica", "I", 9)
                self._set_color(COLORS["mid_gray"])
                self.cell(35, 7, _sanitize_text(date_str), align="R",
                          new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            else:
                self.ln(7)

            if desc:
                self._body(desc, indent=4)
            if techs:
                self.set_font("Helvetica", "B", 9)
                self._set_color(COLORS["accent"])
                self.set_x(self.MARGIN + 4)
                self.cell(28, 5.5, "Technologies:", new_x=XPos.RIGHT, new_y=YPos.TOP)
                self.set_font("Helvetica", "", 9)
                self._set_color(COLORS["dark_gray"])
                self.multi_cell(self.CONTENT_W - 32, 5.5,
                                _sanitize_text(", ".join(str(t) for t in techs)))
            if url:
                self.set_font("Helvetica", "I", 8)
                self._set_color(COLORS["accent"])
                self.set_x(self.MARGIN + 4)
                self.cell(0, 5, _sanitize_text(f"Link: {url}"),
                          new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.ln(4)

    # ── Section 8: Education ──────────────────────────────────────────────────

    def _render_education(self, education: list):
        if not education:
            return
        self._page_break_if_needed(35)
        self._section_heading("6", "Education")

        for entry in education:
            if not isinstance(entry, dict):
                continue
            degree = entry.get("title", entry.get("degree", ""))
            school = entry.get("organisation", entry.get("institution", ""))
            start  = entry.get("start_date", "")
            end    = entry.get("end_date", "")
            grade  = entry.get("grade", entry.get("gpa", ""))
            field  = entry.get("field", entry.get("major", ""))

            date_str = f"{start} - {end}" if start else end
            deg_text = degree + (f" in {field}" if field else "")

            # Degree title bold + date right-aligned
            self.set_font("Helvetica", "B", 10)
            self._set_color(COLORS["primary"])
            self.set_x(self.MARGIN)
            self.cell(self.CONTENT_W - 35, 7, _sanitize_text(deg_text),
                      new_x=XPos.RIGHT, new_y=YPos.TOP)
            self.set_font("Helvetica", "I", 9)
            self._set_color(COLORS["mid_gray"])
            self.cell(35, 7, _sanitize_text(date_str), align="R",
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)

            # Thin rule under title row
            rt, gt, bt = hex_to_rgb(COLORS["rule"])
            self.set_draw_color(rt, gt, bt)
            self.set_line_width(0.2)
            self.line(self.MARGIN, self.get_y(), self.MARGIN + self.CONTENT_W, self.get_y())
            self.ln(1)

            if school:
                self.set_font("Helvetica", "I", 9)
                self._set_color(COLORS["accent"])
                self.set_x(self.MARGIN)
                self.cell(0, 5.5, _sanitize_text(school),
                          new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            if grade:
                self.set_font("Helvetica", "", 9)
                self._set_color(COLORS["dark_gray"])
                self.set_x(self.MARGIN + 4)
                self.cell(0, 5.5, _sanitize_text(f"Grade / GPA: {grade}"),
                          new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.ln(4)

    # ── Section 9: Certifications ─────────────────────────────────────────────

    def _render_certifications(self, certifications: list):
        if not certifications:
            return
        self._page_break_if_needed(30)
        self._section_heading("7", "Certifications")

        for cert in certifications:
            if isinstance(cert, str):
                self._bullet(cert)
            elif isinstance(cert, dict):
                name   = cert.get("title", cert.get("name", ""))
                issuer = cert.get("organisation", cert.get("issuer", ""))
                date   = cert.get("end_date", cert.get("date", ""))
                line   = name
                if issuer:
                    line += f"  —  {issuer}"
                if date:
                    line += f"  ({date})"
                self._bullet(line)
        self.ln(3)

    # ── Section 10: AI Analysis / Opportunity Insights ────────────────────────

    def _render_ai_analysis(
        self,
        overall_score: float,
        score_breakdown: dict,
        jd: dict,
        gap_summary: str,
    ):
        self._page_break_if_needed(60)
        self._section_heading("8", "AI Analysis & Opportunity Insights")

        # JD info box
        job_title     = jd.get("job_title", jd.get("title", ""))
        company       = jd.get("company", "")
        location      = jd.get("location", "")
        exp_req       = jd.get("experience_required", "")
        education_req = jd.get("education", "")

        # Guard: keep only the first line of each field in case the LLM or
        # upstream code stuffed multi-line text into a single field.
        def _first_line(s: str) -> str:
            return s.splitlines()[0].strip() if s else ""

        job_title     = _first_line(job_title)
        company       = _first_line(company)
        location      = _first_line(location)
        exp_req       = _first_line(exp_req)
        education_req = _first_line(education_req)

        if job_title or company:
            self._sub_heading("Job Requirements Overview")
            if job_title:
                self._info_row("Role:", job_title)
                self.ln(1)
            if company:
                self._info_row("Company:", company)
                self.ln(1)
            if location:
                self._info_row("Location:", location)
                self.ln(1)
            if exp_req:
                self._info_row("Experience:", exp_req)
                self.ln(1)
            if education_req:
                self._info_row("Education:", education_req)
                self.ln(1)
            self.ln(3)

        # Match score summary
        self._sub_heading("Match Score Summary")
        tier_order  = ["required", "preferred", "nice_to_have"]
        tier_labels = {"required": "Required Skills", "preferred": "Preferred Skills",
                       "nice_to_have": "Nice-to-Have Skills"}
        for tier in tier_order:
            d = score_breakdown.get(tier, {})
            if not d:
                continue
            pct = d.get("tier_pct", 0)
            self._progress_bar(tier_labels.get(tier, tier), pct)
            self.ln(1)

        score_color = (
            COLORS["success"] if overall_score >= 80
            else (COLORS["warning"] if overall_score >= 60 else COLORS["danger"])
        )
        self.ln(2)
        self.set_font("Helvetica", "B", 10)
        self._set_color(COLORS["dark_gray"])
        self.cell(55, 7, "Overall Match Score:")
        self.set_font("Helvetica", "B", 12)
        r, g, b = hex_to_rgb(score_color)
        self.set_text_color(r, g, b)
        self.cell(0, 7, f"{overall_score}%", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(4)

        # Strengths & Weaknesses derived from tiers
        req_d  = score_breakdown.get("required",  {})
        req_matched = req_d.get("matched", [])
        req_missing = req_d.get("missing", [])

        if req_matched:
            self._sub_heading("Strengths (Matched Required Skills)")
            for skill in sorted(req_matched):
                self._bullet(skill.title())
            self.ln(2)

        if req_missing:
            self._page_break_if_needed(30)
            self._sub_heading("Critical Gaps (Missing Required Skills)")
            for skill in sorted(req_missing):
                self.set_font("Helvetica", "", 10)
                r, g, b = hex_to_rgb(COLORS["danger"])
                self.set_text_color(r, g, b)
                self.set_x(self.MARGIN + 6)
                self.cell(4, 5.5, "!", new_x=XPos.RIGHT, new_y=YPos.TOP)
                self._set_color(COLORS["dark_gray"])
                self.multi_cell(self.CONTENT_W - 10, 5.5, _sanitize_text(skill.title()))
                self.ln(0.5)
            self.ln(2)

        # Gap analysis paragraph
        if gap_summary:
            self._page_break_if_needed(25)
            self._sub_heading("Gap Analysis")
            self._body(gap_summary)

    # ── Section 11: Skill Visualization (charts) ──────────────────────────────

    def _render_skill_visualization(self, chart_paths: dict, candidate_skills: list):
        self._page_break_if_needed(40)
        self._section_heading("9", "Skill Visualization")

        def _chart_caption(caption: str):
            self.set_font("Helvetica", "I", 9)
            self.set_text_color(120, 140, 160)
            self.cell(0, 6, _sanitize_text(caption), align="C",
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.ln(4)

        # Radar chart — centred, 110 mm (reduced from 130)
        if "radar" in chart_paths and os.path.exists(chart_paths["radar"]):
            img_w = 110
            self.image(chart_paths["radar"],
                       x=(self.PAGE_W - img_w) / 2, w=img_w)
            _chart_caption("Fig 1 — Candidate skills overview (up to 12 skills shown)")

        # Tier coverage bar — full width
        if "tier_bar" in chart_paths and os.path.exists(chart_paths["tier_bar"]):
            self._page_break_if_needed(60)
            img_w = self.CONTENT_W - 10
            self.image(chart_paths["tier_bar"],
                       x=self.MARGIN + 5, w=img_w)
            _chart_caption("Fig 2 — Skill coverage % by requirement tier")

        # Matched vs Missing grouped bar — slightly inset
        if "matched_missing" in chart_paths and os.path.exists(chart_paths["matched_missing"]):
            self._page_break_if_needed(60)
            img_w = self.CONTENT_W - 20
            self.image(chart_paths["matched_missing"],
                       x=self.MARGIN + 10, w=img_w)
            _chart_caption("Fig 3 — Matched vs missing skills count per tier")

    # ── Section 12: Recommendations / Roadmap ────────────────────────────────

    def _render_roadmap(self, roadmap_text: str):
        self._page_break_if_needed(40)
        self._section_heading("10", "30-Day Learning Roadmap & Recommendations")

        if not roadmap_text:
            self._body("No roadmap data available.")
            return

        sections = _parse_roadmap_markdown(roadmap_text)
        for section in sections:
            self._page_break_if_needed(30)
            self.ln(4)

            # ── Section title: bold + full-width accent rule ───────────────────
            self.set_font("Helvetica", "B", 11)
            self._set_color(COLORS["primary"])
            self.set_x(self.MARGIN)
            self.cell(self.CONTENT_W, 8,
                      _sanitize_text(section["title"]),
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            # Full-width accent rule below title
            ra, ga, ba = hex_to_rgb(COLORS["accent"])
            self.set_draw_color(ra, ga, ba)
            self.set_line_width(0.5)
            self.line(self.MARGIN, self.get_y(),
                      self.MARGIN + self.CONTENT_W, self.get_y())
            self.ln(3)

            # ── Section-level items (flat bullets) ────────────────────────────
            for item in section["items"]:
                self._page_break_if_needed(10)
                self._bullet_rich(item)

            # ── Subsections ────────────────────────────────────────────────────
            for sub in section["subsections"]:
                self._page_break_if_needed(20)
                self.ln(3)

                # Subsection header: spaced caps + short rule
                self.set_font("Helvetica", "B", 9)
                self._set_color(COLORS["accent"])
                self.set_x(self.MARGIN + 4)
                sub_label = _sanitize_text(sub["title"].upper())
                self.cell(self.CONTENT_W - 4, 6, sub_label,
                          new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                # Short accent rule under subsection label
                sub_label_w = min(60, self.get_string_width(sub_label) + 4)
                self.set_draw_color(ra, ga, ba)
                self.set_line_width(0.25)
                self.line(self.MARGIN + 4, self.get_y(),
                          self.MARGIN + 4 + sub_label_w, self.get_y())
                self.ln(2)

                for item in sub["items"]:
                    self._page_break_if_needed(10)
                    self._bullet_rich(item, indent=10)

                self.ln(1)

            self.ln(4)


# ── PDF data preparation ───────────────────────────────────────────────────────

def _prepare_pdf_data(
    resume: dict,
    jd: dict,
    score_result: dict,
    roadmap_text: str,
    candidate_skills: set,
) -> dict:
    """
    Normalise all inputs into a flat dict consumed by CareerReportPDF render methods.
    Handles both the OCR LLM format and the notebook mock format gracefully.
    """
    name    = resume.get("name", "Candidate")
    contact = resume.get("contact", {})
    title   = resume.get("title", contact.get("headline", "Professional"))
    email   = contact.get("email", "")
    phone   = contact.get("phone", "")
    location = contact.get("location", "")
    linkedin = contact.get("linkedin", "")

    sections = resume.get("sections", {})
    experience = sections.get("experience", [])
    projects   = sections.get("projects",   [])
    education  = sections.get("education",  [])
    certs      = sections.get("certifications", sections.get("certificates", []))

    # Normalise experience: notebook mock format uses subsections dict
    if isinstance(experience, dict):
        exp_list = []
        for role_name, content in experience.get("subsections", {}).items():
            bullets = content.get("bullet_points", [])
            exp_list.append({"title": role_name, "bullets": bullets})
        experience = exp_list

    # Normalise projects: notebook mock format uses subsections dict
    if isinstance(projects, dict):
        proj_list = []
        for proj_name, content in projects.get("subsections", {}).items():
            techs = [b for b in content.get("bullet_points", []) if len(b) < 40]
            proj_list.append({"title": proj_name, "technologies": techs})
        projects = proj_list

    # Normalise education: might be a list of dicts or a dict with subsections
    if isinstance(education, dict):
        edu_list = []
        for deg, content in education.get("subsections", {}).items():
            edu_list.append({"title": deg})
        education = edu_list

    # Normalise certifications: might be a list of strings
    if not isinstance(certs, list):
        certs = []

    # Build score breakdown in a stable form
    bd = {}
    for tier, d in score_result.get("breakdown", {}).items():
        bd[tier] = {
            "matched":       d.get("matched", []),
            "missing":       d.get("missing", []),
            "tier_pct":      d.get("tier_pct", 0),
            "matched_count": d.get("matched_count", len(d.get("matched", []))),
            "total_count":   d.get("total_count",
                                   len(d.get("matched", [])) + len(d.get("missing", []))),
        }

    all_matched = []
    all_missing = []
    for d in bd.values():
        all_matched.extend(d["matched"])
        all_missing.extend(d["missing"])

    gap_summary = _extract_gap_summary(roadmap_text)

    return {
        "candidate": {
            "name":         name,
            "title":        title,
            "email":        email,
            "phone":        phone,
            "location":     location,
            "linkedin":     linkedin,
            "skills_count": len(candidate_skills),
            "contact_raw":  contact,
        },
        "target_role": {
            "title":    jd.get("job_title", jd.get("title", "N/A")),
            "company":  jd.get("company", "N/A"),
            "location": jd.get("location", ""),
        },
        "overall_score":    score_result.get("overall_score", 0),
        "score_breakdown":  bd,
        "matched_skills":   all_matched,
        "missing_skills":   all_missing,
        "gap_summary":      gap_summary,
        "roadmap_text":     roadmap_text,
        "candidate_skills": sorted(list(candidate_skills)),
        "sections":         sections,
        "experience":       experience,
        "projects":         projects,
        "education":        education,
        "certifications":   certs,
        "jd":               jd,
    }


# ── Step 6 — PDF generation ────────────────────────────────────────────────────

def generate_pdf_report(
    resume: dict,
    jd: dict,
    score_result: dict,
    roadmap_text: str,
    candidate_skills: set,
    chart_paths: dict,
    output_path: str,
) -> int:
    """
    Build and save the professional multi-page PDF report.

    Returns the total page count.
    """
    d = _prepare_pdf_data(resume, jd, score_result, roadmap_text, candidate_skills)

    pdf = CareerReportPDF(
        candidate_name=d["candidate"]["name"],
        target_role=d["target_role"]["title"],
    )
    pdf.alias_nb_pages()

    # ── Render all sections ───────────────────────────────────────────────────
    # 1. Cover page
    pdf._render_cover(
        candidate=d["candidate"],
        target_role=d["target_role"],
        overall_score=d["overall_score"],
        chart_paths=chart_paths,
        jd=d["jd"],
    )

    # Record TOC entries with live page numbers
    # (TOC page itself is added next so sections start at page 3)
    toc_entries = []

    def _add_section(num, title, fn, *args, **kwargs):
        page_before = pdf.page_no()
        fn(*args, **kwargs)
        # The section likely started on the page AFTER where we were,
        # but _section_heading() always starts at current position.
        # We capture the page at function entry as the section start.
        toc_entries.append((str(num), title, page_before + 1))

    # 2. Executive Summary
    pdf.add_page()
    toc_entries.append(("1", "Executive Summary", pdf.page_no()))
    pdf._render_executive_summary(
        gap_summary=d["gap_summary"],
        overall_score=d["overall_score"],
        matched_skills=d["matched_skills"],
        missing_skills=d["missing_skills"],
        candidate=d["candidate"],
    )

    # 3. Candidate Profile
    toc_entries.append(("2", "Candidate Profile", pdf.page_no()))
    pdf._render_candidate_profile(
        candidate=d["candidate"],
        sections=d["sections"],
    )

    # 4. Skills Analysis
    toc_entries.append(("3", "Skills Analysis", pdf.page_no()))
    pdf._render_skills_analysis(
        candidate_skills=d["candidate_skills"],
        score_breakdown=d["score_breakdown"],
    )

    # 5. Work Experience
    if d["experience"]:
        toc_entries.append(("4", "Work Experience", pdf.page_no()))
        pdf._render_experience(d["experience"])

    # 6. Projects
    if d["projects"]:
        toc_entries.append(("5", "Projects", pdf.page_no()))
        pdf._render_projects(d["projects"])

    # 7. Education
    if d["education"]:
        toc_entries.append(("6", "Education", pdf.page_no()))
        pdf._render_education(d["education"])

    # 8. Certifications
    if d["certifications"]:
        toc_entries.append(("7", "Certifications", pdf.page_no()))
        pdf._render_certifications(d["certifications"])

    # 9. AI Analysis
    toc_entries.append(("8", "AI Analysis & Opportunity Insights", pdf.page_no()))
    pdf._render_ai_analysis(
        overall_score=d["overall_score"],
        score_breakdown=d["score_breakdown"],
        jd=d["jd"],
        gap_summary=d["gap_summary"],
    )

    # 10. Skill Visualization
    toc_entries.append(("9", "Skill Visualization", pdf.page_no()))
    pdf._render_skill_visualization(
        chart_paths=chart_paths,
        candidate_skills=d["candidate_skills"],
    )

    # 11. Roadmap
    toc_entries.append(("10", "30-Day Roadmap & Recommendations", pdf.page_no()))
    pdf._render_roadmap(d["roadmap_text"])

    # ── Insert TOC as page 2 ──────────────────────────────────────────────────
    # fpdf2 doesn't support inserting pages, so we output to a temp file,
    # then prepend the TOC page by re-creating the PDF with the TOC inline.
    # Simplest approach: write a new PDF with TOC at position 2.
    # Because page numbers are already finalised, we can now bake them in.
    pdf.output(output_path)

    # Increment all TOC page numbers by 1 to account for the TOC page
    # being inserted at position 2, which shifts every section page by +1.
    toc_entries_adjusted = [(num, title, pg + 1) for num, title, pg in toc_entries]

    # Now rebuild with TOC inserted at page 2
    _insert_toc_page(output_path, toc_entries_adjusted, d["candidate"])

    return pdf.page_no()


def _insert_toc_page(output_path: str, toc_entries: list, candidate: dict):
    """
    Re-open the PDF, insert a TOC page after the cover, and re-save.
    Uses a simple fpdf2 rebuild: generate TOC as a standalone single-page PDF,
    then use PyPDF2/pypdf to merge if available, otherwise skip TOC merge.
    Falls back gracefully if pypdf is not installed.
    """
    try:
        from pypdf import PdfWriter, PdfReader
    except ImportError:
        try:
            from PyPDF2 import PdfWriter, PdfReader
        except ImportError:
            # pypdf/PyPDF2 not available: TOC is skipped, PDF stands as-is
            return

    import io

    # Build TOC-only PDF in memory
    toc_pdf = CareerReportPDF(
        candidate_name=candidate.get("name", ""),
        target_role="",
    )
    toc_pdf.alias_nb_pages()
    toc_pdf._render_toc(toc_entries)
    toc_bytes = io.BytesIO()
    toc_pdf.output(toc_bytes)
    toc_bytes.seek(0)

    # Read main PDF
    main_reader = PdfReader(output_path)
    toc_reader  = PdfReader(toc_bytes)

    writer = PdfWriter()
    # Page 1: cover
    writer.add_page(main_reader.pages[0])
    # Page 2: TOC
    writer.add_page(toc_reader.pages[0])
    # Remaining pages
    for page in main_reader.pages[1:]:
        writer.add_page(page)

    with open(output_path, "wb") as f:
        writer.write(f)


# ── Main entry point ───────────────────────────────────────────────────────────
def run_strategist_agent(
    resume_json: dict,
    jd_json: dict = None,
    output_dir: str = "outputs",
    progress_cb=None,
) -> dict:
    """
    Full Strategist pipeline.

    Parameters
    ----------
    resume_json  : structured resume dict from OCR pipeline
    jd_json      : job description dict (uses default mock if None)
    output_dir   : directory to save PDF and JSON outputs
    progress_cb  : optional callable(message: str)

    Returns
    -------
    dict with keys:
        candidate_name  : str
        target_role     : str
        overall_score   : float
        breakdown       : dict
        matched_skills  : list
        missing_skills  : list
        roadmap_markdown: str
        pdf_path        : str
        json_path       : str
        chart_data      : dict  (base64 chart images for web display)
    """
    os.makedirs(output_dir, exist_ok=True)

    # ── Default JD ────────────────────────────────────────────────────────────
    if jd_json is None:
        jd_json = {
            "job_title": "Senior Machine Learning Engineer",
            "company": "TechVision AI",
            "location": "Remote",
            "description": "We are seeking a Senior ML Engineer to design, build, and deploy production-grade ML systems.",
            "requirements": {
                "required_skills": [
                    "Python", "Machine Learning", "Deep Learning", "PyTorch", "SQL",
                    "Docker", "Kubernetes", "MLflow", "CI/CD Pipelines", "REST APIs",
                ],
                "preferred_skills": [
                    "Apache Spark", "TensorFlow", "AWS (SageMaker, Lambda, S3)",
                    "Terraform", "Data Analysis", "LLM Fine-tuning",
                ],
                "nice_to_have": ["Rust", "Go", "Graph Neural Networks", "Team Management"],
            },
            "experience_required": "5+ years in ML/Data Science",
            "education": "MS or PhD in Computer Science, Data Science, or related field",
        }

    # ── Step 1: Skills extraction ─────────────────────────────────────────────
    candidate_skills = extract_candidate_skills(resume_json)
    _log(None, f"Found {len(candidate_skills)} candidate skills.")

    jd_requirements = extract_jd_requirements(jd_json, progress_cb=None)

    # ── Step 2: Match scoring ─────────────────────────────────────────────────
    score_result = calculate_match_score(candidate_skills, jd_requirements)
    _log(None, f"Match score: {score_result['overall_score']}%")

    # ── Step 3: Roadmap generation ────────────────────────────────────────────
    _log(None, "Generating 30-day learning roadmap via Mistral AI...")
    roadmap_text = generate_roadmap(resume_json, jd_json, score_result)
    _log(None, "Roadmap generated.")

    # ── Step 4: Charts ────────────────────────────────────────────────────────
    tmp_dir = tempfile.mkdtemp(prefix="career_report_")
    try:
        chart_paths = generate_charts(score_result, candidate_skills, tmp_dir)
        _log(None, f"Charts generated: {list(chart_paths.keys())}")

        # Convert charts to base64 for web embedding
        import base64
        chart_data = {}
        for key, path in chart_paths.items():
            if os.path.exists(path):
                with open(path, "rb") as f:
                    chart_data[key] = base64.b64encode(f.read()).decode("utf-8")

        # ── Step 5: PDF generation ─────────────────────────────────────────────
        pdf_path = os.path.join(output_dir, "career_analysis_report.pdf")
        page_count = generate_pdf_report(
            resume_json, jd_json, score_result, roadmap_text,
            candidate_skills, chart_paths, pdf_path,
        )
        _log(None, f"PDF report saved ({page_count} pages): {pdf_path}")

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    # ── Step 6: Export JSON ───────────────────────────────────────────────────
    name = resume_json.get("name", "Candidate")
    title = resume_json.get("title", resume_json.get("contact", {}).get("headline", "Professional"))

    all_missing = []
    all_matched = []
    for tier, tier_data in score_result["breakdown"].items():
        all_missing.extend(tier_data["missing"])
        all_matched.extend(tier_data["matched"])

    strategist_output = {
        "agent": "strategist",
        "candidate": {
            "name":         name,
            "title":        title,
            "skills_found": sorted(list(candidate_skills)),
        },
        "target_role": {
            "title":   jd_json.get("job_title", "N/A"),
            "company": jd_json.get("company", "N/A"),
        },
        "match_score": {
            "overall": score_result["overall_score"],
            "breakdown": {
                tier: {
                    "matched":  d["matched"],
                    "missing":  d["missing"],
                    "tier_pct": d["tier_pct"],
                }
                for tier, d in score_result["breakdown"].items()
            },
        },
        "roadmap_markdown": roadmap_text,
    }

    json_path = os.path.join(output_dir, "strategist_output.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(strategist_output, f, indent=2, ensure_ascii=False)
    _log(None, f"Results exported to JSON: {json_path}")

    return {
        "candidate_name":   name,
        "target_role":      jd_json.get("job_title", "N/A"),
        "company":          jd_json.get("company", "N/A"),
        "overall_score":    score_result["overall_score"],
        "breakdown":        score_result["breakdown"],
        "matched_skills":   all_matched,
        "missing_skills":   all_missing,
        "roadmap_markdown": roadmap_text,
        "pdf_path":         pdf_path,
        "json_path":        json_path,
        "chart_data":       chart_data,
        "gap_summary":      (re.search(r"### Gap Analysis Summary\n(.*?)(?:\n###|$)", roadmap_text, re.DOTALL).group(1).strip() 
                             if "### Gap Analysis Summary" in roadmap_text else ""),
    }


# ── Utility ───────────────────────────────────────────────────────────────────
def _log(cb, msg: str):
    """Always print to terminal; never forward to the UI progress callback."""
    print(f"[strategist] {msg}")
