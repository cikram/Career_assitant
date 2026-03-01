"""
services/scoring.py
===================
Skills scoring service — wraps the Strategist pipeline scoring functions.
"""

from pipeline.strategist import (  # noqa: F401
    calculate_match_score,
    extract_candidate_skills,
    extract_jd_requirements,
)

__all__ = ["extract_candidate_skills", "extract_jd_requirements", "calculate_match_score"]
