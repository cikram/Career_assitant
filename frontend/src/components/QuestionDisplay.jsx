import React from 'react'

const CATEGORY_COLORS = {
  'Technical':         { color: 'var(--accent-blue)',   bg: 'rgba(59,130,246,0.12)',   border: 'rgba(59,130,246,0.35)' },
  'Behavioral':        { color: 'var(--accent-green)',  bg: 'rgba(29,185,84,0.12)',    border: 'rgba(29,185,84,0.35)'  },
  'Project deep dive': { color: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.12)',   border: 'rgba(139,92,246,0.35)' },
  'Problem solving':   { color: 'var(--accent-orange)', bg: 'rgba(245,158,11,0.12)',   border: 'rgba(245,158,11,0.35)' },
}

function categoryStyle(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['Technical']
}

/* SVG icons — inline so no extra dependency */
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

export default function QuestionDisplay({
  question, category, questionNumber, totalQuestions,
  isSpeaking, isPaused,
  onStop, onPause, onResume, onReplay,
}) {
  const style = categoryStyle(category)

  // derive TTS state label
  const ttsLabel = isSpeaking
    ? (isPaused ? 'Paused' : 'Speaking…')
    : 'Interviewer'

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

        {/* header: label + dots + control bar */}
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

          {/* TTS control bar — always shown once a question is active */}
          <div className="iv-tts-bar">
            {/* Play / Pause toggle */}
            {isSpeaking ? (
              isPaused ? (
                <button className="iv-tts-btn iv-tts-play" onClick={onResume} title="Resume">
                  <PlayIcon />
                </button>
              ) : (
                <button className="iv-tts-btn iv-tts-pause" onClick={onPause} title="Pause">
                  <PauseIcon />
                </button>
              )
            ) : (
              <button className="iv-tts-btn iv-tts-play" onClick={onReplay} title="Play">
                <PlayIcon />
              </button>
            )}

            {/* Stop — only while something is playing or paused */}
            {(isSpeaking) && (
              <button className="iv-tts-btn iv-tts-stop" onClick={onStop} title="Stop">
                <StopIcon />
              </button>
            )}

            {/* Replay — only when idle (already finished) */}
            {!isSpeaking && (
              <button className="iv-tts-btn iv-tts-replay" onClick={onReplay} title="Replay">
                <ReplayIcon />
              </button>
            )}
          </div>
        </div>

        <p className="iv-question-text">{question}</p>
      </div>
    </div>
  )
}
