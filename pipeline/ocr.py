"""
OCR Pipeline Module
===================
Extracted directly from agents/test/ocr.ipynb

Steps:
1. detect_file_type()         — validate extension
2. extract_text_with_mistral_ocr() — upload → signed URL → OCR
3. combine_pages()            — join page markdown strings
4. parse_resume_with_llm()    — send text to Mistral LLM → structured JSON
"""

import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from mistralai import Mistral

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv()

OCR_MODEL = "mistral-ocr-2512"
LLM_MODEL = "mistral-small-latest"

_client = None  # lazy-initialised


def _get_client() -> "Mistral":
    """Return (or create) the shared Mistral client. Raises clearly if key missing."""
    global _client
    if _client is None:
        api_key = (os.getenv("MISTRAL_API_KEY") or "").strip().strip('"').strip("'")
        if not api_key:
            raise RuntimeError(
                "MISTRAL_API_KEY not found. "
                "Create a .env file containing: MISTRAL_API_KEY=your_key_here"
            )
        _client = Mistral(api_key=api_key)
    return _client


# ── Step 1 — File type detection ──────────────────────────────────────────────
def detect_file_type(file_path) -> str:
    """
    Detect file type from extension.

    Returns one of: 'pdf', 'png', 'jpg', 'jpeg'
    Raises FileNotFoundError or ValueError for unsupported types.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = path.suffix.lower().lstrip(".")
    supported = {"pdf", "png", "jpg", "jpeg"}
    if ext not in supported:
        raise ValueError(
            f"Unsupported file type '.{ext}'. "
            f"Supported types: {', '.join(sorted(supported))}"
        )
    return ext


# ── Step 2 — OCR extraction ───────────────────────────────────────────────────
def extract_text_with_mistral_ocr(file_path, progress_cb=None):
    """
    Extract text from a PDF/PNG/JPG/JPEG using Mistral OCR.

    progress_cb: optional callable(message: str) for streaming progress updates.
    Returns the raw OCR response object (has .pages[i].markdown).
    """
    path = Path(file_path)

    detect_file_type(path)  # validate extension; raises on bad type
    client = _get_client()

    _log(progress_cb, "Uploading your resume…", user=True)
    try:
        with open(path, "rb") as f:
            upload_response = client.files.upload(
                file={"file_name": path.name, "content": f},
                purpose="ocr",
            )
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"File upload failed: {exc}") from exc

    print(f"[ocr] File uploaded. ID: {upload_response.id}")

    try:
        signed_url_response = client.files.get_signed_url(file_id=upload_response.id)
    except Exception as exc:
        raise RuntimeError(f"Failed to get signed URL: {exc}") from exc

    _log(progress_cb, "Reading your resume with OCR…", user=True)
    try:
        file_type = path.suffix.lower().lstrip(".")
        if file_type == "pdf":
            ocr_response = client.ocr.process(
                model=OCR_MODEL,
                document={"type": "document_url", "document_url": signed_url_response.url},
            )
        else:
            ocr_response = client.ocr.process(
                model=OCR_MODEL,
                document={"type": "image_url", "image_url": signed_url_response.url},
            )
    except Exception as exc:
        raise RuntimeError(f"OCR API call failed: {exc}") from exc

    print(f"[ocr] OCR complete. Pages: {len(ocr_response.pages)}")
    return ocr_response


# ── Step 3 — Combine pages ────────────────────────────────────────────────────
def combine_pages(ocr_response) -> str:
    """Concatenate markdown text from all OCR pages into one string."""
    full_text = ""
    for page in ocr_response.pages:
        full_text += page.markdown + "\n"
    return full_text.strip()


# ── Step 4 — LLM resume parsing ───────────────────────────────────────────────
def _build_prompt(ocr_text: str) -> str:
    return (
        "You are an expert resume parser.\n\n"
        "Read the resume text below and convert it into a clean, structured "
        "JSON object.\n\n"
        "RULES YOU MUST FOLLOW:\n"
        "1. Detect sections DYNAMICALLY from the content — do NOT assume a "
        "fixed structure.\n"
        "2. Include every section you find, including uncommon ones "
        "(e.g. Strengths, Certifications, Languages, Awards, Publications, etc.).\n"
        "3. Preserve all information exactly as written — do NOT summarise, "
        "rephrase, or omit anything.\n"
        "4. Use null for missing scalar fields and [] for missing arrays — "
        "never invent data.\n"
        "5. Return ONLY a valid JSON object — no markdown fences, no "
        "explanation, no extra text whatsoever.\n\n"
        "OUTPUT STRUCTURE GUIDELINES:\n"
        "- Top-level keys: name, contact, sections\n"
        "- contact: { email, phone, location, linkedin, website, ... } "
        "(include whatever is present)\n"
        "- sections: object whose keys are the detected section names in "
        "snake_case (e.g. experience, education, skills, projects, "
        "certifications, languages, strengths, ...)\n"
        "- Experience / education entries: { title, organisation, location, "
        "start_date, end_date, description, bullets[] }\n"
        "- Project entries: { title, role, start_date, end_date, description, "
        "technologies[] }\n"
        "- Simple list sections (skills, languages, etc.): array of strings\n\n"
        f"RESUME TEXT:\n{ocr_text}\n\n"
        "Return only the JSON object:"
    )


def _call_mistral(prompt: str) -> str:
    try:
        response = _get_client().chat.complete(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Mistral API call failed: {exc}") from exc


def _extract_json(raw: str) -> dict:
    cleaned = re.sub(r"^```[a-zA-Z]*\s*", "", raw, flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"LLM response is not valid JSON.\nFirst 500 chars:\n{raw[:500]}"
        ) from exc


def parse_resume_with_llm(ocr_text: str, progress_cb=None) -> dict:
    """
    Full LLM pipeline: prompt → Mistral → parse JSON → return dict.

    progress_cb: optional callable(message: str)
    """
    if not ocr_text or not ocr_text.strip():
        raise ValueError("OCR text is empty. Run OCR extraction first.")

    _log(progress_cb, "Extracting structured data from your resume…", user=True)
    prompt = _build_prompt(ocr_text)
    raw = _call_mistral(prompt)
    print(f"[ocr] LLM response received ({len(raw)} chars).")
    structured = _extract_json(raw)
    print(f"[ocr] Resume structured. Keys: {list(structured.keys())}")
    return structured


# ── Full pipeline entry point ─────────────────────────────────────────────────
def run_ocr_pipeline(file_path: str, progress_cb=None) -> dict:
    """
    Full OCR + LLM pipeline.

    Returns structured resume dict with keys: name, contact, sections
    Also attaches 'ocr_text' (raw combined text) as a top-level key.
    """
    ocr_response = extract_text_with_mistral_ocr(file_path, progress_cb)
    ocr_text = combine_pages(ocr_response)
    print(f"[ocr] OCR text extracted ({len(ocr_text)} chars).")

    structured = parse_resume_with_llm(ocr_text, progress_cb)
    structured["_ocr_text"] = ocr_text  # attach for downstream use
    return structured


# ── Utility ───────────────────────────────────────────────────────────────────
def _log(cb, msg: str, user: bool = False):
    """
    user=True  → send to both the UI progress_cb and the terminal.
    user=False → send to terminal only (internal/debug info).
    """
    print(msg)
    if user and cb:
        cb(msg)
