import { useState, useRef, useCallback } from 'react'
import Header from './components/Header'
import UploadCard from './components/UploadCard'
import ErrorBanner from './components/ErrorBanner'
import ProgressPanel from './components/ProgressPanel'
import ResumeCard from './components/ResumeCard'
import ScoutPanel from './components/ScoutPanel'
import ScorePanel from './components/ScorePanel'
import SkillsPanel from './components/SkillsPanel'
import ChartsPanel from './components/ChartsPanel'
import GapSummaryPanel from './components/GapSummaryPanel'
import RoadmapPanel from './components/RoadmapPanel'
import DownloadBar from './components/DownloadBar'

// Stage keys that match backend event stage values
const STAGE_KEYS = ['ocr', 'agents', 'scout', 'strategist', 'done']

function initialStages() {
  return {
    ocr:        'pending',   // 'pending' | 'active' | 'done' | 'error'
    agents:     'pending',
    scout:      'pending',
    strategist: 'pending',
    done:       'pending',
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

  // ── Results ──────────────────────────────────────────────
  const [showResults, setShowResults] = useState(false)
  const [scoutResult, setScoutResult] = useState(null)
  const [strategistResult, setStrategistResult] = useState(null)

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
    ocr:             () => setStage('ocr', 'active'),
    ocr_done:        () => setStage('ocr', 'done'),
    agents:          () => setStage('agents', 'active'),
    scout:           () => setStage('scout', 'active'),
    scout_done:      () => setStage('scout', 'done'),
    strategist:      () => setStage('strategist', 'active'),
    strategist_done: () => setStage('strategist', 'done'),
    done:            () => {
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
      try {
        const data = JSON.parse(e.data)
        setError({ title: data.message || 'Pipeline error', detail: data.detail || '' })
        addLog(`Error: ${data.message || 'Pipeline error'}`, 'error')
      } catch {
        setError({ title: 'Stream error', detail: e.data || 'Unknown error' })
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
          addLog('Pipeline complete.', 'ok')
          closeStream()
        }
        return prev
      })
    }, 500)
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <Header />
      <main>
        <div className="container">
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
              <div className="results-grid">
                {scoutResult && (
                  <div className="card full-width">
                    <ScoutPanel data={scoutResult} />
                  </div>
                )}
                {strategistResult && (
                  <>
                    <div className="card">
                      <ScorePanel data={strategistResult} />
                    </div>
                    <div className="card">
                      <SkillsPanel data={strategistResult} />
                    </div>
                    <div className="card full-width">
                      <ChartsPanel data={strategistResult} />
                    </div>
                    <div className="card full-width">
                      <GapSummaryPanel data={strategistResult} />
                    </div>
                    <div className="card full-width">
                      <RoadmapPanel data={strategistResult} />
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {showDownload && jobId && <DownloadBar jobId={jobId} />}
        </div>
      </main>
    </>
  )
}
