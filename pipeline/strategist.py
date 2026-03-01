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

# ── Color palette (verbatim from notebook) ────────────────────────────────────
COLORS = {
    "primary":        "#1E3A5F",
    "accent":         "#4A90D9",
    "success":        "#27AE60",
    "warning":        "#F39C12",
    "danger":         "#E74C3C",
    "light_gray":     "#F5F5F5",
    "mid_gray":       "#BDC3C7",
    "dark_gray":      "#2C3E50",
    "white":          "#FFFFFF",
    "tier_required":  "#E74C3C",
    "tier_preferred": "#F39C12",
    "tier_nice":      "#3498DB",
}


def hex_to_rgb(hex_color: str) -> tuple:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hex_to_float_rgb(hex_color: str) -> tuple:
    r, g, b = hex_to_rgb(hex_color)
    return (r / 255, g / 255, b / 255)


# ── Known skill keywords (verbatim from notebook) ─────────────────────────────
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


# ── Step 1 — Skills extraction (verbatim from notebook) ───────────────────────
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
    # sections.skills is a dict with bullet_points list
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
        "Read the job description below and extract a structured list of skills/requirements, "
        "categorized into three tiers: Required, Preferred, and Nice-to-have.\n\n"
        "RULES:\n"
        "1. Required: Essential skills, minimum qualifications, 'must-have'.\n"
        "2. Preferred: 'Plus', 'experience with X is a bonus', 'ideal candidate has'.\n"
        "3. Nice-to-have: Soft skills, secondary tools, or minor preferences.\n\n"
        "4. Standardize skill names (e.g., 'Python' not 'Python programming').\n"
        "5. Return ONLY a valid JSON object with keys: required, preferred, nice_to_have (each is a list of strings).\n"
        "6. No markdown fences, no extra text.\n\n"
        f"JOB DESCRIPTION:\n{jd_text}\n\n"
        "Return only JSON:"
    )


def parse_jd_with_llm(jd_text: str, progress_cb=None) -> dict:
    """Call Mistral to extract structured skills from raw JD text."""
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
                return llm_reqs
            
            # 2. Fallback to keyword scanning
            required = _extract_skills_from_text(description, SKILL_KEYWORDS)

    return {
        "required":     required,
        "preferred":    preferred,
        "nice_to_have": nice_to_have,
    }


# ── Step 2 — Weighted match score (verbatim from notebook) ────────────────────
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


# ── Step 5 — PDF helpers (verbatim from notebook) ─────────────────────────────
def _sanitize_text(text: str) -> str:
    replacements = {
        "\u2014": "-", "\u2013": "-",
        "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"',
        "\u2022": "*", "\u2026": "...",
        "\u2192": "->", "\u2190": "<-",
    }
    result = []
    for ch in text:
        ch = replacements.get(ch, ch)
        try:
            ch.encode("latin-1")
            result.append(ch)
        except UnicodeEncodeError:
            result.append("")
    return "".join(result)


def _clean_markdown_text(text: str) -> str:
    text = re.sub(r"\*\*([^*]+)\*\*",      r"\1", text)
    text = re.sub(r"\*([^*]+)\*",           r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"`([^`]*)`",             r"\1", text)
    text = text.replace("`", "")
    return text.strip()


def _parse_roadmap_markdown(roadmap_text: str) -> list:
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
            content = _clean_markdown_text(stripped[2:])
            if current_subsection:
                current_subsection["items"].append(content)
            elif current_section:
                current_section["items"].append(content)
        else:
            content = _clean_markdown_text(stripped)
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


class CareerReportPDF(FPDF):
    def __init__(self, candidate_name="", target_role=""):
        super().__init__("P", "mm", "A4")
        self.candidate_name = candidate_name
        self.target_role = target_role
        self.set_auto_page_break(auto=True, margin=25)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "B", 8)
        r, g, b = hex_to_rgb(COLORS["mid_gray"])
        self.set_text_color(r, g, b)
        self.cell(0, 8, _sanitize_text(f"Career Analysis Report - {self.candidate_name}"),
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        r, g, b = hex_to_rgb(COLORS["accent"])
        self.set_draw_color(r, g, b)
        self.set_line_width(0.5)
        self.line(10, 13, 200, 13)
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        r, g, b = hex_to_rgb(COLORS["mid_gray"])
        self.set_text_color(r, g, b)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title: str):
        self.set_font("Helvetica", "B", 16)
        r, g, b = hex_to_rgb(COLORS["primary"])
        self.set_text_color(r, g, b)
        self.cell(0, 12, _sanitize_text(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        r, g, b = hex_to_rgb(COLORS["accent"])
        self.set_draw_color(r, g, b)
        self.set_line_width(0.8)
        self.line(self.l_margin, self.get_y(), 100, self.get_y())
        self.ln(6)

    def sub_title(self, title: str):
        self.set_font("Helvetica", "B", 13)
        r, g, b = hex_to_rgb(COLORS["dark_gray"])
        self.set_text_color(r, g, b)
        self.cell(0, 10, _sanitize_text(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)

    def body_text(self, text: str, bold: bool = False):
        self.set_font("Helvetica", "B" if bold else "", 10)
        r, g, b = hex_to_rgb(COLORS["dark_gray"])
        self.set_text_color(r, g, b)
        self.multi_cell(0, 6, _sanitize_text(text))
        self.ln(2)

    def info_row(self, label: str, value: str):
        self.set_font("Helvetica", "B", 10)
        r, g, b = hex_to_rgb(COLORS["primary"])
        self.set_text_color(r, g, b)
        self.cell(50, 7, _sanitize_text(label), new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_font("Helvetica", "", 10)
        r, g, b = hex_to_rgb(COLORS["dark_gray"])
        self.set_text_color(r, g, b)
        self.cell(0, 7, _sanitize_text(value), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def skill_badge(self, skill: str, is_matched: bool = True):
        color = COLORS["success"] if is_matched else COLORS["danger"]
        icon = "[+]" if is_matched else "[-]"
        self.set_font("Helvetica", "", 9)
        r, g, b = hex_to_rgb(color)
        self.set_text_color(r, g, b)
        self.cell(0, 5, _sanitize_text(f"  {icon}  {skill.title()}"),
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def roadmap_item(self, text: str):
        self.set_font("Helvetica", "", 10)
        r, g, b = hex_to_rgb(COLORS["dark_gray"])
        self.set_text_color(r, g, b)
        self.set_x(self.l_margin + 6)
        self.multi_cell(0, 5, _sanitize_text("* " + text))
        self.ln(1)


# ── Step 6 — PDF generation (verbatim from notebook) ──────────────────────────
def generate_pdf_report(
    resume: dict,
    jd: dict,
    score_result: dict,
    roadmap_text: str,
    candidate_skills: set,
    chart_paths: dict,
    output_path: str,
):
    """Build and save the multi-page PDF report."""
    name = resume.get("name", "Candidate")
    title = resume.get("title", resume.get("contact", {}).get("headline", "Professional"))

    data = {
        "candidate": {
            "name":         name,
            "title":        title,
            "skills_found": sorted(list(candidate_skills)),
        },
        "target_role": {
            "title":   jd.get("job_title", jd.get("title", "N/A")),
            "company": jd.get("company", "N/A"),
            "location": jd.get("location", ""),
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

    pdf = CareerReportPDF(
        candidate_name=data["candidate"]["name"],
        target_role=data["target_role"]["title"],
    )
    pdf.alias_nb_pages()
    bd_pdf = data["match_score"]["breakdown"]

    # ── PAGE 1: Cover ────────────────────────────────────────────────────────
    pdf.add_page()
    pdf.ln(20)
    pdf.set_font("Helvetica", "B", 28)
    r, g, b = hex_to_rgb(COLORS["primary"])
    pdf.set_text_color(r, g, b)
    pdf.cell(0, 15, "Career Analysis Report", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 12)
    r, g, b = hex_to_rgb(COLORS["mid_gray"])
    pdf.set_text_color(r, g, b)
    pdf.cell(0, 8, "AI-Powered Skills Gap Analysis & Learning Roadmap",
             align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(5)
    r, g, b = hex_to_rgb(COLORS["accent"])
    pdf.set_draw_color(r, g, b)
    pdf.set_line_width(1)
    pdf.line(60, pdf.get_y(), 150, pdf.get_y())
    pdf.ln(12)

    pdf.set_font("Helvetica", "B", 13)
    r, g, b = hex_to_rgb(COLORS["dark_gray"])
    pdf.set_text_color(r, g, b)
    pdf.cell(0, 8, "Candidate Profile", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)
    pdf.info_row("Name:",          data["candidate"]["name"])
    pdf.info_row("Current Title:", data["candidate"]["title"])
    pdf.info_row("Total Skills:",  str(len(data["candidate"]["skills_found"])))
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    r, g, b = hex_to_rgb(COLORS["dark_gray"])
    pdf.set_text_color(r, g, b)
    pdf.cell(0, 8, "Target Role", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)
    pdf.info_row("Position:", data["target_role"]["title"])
    pdf.info_row("Company:",  data["target_role"]["company"])
    pdf.ln(8)

    if "donut" in chart_paths and os.path.exists(chart_paths["donut"]):
        img_w = 65
        pdf.image(chart_paths["donut"], x=(210 - img_w) / 2, y=pdf.get_y(), w=img_w)
        pdf.ln(70)

    pdf.set_font("Helvetica", "I", 9)
    r, g, b = hex_to_rgb(COLORS["mid_gray"])
    pdf.set_text_color(r, g, b)
    pdf.cell(0, 8, f"Generated on {datetime.now().strftime('%B %d, %Y at %H:%M')}",
             align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # ── PAGE 2: Skills Breakdown ─────────────────────────────────────────────
    pdf.add_page()
    pdf.section_title("Skills Match Breakdown")
    overall = data["match_score"]["overall"]
    pdf.body_text(f"Overall match score: {overall}%. Below is the detailed breakdown by skill tier.")

    if "tier_bar" in chart_paths and os.path.exists(chart_paths["tier_bar"]):
        pdf.image(chart_paths["tier_bar"], x=15, w=180)
        pdf.ln(5)
    if "matched_missing" in chart_paths and os.path.exists(chart_paths["matched_missing"]):
        pdf.image(chart_paths["matched_missing"], x=25, w=155)
        pdf.ln(5)

    pdf.sub_title("[+] Matched Skills")
    for tier in ["required", "preferred", "nice_to_have"]:
        if tier in bd_pdf and bd_pdf[tier]["matched"]:
            label = tier.replace("_", " ").title()
            pdf.set_font("Helvetica", "B", 10)
            r, g, b = hex_to_rgb(COLORS["primary"])
            pdf.set_text_color(r, g, b)
            pdf.cell(0, 6, _sanitize_text(f"  {label}:"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            for skill in bd_pdf[tier]["matched"]:
                pdf.skill_badge(skill, is_matched=True)
            pdf.ln(2)

    pdf.sub_title("[-] Missing Skills (Gap)")
    for tier in ["required", "preferred", "nice_to_have"]:
        if tier in bd_pdf and bd_pdf[tier]["missing"]:
            label = tier.replace("_", " ").title()
            pdf.set_font("Helvetica", "B", 10)
            r, g, b = hex_to_rgb(COLORS["primary"])
            pdf.set_text_color(r, g, b)
            pdf.cell(0, 6, _sanitize_text(f"  {label}:"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            for skill in bd_pdf[tier]["missing"]:
                pdf.skill_badge(skill, is_matched=False)
            pdf.ln(2)

    # ── PAGE 3: Skills Radar + Inventory ─────────────────────────────────────
    pdf.add_page()
    pdf.section_title("Candidate Skills Overview")
    skills_all = data["candidate"]["skills_found"]
    pdf.body_text(
        f"{data['candidate']['name']} has {len(skills_all)} identified skills "
        "across technical, tools, and soft skills categories."
    )

    if "radar" in chart_paths and os.path.exists(chart_paths["radar"]):
        img_w = 140
        pdf.image(chart_paths["radar"], x=(210 - img_w) / 2, w=img_w)
        pdf.ln(5)

    pdf.sub_title("Complete Skills Inventory")
    sorted_skills = sorted(skills_all)
    col_width = 60
    x_start = pdf.l_margin
    pdf.set_font("Helvetica", "", 9)
    r, g, b = hex_to_rgb(COLORS["dark_gray"])
    pdf.set_text_color(r, g, b)
    for i, skill in enumerate(sorted_skills):
        col = i % 3
        if col == 0 and i > 0:
            pdf.ln(5)
        pdf.set_x(x_start + col * col_width)
        pdf.cell(col_width, 5, f"  * {skill.title()}", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.ln(10)

    # ── PAGE 4+: Learning Roadmap ─────────────────────────────────────────────
    pdf.add_page()
    pdf.section_title("30-Day Learning Roadmap")
    roadmap_text_pdf = data.get("roadmap_markdown", "")

    if roadmap_text_pdf:
        sections = _parse_roadmap_markdown(roadmap_text_pdf)
        for section in sections:
            if pdf.get_y() > 240:
                pdf.add_page()
            pdf.sub_title(section["title"])
            for item in section["items"]:
                pdf.roadmap_item(item)
            for subsection in section["subsections"]:
                if pdf.get_y() > 250:
                    pdf.add_page()
                pdf.set_font("Helvetica", "B", 11)
                r, g, b = hex_to_rgb(COLORS["accent"])
                pdf.set_text_color(r, g, b)
                pdf.cell(0, 8, _sanitize_text(f"  {subsection['title']}"),
                         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                for item in subsection["items"]:
                    pdf.roadmap_item(item)
            pdf.ln(4)
    else:
        pdf.body_text("No roadmap data available.")

    pdf.output(output_path)
    return pdf.page_no()


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
