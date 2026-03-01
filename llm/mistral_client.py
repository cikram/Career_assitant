"""
llm/mistral_client.py
=====================
Shared Mistral AI client instance.
Import this instead of constructing a new Mistral() everywhere.
"""

import os

from dotenv import load_dotenv
from mistralai import Mistral

load_dotenv()

_api_key = (os.getenv("MISTRAL_API_KEY") or "").strip().strip('"').strip("'")
if not _api_key:
    raise ValueError("MISTRAL_API_KEY not found in environment.")

client: Mistral = Mistral(api_key=_api_key)

__all__ = ["client"]
