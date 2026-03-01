"""
utils/similarity.py
===================
Text similarity helpers used for fuzzy skill matching.
"""

import re


def normalize(text: str) -> str:
    """Lowercase and strip whitespace."""
    return text.strip().lower()


def fuzzy_match(a: str, b: str) -> bool:
    """
    Return True if skill strings a and b are considered a match.
    Matching logic:
      1. Exact equality after normalisation
      2. One is a substring of the other
      3. Significant word overlap (words >= 3 chars)
    """
    na, nb = normalize(a), normalize(b)
    if na == nb:
        return True
    if na in nb or nb in na:
        return True
    a_words = {w for w in na.split() if len(w) >= 3}
    b_words = {w for w in nb.split() if len(w) >= 3}
    if a_words and b_words and a_words & b_words:
        return True
    return False


def extract_skill_keywords(text: str, known_skills: set) -> set:
    """
    Scan text for occurrences of known skill keywords.
    Short skills (<= 2 chars) require word-boundary matching.
    """
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


__all__ = ["normalize", "fuzzy_match", "extract_skill_keywords"]
