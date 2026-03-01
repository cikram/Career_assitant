import React from 'react'

function gradeColor(score) {
  if (score >= 80) return 'var(--accent-green)'
  if (score >= 65) return 'var(--accent-blue)'
  if (score >= 50) return 'var(--accent-orange)'
  return 'var(--danger)'
}

function HireTag({ recommendation }) {
  const rec = (recommendation || '').toLowerCase()
  let color = 'var(--text-muted)'
  if (rec.includes('strong hire') || rec.includes('yes'))         color = 'var(--accent-green)'
  else if (rec.includes('hire'))                                   color = 'var(--accent-blue)'
  else if (rec.includes('no hire') || rec.includes('not'))        color = 'var(--danger)'
  return (
    <span className="iv-hire-tag" style={{ color }}>
      {recommendation || 'Pending'}
    </span>
  )
}

export default function InterviewReport({ report, session }) {
  if (!report) return null

  const score = report.overall_score ?? 0
  const color = gradeColor(score)
  const circumference = 2 * Math.PI * 38
  const filled = circumference * (score / 100)

  return (
    <div className="iv-report">
      <div className="iv-report-header">
        <h2 className="iv-report-title">Interview Report</h2>
        {session && (
          <p className="iv-report-meta">
            {session.candidateName} &nbsp;·&nbsp; {session.targetRole} &nbsp;·&nbsp; {session.targetCompany}
          </p>
        )}
      </div>

      {/* Score ring + grade + recommendation */}
      <div className="iv-report-hero">
        <div className="iv-score-ring-wrap">
          <svg className="iv-score-ring" viewBox="0 0 90 90">
            <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
            <circle
              cx="45" cy="45" r="38" fill="none"
              stroke={color}
              strokeWidth="6"
              strokeDasharray={`${filled} ${circumference - filled}`}
              strokeDashoffset={circumference * 0.25}
              strokeLinecap="round"
            />
            <text x="45" y="48" textAnchor="middle" dominantBaseline="middle"
              fill={color} fontSize="18" fontWeight="800">{score}</text>
          </svg>
          <div className="iv-score-ring-label">out of 100</div>
        </div>

        <div className="iv-report-summary">
          <div className="iv-grade-row">
            <span className="iv-grade-label">Grade</span>
            <span className="iv-grade-value" style={{ color }}>{report.grade || '—'}</span>
          </div>
          <div className="iv-grade-row">
            <span className="iv-grade-label">Hire Recommendation</span>
            <HireTag recommendation={report.hire_recommendation} />
          </div>
          {report.executive_summary && (
            <p className="iv-executive-summary">{report.executive_summary}</p>
          )}
        </div>
      </div>

      {/* Q breakdown */}
      {report.question_breakdown?.length > 0 && (
        <div className="iv-section">
          <div className="iv-section-title">Question Breakdown</div>
          <div className="iv-breakdown-list">
            {report.question_breakdown.map((qb, i) => (
              <div className="iv-breakdown-row" key={i}>
                <div className="iv-breakdown-num" style={{ color: gradeColor(qb.score) }}>
                  Q{qb.question_number}
                </div>
                <div className="iv-breakdown-body">
                  <span className="iv-breakdown-cat">{qb.category}</span>
                  <span className="iv-breakdown-summary">{qb.summary}</span>
                </div>
                <div className="iv-breakdown-score" style={{ color: gradeColor(qb.score) }}>
                  {qb.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths / Weaknesses */}
      <div className="iv-sw-grid">
        {report.strengths?.length > 0 && (
          <div className="iv-sw-card iv-sw-card--strengths">
            <div className="iv-sw-title" style={{ color: 'var(--accent-green)' }}>Strengths</div>
            <ul className="iv-sw-list">
              {report.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
        {report.weaknesses?.length > 0 && (
          <div className="iv-sw-card iv-sw-card--weaknesses">
            <div className="iv-sw-title" style={{ color: 'var(--danger)' }}>Weaknesses</div>
            <ul className="iv-sw-list">
              {report.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Areas to improve + prep topics */}
      {(report.areas_to_improve?.length > 0 || report.preparation_topics?.length > 0) && (
        <div className="iv-sw-grid">
          {report.areas_to_improve?.length > 0 && (
            <div className="iv-sw-card">
              <div className="iv-sw-title" style={{ color: 'var(--accent-orange)' }}>Areas to Improve</div>
              <ul className="iv-sw-list">
                {report.areas_to_improve.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
          {report.preparation_topics?.length > 0 && (
            <div className="iv-sw-card">
              <div className="iv-sw-title" style={{ color: 'var(--accent-blue)' }}>Preparation Topics</div>
              <ul className="iv-sw-list">
                {report.preparation_topics.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
