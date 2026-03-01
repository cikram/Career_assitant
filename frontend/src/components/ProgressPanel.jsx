import { useRef, useEffect } from 'react'

const STAGES = [
  { key: 'ocr',        label: 'OCR & Parse',   num: '1' },
  { key: 'agents',     label: 'Agents Start',  num: '2' },
  { key: 'scout',      label: 'Scout Agent',   num: '3' },
  { key: 'strategist', label: 'Strategist',    num: '4' },
  { key: 'done',       label: 'Complete',      num: '5' },
]

export default function ProgressPanel({ stages, logs }) {
  const feedRef = useRef(null)

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [logs])

  return (
    <>
      <div className="progress-header">
        <div className="spinner" />
        <h2>Processing Resume</h2>
      </div>

      <div className="stage-track">
        {STAGES.map(({ key, label, num }) => {
          const state = stages[key] || 'pending'
          return (
            <div key={key} className={`stage ${state}`} data-stage={key}>
              <div className="stage-dot">
                {state === 'done' ? '✓' : num}
              </div>
              <div className="stage-label">{label}</div>
            </div>
          )
        })}
      </div>

      <div className="log-feed" ref={feedRef}>
        {logs.map((entry, i) => (
          <div key={i} className={`log-line log-${entry.type}`}>
            [{entry.ts}] {entry.msg}
          </div>
        ))}
      </div>
    </>
  )
}
