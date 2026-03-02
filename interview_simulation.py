"""
interview_simulation.py
=======================
Standalone Python script — full voice interview simulation.
Run from the project root:

    python interview_simulation.py

TTS uses win32com SAPI directly (no pyttsx3, no threads, no queue).
This is the most reliable approach on Windows — synchronous, no device contention.

The original notebook is NOT modified by this script.
"""


import os
import sys
import json
import time
import datetime
import tempfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv

env_path = PROJECT_ROOT / ".env"
if not env_path.exists():
    sys.exit(f"[ERROR] .env file not found at {env_path}\n"
             "Create it with: MISTRAL_API_KEY=your_key_here")

load_dotenv(env_path)
API_KEY = os.getenv("MISTRAL_API_KEY", "").strip().strip('"').strip("'")
if not API_KEY:
    sys.exit("[ERROR] MISTRAL_API_KEY is empty — check your .env file.")

print(f"[INIT] Project root : {PROJECT_ROOT}")
print(f"[INIT] API key      : {API_KEY[:8]}{'*' * (len(API_KEY) - 8)}")


try:
    import numpy as np
    import sounddevice as sd
    from scipy.io import wavfile
    from scipy.signal import resample_poly
    import win32com.client
    from mistralai import Mistral
except ImportError as exc:
    sys.exit(
        f"[ERROR] Missing dependency: {exc}\n"
        "Run:  pip install python-dotenv mistralai sounddevice scipy pywin32"
    )

from math import gcd


RESUME_SOURCE   = str(PROJECT_ROOT / "agents" / "test" / "resume_llm_structured.json")
TARGET_ROLE     = "Senior Software Engineer"
TARGET_COMPANY  = "a top-tier tech company"
NUM_QUESTIONS   = 7


PREFERRED_MIC_INDEX = 15
NATIVE_SAMPLE_RATE  = 48000   
STT_SAMPLE_RATE     = 16000   
CHANNELS            = 1       

QUESTION_MODEL   = "mistral-large-latest"
EVALUATION_MODEL = "mistral-large-latest"
STT_MODEL        = "voxtral-mini-latest"



client = Mistral(api_key=API_KEY)
print(f"[INIT] Mistral client ready")



print("[TTS] Initialising SAPI voice engine...")
_sapi = win32com.client.Dispatch("SAPI.SpVoice")
_voices = _sapi.GetVoices()


_sapi.Voice  = _voices.Item(1 if _voices.Count > 1 else 0)
_sapi.Rate   = -1    
_sapi.Volume = 100   

print(f"[TTS] Voice  : {_sapi.Voice.GetDescription()}")
print(f"[TTS] Rate   : {_sapi.Rate}")
print(f"[TTS] Volume : {_sapi.Volume}")


def speak(text: str, label: str = "") -> None:
    """
    Speak text aloud using Windows SAPI via win32com.
    Blocks until the utterance is fully complete.
    Prints text to terminal so the user can read along.
    """
    if label:
        print(f"\n[{label}] {text}")
    else:
        print(f"\n{text}")
    print("[TTS] Speaking...")
    _sapi.Speak(text)   
    print("[TTS] Done.")



_SEP = "=" * 60

def _banner(title: str) -> None:
    print(f"\n{_SEP}\n  {title}\n{_SEP}")


_banner("LOADING RESUME")

def load_resume(source: str | None) -> dict:
    if source is None:
        sample = PROJECT_ROOT / "agents" / "test" / "resume_llm_structured.json"
        if sample.exists():
            print(f"[RESUME] Using bundled sample: {sample.name}")
            return json.loads(sample.read_text(encoding="utf-8"))
        raise FileNotFoundError("No RESUME_SOURCE and bundled sample not found.")
    p = Path(source)
    if not p.exists():
        raise FileNotFoundError(f"Resume file not found: {p}")
    ext = p.suffix.lower()
    if ext == ".json":
        print(f"[RESUME] Loading JSON: {p.name}")
        return json.loads(p.read_text(encoding="utf-8"))
    if ext in (".pdf", ".png", ".jpg", ".jpeg"):
        print(f"[RESUME] Running OCR pipeline on: {p.name}")
        from pipeline.ocr import run_ocr_pipeline
        return run_ocr_pipeline(str(p), progress_cb=print)
    raise ValueError(f"Unsupported resume format: {ext}")


resume   = load_resume(RESUME_SOURCE)
name     = resume.get("name", "Unknown Candidate")
sections = resume.get("sections", {})
skills   = sections.get("skills", [])

print(f"[RESUME] Candidate : {name}")
print(f"[RESUME] Skills    : {', '.join(skills[:8])}{'...' if len(skills) > 8 else ''}")
print(f"[RESUME] Experience: {len(sections.get('experience', []))} role(s)")
print(f"[RESUME] Projects  : {len(sections.get('projects', []))} project(s)")


def build_resume_context(r: dict) -> str:
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
    if s.get("certificates"):
        lines.append("\nCERTIFICATES:")
        for c in s["certificates"]:
            lines.append(f"  - {c.get('title','')} — {c.get('organisation','')}")
    return "\n".join(lines)


RESUME_CONTEXT = build_resume_context(resume)


_banner("GENERATING INTERVIEW QUESTIONS")

def generate_interview_questions(
    resume_context: str,
    target_role: str,
    target_company: str,
    num_questions: int = 7,
) -> list[dict]:
    system_prompt = (
        "You are a senior technical interviewer at a top-tier technology company. "
        "You craft questions that reveal genuine depth of knowledge and real-world experience. "
        "Every question is grounded in the candidate's specific background."
    )
    user_prompt = f"""Interview candidate for {target_role} at {target_company}.

=== CANDIDATE RESUME ===
{resume_context}
========================

Generate exactly {num_questions} interview questions personalised to this candidate.
Categories: Technical, Behavioral, Project deep dive, Problem solving.
Rules:
  - Every question must reference something specific from the resume.
  - Questions must be clear and speakable (no bullet sub-points, no markdown).
  - Vary difficulty.

Return ONLY a valid JSON array (no markdown fences):
[
  {{"category": "Technical", "question": "..."}},
  ...
]"""

    response = client.chat.complete(
        model=QUESTION_MODEL,
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
    return json.loads(raw)


print(f"[QUESTIONS] Generating {NUM_QUESTIONS} questions for '{TARGET_ROLE}'...")
QUESTIONS = generate_interview_questions(
    RESUME_CONTEXT, TARGET_ROLE, TARGET_COMPANY, NUM_QUESTIONS
)
print(f"[QUESTIONS] {len(QUESTIONS)} questions ready:\n")
for i, q in enumerate(QUESTIONS, 1):
    print(f"  Q{i} [{q['category']}]")
    print(f"     {q['question']}\n")


def list_input_devices() -> None:
    print("\n[MIC] Available input devices:")
    for i, dev in enumerate(sd.query_devices()):
        if dev["max_input_channels"] > 0:
            marker = "  <-- PREFERRED" if i == PREFERRED_MIC_INDEX else ""
            print(f"  [{i:2d}] {dev['name']}{marker}")


def _resample(audio: np.ndarray, from_sr: int, to_sr: int) -> np.ndarray:
    """Resample a float32 mono array from from_sr to to_sr."""
    if from_sr == to_sr:
        return audio
    g    = gcd(to_sr, from_sr)
    up   = to_sr   // g
    down = from_sr // g
    return resample_poly(audio.flatten(), up, down).astype(np.float32)


def record_answer(
    duration_seconds: int = 60,
    silence_threshold: float = 0.0005,   
    silence_timeout: float = 3.0,
) -> str:
    """
    Record mic audio at NATIVE_SAMPLE_RATE, resample to STT_SAMPLE_RATE for Voxtral.
    Stops on silence or max duration. Returns path to a temp 16kHz WAV file.
    """
    mic_name = sd.query_devices(PREFERRED_MIC_INDEX)["name"]
    print(f"\n[REC] Device  : [{PREFERRED_MIC_INDEX}] {mic_name}")
    print(f"[REC] Speak now — max {duration_seconds}s, "
          f"auto-stops after {silence_timeout}s silence")
    print("[REC] Press Ctrl+C to stop early.")

    chunk_size    = int(NATIVE_SAMPLE_RATE * 0.5)   
    all_chunks: list = []
    silent_chunks = 0
    silent_limit  = int(silence_timeout / 0.5)
    total_chunks  = int(duration_seconds  / 0.5)

    try:
        for _ in range(total_chunks):
            chunk = sd.rec(chunk_size, samplerate=NATIVE_SAMPLE_RATE,
                           channels=CHANNELS, dtype="float32",
                           device=PREFERRED_MIC_INDEX)
            sd.wait()
            all_chunks.append(chunk)
            rms = float(np.sqrt(np.mean(chunk ** 2)))
            bar = "#" * min(40, int(rms * 5000))
            print(f"[REC] {rms:.5f}  {bar}", end="\r")
            if rms < silence_threshold:
                silent_chunks += 1
            else:
                silent_chunks = 0
            if silent_chunks >= silent_limit and len(all_chunks) > silent_limit:
                print()
                print("[REC] Silence detected — stopping.")
                break
    except KeyboardInterrupt:
        print()
        print("[REC] Stopped by user.")
    except sd.PortAudioError as exc:
        raise RuntimeError(f"[REC] Microphone error: {exc}") from exc

    print()   
    if not all_chunks:
        raise RuntimeError("No audio was recorded.")

   
    native_audio = np.concatenate(all_chunks, axis=0)
    resampled    = _resample(native_audio, NATIVE_SAMPLE_RATE, STT_SAMPLE_RATE)
    audio_int16  = (resampled * 32767).astype(np.int16)

    tmp = tempfile.NamedTemporaryFile(
        suffix=".wav", delete=False, prefix="interview_answer_"
    )
    wavfile.write(tmp.name, STT_SAMPLE_RATE, audio_int16)
    tmp.close()

    native_dur = len(native_audio) / NATIVE_SAMPLE_RATE
    rms_final  = float(np.sqrt(np.mean(native_audio ** 2)))
    print(f"[REC] Recorded {native_dur:.1f}s  native RMS={rms_final:.5f}")
    print(f"[REC] Saved 16kHz WAV -> {Path(tmp.name).name}")
    return tmp.name


def run_mic_test(test_secs: int = 4) -> None:
    """Record a short clip, print per-chunk RMS, resample and save for Voxtral."""
    print(f"\n[MIC TEST] Recording {test_secs}s from device [{PREFERRED_MIC_INDEX}] — say something now...")
    try:
        rec = sd.rec(int(NATIVE_SAMPLE_RATE * test_secs), samplerate=NATIVE_SAMPLE_RATE,
                     channels=CHANNELS, dtype="float32", device=PREFERRED_MIC_INDEX)
        sd.wait()
        rms  = float(np.sqrt(np.mean(rec ** 2)))
        peak = float(np.max(np.abs(rec)))
        if rms > 0.0001:
            status = "OK — voice detected"
        elif rms > 0.00002:
            status = "WEAK — speak louder or move closer to mic"
        else:
            status = "SILENT — mic not picking up audio"
        print(f"[MIC TEST] Native RMS={rms:.5f}  peak={peak:.5f}  {status}")

        
        resampled = _resample(rec, NATIVE_SAMPLE_RATE, STT_SAMPLE_RATE)
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False, prefix="mic_test_")
        wavfile.write(tmp.name, STT_SAMPLE_RATE, (resampled * 32767).astype(np.int16))
        tmp.close()
        print(f"[MIC TEST] 16kHz clip saved: {tmp.name}")
    except sd.PortAudioError as exc:
        print(f"[MIC TEST] ERROR: {exc}")
        list_input_devices()


def _valid_bias_term(term: str) -> bool:
    """Voxtral context_bias terms must be single tokens: no spaces, no commas."""
    return bool(term) and " " not in term and "," not in term

_raw_hints: list[str] = (
    resume.get("sections", {}).get("skills", []) +
    [p.get("title", "") for p in resume.get("sections", {}).get("projects", [])]
)
STT_CONTEXT_HINTS: list[str] = [t for t in _raw_hints if _valid_bias_term(t)]
print(f"\n[STT] Context hints — {len(_raw_hints)} raw, "
      f"{len(STT_CONTEXT_HINTS)} valid single-word terms: {STT_CONTEXT_HINTS[:10]}")


def transcribe_audio(wav_path: str, context_hints: list[str] | None = None) -> str:
    """Transcribe a WAV file using Mistral Voxtral STT."""
    print("[STT] Transcribing with Voxtral...")
    kwargs: dict = {"model": STT_MODEL, "language": "en"}
    if context_hints:
        
        valid = [t for t in context_hints if _valid_bias_term(t)][:100]
        if valid:
            kwargs["context_bias"] = valid
    with open(wav_path, "rb") as f:
        response = client.audio.transcriptions.complete(
            file={"content": f, "file_name": Path(wav_path).name},
            **kwargs,
        )
    transcript = response.text.strip()
    print(f'[STT] Transcript: "{transcript}"')
    return transcript


def evaluate_answer_text(
    question: str,
    category: str,
    transcript: str,
    resume_context: str,
) -> dict:
    system_prompt = (
        "You are an expert interview coach. "
        "Evaluate answers rigorously and honestly. Do not inflate scores."
    )
    user_prompt = f"""Evaluate this interview answer.

QUESTION ({category}): {question}

CANDIDATE ANSWER:
\"\"\"{transcript}\"\"\"

CANDIDATE BACKGROUND:
{resume_context[:1500]}

Score each dimension 0-100: technical_accuracy, communication_clarity,
confidence, relevance, overall_score.
Also: strengths (list), improvements (list), brief_feedback (2-3 sentences, speakable).

Return ONLY valid JSON (no markdown fences):
{{
  "technical_accuracy": 0, "communication_clarity": 0,
  "confidence": 0, "relevance": 0, "overall_score": 0,
  "strengths": [], "improvements": [], "brief_feedback": ""
}}"""

    response = client.chat.complete(
        model=EVALUATION_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=1024,
    )
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


def generate_final_report(session: dict) -> dict:
    responses = session.get("responses", [])
    if not responses:
        return {"error": "No responses recorded."}

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

    response = client.chat.complete(
        model=EVALUATION_MODEL,
        messages=[
            {"role": "system", "content":
             "You are a senior interview assessor. "
             "Produce an honest evidence-based hiring report. "
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
    return json.loads(raw)


def display_report(report: dict, session: dict) -> None:
    if "error" in report:
        print(f"\n[REPORT] {report['error']}")
        return
    _banner("FINAL INTERVIEW REPORT")
    print(f"  Candidate           : {session['candidate_name']}")
    print(f"  Role                : {session['target_role']}")
    print(f"  Company             : {session['target_company']}")
    print(f"  Overall Score       : {report.get('overall_score', 0)}/100")
    print(f"  Grade               : {report.get('grade', 'N/A')}")
    print(f"  Hire Recommendation : {report.get('hire_recommendation', 'N/A')}")
    print(f"\n--- Executive Summary ---\n{report.get('executive_summary', '')}")
    print("\n--- Question Breakdown ---")
    for qb in report.get("question_breakdown", []):
        print(f"  Q{qb.get('question_number','?')} [{qb.get('category','')}]"
              f"  {qb.get('score', 0)}/100 — {qb.get('summary', '')}")
    print("\n--- Strengths ---")
    for s in report.get("strengths", []):
        print(f"  + {s}")
    print("\n--- Weaknesses ---")
    for w in report.get("weaknesses", []):
        print(f"  - {w}")
    print("\n--- Areas to Improve ---")
    for a in report.get("areas_to_improve", []):
        print(f"  * {a}")
    print("\n--- Suggested Preparation Topics ---")
    for t in report.get("preparation_topics", []):
        print(f"  > {t}")


def save_session(session: dict, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    ts        = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = session["candidate_name"].replace(" ", "_").lower()
    path      = output_dir / f"interview_{safe_name}_{ts}.json"
    serialisable = json.loads(json.dumps(session, default=str))
    for r in serialisable.get("responses", []):
        r.pop("wav_path", None)
    path.write_text(json.dumps(serialisable, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


if __name__ == "__main__":
    _banner("PRE-INTERVIEW CHECKS")

    print("[TTS TEST] You should hear audio now...")
    speak(
        f"Text to speech engine ready. "
        f"Hello {name}, this is your pre-interview audio check. "
        f"You are interviewing for {TARGET_ROLE}.",
        label="TTS TEST"
    )

    list_input_devices()
    run_mic_test(test_secs=3)

    
    interview_session: dict = {
        "candidate_name": name,
        "target_role":    TARGET_ROLE,
        "target_company": TARGET_COMPANY,
        "questions":      QUESTIONS,
        "responses":      [],
    }

    
    _banner("STARTING INTERVIEW")

    opening = (
        f"Welcome, {name}. My name is Alex and I will be conducting your interview today "
        f"for the position of {TARGET_ROLE} at {TARGET_COMPANY}. "
        "We have a few questions for you. Please answer as clearly and thoroughly as you can. "
        "The microphone will start automatically after each question. Let's begin."
    )
    print("[INTERVIEW] Speaking opening statement...")
    speak(opening, label="INTERVIEWER")
    time.sleep(1)

    for idx, q_item in enumerate(QUESTIONS, start=1):
        question = q_item["question"]
        category = q_item["category"]

        print(f"\n{_SEP}")
        print(f"  Question {idx}/{len(QUESTIONS)}  [{category}]")
        print(_SEP)

    
        print(f"[INTERVIEW] Speaking question {idx}...")
        speak(question, label="INTERVIEWER")
        time.sleep(0.5)   

   
        print(f"[INTERVIEW] Microphone open for answer {idx}...")
        try:
            wav_path = record_answer(duration_seconds=60)
        except Exception as exc:
            print(f"[INTERVIEW] Recording failed: {exc} — skipping.")
            continue

       
        print(f"[INTERVIEW] Transcribing answer {idx}...")
        try:
            transcript = transcribe_audio(wav_path, context_hints=STT_CONTEXT_HINTS)
        except Exception as exc:
            transcript = "[transcription failed]"
            print(f"[INTERVIEW] STT error: {exc}")

        if not transcript or transcript == "[transcription failed]":
            speak("I didn't catch that. Let's move to the next question.", label="INTERVIEWER")
            continue

     
        print(f"[INTERVIEW] Evaluating answer {idx}...")
        try:
            evaluation = evaluate_answer_text(question, category, transcript, RESUME_CONTEXT)
        except Exception as exc:
            print(f"[INTERVIEW] Evaluation error: {exc}")
            evaluation = {
                "overall_score": 0,
                "brief_feedback": "I was unable to evaluate that answer.",
                "strengths": [],
                "improvements": [],
            }

        score    = evaluation.get("overall_score", 0)
        feedback = evaluation.get("brief_feedback", "")
        print(f"[INTERVIEW] Score    : {score}/100")
        print(f"[INTERVIEW] Feedback : {feedback}")

        transition = f"Thank you. {feedback}"
        if idx < len(QUESTIONS):
            transition += " Let's move on to the next question."
        print(f"[INTERVIEW] Speaking feedback for question {idx}...")
        speak(transition, label="INTERVIEWER")
        time.sleep(0.5)

       
        interview_session["responses"].append({
            "question_number": idx,
            "category":        category,
            "question":        question,
            "transcript":      transcript,
            "wav_path":        wav_path,
            "evaluation":      evaluation,
        })


    speak(
        "That concludes the interview. Thank you for your time today. "
        "We will now generate your performance report.",
        label="INTERVIEWER"
    )
    print("\n[INTERVIEW] All questions complete.")

   
    _banner("GENERATING FINAL REPORT")
    FINAL_REPORT = generate_final_report(interview_session)
    interview_session["final_report"] = FINAL_REPORT

    display_report(FINAL_REPORT, interview_session)

    summary = FINAL_REPORT.get("executive_summary", "")
    score   = FINAL_REPORT.get("overall_score", 0)
    speak(
        f"Here is your interview performance report, {name}. "
        f"Your overall score is {score} out of 100. {summary} "
        "The full written report has been printed above. Good luck.",
        label="INTERVIEWER"
    )

    
    _banner("SAVING SESSION")
    output_path = save_session(
        interview_session,
        output_dir=PROJECT_ROOT / "outputs" / "interviews",
    )
    print(f"[SAVE] Session saved to: {output_path}")
    print("\n[DONE] Interview simulation complete.")
