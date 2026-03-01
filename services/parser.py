"""
services/parser.py
==================
Resume parsing service — wraps the OCR pipeline.
"""

from pipeline.ocr import run_ocr_pipeline, parse_resume_with_llm  # noqa: F401

__all__ = ["run_ocr_pipeline", "parse_resume_with_llm"]
