# Skillora — AI Career Assistant

> An end-to-end AI platform that parses your resume, scores it against any job description, discovers live job openings, generates a personalised 30-day roadmap, and simulates a voice-based interview — all in under a minute.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Features](#3-features)
4. [Tech Stack](#4-tech-stack)
5. [Project Structure](#5-project-structure)
6. [Installation](#6-installation)
7. [Usage](#7-usage)
8. [API Reference](#8-api-reference)
9. [AI & Processing Pipeline](#9-ai--processing-pipeline)
10. [Environment Variables](#10-environment-variables)
11. [Future Improvements](#11-future-improvements)

---

## 1. Project Overview

### Purpose

Skillora helps job seekers understand exactly where they stand against a target role. Rather than spending hours guessing which skills to improve, a user uploads their resume, pastes a job description, and within seconds receives:

- A structured breakdown of every skill they have and every skill they are missing
- A percentage match score against the target role
- A curated list of live job openings at target and competitor companies
- A 30-day, day-by-day preparation roadmap
- A downloadable multi-page PDF career report with charts
- A voice-powered AI interview simulator with real-time scoring and feedback

### Problem it solves

Candidates typically apply to jobs without knowing their actual fit. They lack objective data on which skills matter most, how competitive they are, and what to practise before the interview. Skillora closes that gap with AI-driven analysis across the entire hiring funnel — from resume audit to interview readiness.

### How it works (high level)

```
Resume (PDF / image)
    + Target company name
    + Job description text
            │
            ▼
    FastAPI backend
            │
    ┌───────┴────────┐
    │ OCR + Parsing  │  ← Mistral OCR + LLM
    └───────┬────────┘
            │  (concurrent)
    ┌───────┴─────────┐    ┌───────────────────┐
    │  Scout Agent    │    │ Strategist Agent   │
    │ (job discovery) │    │ (scoring + report) │
    └───────┬─────────┘    └────────┬──────────┘
            │                       │
            └──────────┬────────────┘
                       │
              React frontend
          (SSE real-time updates)
                       │
              Interview Simulator
          (questions → voice → scoring)
```

---

## 2. Architecture Overview

### Components

| Component | Technology | Responsibility |
|---|---|---|
| **Frontend SPA** | React 19 + Vite | User interface, file upload, SSE consumption, charts, interview UI |
| **Backend API** | FastAPI + Uvicorn | HTTP/SSE endpoints, job state management, file I/O |
| **OCR Module** | `pipeline/ocr.py` | Extracts text from PDF/image resumes via Mistral OCR, then parses into structured JSON |
| **Scout Agent** | `pipeline/scout.py` | Performs live Google searches via SerpAPI, then summarises matching jobs with an LLM |
| **Strategist Agent** | `pipeline/strategist.py` | Skills scoring, gap analysis, roadmap generation, chart creation, PDF report assembly |
| **Interview Module** | `app.py` + `interview_simulation.py` | Generates personalised questions, transcribes voice answers, evaluates responses, produces final report |
| **LLM Client** | `llm/mistral_client.py` | Shared singleton Mistral API client used across all modules |

### Communication

- **Frontend → Backend:** HTTP (Axios) for uploads and one-shot requests; **Server-Sent Events (SSE)** for real-time pipeline progress streaming.
- **Backend → AI:** Mistral AI REST API (OCR, chat completions, STT).
- **Backend → Web:** SerpAPI REST API (Google search results).
- **Backend → Frontend (static):** FastAPI serves the built React `dist/` directory directly.

### Application workflow

```
1. User opens the landing page (ExplorePage)
2. User clicks "Launch App" → enters the main dashboard
3. User uploads resume (PDF/PNG/JPG), types target company and job description → POST /upload
4. Backend returns job_id; frontend opens SSE stream GET /stream/{job_id}
5. Pipeline runs in a background thread:
   a. OCR + LLM parsing          → SSE event: resume_data
   b. Scout agent (concurrent)   → SSE event: scout_result
   c. Strategist agent (concurrent)
      - scoring + roadmap        → SSE event: strategist_result
      - chart generation
      - PDF assembly             → SSE flag: pdf_ready
   d. Done                       → SSE event: status "done"
6. Frontend renders all panels live as events arrive
7. User downloads PDF report     → GET /download/pdf/{job_id}
8. User navigates to Interview Simulator
9. Backend generates N personalised questions → POST /interview/start
10. User speaks each answer; audio sent to   → POST /interview/transcribe (STT)
11. Transcript evaluated by LLM             → POST /interview/analyze
12. Final interview report generated        → POST /interview/report
```

---

## 3. Features

### Resume Intelligence
Upload a resume as a PDF or image. Mistral's OCR model extracts the raw text; a language model then structures it into a clean JSON profile containing name, contact details, skills, work experience, projects, education, and certifications.

### Job Description Matching & Scoring
Paste any job description. The Strategist agent uses an LLM to extract required, preferred, and nice-to-have skills, then calculates a weighted match score against the candidate's profile (required = 1.0 × weight, preferred = 0.5 ×, nice-to-have = 0.25 ×).

### Skill Gap Analysis
Every matched and missing skill is categorised by priority tier. The frontend displays interactive bar charts and the PDF report includes a multi-tier breakdown with progress indicators.

### Live Job Market Discovery (Scout Agent)
Three parallel Google searches are executed via SerpAPI to find:
- Live openings at the target company for the target role
- Similar roles at competitor companies (Meta, Microsoft, OpenAI, etc.)
- Roles specifically requiring the candidate's top skills

Results are consolidated by an LLM into a ranked markdown table of 5–8 actionable job matches.

### 30-Day Personalised Roadmap
The Strategist agent generates a day-by-day preparation plan tailored to the candidate's specific gaps and the target role's requirements.

### Professional PDF Career Report
A multi-page, print-quality PDF is generated using fpdf2 and includes:
- Cover page (candidate name, target role, target company, match score)
- Table of contents
- Executive summary with two-column skill overview
- Experience and education sections
- Skills breakdown with progress bars and tier labels
- Roadmap section
- Embedded matplotlib charts (donut gauge, skill bar charts, radar chart)

### AI Interview Simulator (Web)
Accessed from the main dashboard after analysis. The system generates N personalised questions tailored to the candidate's resume and target role. The user records voice answers in the browser; Mistral's Voxtral STT model transcribes them; `mistral-large-latest` evaluates each answer across five dimensions: technical accuracy, communication clarity, confidence, relevance, and overall score. A final hire/no-hire report is produced at the end.

### Voice Interview Simulator (Standalone)
`interview_simulation_copy.py` is a standalone CLI script for local voice interviews. It uses Windows SAPI text-to-speech to read questions aloud, records microphone input with adaptive silence detection and noise-floor calibration, transcribes via Voxtral STT, evaluates with `mistral-large-latest`, and saves a full session JSON to `outputs/interviews/`.

---

## 4. Tech Stack

### Backend

| Technology | Version | Role |
|---|---|---|
| Python | 3.10+ | Core language |
| FastAPI | latest | REST API + SSE server |
| Uvicorn | latest | ASGI web server |
| Mistral AI SDK | latest | OCR, LLM chat, STT |
| SerpAPI (`google-search-results`) | latest | Live job market search |
| fpdf2 | latest | PDF report generation |
| pypdf | latest | TOC page insertion into PDF |
| Matplotlib | latest | Server-side chart images |
| NumPy | latest | Numerical processing |
| Pillow | latest | Image handling |
| python-multipart | latest | File upload parsing |
| python-dotenv | latest | `.env` loading |

### Frontend

| Technology | Version | Role |
|---|---|---|
| React | 19 | UI framework |
| Vite | 7 | Build tool + dev server |
| Axios | latest | HTTP client |
| React Dropzone | latest | File upload UI |
| React Markdown | latest | Render LLM markdown output |
| Recharts | latest | Interactive skill charts |

### AI Models (Mistral AI)

| Model | Purpose |
|---|---|
| `mistral-ocr-2512` | Extract text from PDF/image resumes |
| `mistral-small-latest` | Resume parsing, JD parsing, Scout summarisation, roadmap generation |
| `mistral-large-latest` | Interview question generation, answer evaluation, final interview report |
| `voxtral-mini-latest` | Speech-to-text transcription of interview answers |

---

## 5. Project Structure

```
Career_assitant/
│
├── app.py                      # FastAPI application — all HTTP/SSE endpoints, job state
├── config.py                   # Centralised constants: model IDs, output paths, env vars
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variable template
├── interview_simulation.py     # Standalone voice interview CLI (fixed mic index)
├── interview_simulation_copy.py# Standalone voice interview CLI (auto mic probe, recommended)
│
├── pipeline/                   # Core AI processing modules
│   ├── ocr.py                  # OCR pipeline: Mistral Files API → OCR → LLM resume parsing
│   ├── scout.py                # Scout agent: SerpAPI searches → LLM job matching
│   └── strategist.py           # Strategist agent: scoring, roadmap, charts, PDF (primary)
│
├── agents/                     # Thin re-export wrappers (pipeline/ contains real logic)
│   ├── scout.py
│   ├── strategist.py
│   └── auditor.py              # Placeholder for future ATS audit agent
│
├── llm/
│   ├── mistral_client.py       # Shared Mistral() singleton client instance
│   └── openrouter_client.py    # Placeholder (unused)
│
├── services/                   # Service-layer abstractions
│   ├── scoring.py              # Re-exports scoring functions from strategist
│   ├── report.py               # Older/alternative PDF generator (not used by main pipeline)
│   ├── parser.py               # Resume parser service wrapper
│   ├── rewriter.py             # Resume rewriter service wrapper
│   ├── roadmap.py              # Roadmap service wrapper
│   └── scout.py                # Scout service wrapper
│
├── utils/
│   ├── file_utils.py           # File handling utilities
│   └── similarity.py           # Skill similarity helpers
│
├── frontend/                   # React SPA
│   ├── package.json
│   ├── vite.config.js          # Dev proxy: /upload /stream /download /interview → :8000
│   ├── index.html
│   ├── dist/                   # Production build (served by FastAPI)
│   └── src/
│       ├── App.jsx             # Root component — state, SSE client, routing
│       ├── App.css / index.css
│       └── components/
│           ├── ExplorePage.jsx         # Landing page
│           ├── UploadCard.jsx          # Resume upload form
│           ├── ProgressPanel.jsx       # Live SSE progress display
│           ├── ResumeCard.jsx          # Parsed resume viewer
│           ├── ScoutPanel.jsx          # Job matches table
│           ├── SkillsPanel.jsx         # Matched / missing skills
│           ├── ChartsPanel.jsx         # Recharts visualisations
│           ├── RoadmapPanel.jsx        # 30-day roadmap renderer
│           ├── DownloadBar.jsx         # PDF download button
│           ├── InterviewSimulatorPage.jsx # Interview UI shell
│           ├── InterviewProgress.jsx   # Per-question progress tracker
│           ├── InterviewReport.jsx     # Final interview report display
│           ├── QuestionDisplay.jsx     # Current question card
│           ├── RecordingControls.jsx   # Mic recording start/stop
│           └── TranscriptDisplay.jsx  # Live transcript viewer
│
├── uploads/                    # Uploaded resume files (auto-created, per job_id subfolder)
├── outputs/                    # Generated PDFs and JSONs (per job_id subfolder)
│   └── interviews/             # Interview session JSON files
└── static/                     # Fallback static files
```

---

## 6. Installation

### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- A [Mistral AI](https://console.mistral.ai/) API key
- A [SerpAPI](https://serpapi.com/) API key

### 1. Clone the repository

```bash
git clone <repository-url>
cd Career_assitant
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your keys:

```env
MISTRAL_API_KEY=your_mistral_api_key_here
SERPAPI_KEY=your_serpapi_key_here
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Build the frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 5. Start the backend server

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

The application is now available at `http://localhost:8000`.

> **Development mode:** If you want hot-reload on the frontend, run Vite's dev server alongside the backend. The `vite.config.js` proxies all API calls to port 8000.
>
> ```bash
> # Terminal 1
> uvicorn app:app --reload --port 8000
>
> # Terminal 2
> cd frontend && npm run dev
> ```
> Then open `http://localhost:5173`.

---

## 7. Usage

### Career Analysis

1. Open the app in your browser and click **Launch App** from the landing page.
2. In the **Upload** panel, drop or select your resume file (PDF, PNG, or JPG).
3. Type the **target company name** (e.g. `Google`).
4. Paste the full **job description** text into the text area.
5. Click **Analyse**. A progress panel appears and updates in real time as each pipeline stage completes.
6. Once done, explore the results across the tabs:
   - **Resume** — your parsed profile
   - **Scout** — live job matches at target and competitor companies
   - **Skills** — matched vs. missing skill breakdown
   - **Charts** — visual skill gap analysis
   - **Roadmap** — your personalised 30-day plan
7. Click **Download PDF Report** to save the full career analysis document.

### AI Interview Simulator

1. After completing a career analysis, click **Interview Simulator** in the sidebar.
2. Confirm your target role, company, and number of questions.
3. Click **Start Interview**. Personalised questions appear one at a time.
4. Click **Record**, speak your answer naturally, then click **Stop**.
5. The system transcribes and evaluates your answer in real time, showing scores and feedback.
6. After all questions, a **Final Report** is generated with an overall grade, hire recommendation, strengths, weaknesses, and preparation topics.

### Standalone Voice Interview (local only)

For a fully voice-driven experience on Windows:

```bash
python interview_simulation_copy.py
```

The script probes your microphone, speaks questions aloud via Windows TTS, records your answers, transcribes and evaluates them, and saves a JSON report to `outputs/interviews/`.

---

## 8. API Reference

All endpoints are served at `http://localhost:8000`.

### `GET /health`
Health check.

**Response**
```json
{ "status": "ok", "timestamp": "2026-03-02T10:00:00" }
```

---

### `POST /upload`
Upload a resume and start the analysis pipeline.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | Yes | Resume file (PDF, PNG, JPG, JPEG) |
| `target_company` | string | Yes | Target company name |
| `job_description` | string | Yes | Full job description text |

**Response** `200 OK`
```json
{ "job_id": "uuid-string" }
```

---

### `GET /stream/{job_id}`
Open an SSE stream to receive live pipeline progress.

**Event types**

| Event | Payload fields | Description |
|---|---|---|
| `status` | `stage`, `message` | Pipeline stage transition |
| `progress` | `message` | Free-text progress update |
| `resume_data` | `name`, `contact`, `resume_json` | Parsed resume available |
| `scout_result` | `target_company`, `markdown_result` | Job matches table |
| `strategist_result` | `scores`, `matched_skills`, `missing_skills`, `roadmap`, `chart_data`, `pdf_ready` | Full analysis results |
| `error` | `message`, `detail` | Pipeline error |

---

### `GET /download/pdf/{job_id}`
Download the generated PDF career report.

**Response** — `application/pdf` file attachment.

---

### `POST /interview/start`
Generate personalised interview questions.

**Request** — `application/json`

```json
{
  "resume_json": { ... },
  "target_role": "Senior ML Engineer",
  "target_company": "Google",
  "job_description": "...",
  "num_questions": 5
}
```

**Response**
```json
{
  "session_id": "uuid-string",
  "questions": [
    { "category": "Technical", "question": "Describe how you would design a feature store." }
  ]
}
```

---

### `POST /interview/transcribe`
Transcribe a recorded audio answer.

**Request** — `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `session_id` | string | Session identifier |
| `question_number` | integer | 0-indexed question number |
| `audio` | File | Audio blob (WebM/WAV) |

**Response**
```json
{ "transcript": "I would start by defining the feature schema..." }
```

---

### `POST /interview/analyze`
Evaluate a single transcribed answer.

**Request** — `application/json`

```json
{
  "session_id": "uuid-string",
  "question_number": 0,
  "question": "...",
  "category": "Technical",
  "transcript": "I would start by..."
}
```

**Response**
```json
{
  "technical_accuracy": 8,
  "communication_clarity": 7,
  "confidence": 7,
  "relevance": 9,
  "overall_score": 7.8,
  "strengths": ["Clear problem decomposition"],
  "improvements": ["Add concrete metrics"],
  "brief_feedback": "Strong structure, expand on trade-offs."
}
```

---

### `POST /interview/report`
Generate the final interview report for a completed session.

**Request** — `application/json`
```json
{ "session_id": "uuid-string" }
```

**Response**
```json
{
  "overall_score": 7.4,
  "grade": "B+",
  "hire_recommendation": "Strong Hire",
  "strengths": [...],
  "weaknesses": [...],
  "areas_to_improve": [...],
  "preparation_topics": [...],
  "question_breakdown": [...],
  "executive_summary": "..."
}
```

---

### `GET /interview/session/{session_id}`
Retrieve stored session data.

**Response** — full session JSON object.

---

## 9. AI & Processing Pipeline

### Stage 1 — OCR & Resume Parsing (`pipeline/ocr.py`)

1. The uploaded file is sent to the **Mistral Files API** for server-side storage.
2. `mistral-ocr-2512` processes the file and returns structured markdown per page.
3. All pages are concatenated into a single raw text block.
4. `mistral-small-latest` receives the raw text and a structured prompt instructing it to extract: name, contact details (email, phone, location, LinkedIn), and nested sections for skills, work experience, projects, education, and certifications.
5. The result is a clean Python dict (the "resume JSON") that flows into all downstream stages.

### Stage 2a — Scout Agent (`pipeline/scout.py`) — runs concurrently

1. The top 3 skills from the resume and the target company/role are extracted.
2. Three Google searches are constructed and executed via **SerpAPI**:
   - `"{company} careers {role} site:linkedin.com OR careers.{company}.com"`
   - `"{role} jobs {competitors} 2026"`
   - `"{skill1} {skill2} jobs hiring 2026"`
3. All search result snippets are concatenated and passed to `mistral-small-latest` with a prompt to synthesise 5–8 job matches into a markdown table (title, company, match reason, estimated fit score, link).
4. The resulting markdown is emitted as the `scout_result` SSE event.

### Stage 2b — Strategist Agent (`pipeline/strategist.py`) — runs concurrently

**JD Parsing**
`mistral-small-latest` parses the raw job description text into a structured dict with `job_title`, `required_skills`, `preferred_skills`, `nice_to_have_skills`, `responsibilities`, and `qualifications`.

**Skill Scoring**
Each of the candidate's skills is matched against the JD skill lists (case-insensitive, with normalisation). A weighted score is computed:

```
score = (matched_required × 1.0 + matched_preferred × 0.5 + matched_nice × 0.25)
      / (total_required × 1.0 + total_preferred × 0.5 + total_nice × 0.25)
```

**Roadmap Generation**
`mistral-small-latest` receives the missing skills, the target role, and instructions to produce a structured 30-day preparation plan.

**Chart Generation (Matplotlib)**
Four charts are created server-side and saved as PNG files, then Base64-encoded for web embedding:
- **Donut gauge** — overall match percentage
- **Tier bar chart** — matched vs. missing per skill tier
- **Horizontal bar chart** — individual skill match scores
- **Radar chart** — multi-dimensional skill profile

**PDF Report Assembly (fpdf2 + pypdf)**
`CareerReportPDF` (subclass of `FPDF`) builds a 10-section document:

| # | Section |
|---|---|
| 0 | Cover page |
| 1 | Table of contents |
| 2 | Executive summary |
| 3 | Skills analysis |
| 4 | Embedded charts |
| 5 | Work experience |
| 6 | Education |
| 7 | Projects & certifications |
| 8 | Career roadmap |
| 9 | Job market findings (Scout output) |

The TOC is inserted post-hoc using `pypdf` page splicing (fpdf2 does not support mid-document page insertion).

### Stage 3 — Interview Pipeline (`app.py`)

**Question generation** — `mistral-large-latest` receives the full resume JSON, target role, target company, and job description, and produces N categorised questions tailored specifically to the candidate.

**Transcription** — Audio blobs are forwarded to Mistral's `voxtral-mini-latest` STT endpoint and the transcript is returned.

**Answer evaluation** — `mistral-large-latest` evaluates each transcript against the original question across five dimensions (1–10 scale each): technical accuracy, communication clarity, confidence, relevance, and overall score. Structured JSON feedback is returned.

**Final report** — `mistral-large-latest` receives all Q&A pairs and evaluations, and produces a holistic assessment: overall grade, hire recommendation, top strengths, top weaknesses, areas to improve, and suggested preparation topics.

---

## 10. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MISTRAL_API_KEY` | Yes | Mistral AI API key — used by all pipeline modules |
| `SERPAPI_KEY` | Yes | SerpAPI key for live Google job searches |
| `OPENROUTER_API_KEY` | No | Placeholder for future multi-provider routing (unused) |
| `MIC_DEVICE_INDEX` | No | Pin a specific microphone index for the standalone CLI |
| `RESUME_SOURCE` | No | Path to resume file for the standalone CLI |
| `TARGET_ROLE` | No | Default target role for the standalone CLI |
| `TARGET_COMPANY` | No | Default target company for the standalone CLI |
| `NUM_QUESTIONS` | No | Number of interview questions for the standalone CLI (default: 7) |
| `QUESTION_MODEL` | No | Override LLM for question generation (default: `mistral-large-latest`) |
| `EVALUATION_MODEL` | No | Override LLM for answer evaluation (default: `mistral-large-latest`) |
| `STT_MODEL` | No | Override STT model (default: `voxtral-mini-latest`) |

---

## 11. Future Improvements

- **Persistent storage** — Replace the in-memory job store (`_JOBS` dict) with a database (PostgreSQL or Redis) so job results survive server restarts and can be retrieved across sessions.
- **User accounts** — Add authentication so users can save multiple analyses and track progress over time.
- **ATS Audit Agent** — The `agents/auditor.py` placeholder suggests a planned feature to analyse how well a resume passes Applicant Tracking Systems.
- **Resume Rewriter** — `services/rewriter.py` is a stub for an AI-powered resume rewriting feature targeted to a specific job description.
- **Multi-provider LLM routing** — `llm/openrouter_client.py` is a placeholder for routing requests across different LLM providers for cost or quality optimisation.
- **Cross-platform voice interview** — The standalone voice interview script currently depends on Windows SAPI for TTS. A cross-platform TTS library would extend support to macOS and Linux.
- **Real-time interview feedback** — Surface evaluation scores to the user after each answer in a streaming fashion rather than waiting until after the full session.
- **Job application tracker** — Integrate with the Scout results to let users save, track, and update the status of job applications.
- **Similarity-based skill matching** — `utils/similarity.py` exists as a stub; replacing the current string-match scoring with semantic similarity embeddings would improve match accuracy for skill synonyms.
