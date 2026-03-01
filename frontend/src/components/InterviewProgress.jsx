import React from 'react'

export default function InterviewProgress({ questions, currentIndex, responses }) {
  return (
    <div className="iv-progress-track">
      {questions.map((q, i) => {
        const isDone    = i < currentIndex
        const isActive  = i === currentIndex
        const response  = responses[i]
        const score     = response?.evaluation?.overall_score

        let dotClass = 'iv-progress-dot'
        if (isDone)   dotClass += ' done'
        if (isActive) dotClass += ' active'

        return (
          <div className="iv-progress-step" key={i}>
            <div className={dotClass}>
              {isDone ? (
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: score >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                  {score !== undefined ? score : '✓'}
                </span>
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            <div className="iv-progress-label">Q{i + 1}</div>
          </div>
        )
      })}
    </div>
  )
}
