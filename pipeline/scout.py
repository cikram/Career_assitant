"""
Scout Agent Module
==================


Uses SerpAPI (3 searches) + Mistral chat.complete to:
1. Run 3 targeted Google searches via SerpAPI
2. Inject live search results into a prompt
3. Call Mistral chat.complete (no Agents API — avoids rate limits)
4. Return a Markdown table of matched job opportunities with real URLs
"""

import json
import os
import time

from dotenv import load_dotenv
from mistralai import Mistral

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv()

MISTRAL_API_KEY = (os.getenv("MISTRAL_API_KEY") or "").strip().strip('"').strip("'")
SERPAPI_KEY     = (os.getenv("SERPAPI_KEY") or "").strip().strip('"').strip("'")
SCOUT_MODEL     = "mistral-small-latest"

if not MISTRAL_API_KEY:
    raise ValueError("MISTRAL_API_KEY not found in environment.")

client = Mistral(api_key=MISTRAL_API_KEY)

# ── System Prompt  ────────────────────
SCOUT_SYSTEM_PROMPT = """You are the "Market Mapper" Scout, a high-speed recruitment intelligence agent.
Your purpose is to bridge the gap between a candidate's profile and the real-time 2026 job market.

You have access to the 'web_search' tool. You MUST use it to find current job listings.

Operational Protocol:
1. Analyze the Resume JSON embedded in the user message (not a file — it's inline text).
2. Use web_search to run THREE searches:
   - Search A: Open roles at the target company matching the candidate (e.g. "Google careers senior data scientist 2026")
   - Search B: Similar roles at top competitors (e.g. "senior data scientist jobs Meta Microsoft 2026")
   - Search C: Skill-based discovery using top 3-5 candidate skills (e.g. "PyTorch Spark MLOps jobs 2026")
3. Match each found role against the candidate profile:
   - High match: >80% skill overlap
   - Medium match: 50-80% overlap
   - Strategic Pivot: leverages candidate's niche skills despite lower overall match
4. Output a Markdown table with columns:
   | Job Title | Company | Match Level | Why it Matches | Source Link |
   Include at least 5-8 rows with real URLs from your searches.
5. Stay objective. Use only verified URLs from web searches."""


# ── SerpAPI search helper  ────────────────────────────
def _search_jobs_serpapi(query: str, num: int = 5) -> str:
    """Run a Google search via SerpAPI and return formatted results."""
    if not SERPAPI_KEY:
        return "SerpAPI key not configured — search unavailable."
    try:
        from serpapi import GoogleSearch
        results = GoogleSearch({
            "q":       query,
            "api_key": SERPAPI_KEY,
            "num":     num,
        }).get_dict()

        lines = []
        for r in results.get("organic_results", []):
            title   = r.get("title", "No title")
            link    = r.get("link", "#")
            snippet = r.get("snippet", "")[:250]
            lines.append(f"- [{title}]({link})\n  {snippet}")

        if not lines:
            return "No results found."
        return "\n".join(lines)

    except ImportError:
        return "SerpAPI library not installed. Run: pip install google-search-results"
    except Exception as exc:
        return f"Search error: {exc}"


# ── Extract top skills for skill-based query ─────────────────────────────────
def _extract_top_skills(resume_json: dict, jd_json: dict = None, max_skills: int = 5) -> str:
    """Return a space-separated string of the candidate's top skills."""
    skills_list = []

    # From resume sections (LLM-structured format from ocr.py)
    sections = resume_json.get("sections", {})
    raw_skills = sections.get("skills", [])
    if isinstance(raw_skills, list):
        skills_list.extend([s for s in raw_skills if isinstance(s, str)])
    elif isinstance(raw_skills, dict):
        for bp in raw_skills.get("bullet_points", []):
            skills_list.append(bp)

    # From notebook mock format: skills is a dict of categories
    mock_skills = resume_json.get("skills", {})
    if isinstance(mock_skills, dict):
        for category in mock_skills.values():
            if isinstance(category, list):
                skills_list.extend(category[:2])

    # Deduplicate and trim
    seen = set()
    unique = []
    for s in skills_list:
        if isinstance(s, str) and s.lower() not in seen:
            seen.add(s.lower())
            unique.append(s)

    return " ".join(unique[:max_skills]) if unique else "Python machine learning data science"


# ── Build discovery prompt with injected search results ───────────────────────
def _build_discovery_prompt(
    resume_json: dict,
    jd_json: dict,
    target_company: str,
    search_a: str,
    search_b: str,
    search_c: str,
    top_skills_str: str,
) -> str:
    resume_json_str = json.dumps(resume_json, ensure_ascii=False, indent=2)
    jd_json_str     = json.dumps(jd_json,     ensure_ascii=False, indent=2)

    return f"""I am initiating an Opportunity Scan for the following candidate.

**Target Company:** {target_company}

**Candidate Resume JSON:**
```json
{resume_json_str}
```

**Job Description JSON:**
```json
{jd_json_str}
```

**Live Search Results (fetched via Google):**

Search A — {target_company} roles:
{search_a}

Search B — Competitor roles:
{search_b}

Search C — Skill-based discovery ({top_skills_str}):
{search_c}

**Your Mission:**
1. Analyze the Resume JSON and identify the candidate's core competencies.
2. Cross-reference with the search results above (real, live URLs are already provided).
3. Return a Markdown table of 5-8 best-matched opportunities with these columns:
   | Job Title | Company | Match Level | Why it Matches | Source Link |
   - Match Level: High (>80%), Medium (50-80%), Strategic Pivot (niche match)
   - Why it Matches: reference specific skills/experience from the Resume JSON
   - Source Link: use the URLs from the search results above
"""


# ── Main entry point ──────────────────────────────────────────────────────────
def run_scout_agent(
    resume_json: dict,
    target_company: str = "Google",
    jd_json: dict = None,
    progress_cb=None,
) -> dict:
    """
    Run the Scout agent opportunity scan.

    Parameters
    ----------
    resume_json     : structured resume dict from OCR pipeline
    target_company  : company to search first (default: "Google")
    jd_json         : optional job description dict; uses a default if None
    progress_cb     : optional callable(message: str) for progress updates

    Returns
    -------
    dict with keys:
        target_company  : str
        markdown_result : str   (Markdown table from the agent)
        raw_response    : str
    """
    if jd_json is None:
        sections   = resume_json.get("sections", {})
        skills     = sections.get("skills", [])
        skill_list = skills[:5] if isinstance(skills, list) else []

        experience = sections.get("experience", [])
        role_title = "Data Scientist"
        if isinstance(experience, list) and experience:
            role_title = experience[0].get("title", "Data Scientist")

        jd_json = {
            "job_title":        role_title,
            "company":          target_company,
            "required_skills":  skill_list,
            "preferred_skills": [],
            "description":      f"Looking for a {role_title} with relevant experience",
        }

    job_title      = jd_json.get("job_title", "data scientist")
    top_skills_str = _extract_top_skills(resume_json, jd_json)

    # ── Run 3 SerpAPI searches  ───────────────────────
    _log(progress_cb, "Scout: Running SerpAPI searches...")

    query_a = f"{target_company} careers {job_title} 2026"
    query_b = f"{job_title} jobs Meta Microsoft OpenAI 2026"
    query_c = f"{top_skills_str} jobs hiring 2026"

    _log(progress_cb, f"Scout Search A: {query_a}")
    search_a = _search_jobs_serpapi(query_a)
    _log(progress_cb, f"Scout Search A: {len(search_a)} chars returned")

    _log(progress_cb, f"Scout Search B: {query_b}")
    search_b = _search_jobs_serpapi(query_b)
    _log(progress_cb, f"Scout Search B: {len(search_b)} chars returned")

    _log(progress_cb, f"Scout Search C: {query_c}")
    search_c = _search_jobs_serpapi(query_c)
    _log(progress_cb, f"Scout Search C: {len(search_c)} chars returned")

    _log(progress_cb, "Scout: All searches complete. Sending to Mistral for analysis...")

    # ── Build prompt with injected results ────────────────────────────────────
    discovery_prompt = _build_discovery_prompt(
        resume_json, jd_json, target_company,
        search_a, search_b, search_c, top_skills_str,
    )

    # ── Call Mistral chat.complete with retries  ──────
    response    = None
    MAX_RETRIES = 3

    for attempt in range(MAX_RETRIES):
        try:
            response = client.chat.complete(
                model=SCOUT_MODEL,
                messages=[
                    {"role": "system", "content": SCOUT_SYSTEM_PROMPT},
                    {"role": "user",   "content": discovery_prompt},
                ],
            )
            _log(progress_cb, "Scout: Mistral response received.")
            break

        except Exception as exc:
            error_str = str(exc)
            if "429" in error_str and attempt < MAX_RETRIES - 1:
                wait = 30 * (attempt + 1)
                _log(progress_cb, f"Scout: Rate limited. Waiting {wait}s (retry {attempt + 2}/{MAX_RETRIES})...")
                time.sleep(wait)
            else:
                _log(progress_cb, f"Scout: API error: {error_str}")
                break

    # ── Extract text content  ─────────────────
    result_text = ""

    if response is not None and hasattr(response, "choices") and response.choices:
        message = response.choices[0].message
        if isinstance(message.content, list):
            for block in message.content:
                if hasattr(block, "text"):
                    result_text += block.text
                elif hasattr(block, "type") and block.type == "text":
                    result_text += block.text
        elif isinstance(message.content, str):
            result_text = message.content

    if not result_text:
        result_text = (
            "**Scout Agent could not retrieve live results.**\n\n"
            f"Searches were performed for roles at **{target_company}** and competitors, "
            "but no response was returned from the LLM. Please check your API key and try again."
        )

    return {
        "target_company":  target_company,
        "markdown_result": result_text,
        "raw_response":    result_text,
    }


# ── Utility ───────────────────────────────────────────────────────────────────
def _log(cb, msg: str):
    """Always print to terminal; never forward to the UI progress callback."""
    print(f"[scout] {msg}")
