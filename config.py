"""
Career Assistant — Centralized Configuration
============================================
All environment-driven config loaded once here.
Individual pipeline modules import from this file.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ── API keys ──────────────────────────────────────────────────────────────────
MISTRAL_API_KEY: str = (os.getenv("MISTRAL_API_KEY") or "").strip().strip('"').strip("'")
SERPAPI_KEY: str     = (os.getenv("SERPAPI_KEY") or "").strip().strip('"').strip("'")

if not MISTRAL_API_KEY:
    raise ValueError(
        "MISTRAL_API_KEY not found. "
        "Create a .env file with: MISTRAL_API_KEY=your_key_here"
    )

# ── Model IDs ───
OCR_MODEL:        str = "mistral-ocr-2512"
LLM_MODEL:        str = "mistral-small-latest"
SCOUT_MODEL:      str = "mistral-small-latest"
STRATEGIST_MODEL: str = "mistral-small-latest"

# ── Directory paths ───
BASE_DIR:     Path = Path(__file__).parent
UPLOADS_DIR:  Path = BASE_DIR / "uploads"
OUTPUTS_DIR:  Path = BASE_DIR / "outputs"
STATIC_DIR:   Path = BASE_DIR / "static"
PROMPTS_DIR:  Path = BASE_DIR / "prompts"

UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUTS_DIR.mkdir(exist_ok=True)
