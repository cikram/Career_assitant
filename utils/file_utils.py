"""
utils/file_utils.py
===================
File utility helpers used across the pipeline.
"""

import os
import shutil
from pathlib import Path


def ensure_dir(path: str) -> Path:
    """Create directory (and parents) if it does not exist. Returns Path object."""
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def safe_delete(path: str) -> None:
    """Delete a file or directory tree, silently ignoring errors."""
    try:
        p = Path(path)
        if p.is_dir():
            shutil.rmtree(p, ignore_errors=True)
        elif p.exists():
            p.unlink(missing_ok=True)
    except Exception:
        pass


def get_extension(filename: str) -> str:
    """Return lowercase extension without leading dot (e.g. 'pdf', 'png')."""
    return Path(filename).suffix.lower().lstrip(".")


def read_bytes(path: str) -> bytes:
    """Read and return raw bytes from a file."""
    with open(path, "rb") as f:
        return f.read()


__all__ = ["ensure_dir", "safe_delete", "get_extension", "read_bytes"]
