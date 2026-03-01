import React from 'react'

const CATEGORY_COLORS = {
  'Technical':         { color: 'var(--accent-blue)',   bg: 'rgba(59,130,246,0.12)',   border: 'rgba(59,130,246,0.35)' },
  'Behavioral':        { color: 'var(--accent-green)',  bg: 'rgba(29,185,84,0.12)',    border: 'rgba(29,185,84,0.35)'  },
  'Project deep dive': { color: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.12)',   border: 'rgba(139,92,246,0.35)' },
  'Problem solving':   { color: 'var(--accent-orange)', bg: 'rgba(245,158,11,0.12)',   border: 'rgba(245,158,11,0.35)' },
}

function categoryStyle(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['Technical']
}

export default function QuestionDisplay({ question, category, questionNumber, totalQuestions, isSpeaking }) {
  const style = categoryStyle(category)
  return (
    <div className="iv-question-display">
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
      <div className="iv-question-bubble">
        <div className="iv-interviewer-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Interviewer
          {isSpeaking && (
            <span className="iv-speaking-indicator" title="Speaking…">
              <span className="iv-speaking-dot" />
              <span className="iv-speaking-dot" />
              <span className="iv-speaking-dot" />
            </span>
          )}
        </div>
        <p className="iv-question-text">{question}</p>
      </div>
    </div>
  )
}
