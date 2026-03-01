"""
agents/strategist.py
====================
Thin wrapper around pipeline/strategist.py.
Exposes run_strategist_agent for use by app.py or other callers.
"""

from pipeline.strategist import run_strategist_agent  # noqa: F401

__all__ = ["run_strategist_agent"]
