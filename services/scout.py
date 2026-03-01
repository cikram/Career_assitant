import json
from serpapi import GoogleSearch
from config import SERPAPI_KEY
from llm.mistral_client import get_mistral_client

def search_jobs_serpapi(query: str, num: int = 5) -> str:
    """Run a Google search via SerpAPI and return formatted results."""
    try:
        results = GoogleSearch({
            "q": query,
            "api_key": SERPAPI_KEY,
            "num": num
        }).get_dict()

        lines = []
        for r in results.get("organic_results", []):
            title = r.get('title', 'No title')
            link = r.get('link', '#')
            snippet = r.get('snippet', '')[:250]
            lines.append(f"- [{title}]({link})\n  {snippet}")

        if not lines:
            return "No results found."
        return "\n".join(lines)
    except Exception as e:
        return f"Search error: {e}"

def run_scout_agent(resume_json, jd_json):
    target_company = jd_json.get('company', 'Unknown')
    resume_json_str = json.dumps(resume_json, ensure_ascii=False, indent=2)
    jd_json_str = json.dumps(jd_json, ensure_ascii=False, indent=2)

    # Extract top skills from Job Description for searching
    jd_reqs = jd_json.get('requirements', {}) if isinstance(jd_json.get('requirements'), dict) else {}
    req_skills = jd_reqs.get('required_skills') or []
    pref_skills = jd_reqs.get('preferred_skills') or []
    jd_skills = req_skills + pref_skills
    if isinstance(jd_skills, list) and len(jd_skills) > 0:
        top_skills_str = ' '.join(jd_skills[:5])
    else:
        # Fallback to resume skills if JD skills are missing
        skills = resume_json.get('sections', {}).get('skills', [])
        if isinstance(skills, dict):
            top_skills = []
            for category in skills.values():
                if isinstance(category, list):
                    top_skills.extend(category[:2])
            top_skills_str = ' '.join(top_skills[:5])
        elif isinstance(skills, list):
            top_skills_str = ' '.join(skills[:5])
        else:
            top_skills_str = ""

    query_a = f"{target_company} careers {jd_json.get('job_title', 'data scientist')} 2026"
    query_b = f"{jd_json.get('job_title', 'senior data scientist')} jobs Meta Microsoft OpenAI 2026"
    query_c = f"{top_skills_str} jobs hiring 2026"

    search_a = search_jobs_serpapi(query_a)
    search_b = search_jobs_serpapi(query_b)
    search_c = search_jobs_serpapi(query_c)

    SCOUT_SYSTEM_PROMPT = """You are the "Market Mapper" Scout, a high-speed recruitment intelligence agent.
Your purpose is to bridge the gap between a candidate's profile and the real-time 2026 job market.

Operational Protocol:
1. Analyze the Resume JSON embedded in the user message.
2. Review the live search results provided in the user message.
3. Match each found role against the candidate profile:
   - High match: >80% skill overlap
   - Medium match: 50-80% overlap
   - Strategic Pivot: leverages candidate's niche skills despite lower overall match
4. Output a Markdown table with columns:
   | Job Title | Company | Match Level | Why it Matches | Source Link |
   Include at least 5-8 rows with real URLs from your searches.
5. VERY IMPORTANT: Your 'Source Link' column MUST use clickable markdown syntax. Example: `[Apply Here](https://url.com)`. Do NOT paste raw URLs.
6. Make sure your Markdown table is perfectly formatted, padded, and clean. Do not include extra conversational text."""

    discovery_prompt = f"""I am initiating an Opportunity Scan for the following candidate.

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

🔎 Search A — {target_company} roles:
{search_a}

🔎 Search B — Competitor roles:
{search_b}

🔎 Search C — Skill-based discovery ({top_skills_str}):
{search_c}

**Your Mission:**
1. Analyze the Resume JSON and identify the candidate's core competencies.
2. Cross-reference with the search results above (real, live URLs are already provided).
3. Return ONLY a perfectly formatted Markdown table of 5-8 best-matched opportunities with these exact columns:
   | Job Title | Company | Match Level | Why it Matches | Source Link |
   - Match Level: High (>80%), Medium (50-80%), Strategic Pivot (niche match)
   - Why it Matches: reference specific skills/experience from the Resume JSON
   - Source Link: YOU MUST use the format `[View Job](URL_FROM_SEARCH)`. Raw URLs will break the UI. Do not leave this blank.
"""

    client = get_mistral_client()
    response = client.chat.complete(
        model="mistral-small-latest",
        messages=[
            {"role": "system", "content": SCOUT_SYSTEM_PROMPT},
            {"role": "user", "content": discovery_prompt}
        ]
    )
    
    content_text = ''
    if hasattr(response, 'choices') and response.choices:
        message = response.choices[0].message
        if isinstance(message.content, list):
            for block in message.content:
                if hasattr(block, 'text'):
                    content_text += block.text
                elif hasattr(block, 'type') and block.type == 'text':
                    content_text += block.text
        elif isinstance(message.content, str):
            content_text = message.content
            
    return content_text
