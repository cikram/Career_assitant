"""
Career Assistant — FastAPI Application
=======================================

Routes:
  GET  /               → serves the SPA frontend (static/index.html)
  POST /upload         → upload resume file, returns job_id
  GET  /stream/{job_id}→ SSE stream of pipeline progress + results
  GET  /download/pdf/{job_id} → download the PDF report
  GET  /health         → health check

Pipeline flow per job:
  1. OCR extraction  (pipeline/ocr.py)
  2. LLM parsing     (pipeline/ocr.py)
  3. Scout Agent     (pipeline/scout.py)   ─┐ run concurrently
  4. Strategist Agent(pipeline/strategist.py) ─┘
  5. Stream results back to client
"""

import asyncio
import json
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(title="Career Assistant", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR    = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"
OUTPUTS_DIR = BASE_DIR / "outputs"
STATIC_DIR  = BASE_DIR / "static"
DIST_DIR    = BASE_DIR / "frontend" / "dist"

UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUTS_DIR.mkdir(exist_ok=True)

# In-memory job store  {job_id: {"status": ..., "events": [...], "result": ...}}
_JOBS: dict = {}

# ── Static files ──────────────────────────────────────────────────────────────
# Mount assets before defining routes
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")
else:
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": time.time()}


# ── Upload endpoint ───────────────────────────────────────────────────────────
@app.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    target_company: str = Form(default="Google"),
    job_description: str = Form(default=""),
):
    """
    Accepts a resume file (PDF/PNG/JPG/JPEG).
    Saves it, creates a job_id, starts background processing, returns job_id.
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in {".pdf", ".png", ".jpg", ".jpeg"}:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    job_id = str(uuid.uuid4())
    job_dir = UPLOADS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    file_path = job_dir / f"resume{ext}"
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    output_dir = OUTPUTS_DIR / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    _JOBS[job_id] = {
        "status":           "queued",
        "events":           [],
        "result":           None,
        "file_path":        str(file_path),
        "output_dir":       str(output_dir),
        "target_company":   target_company,
        "job_description":  job_description,
    }

    # Start background pipeline
    asyncio.create_task(_run_pipeline(job_id))

    return {"job_id": job_id, "status": "queued"}


# ── SSE stream endpoint ───────────────────────────────────────────────────────
@app.get("/stream/{job_id}")
async def stream_job(job_id: str):
    """Server-Sent Events stream for pipeline progress."""
    if job_id not in _JOBS:
        raise HTTPException(status_code=404, detail="Job not found")

    return StreamingResponse(
        _event_generator(job_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _event_generator(job_id: str) -> AsyncGenerator[str, None]:
    """Yield SSE events until the job completes or fails."""
    sent_idx = 0
    max_wait = 600  # 10 minutes timeout
    start = time.time()

    while time.time() - start < max_wait:
        job = _JOBS.get(job_id)
        if not job:
            yield _sse("error", {"message": "Job not found"})
            return

        events = job["events"]
        while sent_idx < len(events):
            yield _sse(events[sent_idx]["type"], events[sent_idx]["data"])
            sent_idx += 1

        if job["status"] in ("done", "error"):
            return

        await asyncio.sleep(0.3)

    yield _sse("error", {"message": "Job timed out"})


def _sse(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


# ── PDF download ──────────────────────────────────────────────────────────────
@app.get("/download/pdf/{job_id}")
async def download_pdf(job_id: str):
    pdf_path = OUTPUTS_DIR / job_id / "career_analysis_report.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF not ready yet")
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename="career_analysis_report.pdf",
    )


# ── Background pipeline ───────────────────────────────────────────────────────
async def _run_pipeline(job_id: str):
    """
    Runs the full pipeline in a thread pool (CPU/IO-bound work).
    Pushes SSE events as it progresses.
    """
    job = _JOBS[job_id]

    def push(event_type: str, data: dict):
        job["events"].append({"type": event_type, "data": data})

    def progress_cb(msg: str):
        push("progress", {"message": msg})

    try:
        push("status", {"stage": "ocr", "message": "Starting OCR extraction..."})

        # ── OCR + LLM parsing ────────────────────────────────────────────────
        from pipeline.ocr import run_ocr_pipeline

        loop = asyncio.get_event_loop()
        resume_json = await loop.run_in_executor(
            None,
            lambda: run_ocr_pipeline(job["file_path"], progress_cb=progress_cb),
        )

        push("status", {"stage": "ocr_done", "message": "Resume parsed successfully."})
        push("resume_data", {
            "name":    resume_json.get("name", "N/A"),
            "contact": resume_json.get("contact", {}),
        })

        target_company = job["target_company"]

        # ── Build jd_json from raw job description text (if provided) ────────
        raw_jd = job.get("job_description", "").strip()
        jd_json = None
        if raw_jd:
            jd_json = {
                "job_title":   target_company + " Role",
                "company":     target_company,
                "location":    "",
                "description": raw_jd,
                "requirements": {
                    "required_skills":  [],
                    "preferred_skills": [],
                    "nice_to_have":     [],
                },
                "experience_required": "",
                "education":           "",
            }

        # ── Run Scout + Strategist concurrently ──────────────────────────────
        push("status", {"stage": "agents", "message": "Running Scout & Strategist agents concurrently..."})

        from pipeline.scout import run_scout_agent
        from pipeline.strategist import run_strategist_agent

        scout_result_holder = {}
        strategist_result_holder = {}

        def run_scout():
            push("status", {"stage": "scout", "message": "Scout Agent: searching for job opportunities..."})
            result = run_scout_agent(
                resume_json,
                target_company=target_company,
                progress_cb=progress_cb,
            )
            scout_result_holder["result"] = result
            push("status", {"stage": "scout_done", "message": "Scout Agent completed."})

        def run_strategist():
            push("status", {"stage": "strategist", "message": "Strategist Agent: analyzing skills gap..."})
            result = run_strategist_agent(
                resume_json,
                jd_json=jd_json,
                output_dir=job["output_dir"],
                progress_cb=progress_cb,
            )
            strategist_result_holder["result"] = result
            push("status", {"stage": "strategist_done", "message": "Strategist Agent completed."})

        # Run both in thread pool concurrently
        await asyncio.gather(
            loop.run_in_executor(None, run_scout),
            loop.run_in_executor(None, run_strategist),
        )

        scout_result      = scout_result_holder.get("result", {})
        strategist_result = strategist_result_holder.get("result", {})

        # ── Push final results ────────────────────────────────────────────────
        push("scout_result", {
            "target_company":  scout_result.get("target_company", target_company),
            "markdown_result": scout_result.get("markdown_result", ""),
        })

        push("strategist_result", {
            "candidate_name":   strategist_result.get("candidate_name", ""),
            "target_role":      strategist_result.get("target_role", ""),
            "company":          strategist_result.get("company", ""),
            "overall_score":    strategist_result.get("overall_score", 0),
            "breakdown":        strategist_result.get("breakdown", {}),
            "matched_skills":   strategist_result.get("matched_skills", []),
            "missing_skills":   strategist_result.get("missing_skills", []),
            "roadmap_markdown": strategist_result.get("roadmap_markdown", ""),
            "chart_data":       strategist_result.get("chart_data", {}),
            "pdf_ready":        True,
        })

        push("status", {"stage": "done", "message": "All agents completed successfully."})
        job["status"] = "done"
        job["result"] = {
            "scout":      scout_result,
            "strategist": strategist_result,
        }

    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        push("error", {"message": str(exc), "detail": tb})
        job["status"] = "error"

# ── SPA Catch-all (must be last so API routes match first) ───────────────────
@app.get("/", response_class=HTMLResponse)
async def serve_frontend_root():
    if DIST_DIR.exists():
        index = DIST_DIR / "index.html"
    else:
        index = STATIC_DIR / "index.html"
    return HTMLResponse(content=index.read_text(encoding="utf-8"))


@app.get("/{full_path:path}", response_class=HTMLResponse)
async def serve_spa(full_path: str):
    """Catch-all for SPA client-side routing. Only reached if no API route matched."""
    if DIST_DIR.exists():
        index = DIST_DIR / "index.html"
    else:
        index = STATIC_DIR / "index.html"
    return HTMLResponse(content=index.read_text(encoding="utf-8"))