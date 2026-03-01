import { useState, useRef, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import ErrorBanner from './ErrorBanner'
import QuestionDisplay from './QuestionDisplay'
import RecordingControls from './RecordingControls'
import TranscriptDisplay from './TranscriptDisplay'
import InterviewProgress from './InterviewProgress'
import InterviewReport from './InterviewReport'
import { IconInterview, IconMic, IconUpload } from './Icons'

// ── State machine phases ──────────────────────────────────────────────────────
// 'setup'       → configure + load resume
// 'generating'  → AI generating questions
// 'intro'       → interviewer speaks welcome + mic test
// 'questioning' → active interview loop
// 'report'      → final report shown

const DEFAULT_ROLE    = 'Senior Software Engineer'
const DEFAULT_COMPANY = ''
const NUM_QUESTIONS   = 7

// ── Text-to-Speech helper ─────────────────────────────────────────────────────
function speak(text) {
  return new Promise(resolve => {
    if (!window.speechSynthesis) { resolve(); return }
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate   = 0.95
    utt.pitch  = 1.0
    utt.volume = 1.0
    // prefer a natural English voice if available
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
    ) || voices.find(v => v.lang.startsWith('en'))
    if (preferred) utt.voice = preferred
    utt.onend   = resolve
    utt.onerror = resolve
    window.speechSynthesis.speak(utt)
  })
}

export default function InterviewSimulatorPage({
  resumeJson:      propResumeJson    = null,
  targetCompany:   propTargetCompany = '',
  jobDescription:  propJobDescription = '',
  resumeFileName:  propResumeFileName = null,
}) {
  // ── Setup form ────────────────────────────────────────────────────────────
  const [targetRole,     setTargetRole]     = useState(DEFAULT_ROLE)
  const [targetCompany,  setTargetCompany]  = useState(propTargetCompany || DEFAULT_COMPANY)
  const [jobDescription, setJobDescription] = useState(propJobDescription || '')

  useEffect(() => {
    if (propTargetCompany) setTargetCompany(propTargetCompany)
  }, [propTargetCompany])

  // ── Resume state (prop fills it; user can also upload directly) ──────────
  const [resumeJson,      setResumeJson]      = useState(propResumeJson)
  const [resumeFile,      setResumeFile]      = useState(null)
  const [resumeUploading, setResumeUploading] = useState(false)

  // Auto-fill target role from most recent job title whenever resumeJson changes
  useEffect(() => {
    const title = resumeJson?.sections?.experience?.[0]?.title
    if (title) setTargetRole(title)
  }, [resumeJson])

  // Sync whenever parent passes a new resumeJson (e.g. after New Analysis)
  useEffect(() => { if (propResumeJson) setResumeJson(propResumeJson) }, [propResumeJson])

  // Drop-zone for inline resume upload
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'], 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] },
    multiple: false,
    disabled: resumeUploading,
    onDrop: useCallback(async (accepted) => {
      if (!accepted.length) return
      const file = accepted[0]
      setResumeFile(file)
      setResumeUploading(true)
      setError(null)
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('target_company', targetCompany || 'Unknown')
        const resp = await fetch('/upload', { method: 'POST', body: form })
        if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).detail || 'Upload failed')
        const { job_id } = await resp.json()
        // Stream until resume_data event
        await new Promise((resolve, reject) => {
          const es = new EventSource(`/stream/${job_id}`)
          es.addEventListener('resume_data', e => {
            const d = JSON.parse(e.data)
            if (d.resume_json) setResumeJson(d.resume_json)
            es.close(); resolve()
          })
          es.addEventListener('error', e => {
            es.close()
            if (e.data) { try { reject(new Error(JSON.parse(e.data).message)) } catch { reject(new Error('Processing failed')) } }
            else resolve() // stream closed naturally
          })
        })
      } catch (err) {
        setError({ title: 'Resume upload failed', detail: err.message })
        setResumeFile(null)
      } finally {
        setResumeUploading(false)
      }
    }, [targetCompany]),
  })


  // ── Session state ─────────────────────────────────────────────────────────
  const [phase,      setPhase]      = useState('setup')
  const [sessionId,  setSessionId]  = useState(null)
  const [questions,  setQuestions]  = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [responses,  setResponses]  = useState([])
  const [report,     setReport]     = useState(null)

  // ── Intro phase state ─────────────────────────────────────────────────────
  const [introStep,      setIntroStep]      = useState('speaking')  // speaking | mic-test | ready
  const [micTestPhase,   setMicTestPhase]   = useState('idle')      // idle | recording | done
  const [introSpeaking,  setIntroSpeaking]  = useState(false)

  // ── Per-question recording state ──────────────────────────────────────────
  const [recPhase,    setRecPhase]    = useState('idle')
  const [transcript,  setTranscript]  = useState('')
  const [evaluation,  setEvaluation]  = useState(null)
  const [isSpeaking,  setIsSpeaking]  = useState(false)
  const [isPaused,    setIsPaused]    = useState(false)

  // ── Error ─────────────────────────────────────────────────────────────────
  const [error,        setError]       = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── MediaRecorder refs ────────────────────────────────────────────────────
  const mediaRecorderRef   = useRef(null)
  const audioChunksRef     = useRef([])
  const micTestChunksRef   = useRef([])
  const micTestRecorderRef = useRef(null)

  // ── Speak a question whenever currentIdx changes in 'questioning' phase ───
  useEffect(() => {
    if (phase !== 'questioning' || questions.length === 0) return
    const q = questions[currentIdx]
    if (!q) return
    setIsSpeaking(true)
    setIsPaused(false)
    setRecPhase('idle')
    speak(`Question ${currentIdx + 1}. ${q.question}`).then(() => { setIsSpeaking(false); setIsPaused(false) })
    return () => window.speechSynthesis?.cancel()
  }, [phase, currentIdx, questions])

  // ── Start interview: generate questions then enter intro ──────────────────
  const handleStart = useCallback(async () => {
    setError(null)
    setPhase('generating')
    setIsSubmitting(true)

    try {
      const body = {
        resume_json:     resumeJson || {},
        target_role:     targetRole,
        target_company:  targetCompany || 'a top-tier tech company',
        job_description: jobDescription,
        num_questions:   NUM_QUESTIONS,
      }

      const resp = await fetch('/interview/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(err.detail || 'Failed to start interview')
      }
      const data = await resp.json()
      setSessionId(data.session_id)
      setQuestions(data.questions)
      setCurrentIdx(0)
      setResponses([])
      setTranscript('')
      setEvaluation(null)
      setRecPhase('idle')
      setIntroStep('speaking')
      setPhase('intro')
    } catch (err) {
      setError({ title: 'Could not start interview', detail: err.message })
      setPhase('setup')
    } finally {
      setIsSubmitting(false)
    }
  }, [targetRole, targetCompany, jobDescription, resumeJson])

  // ── Run intro speech when phase becomes 'intro' ───────────────────────────
  useEffect(() => {
    if (phase !== 'intro' || introStep !== 'speaking') return

    const company = targetCompany || 'our company'
    const intro = (
      `Hello, and welcome! I'm your AI interviewer today. ` +
      `We're conducting a ${targetRole} interview for ${company}. ` +
      `I'll be asking you ${NUM_QUESTIONS} questions tailored to your background. ` +
      `Take your time with each answer — there's no rush. ` +
      `Before we begin, let's do a quick microphone check to make sure I can hear you clearly. ` +
      `Please click the Test Microphone button when you're ready.`
    )

    setIntroSpeaking(true)
    speak(intro).then(() => {
      setIntroSpeaking(false)
      setIntroStep('mic-test')
    })

    return () => window.speechSynthesis?.cancel()
  }, [phase, introStep, targetRole, targetCompany])

  // ── Mic test recording ────────────────────────────────────────────────────
  const handleMicTestStart = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micTestChunksRef.current = []
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', ''].find(
        t => !t || MediaRecorder.isTypeSupported(t)
      )
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
      micTestRecorderRef.current = mr
      mr.ondataavailable = e => { if (e.data.size > 0) micTestChunksRef.current.push(e.data) }
      mr.start(250)
      setMicTestPhase('recording')

      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (mr.state === 'recording') {
          mr.stop()
          mr.stream.getTracks().forEach(t => t.stop())
          mr.onstop = () => setMicTestPhase('done')
        }
      }, 5000)
    } catch (err) {
      setError({ title: 'Microphone access denied', detail: err.message })
    }
  }, [])

  const handleMicTestStop = useCallback(() => {
    const mr = micTestRecorderRef.current
    if (!mr || mr.state !== 'recording') return
    mr.stop()
    mr.stream.getTracks().forEach(t => t.stop())
    mr.onstop = () => setMicTestPhase('done')
  }, [])

  // ── Proceed from intro to first question ─────────────────────────────────
  const handleBeginInterview = useCallback(() => {
    window.speechSynthesis?.cancel()
    setPhase('questioning')
  }, [])

  // ── TTS controls: stop / pause / resume / replay ─────────────────────────
  const handleStopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
  }, [])

  const handlePauseSpeaking = useCallback(() => {
    window.speechSynthesis?.pause()
    setIsPaused(true)
  }, [])

  const handleResumeSpeaking = useCallback(() => {
    window.speechSynthesis?.resume()
    setIsPaused(false)
  }, [])

  const handleReplaySpeaking = useCallback(() => {
    const q = questions[currentIdx]
    if (!q) return
    window.speechSynthesis?.cancel()
    setIsPaused(false)
    setIsSpeaking(true)
    speak(`Question ${currentIdx + 1}. ${q.question}`).then(() => {
      setIsSpeaking(false)
      setIsPaused(false)
    })
  }, [questions, currentIdx])

  // ── Recording ─────────────────────────────────────────────────────────────
  const handleStartRecording = useCallback(async () => {
    setError(null)
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', ''].find(
        t => !t || MediaRecorder.isTypeSupported(t)
      )
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
      mediaRecorderRef.current = mr
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.start(250)
      setRecPhase('recording')
    } catch (err) {
      setError({ title: 'Microphone access denied', detail: err.message })
    }
  }, [])

  const handleStopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr) return
    mr.stop()
    mr.stream.getTracks().forEach(t => t.stop())

    mr.onstop = async () => {
      setRecPhase('transcribing')
      const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' })
      const ext  = (mr.mimeType || 'audio/webm').includes('ogg') ? '.ogg' : '.webm'

      const form = new FormData()
      form.append('session_id',       sessionId)
      form.append('question_number',  String(currentIdx + 1))
      form.append('audio',            blob, `answer${ext}`)

      try {
        const resp = await fetch('/interview/transcribe', { method: 'POST', body: form })
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: resp.statusText }))
          throw new Error(err.detail || 'Transcription failed')
        }
        const data = await resp.json()
        setTranscript(data.transcript || '')
        setRecPhase('done')
      } catch (err) {
        setError({ title: 'Transcription error', detail: err.message })
        setRecPhase('idle')
      }
    }
  }, [sessionId, currentIdx])

  const handleRetake = useCallback(() => {
    setTranscript('')
    setEvaluation(null)
    setRecPhase('idle')
    // Re-read the question
    const q = questions[currentIdx]
    if (q) {
      setIsSpeaking(true)
      speak(`Question ${currentIdx + 1}. ${q.question}`).then(() => setIsSpeaking(false))
    }
  }, [questions, currentIdx])

  // ── Submit answer → analyse → speak feedback → wait for user to advance ────
  const handleAnalyse = useCallback(async () => {
    if (!transcript.trim()) { setRecPhase('idle'); return }
    setIsSubmitting(true)
    setError(null)

    const q = questions[currentIdx]
    let eval_ = null

    try {
      const resp = await fetch('/interview/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          session_id:      sessionId,
          question_number: currentIdx + 1,
          question:        q.question,
          category:        q.category,
          transcript:      transcript,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(err.detail || 'Analysis failed')
      }
      eval_ = await resp.json()
      setEvaluation(eval_)
    } catch (err) {
      setError({ title: 'Analysis error', detail: err.message })
      setIsSubmitting(false)
      return
    }

    const newResponses = [...responses, { transcript, evaluation: eval_ }]
    setResponses(newResponses)

    // Speak the brief feedback, then wait — user must click Next/Finish
    if (eval_?.brief_feedback) {
      setIsSpeaking(true)
      await speak(eval_.brief_feedback)
      setIsSpeaking(false)
    }

    setIsSubmitting(false)
    setRecPhase('evaluated')   // show evaluation card + Next/Finish button
  }, [transcript, questions, currentIdx, sessionId, responses])

  // ── Advance to next question (or generate report) after user clicks Next ──
  const handleAdvance = useCallback(async () => {
    const isLast = currentIdx >= questions.length - 1
    if (isLast) {
      setIsSubmitting(true)
      try {
        const resp = await fetch('/interview/report', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ session_id: sessionId }),
        })
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: resp.statusText }))
          throw new Error(err.detail || 'Report generation failed')
        }
        const reportData = await resp.json()
        setReport(reportData)
        await speak('Thank you for completing the interview. Your full report is now ready.')
        setPhase('report')
      } catch (err) {
        setError({ title: 'Report error', detail: err.message })
      }
      setIsSubmitting(false)
    } else {
      setTranscript('')
      setEvaluation(null)
      setRecPhase('idle')
      setCurrentIdx(prev => prev + 1)
      // next question spoken by the useEffect watching currentIdx
    }
  }, [currentIdx, questions.length, sessionId])

  const handleRestart = () => {
    window.speechSynthesis?.cancel()
    setPhase('setup')
    setSessionId(null)
    setQuestions([])
    setCurrentIdx(0)
    setResponses([])
    setReport(null)
    setTranscript('')
    setEvaluation(null)
    setRecPhase('idle')
    setIntroStep('speaking')
    setMicTestPhase('idle')
    setIsSpeaking(false)
    setError(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="iv-page">

      {/* ── Setup ── */}
      {phase === 'setup' && (
        <>
          <div className="page-title">
            <h2>Interview Simulator</h2>
            <p>Practise a personalised AI-powered mock interview based on your resume</p>
          </div>

          {error && <ErrorBanner title={error.title} detail={error.detail} />}

          <div className="card iv-setup-card">
            <div className="iv-setup-header">
              <div className="iv-setup-header-accent" />
              <div>
                <h3 className="iv-setup-title">Configure Your Session</h3>
                <p className="iv-setup-subtitle">Set your target role and company so the AI can tailor every question to the job</p>
              </div>
            </div>

            {/* ── Resume section ── */}
            <div className="form-group form-group--full" style={{ marginTop: 20 }}>
              <label>Resume</label>
              {resumeJson ? (
                <div className="iv-resume-loaded">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    {resumeFile
                      ? resumeFile.name
                      : propResumeFileName
                        ? propResumeFileName
                        : 'Resume loaded from analysis'}
                  </span>
                  <button
                    className="iv-resume-clear"
                    onClick={() => { setResumeJson(null); setResumeFile(null) }}
                    title="Remove resume"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  className={`iv-resume-dropzone${isDragActive ? ' dragover' : ''}${resumeUploading ? ' uploading' : ''}`}
                >
                  <input {...getInputProps()} />
                  {resumeUploading ? (
                    <div className="iv-resume-uploading">
                      <div className="spinner" style={{ width: 20, height: 20 }} />
                      <span>Processing resume…</span>
                    </div>
                  ) : (
                    <>
                      <span className="iv-resume-dz-icon"><IconUpload /></span>
                      <span className="iv-resume-dz-text">
                        {isDragActive ? 'Drop it here…' : 'Drag & drop or click to upload your resume'}
                      </span>
                      <span className="iv-resume-dz-hint">PDF, PNG or JPG</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="form-row" style={{ marginTop: 16 }}>
              <div className="form-group">
                <label>Target Role</label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={e => setTargetRole(e.target.value)}
                  placeholder="Senior Software Engineer"
                />
              </div>
              <div className="form-group">
                <label>Target Company</label>
                <input
                  type="text"
                  value={targetCompany}
                  onChange={e => setTargetCompany(e.target.value)}
                  placeholder="Google"
                />
              </div>
            </div>

            <div className="form-group form-group--full">
              <label>Job Description</label>
              <textarea
                rows={6}
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
                placeholder="Paste the job description here to get questions tailored to its requirements…"
              />
            </div>

            <hr className="form-divider" />

            <div className="iv-setup-footer">
              <div className="iv-setup-badges">
                <span className="iv-badge iv-badge--blue">7 Questions</span>
                <span className="iv-badge iv-badge--purple">AI Scoring</span>
                <span className="iv-badge iv-badge--green">Instant Feedback</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {!resumeJson && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent-orange)' }}>
                    Upload a resume to continue
                  </span>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleStart}
                  disabled={isSubmitting || !targetRole.trim() || !resumeJson || resumeUploading}
                >
                  Start Interview
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Generating questions ── */}
      {phase === 'generating' && (
        <div className="iv-generating">
          <div className="card iv-generating-card">
            <div className="progress-header">
              <div className="spinner" />
              <h2>Preparing your interview…</h2>
            </div>
            <p className="iv-generating-text">
              The AI is analysing your resume and crafting personalised questions for{' '}
              <strong>{targetRole}</strong>
              {targetCompany ? <> at <strong>{targetCompany}</strong></> : ''}.
            </p>
          </div>
        </div>
      )}

      {/* ── Intro + mic test ── */}
      {phase === 'intro' && (
        <div className="iv-generating">
          <div className="card iv-generating-card" style={{ maxWidth: 560 }}>

            {/* Speaking intro */}
            {introStep === 'speaking' && (
              <>
                <div className="progress-header">
                  <div className="iv-speaking-indicator">
                    <span className="iv-speaking-dot" />
                    <span className="iv-speaking-dot" />
                    <span className="iv-speaking-dot" />
                  </div>
                  <h2>Your interviewer is speaking…</h2>
                </div>
                <p className="iv-generating-text" style={{ marginTop: 12 }}>
                  Please listen to the introduction.
                </p>
                <div className="iv-interviewer-speech-bubble">
                  <div className="iv-interviewer-label">Interviewer</div>
                  <p>
                    Hello, and welcome! I'm your AI interviewer today. We're conducting a{' '}
                    <strong>{targetRole}</strong> interview
                    {targetCompany ? <> for <strong>{targetCompany}</strong></> : ''}. I'll be asking
                    you {NUM_QUESTIONS} questions tailored to your background. Take your time with each
                    answer — there's no rush. Before we begin, let's do a quick microphone check to
                    make sure I can hear you clearly.
                  </p>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 20, alignSelf: 'flex-end' }}
                  onClick={() => { window.speechSynthesis?.cancel(); setIntroStep('mic-test') }}
                >
                  Skip intro
                </button>
              </>
            )}

            {/* Mic test */}
            {introStep === 'mic-test' && (
              <>
                <div className="progress-header" style={{ gap: 12 }}>
                  <div className="neon-box" style={{ width: 40, height: 40, flexShrink: 0 }}>
                    <IconMic />
                  </div>
                  <h2>Microphone Check</h2>
                </div>
                <p className="iv-generating-text" style={{ marginTop: 8 }}>
                  Click <strong>Test Microphone</strong> and say a few words. Recording stops
                  automatically after 5 seconds or when you click Stop.
                </p>

                <div className="iv-mic-test-controls" style={{ marginTop: 20 }}>
                  {micTestPhase === 'idle' && (
                    <button className="iv-btn iv-btn-record" onClick={handleMicTestStart}>
                      <span className="iv-btn-icon"><IconMic /></span>
                      Test Microphone
                    </button>
                  )}
                  {micTestPhase === 'recording' && (
                    <div className="iv-recording-active">
                      <div className="iv-recording-indicator">
                        <span className="iv-recording-pulse" />
                        <span className="iv-recording-label">Recording… (auto-stops in 5 s)</span>
                      </div>
                      <button className="iv-btn iv-btn-stop" onClick={handleMicTestStop}>
                        Stop Early
                      </button>
                    </div>
                  )}
                  {micTestPhase === 'done' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                        Microphone OK
                      </span>
                      <button
                        className="iv-btn iv-btn-retake"
                        onClick={() => setMicTestPhase('idle')}
                        style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                      >
                        Test Again
                      </button>
                    </div>
                  )}
                </div>

                <hr className="form-divider" style={{ marginTop: 24 }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setIntroStep('speaking')}
                    disabled={introSpeaking}
                  >
                    Replay Intro
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleBeginInterview}
                  >
                    Begin Interview
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Active interview ── */}
      {phase === 'questioning' && questions.length > 0 && (
        <>
          <div className="page-title">
            <h2>Interview in Progress</h2>
            <p>{targetRole} &nbsp;·&nbsp; {targetCompany}</p>
          </div>

          {error && <ErrorBanner title={error.title} detail={error.detail} />}

          <InterviewProgress
            questions={questions}
            currentIndex={currentIdx}
            responses={responses}
          />

          <div className="card mt-24">
            <QuestionDisplay
              question={questions[currentIdx].question}
              category={questions[currentIdx].category}
              questionNumber={currentIdx + 1}
              totalQuestions={questions.length}
              isSpeaking={isSpeaking}
              isPaused={isPaused}
              onStop={handleStopSpeaking}
              onPause={handlePauseSpeaking}
              onResume={handleResumeSpeaking}
              onReplay={handleReplaySpeaking}
            />

            <TranscriptDisplay
              transcript={transcript}
              evaluation={evaluation}
            />

            <RecordingControls
              phase={recPhase}
              onStart={handleStartRecording}
              onStop={handleStopRecording}
              onRetake={handleRetake}
              onAnalyse={handleAnalyse}
              onAdvance={handleAdvance}
              isLastQuestion={currentIdx >= questions.length - 1}
              isSubmitting={isSubmitting}
              isSpeaking={isSpeaking}
            />
          </div>
        </>
      )}

      {/* ── Final report ── */}
      {phase === 'report' && (
        <>
          {error && <ErrorBanner title={error.title} detail={error.detail} />}

          <InterviewReport
            report={report}
            session={{
              candidateName: 'Candidate',
              targetRole,
              targetCompany,
            }}
          />

          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <button className="btn btn-primary" onClick={handleRestart}>
              Start New Interview
            </button>
          </div>
        </>
      )}
    </div>
  )
}
