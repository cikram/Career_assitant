"""
One-shot script to apply all fixes to voice_interview_simulator.ipynb.
Run with: python apply_notebook_fixes.py
"""
import json
import copy

NOTEBOOK_PATH = "voice_interview_simulator.ipynb"

with open(NOTEBOOK_PATH, "r", encoding="utf-8") as f:
    nb = json.load(f)

cells = nb["cells"]

def make_code_cell(source_lines):
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": source_lines,
    }

# ─────────────────────────────────────────────────────────────────────────────
# CELL 14 — TTSManager + speak() wrapper
# ─────────────────────────────────────────────────────────────────────────────
CELL_14 = """\
import pyttsx3
import threading
import queue

class TTSManager:
    \"\"\"
    Runs pyttsx3 on a dedicated background thread to avoid the SAPI5
    message-pump deadlock that occurs when runAndWait() is called on
    the Jupyter main thread (Windows).
    \"\"\"
    def __init__(self):
        self._engine = pyttsx3.init()
        self._engine.setProperty("rate", 165)
        self._engine.setProperty("volume", 1.0)
        _voices = self._engine.getProperty("voices")
        if len(_voices) > 1:
            self._engine.setProperty("voice", _voices[1].id)
        self._queue = queue.Queue()
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()
        # Warm-up: send an empty utterance so SAPI5 initialises fully
        self._engine.say("")
        self._engine.runAndWait()

    def _worker(self):
        while True:
            text = self._queue.get()
            if text is None:          # sentinel — shut down
                self._queue.task_done()
                break
            try:
                self._engine.say(text)
                self._engine.runAndWait()
            except Exception as e:
                print(f"[TTS ERROR] {e}")
            self._queue.task_done()

    def speak(self, text: str, label: str = "") -> None:
        \"\"\"Queue text for speech (non-blocking).\"\"\"
        if label:
            print(f"\\n[{label}] {text}")
        else:
            print(f"\\n{text}")
        self._queue.put(text)

    def wait(self) -> None:
        \"\"\"Block until the speech queue is empty (all audio finished).\"\"\"
        self._queue.join()

    def stop(self) -> None:
        \"\"\"Gracefully shut down the background thread.\"\"\"
        self._queue.put(None)
        self._thread.join()


# Create the singleton manager
tts = TTSManager()


def speak(text: str, label: str = "") -> None:
    \"\"\"
    Speak *text* aloud and block until the utterance is complete.
    Prints text to screen as well so the user can read along.
    This wrapper keeps all existing speak(...) call-sites unchanged.
    \"\"\"
    tts.speak(text, label=label)
    tts.wait()


# Quick smoke-test
speak("Text to speech engine initialised successfully.", label="TTS TEST")
"""

# ─────────────────────────────────────────────────────────────────────────────
# CELL 16 — TTS diagnostic (updated to use tts object)
# ─────────────────────────────────────────────────────────────────────────────
CELL_16 = """\
# TTS Audio Diagnostic — Run this if you can't hear the interviewer
print("Testing Text-to-Speech via TTSManager...")

try:
    tts
    print("TTS manager already initialised from Cell 7")
except NameError:
    print("TTS manager not initialised — re-run Cell 7 first.")
    raise

engine = tts._engine
_voices = engine.getProperty("voices")
print(f"Available voices: {len(_voices)}")
for i, voice in enumerate(_voices):
    print(f"  {i}: {voice.name}")

current_voice = engine.getProperty("voice")
print(f"\\nCurrent voice : {current_voice[:80] if current_voice else 'Not set'}")
print(f"Current rate  : {engine.getProperty('rate')} words/min")
print(f"Current volume: {engine.getProperty('volume')}")

print("\\nTesting speech now...")
speak("Testing. Can you hear me now?", label="TTS DIAGNOSTIC")

print("\\n" + "="*60)
print("TROUBLESHOOTING TIPS:")
print("="*60)
print("1. Check Windows volume (bottom-right taskbar)")
print("2. Check Volume Mixer — make sure Python/Jupyter is not muted")
print("3. Verify correct audio output device is set as default")
print("\\nIf you still cannot hear anything, try voice index 0:")
print("   tts._engine.setProperty('voice', tts._engine.getProperty('voices')[0].id)")
print("   speak('Testing voice zero')")
"""

# ─────────────────────────────────────────────────────────────────────────────
# CELL 18 — record_answer() with PREFERRED_MIC_INDEX + PortAudioError handling
# ─────────────────────────────────────────────────────────────────────────────
CELL_18 = """\
import tempfile
import time
import numpy as np
import sounddevice as sd
from scipy.io import wavfile
from IPython.display import Audio, display

# ── Audio recording settings ──────────────────────────────────────────────────
SAMPLE_RATE        = 16000   # Hz — Voxtral STT works well at 16 kHz
CHANNELS           = 1       # Mono
MAX_DURATION       = 90      # seconds — safety cap per answer

# Set to an integer device index to pin the mic, or None to use the system default.
# Run list_input_devices() below to find the right index for your machine.
PREFERRED_MIC_INDEX = None


def list_input_devices():
    \"\"\"Print all available input (microphone) devices and their indices.\"\"\"
    devices = sd.query_devices()
    print("Available input devices:")
    for i, dev in enumerate(devices):
        if dev["max_input_channels"] > 0:
            marker = " <-- PREFERRED" if i == PREFERRED_MIC_INDEX else ""
            print(f"  [{i:2d}] {dev['name']}{marker}")


def record_answer(
    duration_seconds: int = 60,
    sample_rate: int = SAMPLE_RATE,
    silence_threshold: float = 0.005,
    silence_timeout: float = 3.0,
) -> str:
    \"\"\"
    Record microphone audio until either:
      a) ``duration_seconds`` elapsed, or
      b) ``silence_timeout`` seconds of continuous silence detected.

    Returns the path to a temporary WAV file.

    Parameters
    ----------
    duration_seconds  : Maximum recording time.
    sample_rate       : Audio sample rate in Hz.
    silence_threshold : RMS amplitude below which audio is considered silent.
    silence_timeout   : Stop recording after this many seconds of silence.
    \"\"\"
    device_kwargs = {}
    if PREFERRED_MIC_INDEX is not None:
        device_kwargs["device"] = PREFERRED_MIC_INDEX

    # Pre-check: verify we can open the mic at all
    try:
        test_chunk = sd.rec(
            int(sample_rate * 0.1),
            samplerate=sample_rate,
            channels=CHANNELS,
            dtype="float32",
            **device_kwargs,
        )
        sd.wait()
    except sd.PortAudioError as e:
        raise RuntimeError(
            f"Cannot open microphone (PortAudioError: {e}).\\n"
            "Run list_input_devices() and set PREFERRED_MIC_INDEX to a valid index."
        ) from e

    mic_name = sd.query_devices(PREFERRED_MIC_INDEX if PREFERRED_MIC_INDEX is not None
                                else sd.default.device[0])["name"]
    print(f"\\n  Recording via: {mic_name}")
    print(f"  Speak now — max {duration_seconds}s, auto-stops after {silence_timeout}s silence.")
    print("  Press Ctrl+C to stop early.")

    chunk_size    = int(sample_rate * 0.5)   # 500 ms chunks for silence detection
    all_chunks    = []
    silent_chunks = 0
    silent_limit  = int(silence_timeout / 0.5)
    total_chunks  = int(duration_seconds  / 0.5)

    try:
        for _ in range(total_chunks):
            chunk = sd.rec(
                chunk_size,
                samplerate=sample_rate,
                channels=CHANNELS,
                dtype="float32",
                **device_kwargs,
            )
            sd.wait()
            all_chunks.append(chunk)

            rms = float(np.sqrt(np.mean(chunk ** 2)))
            if rms < silence_threshold:
                silent_chunks += 1
            else:
                silent_chunks = 0   # reset on speech

            if silent_chunks >= silent_limit and len(all_chunks) > silent_limit:
                print("  (silence detected — stopping)")
                break

    except KeyboardInterrupt:
        print("  (stopped by user)")
    except sd.PortAudioError as e:
        raise RuntimeError(f"Microphone error during recording: {e}") from e

    if not all_chunks:
        raise RuntimeError("No audio was recorded.")

    # Concatenate and save to temp WAV
    audio_data  = np.concatenate(all_chunks, axis=0)
    audio_int16 = (audio_data * 32767).astype(np.int16)

    tmp = tempfile.NamedTemporaryFile(
        suffix=".wav",
        delete=False,
        prefix="interview_answer_",
    )
    wavfile.write(tmp.name, sample_rate, audio_int16)
    tmp.close()

    duration = len(audio_data) / sample_rate
    print(f"  Recorded {duration:.1f}s -> {Path(tmp.name).name}")

    return tmp.name


def playback_audio(wav_path: str) -> None:
    \"\"\"Play back a WAV file inline in the notebook for confirmation.\"\"\"
    print("  Playback:")
    display(Audio(filename=wav_path, autoplay=False))


print("Audio recording helpers ready.")
list_input_devices()
"""

# ─────────────────────────────────────────────────────────────────────────────
# CELL 19 (NEW) — Quick mic test cell (3 s record + inline playback)
# ─────────────────────────────────────────────────────────────────────────────
CELL_19_NEW = """\
# --- Mic Test Cell ---
# Records 3 seconds from the selected microphone and plays it back inline.
# Run this before the interview to confirm your mic is working.

import numpy as np
import sounddevice as sd
from scipy.io import wavfile
import tempfile
from IPython.display import Audio, display

_TEST_SECS = 3
print(f"Mic test: recording {_TEST_SECS}s — say something now...")

_device_kwargs = {"device": PREFERRED_MIC_INDEX} if PREFERRED_MIC_INDEX is not None else {}
try:
    _rec = sd.rec(
        int(SAMPLE_RATE * _TEST_SECS),
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype="float32",
        **_device_kwargs,
    )
    sd.wait()
    _rms = float(np.sqrt(np.mean(_rec ** 2)))
    print(f"RMS level: {_rms:.4f}  ({'OK — audio detected' if _rms > 0.002 else 'WARNING: very quiet, check mic'})")

    _tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False, prefix="mic_test_")
    wavfile.write(_tmp.name, SAMPLE_RATE, (_rec * 32767).astype(np.int16))
    _tmp.close()
    print("Playback (should hear your voice):")
    display(Audio(filename=_tmp.name, autoplay=True))

except sd.PortAudioError as _e:
    print(f"ERROR: {_e}")
    print("Run list_input_devices() and set PREFERRED_MIC_INDEX to a valid index.")
"""

# ─────────────────────────────────────────────────────────────────────────────
# CELL 20 — transcribe_audio() with context_bias as list (not string)
# ─────────────────────────────────────────────────────────────────────────────
CELL_20 = """\
def transcribe_audio(wav_path: str, context_hints: list[str] | None = None) -> str:
    \"\"\"
    Transcribe a WAV file using Mistral Voxtral STT.

    Parameters
    ----------
    wav_path      : Path to the WAV file recorded from the microphone.
    context_hints : Optional list of domain-specific terms/skills to improve
                    transcription accuracy (Voxtral context biasing).

    Returns
    -------
    str : Transcribed text.
    \"\"\"
    print("  Transcribing with Voxtral...")

    kwargs = {
        "model": STT_MODEL,
        "language": "en",
    }

    # Voxtral context_bias must be a list[str] (up to 100 terms).
    # Passing a plain string causes a validation error in mistralai SDK >= 1.0.
    if context_hints:
        kwargs["context_bias"] = context_hints[:100]

    with open(wav_path, "rb") as f:
        response = client.audio.transcriptions.complete(
            file={"content": f, "file_name": Path(wav_path).name},
            **kwargs,
        )

    transcript = response.text.strip()
    print(f"  Transcript: \\"{transcript}\\"")
    return transcript


# Build a skill-based context bias list from the candidate's resume
STT_CONTEXT_HINTS = (
    resume.get("sections", {}).get("skills", []) +
    [p.get("title", "") for p in resume.get("sections", {}).get("projects", [])]
)

print(f"STT context hints ({len(STT_CONTEXT_HINTS)} terms): {STT_CONTEXT_HINTS[:10]}")
"""

# ─────────────────────────────────────────────────────────────────────────────
# CELL 28 — interview loop: explicit tts.wait() before record_answer()
# (speak() already calls tts.wait(), but make it explicit as belt-and-suspenders)
# ─────────────────────────────────────────────────────────────────────────────
CELL_28 = """\
import time

# ── Opening statement ─────────────────────────────────────────────────────────
opening = (
    f"Welcome, {name}. My name is Alex and I will be conducting your interview today "
    f"for the position of {TARGET_ROLE} at {TARGET_COMPANY}. "
    "We have a few questions for you. Please answer as clearly and thoroughly as you can. "
    "The microphone will start recording automatically after each question. Let's begin."
)
speak(opening, label="INTERVIEWER")   # speak() already calls tts.wait() internally
time.sleep(1)

# ── Interview loop ────────────────────────────────────────────────────────────
for idx, q_item in enumerate(QUESTIONS, start=1):
    question = q_item["question"]
    category = q_item["category"]

    print(f"\\n{'='*60}")
    print(f"Question {idx}/{len(QUESTIONS)}  [{category}]")
    print(f"{'='*60}")

    # 1. Speak the question — blocks until TTS audio is fully done
    speak(question, label="INTERVIEWER")
    tts.wait()          # belt-and-suspenders: ensure queue is drained before mic opens
    time.sleep(0.3)     # brief pause so the candidate is ready

    # 2. Record answer
    try:
        wav_path = record_answer(duration_seconds=60)
    except Exception as e:
        print(f"  Recording failed: {e} — skipping question.")
        continue

    # 3. Playback for confirmation
    playback_audio(wav_path)

    # 4. Transcribe with Voxtral
    try:
        transcript = transcribe_audio(wav_path, context_hints=STT_CONTEXT_HINTS)
    except Exception as e:
        transcript = "[transcription failed]"
        print(f"  STT error: {e}")

    if not transcript or transcript == "[transcription failed]":
        speak("I didn't catch that. Let's move to the next question.", label="INTERVIEWER")
        continue

    # 5. Evaluate answer (text path — always reliable)
    print("  Evaluating...")
    try:
        evaluation = evaluate_answer_text(
            question, category, transcript, RESUME_CONTEXT
        )
    except Exception as e:
        print(f"  Evaluation error: {e}")
        evaluation = {
            "overall_score": 0,
            "brief_feedback": "I was unable to evaluate that answer.",
            "strengths": [],
            "improvements": [],
        }

    score    = evaluation.get("overall_score", 0)
    feedback = evaluation.get("brief_feedback", "")

    print(f"  Score: {score}/100")
    print(f"  Feedback: {feedback}")

    # 6. Speak brief feedback
    transition = f"Thank you. {feedback}"
    if idx < len(QUESTIONS):
        transition += " Let's move on to the next question."
    speak(transition, label="INTERVIEWER")
    time.sleep(0.5)

    # 7. Store response
    interview_session["responses"].append({
        "question_number": idx,
        "category":        category,
        "question":        question,
        "transcript":      transcript,
        "wav_path":        wav_path,
        "evaluation":      evaluation,
    })

# ── Closing statement ─────────────────────────────────────────────────────────
speak(
    "That concludes the interview. Thank you for your time today. "
    "We will now generate your performance report.",
    label="INTERVIEWER"
)
print("\\nInterview complete. Proceed to the next cell for the final report.")
"""

# ─────────────────────────────────────────────────────────────────────────────
# Apply all edits
# ─────────────────────────────────────────────────────────────────────────────

def set_cell_source(cell, source_str):
    """Replace a cell's source with the given multi-line string, split into lines."""
    lines = source_str.splitlines(keepends=True)
    # Ensure last line has no trailing newline (notebook convention)
    if lines and lines[-1].endswith("\n"):
        lines[-1] = lines[-1].rstrip("\n")
    cell["source"] = lines
    cell["outputs"] = []
    cell["execution_count"] = None

print("Applying fixes to notebook...")

set_cell_source(cells[14], CELL_14)
print("  [OK] Cell 14 — TTSManager + speak()")

set_cell_source(cells[16], CELL_16)
print("  [OK] Cell 16 — TTS diagnostic")

set_cell_source(cells[18], CELL_18)
print("  [OK] Cell 18 — record_answer() with PREFERRED_MIC_INDEX + PortAudioError")

# Insert new mic test cell at index 19 (after cell 18, before old cell 19)
new_cell_19 = make_code_cell([])
set_cell_source(new_cell_19, CELL_19_NEW)
cells.insert(19, new_cell_19)
print("  [OK] Cell 19 (NEW) — Mic test cell inserted")

# After insertion, old cell 20 is now at index 21
set_cell_source(cells[21], CELL_20)
print("  [OK] Cell 21 (was 20) — transcribe_audio() context_bias fix")

# Old cell 28 is now at index 29
set_cell_source(cells[29], CELL_28)
print("  [OK] Cell 29 (was 28) — Interview loop with tts.wait()")

nb["cells"] = cells

with open(NOTEBOOK_PATH, "w", encoding="utf-8") as f:
    json.dump(nb, f, ensure_ascii=False, indent=1)

print(f"\nDone. Notebook saved ({len(cells)} cells total).")
print("Verification summary:")
for idx, label in [(14, "TTSManager"), (16, "TTS diag"), (18, "record_answer"), (19, "mic test"), (21, "transcribe_audio"), (29, "interview loop")]:
    snippet = "".join(cells[idx]["source"])[:80].replace("\n", " ")
    print(f"  [{idx:2d}] {label:20s} | {snippet}")
