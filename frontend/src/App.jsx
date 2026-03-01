import { useState, useRef, useCallback } from 'react'
import UploadCard from './components/UploadCard'
import ErrorBanner from './components/ErrorBanner'
import ProgressPanel from './components/ProgressPanel'
import ResumeCard from './components/ResumeCard'
import ScoutPanel from './components/ScoutPanel'
import SkillsPanel from './components/SkillsPanel'
import ChartsPanel from './components/ChartsPanel'
import RoadmapPanel from './components/RoadmapPanel'
import DownloadBar from './components/DownloadBar'

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
  // ── Upload state ────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Progress state ──────────────────────────────────────
  const [showProgress, setShowProgress] = useState(false)
  const [stages, setStages] = useState(initialStages())
  const [logs, setLogs] = useState([])  // [{ts, msg, type}]

  // ── Resume data ─────────────────────────────────────────
  const [resumeData, setResumeData] = useState(null)  // {name, contact}

  const [showResults, setShowResults] = useState(false)
  const [scoutResult, setScoutResult] = useState(null)
  const [strategistResult, setStrategistResult] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  // ── Error ────────────────────────────────────────────────
  const [error, setError] = useState(null)   // {title, detail}

  // ── Download ─────────────────────────────────────────────
  const [jobId, setJobId] = useState(null)
  const [showDownload, setShowDownload] = useState(false)

  // SSE ref so we can close it on error
  const evtSourceRef = useRef(null)

  // ── Helpers ──────────────────────────────────────────────
  function addLog(msg, type = 'plain') {
    const ts = new Date().toLocaleTimeString('en-US', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    setLogs(prev => [...prev, { ts, msg, type }])
  }

  function setStage(name, state) {
    setStages(prev => ({ ...prev, [name]: state }))
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

  // ── Submit handler ────────────────────────────────────────
  const handleSubmit = useCallback(async ({ file, targetCompany, jobDescription }) => {
    // Reset
    setError(null)
    setResumeData(null)
    setScoutResult(null)
    setStrategistResult(null)
    setShowResults(false)
    setActiveTab('overview')
    setShowDownload(false)
    setShowProgress(true)
    setStages(initialStages())
    setLogs([])
    setIsSubmitting(true)

    addLog('Uploading resume file…', 'info')

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
      addLog(`Job started: ${id}`, 'info')
    } catch (err) {
      setError({ title: 'Upload failed', detail: err.message })
      addLog(`Error: ${err.message}`, 'error')
      setIsSubmitting(false)
      return
    }

    connectStream(id)
  }, [])

  // ── SSE stream ────────────────────────────────────────────
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
      addLog(msg, 'info')
      if (stageMap[stage]) stageMap[stage]()
    })

    es.addEventListener('progress', e => {
      const data = JSON.parse(e.data)
      addLog(data.message || '', 'plain')
    })

    es.addEventListener('resume_data', e => {
      const data = JSON.parse(e.data)
      setResumeData(data)
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
    })

    es.addEventListener('error', e => {
      if (!e.data) {
        // This is a native network closure event (server ended the stream)
        // We can just close it gracefully on our end without an error banner
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
          // only log once
          if (evtSourceRef.current) {
            addLog('Pipeline complete.', 'ok')
            closeStream()
          }
        }
        return prev
      })
    }, 500)
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div id="root">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">⚡</div>
          <div className="sidebar-title">
            <h1>Career Analyst</h1>
            <p>Real-time Job Monitoring</p>
          </div>
        </div>

        <nav className="sidebar-menu">
          <div className="menu-item active">
            <span className="menu-icon">📊</span>
            Overview
            <div className="active-dot"></div>
          </div>
          <div className="menu-item">
            <span className="menu-icon">🎯</span>
            Target Roles
          </div>
          <div className="menu-item">
            <span className="menu-icon">⚙️</span>
            Settings
          </div>
        </nav>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="user-profile">
            <div className="user-details">
              <span>Logged in as</span>
              <strong>candidate@hire.me</strong>
            </div>
          </div>
        </header>

        <div className="workspace">
          <div className="page-title">
            <h2>Welcome Back</h2>
            <p>Monitor your career strategy and active analyses</p>
          </div>

          <UploadCard onSubmit={handleSubmit} isSubmitting={isSubmitting} />

          {error && <ErrorBanner title={error.title} detail={error.detail} />}

          {showProgress && (
            <div className="card mt-24">
              <ProgressPanel stages={stages} logs={logs} />
            </div>
          )}

          {resumeData && (
            <div className="card mt-24">
              <ResumeCard data={resumeData} />
            </div>
          )}

          {showResults && (
            <section className="mt-24">
              <nav className="tabs-nav">
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
                      <>
                        <div className="metrics-grid">
                          <div className="metric-card">
                            <div className="metric-header">
                              <div className="metric-icon icon-green">📈</div>
                              <span className="metric-badge" style={{ color: 'var(--accent-green)' }}>SCORE</span>
                            </div>
                            <div>
                              <div className="metric-value">{strategistResult?.score}%</div>
                              <div className="metric-label">Weighted Match Score</div>
                            </div>
                          </div>

                          <div className="metric-card">
                            <div className="metric-header">
                              <div className="metric-icon icon-blue">⚡</div>
                              <span className="metric-badge" style={{ color: 'var(--accent-blue)' }}>SKILLS</span>
                            </div>
                            <div>
                              <div className="metric-value">{strategistResult?.skills_map?.matched?.length || 0}</div>
                              <div className="metric-label">Matched Skills Found</div>
                            </div>
                          </div>

                          <div className="metric-card">
                            <div className="metric-header">
                              <div className="metric-icon icon-orange">⚠️</div>
                              <span className="metric-badge" style={{ color: 'var(--accent-orange)' }}>GAPS</span>
                            </div>
                            <div>
                              <div className="metric-value">{strategistResult?.skills_map?.missing?.length || 0}</div>
                              <div className="metric-label">Missing Core Skills</div>
                            </div>
                          </div>
                        </div>

                        <div className="section-heading">Detailed Summary</div>
                        <div className="content-grid">
                          <div className="action-card">
                            <div className="metric-icon icon-green" style={{ marginBottom: '16px' }}>✨</div>
                            <h3>Match Breakdown</h3>
                            <p>{strategistResult?.gap_summary || "Based on the provided job description..."}</p>
                          </div>
                          <div className="action-card">
                            <div className="metric-icon icon-purple" style={{ marginBottom: '16px' }}>🎯</div>
                            <h3>AI Recommendation</h3>
                            <p>Follow the 30-Day roadmap to cover these fundamental gaps and improve your chance of getting an interview by 40%.</p>
                          </div>
                        </div>
                      </>
                    )}
                    {activeTab === 'skills' && (
                      <>
                        <div className="card full-width">
                          <SkillsPanel data={strategistResult} />
                        </div>
                        <div className="card full-width">
                          <ChartsPanel data={strategistResult} />
                        </div>
                      </>
                    )}
                    {activeTab === 'roadmap' && (
                      <div className="card full-width">
                        <RoadmapPanel data={strategistResult} />
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {showDownload && jobId && <DownloadBar jobId={jobId} />}
        </div>
      </main>
    </div>
  )
}
