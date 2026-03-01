"""
agents/scout.py
===============
Thin wrapper around pipeline/scout.py.
Exposes run_scout_agent for use by app.py or other callers.
"""

from pipeline.scout import run_scout_agent  # noqa: F401

__all__ = ["run_scout_agent"]
