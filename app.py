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

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

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
        push("status", {"stage": "ocr", "message": "Analysing your resume…"})

        # ── OCR + LLM parsing ────────────────────────────────────────────────────────
        from pipeline.ocr import run_ocr_pipeline

        loop = asyncio.get_event_loop()
        resume_json = await loop.run_in_executor(
            None,
            lambda: run_ocr_pipeline(job["file_path"], progress_cb=None),
        )

        push("resume_data", {
            "name":        resume_json.get("name", "N/A"),
            "contact":     resume_json.get("contact", {}),
            "resume_json": resume_json,
        })
        push("status", {"stage": "ocr_done", "message": ""})

        target_company = job["target_company"]

        # ── Build jd_json from user inputs (always, so the mock default is never used) ──
        raw_jd = job.get("job_description", "").strip()
        jd_json = {
            "job_title":   "",
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

        # ── Run Scout + Strategist concurrently ───────────────────────────────────────
        push("status", {"stage": "agents", "message": "Finding opportunities and building your roadmap…"})

        from pipeline.scout import run_scout_agent
        from pipeline.strategist import run_strategist_agent

        scout_result_holder = {}
        strategist_result_holder = {}

        def run_scout():
            result = run_scout_agent(
                resume_json,
                target_company=target_company,
                progress_cb=None,
            )
            scout_result_holder["result"] = result
            push("status", {"stage": "scout_done", "message": ""})

        def run_strategist():
            result = run_strategist_agent(
                resume_json,
                jd_json=jd_json,
                output_dir=job["output_dir"],
                progress_cb=None,
            )
            strategist_result_holder["result"] = result
            push("status", {"stage": "strategist_done", "message": ""})

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

        push("status", {"stage": "done", "message": "Your career analysis is ready!"})
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

# ── Interview endpoints ───────────────────────────────────────────────────────

INTERVIEW_SESSIONS: dict = {}  # session_id → session data

INTERVIEW_OUTPUTS_DIR = OUTPUTS_DIR / "interviews"
INTERVIEW_OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)


class InterviewStartRequest(BaseModel):
    resume_json: dict
    target_role: str = "Senior Software Engineer"
    target_company: str = "a top-tier tech company"
    job_description: str = ""
    num_questions: int = 7


class InterviewAnalyzeRequest(BaseModel):
    session_id: str
    question_number: int
    question: str
    category: str
    transcript: str


class InterviewReportRequest(BaseModel):
    session_id: str


@app.post("/interview/start")
async def interview_start(req: InterviewStartRequest):
    """
    Generate interview questions from a resume JSON.
    Returns session_id and list of questions [{category, question}].
    """
    import os
    from mistralai import Mistral
    import json as _json

    api_key = os.getenv("MISTRAL_API_KEY", "").strip().strip('"').strip("'")
    if not api_key:
        raise HTTPException(status_code=500, detail="MISTRAL_API_KEY not configured")

    question_model = os.getenv("QUESTION_MODEL", "mistral-large-latest")
    resume = req.resume_json

    def _build_context(r: dict) -> str:
        s = r.get("sections", {})
        lines = [f"CANDIDATE: {r.get('name', 'Unknown')}"]
        contact = r.get("contact", {})
        if contact.get("location"):
            lines.append(f"LOCATION: {contact['location']}")
        if s.get("summary"):
            lines.append(f"\nSUMMARY:\n{s['summary']}")
        if s.get("skills"):
            lines.append(f"\nSKILLS: {', '.join(s['skills'])}")
        if s.get("experience"):
            lines.append("\nWORK EXPERIENCE:")
            for role in s["experience"]:
                lines.append(
                    f"  - {role.get('title','')} at {role.get('organisation','')} "
                    f"({role.get('start_date','')} - {role.get('end_date','')})"
                )
                for b in role.get("bullets", []):
                    lines.append(f"      {b}")
        if s.get("projects"):
            lines.append("\nPROJECTS:")
            for p in s["projects"]:
                tech = ", ".join(p.get("technologies", []))
                lines.append(f"  - {p.get('title','')} [{tech}]")
                if p.get("description"):
                    lines.append(f"    {p['description']}")
        if s.get("education"):
            lines.append("\nEDUCATION:")
            for e in s["education"]:
                lines.append(
                    f"  - {e.get('title','')} — {e.get('organisation','')} "
                    f"({e.get('end_date','')})"
                )
        return "\n".join(lines)

    resume_context = _build_context(resume)

    client = Mistral(api_key=api_key)
    system_prompt = (
        "You are a senior technical interviewer at a top-tier technology company. "
        "You craft questions that reveal genuine depth of knowledge and real-world experience. "
        "Every question is grounded in the candidate's specific background."
    )
    user_prompt = f"""Interview candidate for {req.target_role} at {req.target_company}.

=== CANDIDATE RESUME ===
{resume_context}
========================
{f'''
=== JOB DESCRIPTION ===
{req.job_description.strip()}
=======================
''' if req.job_description.strip() else ''}
Generate exactly {req.num_questions} interview questions personalised to this candidate.
Categories: Technical, Behavioral, Project deep dive, Problem solving.
Rules:
  - Every question must reference something specific from the resume.
  - Questions must be tailored to the target role and company.
  - If a job description is provided, align questions with its requirements.
  - Questions must be clear and concise.
  - Vary difficulty.

Return ONLY a valid JSON array (no markdown fences):
[
  {{"category": "Technical", "question": "..."}},
  ...
]"""

    loop = asyncio.get_event_loop()

    def _generate():
        response = client.chat.complete(
            model=question_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=2048,
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return _json.loads(raw)

    try:
        questions = await loop.run_in_executor(None, _generate)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Question generation failed: {exc}")

    session_id = str(uuid.uuid4())
    INTERVIEW_SESSIONS[session_id] = {
        "session_id":       session_id,
        "candidate_name":   resume.get("name", "Candidate"),
        "target_role":      req.target_role,
        "target_company":   req.target_company,
        "job_description":  req.job_description,
        "resume_context":   resume_context,
        "questions":        questions,
        "responses":        [],
        "final_report":     None,
    }

    return {"session_id": session_id, "questions": questions}


@app.post("/interview/transcribe")
async def interview_transcribe(
    session_id: str = Form(...),
    question_number: int = Form(...),
    audio: UploadFile = File(...),
):
    """
    Accept a browser-recorded audio blob, run Voxtral STT, return transcript.
    """
    import os
    import tempfile
    from pathlib import Path as _Path
    from mistralai import Mistral

    api_key = os.getenv("MISTRAL_API_KEY", "").strip().strip('"').strip("'")
    if not api_key:
        raise HTTPException(status_code=500, detail="MISTRAL_API_KEY not configured")

    if session_id not in INTERVIEW_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")

    stt_model = os.getenv("STT_MODEL", "voxtral-mini-latest")

    suffix = _Path(audio.filename or "audio.webm").suffix or ".webm"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        content = await audio.read()
        tmp.write(content)
        tmp.close()

        client = Mistral(api_key=api_key)
        loop = asyncio.get_event_loop()

        def _transcribe():
            with open(tmp.name, "rb") as f:
                response = client.audio.transcriptions.complete(
                    file={"content": f, "file_name": _Path(tmp.name).name},
                    model=stt_model,
                    language="en",
                )
            return response.text.strip()

        transcript = await loop.run_in_executor(None, _transcribe)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}")
    finally:
        try:
            import os as _os
            _os.unlink(tmp.name)
        except Exception:
            pass

    return {"transcript": transcript}


@app.post("/interview/analyze")
async def interview_analyze(req: InterviewAnalyzeRequest):
    """
    Evaluate one answer. Returns scores and feedback.
    Also stores the response in the session.
    """
    import os
    import json as _json
    from mistralai import Mistral

    api_key = os.getenv("MISTRAL_API_KEY", "").strip().strip('"').strip("'")
    if not api_key:
        raise HTTPException(status_code=500, detail="MISTRAL_API_KEY not configured")

    if req.session_id not in INTERVIEW_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")

    evaluation_model = os.getenv("EVALUATION_MODEL", "mistral-large-latest")
    session = INTERVIEW_SESSIONS[req.session_id]
    resume_context = session.get("resume_context", "")

    client = Mistral(api_key=api_key)
    user_prompt = f"""Evaluate this interview answer.

QUESTION ({req.category}): {req.question}

CANDIDATE ANSWER:
\"\"\"{req.transcript}\"\"\"

CANDIDATE BACKGROUND:
{resume_context[:1500]}

Score each dimension 0-100: technical_accuracy, communication_clarity,
confidence, relevance, overall_score.
Also: strengths (list), improvements (list), brief_feedback (2-3 sentences).

Return ONLY valid JSON (no markdown fences):
{{
  "technical_accuracy": 0, "communication_clarity": 0,
  "confidence": 0, "relevance": 0, "overall_score": 0,
  "strengths": [], "improvements": [], "brief_feedback": ""
}}"""

    loop = asyncio.get_event_loop()

    def _evaluate():
        response = client.chat.complete(
            model=evaluation_model,
            messages=[
                {"role": "system", "content":
                 "You are an expert interview coach. Evaluate answers rigorously and honestly."},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=1024,
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return _json.loads(raw)

    try:
        evaluation = await loop.run_in_executor(None, _evaluate)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {exc}")

    session["responses"].append({
        "question_number": req.question_number,
        "category":        req.category,
        "question":        req.question,
        "transcript":      req.transcript,
        "evaluation":      evaluation,
    })

    return evaluation


@app.post("/interview/report")
async def interview_report(req: InterviewReportRequest):
    """
    Generate the final interview report for a completed session.
    """
    import os
    import json as _json
    from mistralai import Mistral

    api_key = os.getenv("MISTRAL_API_KEY", "").strip().strip('"').strip("'")
    if not api_key:
        raise HTTPException(status_code=500, detail="MISTRAL_API_KEY not configured")

    if req.session_id not in INTERVIEW_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")

    session = INTERVIEW_SESSIONS[req.session_id]
    responses = session.get("responses", [])
    if not responses:
        raise HTTPException(status_code=400, detail="No responses recorded in session")

    evaluation_model = os.getenv("EVALUATION_MODEL", "mistral-large-latest")

    scores, qa_summary = [], []
    for r in responses:
        ev = r.get("evaluation", {})
        sc = ev.get("overall_score", 0)
        scores.append(sc)
        qa_summary.append(
            f"Q{r['question_number']} [{r['category']}] (score: {sc}/100)\n"
            f"  Question : {r['question']}\n"
            f"  Answer   : {r['transcript'][:400]}\n"
            f"  Strengths: {'; '.join(ev.get('strengths', []))}\n"
            f"  Improve  : {'; '.join(ev.get('improvements', []))}"
        )

    avg = round(sum(scores) / len(scores)) if scores else 0

    client = Mistral(api_key=api_key)
    loop = asyncio.get_event_loop()

    def _report():
        response = client.chat.complete(
            model=evaluation_model,
            messages=[
                {"role": "system", "content":
                 "You are a senior interview assessor. Produce an honest evidence-based hiring report. "
                 "CRITICAL INSTRUCTION: Write every text field — executive_summary, strengths, weaknesses, "
                 "areas_to_improve, preparation_topics, and question_breakdown summaries — in second person, "
                 "addressing the interviewee directly as 'you' and 'your'. "
                 "Do NOT use the candidate's name anywhere. "
                 "Do NOT use 'the candidate' or 'this candidate'. "
                 "Do NOT use third-person pronouns (he, she, his, her, him). "
                 "Every sentence must speak directly to the person being evaluated."},
                {"role": "user", "content": f"""Final report for:
Role      : {session['target_role']}
Company   : {session['target_company']}
Avg Score : {avg}/100

=== Q&A ===
{chr(10).join(qa_summary)}
===========

Return ONLY valid JSON (no markdown fences). All string values must use second-person language ("you", "your"):
{{
  "overall_score": {avg}, "grade": "", "hire_recommendation": "",
  "strengths": [], "weaknesses": [], "areas_to_improve": [],
  "preparation_topics": [],
  "question_breakdown": [{{"question_number":1,"category":"","score":0,"summary":""}}],
  "executive_summary": ""
}}"""},
            ],
            temperature=0.3,
            max_tokens=2048,
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return _json.loads(raw)

    try:
        report = await loop.run_in_executor(None, _report)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {exc}")

    session["final_report"] = report

    import datetime as _dt
    ts        = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = session["candidate_name"].replace(" ", "_").lower()
    out_path  = INTERVIEW_OUTPUTS_DIR / f"interview_{safe_name}_{ts}.json"
    try:
        import json as _json2
        out_path.write_text(
            _json2.dumps(session, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )
    except Exception:
        pass

    return report


@app.get("/interview/session/{session_id}")
async def interview_session_get(session_id: str):
    """Return stored session data (questions + responses + report if ready)."""
    if session_id not in INTERVIEW_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    s = INTERVIEW_SESSIONS[session_id]
    return {
        "session_id":     s["session_id"],
        "candidate_name": s["candidate_name"],
        "target_role":    s["target_role"],
        "target_company": s["target_company"],
        "questions":      s["questions"],
        "responses":      s["responses"],
        "final_report":   s.get("final_report"),
    }


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