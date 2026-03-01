"""
utils/__init__.py
=================
Utility package public API.
"""

from utils.file_utils import ensure_dir, safe_delete, get_extension, read_bytes
from utils.similarity import normalize, fuzzy_match, extract_skill_keywords

__all__ = [
    "ensure_dir",
    "safe_delete",
    "get_extension",
    "read_bytes",
    "normalize",
    "fuzzy_match",
    "extract_skill_keywords",
]
