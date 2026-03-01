import React from 'react'

export default function TranscriptDisplay({ transcript, evaluation }) {
  if (!transcript) return null

  return (
    <div className="iv-transcript-section">
      <div className="iv-transcript-box">
        <div className="iv-transcript-label">Your Answer</div>
        <p className="iv-transcript-text">{transcript}</p>
      </div>

      {evaluation && (
        <div className="iv-eval-box">
          <div className="iv-eval-scores">
            {[
              { key: 'technical_accuracy',    label: 'Technical',    color: 'var(--accent-blue)'   },
              { key: 'communication_clarity', label: 'Clarity',      color: 'var(--accent-green)'  },
              { key: 'confidence',            label: 'Confidence',   color: 'var(--accent-purple)' },
              { key: 'relevance',             label: 'Relevance',    color: 'var(--accent-orange)' },
            ].map(({ key, label, color }) => (
              <div className="iv-score-pill" key={key}>
                <span className="iv-score-pill-label">{label}</span>
                <span className="iv-score-pill-value" style={{ color }}>{evaluation[key] ?? '—'}</span>
              </div>
            ))}
          </div>

          {evaluation.brief_feedback && (
            <div className="iv-feedback-text">
              <span className="iv-feedback-icon">◈</span>
              {evaluation.brief_feedback}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
