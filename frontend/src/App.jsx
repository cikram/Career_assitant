import { useState, useRef, useCallback } from 'react'
import {
  IconPulse, IconResults, IconUpload, IconSkills,
  IconAlert, IconSparkles, IconTarget, IconDownload, IconScore,
  IconInterview
} from './components/Icons'
import UploadCard from './components/UploadCard'
import ErrorBanner from './components/ErrorBanner'
import ProgressPanel from './components/ProgressPanel'
import ResumeCard from './components/ResumeCard'
import ScoutPanel from './components/ScoutPanel'
import SkillsPanel from './components/SkillsPanel'
import ChartsPanel from './components/ChartsPanel'
import RoadmapPanel from './components/RoadmapPanel'
import DownloadBar from './components/DownloadBar'
import InterviewSimulatorPage from './components/InterviewSimulatorPage'

// Stage keys that match backend event stage values
const STAGE_KEYS = ['ocr', 'agents', 'scout', 'strategist', 'done']

function initialStages() {
  return {
    ocr: 'pending',   // 'pending' | 'active' | 'done' | 'error'
    agents: 'pending',
    scout: 'pending',
    strategist: 'pending',
    done: 'pending',
  }
}

export default function App() {
  // ── Dashboard tab: 'upload' | 'results' | 'interview'
  const [dashTab, setDashTab] = useState('upload')

  // ── Upload form state (lifted so App can keep & reset them) ─
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTargetCompany, setUploadTargetCompany] = useState('')
  const [uploadJobDescription, setUploadJobDescription] = useState('')

  // ── Upload tab mode ──────────────────────────────────────────
  // 'form'    → initial / after reset  (no "Analysis Complete" banner)
  // 'results' → pipeline finished      ("Analysis Complete" banner shown above form)
  const [appMode, setAppMode] = useState('form')

  // ── Upload state ────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Progress state ──────────────────────────────────────────
  const [showProgress, setShowProgress] = useState(false)
  const [stages, setStages] = useState(initialStages())
  const [logs, setLogs] = useState([])  // [{ts, msg, type}]

  // ── Resume data ─────────────────────────────────────────────
  const [resumeData, setResumeData] = useState(null)  // {name, contact}
  const [resumeJson, setResumeJson] = useState(null)  // full structured CV

  // ── Interview context (captured from upload form) ───────────
  const [interviewContext, setInterviewContext] = useState({ targetCompany: '', jobDescription: '' })

  const [showResults, setShowResults] = useState(false)
  const [scoutResult, setScoutResult] = useState(null)
  const [strategistResult, setStrategistResult] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  // ── Error ────────────────────────────────────────────────────
  const [error, setError] = useState(null)   // {title, detail}

  // ── Download ─────────────────────────────────────────────────
  const [jobId, setJobId] = useState(null)
  const [showDownload, setShowDownload] = useState(false)

  // SSE ref so we can close it on error
  const evtSourceRef = useRef(null)

  // ── Helpers ──────────────────────────────────────────────────
  function addLog(msg, type = 'plain') {
    const ts = new Date().toLocaleTimeString('en-US', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    setLogs(prev => [...prev, { ts, msg, type }])
  }

  function setStage(name, state) {
    setStages(prev => ({ ...prev, [name]: state }))
  }

  // ── Reset everything → blank form, no banner ─────────────────
  function handleNewAnalysis() {
    setUploadFile(null)
    setUploadTargetCompany('')
    setUploadJobDescription('')
    setAppMode('form')
    setShowProgress(false)
    setStages(initialStages())
    setLogs([])
    setError(null)
    setShowResults(false)
    setShowDownload(false)
    setResumeData(null)
    setResumeJson(null)
    setScoutResult(null)
    setStrategistResult(null)
    setDashTab('upload')
  }

  const stageMap = {
    ocr: () => setStage('ocr', 'active'),
    ocr_done: () => setStage('ocr', 'done'),
    agents: () => setStage('agents', 'active'),
    scout: () => setStage('scout', 'active'),
    scout_done: () => setStage('scout', 'done'),
    strategist: () => setStage('strategist', 'active'),
    strategist_done: () => setStage('strategist', 'done'),
    done: () => {
      setStage('done', 'done')
      setStage('agents', 'done')
    },
  }

  // ── Submit handler ────────────────────────────────────────────
  // NOTE: form field values (uploadFile / uploadTargetCompany / uploadJobDescription)
  // are NOT reset here — they stay filled after analysis completes.
  const handleSubmit = useCallback(async ({ file, targetCompany, jobDescription }) => {
    setError(null)
    setResumeData(null)
    setResumeJson(null)
    setScoutResult(null)
    setStrategistResult(null)
    setShowResults(false)
    setActiveTab('overview')
    setShowDownload(false)
    setShowProgress(true)
    setStages(initialStages())
    setLogs([])
    setIsSubmitting(true)
    setAppMode('form')  // stay in form mode while pipeline is running
    // Capture for Interview Simulator
    setInterviewContext({ targetCompany: targetCompany || '', jobDescription: jobDescription || '', resumeFileName: file.name })

    addLog('Uploading resume file…', 'plain')

    const form = new FormData()
    form.append('file', file)
    form.append('target_company', targetCompany)
    if (jobDescription) form.append('job_description', jobDescription)

    let id
    try {
      const resp = await fetch('/upload', { method: 'POST', body: form })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(err.detail || 'Upload failed')
      }
      const data = await resp.json()
      id = data.job_id
      setJobId(id)
    } catch (err) {
      setError({ title: 'Upload failed', detail: err.message })
      addLog(`Error: ${err.message}`, 'error')
      setIsSubmitting(false)
      return
    }

    connectStream(id)
  }, [])

  // ── SSE stream ────────────────────────────────────────────────
  function connectStream(id) {
    if (evtSourceRef.current) evtSourceRef.current.close()

    const es = new EventSource(`/stream/${id}`)
    evtSourceRef.current = es

    function closeStream() {
      es.close()
      evtSourceRef.current = null
      setIsSubmitting(false)
    }

    es.addEventListener('status', e => {
      const data = JSON.parse(e.data)
      const stage = data.stage || ''
      const msg = data.message || ''
      if (msg) addLog(msg, 'info')
      if (stageMap[stage]) stageMap[stage]()
    })

    es.addEventListener('progress', e => {
      const data = JSON.parse(e.data)
      addLog(data.message || '', 'plain')
    })

    es.addEventListener('resume_data', e => {
      const data = JSON.parse(e.data)
      setResumeData({ name: data.name, contact: data.contact })
      if (data.resume_json) setResumeJson(data.resume_json)
    })

    es.addEventListener('scout_result', e => {
      const data = JSON.parse(e.data)
      setScoutResult(data)
      setShowResults(true)
    })

    es.addEventListener('strategist_result', e => {
      const data = JSON.parse(e.data)
      setStrategistResult(data)
      setShowResults(true)
      setShowDownload(true)
      setAppMode('results')  // switch upload tab to "analysis complete" mode
      setDashTab('results')  // auto-navigate to results tab
    })

    es.addEventListener('error', e => {
      if (!e.data) {
        // Native network closure — server ended the stream cleanly
        closeStream()
        return
      }
      try {
        const data = JSON.parse(e.data)
        setError({ title: data.message || 'Pipeline error', detail: data.detail || '' })
        addLog(`Error: ${data.message || 'Pipeline error'}`, 'error')
      } catch {
        setError({ title: 'Stream error', detail: 'Unknown error structure' })
        addLog('Stream error', 'error')
      }
      // Mark any active stage as error
      setStages(prev => {
        const next = { ...prev }
        STAGE_KEYS.forEach(k => { if (next[k] === 'active') next[k] = 'error' })
        return next
      })
      closeStream()
    })

    // Poll for done stage
    const doneCheck = setInterval(() => {
      setStages(prev => {
        if (prev.done === 'done') {
          clearInterval(doneCheck)
          if (evtSourceRef.current) {
            addLog('Pipeline complete.', 'ok')
            setAppMode('results')  // switch upload tab to "analysis complete" mode
            setDashTab('results')  // redirect to results tab
            closeStream()
          }
        }
        return prev
      })
    }, 500)
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div id="root">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo"><IconPulse /></div>
          <div className="sidebar-title">
            <h1>Career Analyst</h1>
            <p>Real-time Job Monitoring</p>
          </div>
        </div>

        <nav className="sidebar-menu">
          <div
            className={`menu-item${dashTab === 'upload' ? ' active' : ''}`}
            onClick={() => setDashTab('upload')}
          >
            <span className="menu-icon"><IconUpload /></span>
            New Analysis
            {dashTab === 'upload' && <div className="active-dot"></div>}
          </div>
          <div
            className={`menu-item${dashTab === 'results' ? ' active' : ''}`}
            onClick={() => setDashTab('results')}
          >
            <span className="menu-icon"><IconResults /></span>
            Results
            {dashTab === 'results' && <div className="active-dot"></div>}
          </div>
          <div
            className={`menu-item${dashTab === 'interview' ? ' active' : ''}`}
            onClick={() => setDashTab('interview')}
          >
            <span className="menu-icon"><IconInterview /></span>
            Interview Simulator
            {dashTab === 'interview' && <div className="active-dot"></div>}
          </div>
        </nav>

        {showDownload && jobId && dashTab === 'results' && (
          <div className="sidebar-footer">
            <a
              href={`/download/pdf/${jobId}`}
              className="menu-item menu-item--download"
              target="_blank"
              rel="noreferrer"
            >
              <span className="menu-icon"><IconDownload /></span>
              Download PDF
            </a>
          </div>
        )}
      </aside>

      {/* ── Main Content Area ── */}
      <main className="main-content">
        <div className={`workspace${dashTab === 'upload' ? ' workspace--upload' : ''}`}>

          {/* ══ Upload / New Analysis tab ══ */}
          {dashTab === 'upload' && (
            <>
              <div className="page-title">
                <h2>New Analysis</h2>
                <p>Upload your resume to start a real-time career analysis</p>
              </div>

              {/* ── Upload form — always visible; filled values preserved after analysis ── */}
              <UploadCard
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                analysisComplete={appMode === 'results'}
                onNewAnalysis={handleNewAnalysis}
                file={uploadFile}
                setFile={setUploadFile}
                targetCompany={uploadTargetCompany}
                setTargetCompany={setUploadTargetCompany}
                jobDescription={uploadJobDescription}
                setJobDescription={setUploadJobDescription}
              />

              {error && <ErrorBanner title={error.title} detail={error.detail} />}

              {/* Inline progress panel shown during an active run (form mode only) */}
              {appMode === 'form' && showProgress && (
                <div className="card mt-24">
                  <ProgressPanel stages={stages} logs={logs} />
                </div>
              )}

              {/* ── Analysis Complete banner — visible only after pipeline finishes ── */}
              {appMode === 'results' && (
                <div className="card mt-24">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--accent-green)', marginBottom: '6px' }}>
                        ANALYSIS COMPLETE
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {uploadFile?.name || 'Resume'}
                      </div>
                      {uploadTargetCompany && (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                          Target: {uploadTargetCompany}
                        </div>
                      )}
                    </div>
                    {strategistResult?.overall_score != null && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--accent-green)', lineHeight: 1 }}>
                          {strategistResult.overall_score}%
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px', letterSpacing: '0.06em' }}>
                          MATCH SCORE
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pipeline steps — all stages shown with their completed (done) state */}
                  <ProgressPanel stages={stages} logs={logs} hideHeader />
                </div>
              )}

              {showDownload && jobId && <DownloadBar jobId={jobId} />}
            </>
          )}

          {/* ══ Results tab ══ */}
          {dashTab === 'results' && (
            <>
              <div className="page-title">
                <h2>Results</h2>
                <p>Your career analysis and recommendations</p>
              </div>

              {!showResults ? (
                <div className="empty-state">
                  <div className="neon-box" style={{ width: '60px', height: '60px', marginBottom: '20px' }}>
                    <IconPulse />
                  </div>
                  <h3>No analysis yet</h3>
                  <p>Upload a resume in the <strong>New Analysis</strong> tab to get started.</p>
                  <button className="btn btn-primary mt-16" onClick={() => setDashTab('upload')}>
                    Go to Upload
                  </button>
                </div>
              ) : (
                <section>
                  {resumeData && (
                    <div className="card mt-24">
                      <ResumeCard data={resumeData} />
                    </div>
                  )}

                  <nav className="tabs-nav mt-24">
                    <button
                      className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                      onClick={() => setActiveTab('overview')}
                    >
                      Overview
                    </button>
                    <button
                      className={`tab-btn ${activeTab === 'skills' ? 'active' : ''}`}
                      onClick={() => setActiveTab('skills')}
                    >
                      Skills Map
                    </button>
                    <button
                      className={`tab-btn ${activeTab === 'roadmap' ? 'active' : ''}`}
                      onClick={() => setActiveTab('roadmap')}
                    >
                      30-Day Roadmap
                    </button>
                    <button
                      className={`tab-btn ${activeTab === 'jobs' ? 'active' : ''}`}
                      onClick={() => setActiveTab('jobs')}
                    >
                      Job Matches
                    </button>
                  </nav>

                  <div className="results-grid">
                    {activeTab === 'jobs' && scoutResult && (
                      <div className="card full-width">
                        <ScoutPanel data={scoutResult} />
                      </div>
                    )}
                    {strategistResult && (
                      <>
                        {activeTab === 'overview' && (
                          <div className="full-width">
                            <div className="metrics-grid">
                              <div className="metric-card" onClick={() => setActiveTab('skills')} style={{ cursor: 'pointer' }}>
                                <div className="metric-header">
                                  <div className="metric-icon icon-green"><IconResults /></div>
                                  <span className="metric-badge" style={{ color: 'var(--accent-green)' }}>SCORE</span>
                                </div>
                                <div>
                                  <div className="metric-value">{strategistResult?.overall_score}%</div>
                                  <div className="metric-label">Weighted Match Score</div>
                                </div>
                              </div>

                              <div className="metric-card" onClick={() => setActiveTab('skills')} style={{ cursor: 'pointer' }}>
                                <div className="metric-header">
                                  <div className="metric-icon icon-blue"><IconSkills /></div>
                                  <span className="metric-badge" style={{ color: 'var(--accent-blue)' }}>SKILLS</span>
                                </div>
                                <div>
                                  <div className="metric-value">{strategistResult?.matched_skills?.length || 0}</div>
                                  <div className="metric-label">Matched Skills Found</div>
                                </div>
                              </div>

                              <div className="metric-card" onClick={() => setActiveTab('skills')} style={{ cursor: 'pointer' }}>
                                <div className="metric-header">
                                  <div className="metric-icon icon-orange"><IconAlert /></div>
                                  <span className="metric-badge" style={{ color: 'var(--accent-orange)' }}>GAPS</span>
                                </div>
                                <div>
                                  <div className="metric-value">{strategistResult?.missing_skills?.length || 0}</div>
                                  <div className="metric-label">Missing Core Skills</div>
                                </div>
                              </div>
                            </div>

                            <div className="section-heading text-center">Detailed Summary</div>
                            <div className="content-grid">
                              <div className="action-card" onClick={() => setActiveTab('jobs')} style={{ cursor: 'pointer' }}>
                                <div className="neon-box" style={{ marginBottom: '16px', width: '40px', height: '40px' }}>
                                  <IconSparkles />
                                </div>
                                <h3>Match Breakdown</h3>
                                <p>{strategistResult?.gap_summary || "Based on the provided job description..."}</p>
                              </div>
                              <div className="action-card" onClick={() => setActiveTab('roadmap')} style={{ cursor: 'pointer' }}>
                                <div className="neon-box" style={{ marginBottom: '16px', width: '40px', height: '40px' }}>
                                  <IconTarget />
                                </div>
                                <h3>AI Recommendation</h3>
                                <p>Follow the 30-Day roadmap to cover these fundamental gaps and improve your chance of getting an interview by 40%.</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {activeTab === 'skills' && (
                          <div className="full-width skills-tab-grid">
                            <div className="card">
                              <SkillsPanel data={strategistResult} />
                            </div>
                            <div className="card">
                              <ChartsPanel data={strategistResult} />
                            </div>
                          </div>
                        )}
                        {activeTab === 'roadmap' && (
                          <div className="card full-width">
                            <RoadmapPanel data={strategistResult} />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Download Bar removed - moved to header */}
                </section>
              )}
            </>
          )}

          {/* ══ Interview Simulator tab ══ */}
          {dashTab === 'interview' && (
            <InterviewSimulatorPage
              resumeJson={resumeJson}
              targetCompany={interviewContext.targetCompany}
              jobDescription={interviewContext.jobDescription}
              resumeFileName={interviewContext.resumeFileName || null}
            />
          )}

        </div>
      </main>
    </div>
  )
}
