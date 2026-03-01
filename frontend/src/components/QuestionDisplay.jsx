import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

const CATEGORY_COLORS = {
  'Technical':         { color: 'var(--accent-blue)',   bg: 'rgba(59,130,246,0.12)',   border: 'rgba(59,130,246,0.35)' },
  'Behavioral':        { color: 'var(--accent-green)',  bg: 'rgba(29,185,84,0.12)',    border: 'rgba(29,185,84,0.35)'  },
  'Project deep dive': { color: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.12)',   border: 'rgba(139,92,246,0.35)' },
  'Problem solving':   { color: 'var(--accent-orange)', bg: 'rgba(245,158,11,0.12)',   border: 'rgba(245,158,11,0.35)' },
}

function categoryStyle(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['Technical']
}

const PlayIcon = () => (
  <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
    <polygon points="2,1 11,6 2,11" />
  </svg>
)
const PauseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
    <rect x="2" y="1" width="3" height="10" rx="1" />
    <rect x="7" y="1" width="3" height="10" rx="1" />
  </svg>
)
const StopIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
    <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" />
  </svg>
)
const ReplayIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-3.78" />
  </svg>
)

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

function SpeedDropdown({ anchorRef, speechRate, onRateChange, onClose, onMouseEnter }) {
  const [pos, setPos] = useState(null)
  const popupRef = useRef(null)

  useEffect(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({
      bottom: window.innerHeight - rect.top + 6,
      right:  window.innerWidth  - rect.right,
    })
  }, [anchorRef])

  // close on Escape or outside click — but NOT when clicking inside the popup itself
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    function onOutside(e) {
      if (anchorRef.current && anchorRef.current.contains(e.target)) return
      if (popupRef.current  && popupRef.current.contains(e.target))  return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutside)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside)
    }
  }, [onClose, anchorRef])

  if (!pos) return null

  return createPortal(
    <div
      ref={popupRef}
      className="iv-speed-options-inner"
      style={{ position: 'fixed', bottom: pos.bottom, right: pos.right, zIndex: 9999 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onClose}
    >
      {SPEEDS.map(s => (
        <button
          key={s}
          className={`iv-speed-opt${speechRate === s ? ' active' : ''}`}
          onClick={() => { onRateChange?.(s); onClose() }}
        >
          {s === 1.0 ? '1×' : `${s}×`}
        </button>
      ))}
    </div>,
    document.body
  )
}

export default function QuestionDisplay({
  question, category, questionNumber, totalQuestions,
  isSpeaking, isPaused,
  speechRate = 1.0, onRateChange,
  onStop, onPause, onResume, onReplay,
}) {
  const style = categoryStyle(category)
  const [speedOpen, setSpeedOpen] = useState(false)
  const labelRef   = useRef(null)
  const closeTimer = useRef(null)

  const ttsLabel = isSpeaking
    ? (isPaused ? 'Paused' : 'Speaking…')
    : 'Interviewer'

  // Schedule a close — cancelled if mouse re-enters label or popup
  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setSpeedOpen(false), 120)
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  // Clean up timer on unmount
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  return (
    <div className="iv-question-display">

      {/* meta row */}
      <div className="iv-question-meta">
        <span
          className="iv-category-badge"
          style={{ color: style.color, background: style.bg, borderColor: style.border }}
        >
          {category}
        </span>
        <span className="iv-question-counter">
          Question {questionNumber} / {totalQuestions}
        </span>
      </div>

      {/* question bubble */}
      <div className="iv-question-bubble">

        <div className="iv-q-header">
          <div className="iv-interviewer-label">
            <span className="iv-interviewer-name">{ttsLabel}</span>
            {isSpeaking && !isPaused && (
              <span className="iv-speaking-indicator">
                <span className="iv-speaking-dot" />
                <span className="iv-speaking-dot" />
                <span className="iv-speaking-dot" />
              </span>
            )}
          </div>

          <div className="iv-tts-bar">
            {isSpeaking ? (
              isPaused ? (
                <button className="iv-tts-btn iv-tts-play" onClick={onResume} title="Resume"><PlayIcon /></button>
              ) : (
                <button className="iv-tts-btn iv-tts-pause" onClick={onPause} title="Pause"><PauseIcon /></button>
              )
            ) : (
              <button className="iv-tts-btn iv-tts-play" onClick={onReplay} title="Play"><PlayIcon /></button>
            )}

            {isSpeaking && (
              <button className="iv-tts-btn iv-tts-stop" onClick={onStop} title="Stop"><StopIcon /></button>
            )}

            {!isSpeaking && (
              <button className="iv-tts-btn iv-tts-replay" onClick={onReplay} title="Replay"><ReplayIcon /></button>
            )}

            {/* Speed control */}
            <div className="iv-speed-control">
              <span
                ref={labelRef}
                className="iv-speed-label"
                onMouseEnter={() => { cancelClose(); setSpeedOpen(true) }}
                onMouseLeave={scheduleClose}
              >
                {speechRate === 1.0 ? '1×' : `${speechRate}×`}
              </span>
              {speedOpen && (
                <SpeedDropdown
                  anchorRef={labelRef}
                  speechRate={speechRate}
                  onRateChange={onRateChange}
                  onClose={() => setSpeedOpen(false)}
                  onMouseEnter={cancelClose}
                />
              )}
            </div>
          </div>
        </div>

        <p className="iv-question-text">{question}</p>
      </div>
    </div>
  )
}
