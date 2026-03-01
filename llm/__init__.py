"""
llm/__init__.py
===============
LLM client package.
"""

from llm.mistral_client import client as mistral_client

__all__ = ["mistral_client"]
