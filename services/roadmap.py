"""
services/roadmap.py
===================
Roadmap generation service — wraps the Strategist pipeline roadmap function.
"""

from pipeline.strategist import generate_roadmap  # noqa: F401

__all__ = ["generate_roadmap"]
