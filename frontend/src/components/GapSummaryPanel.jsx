const TIER_META = {
  required:     { label: 'Required',     color: '#E74C3C', bg: 'rgba(231,76,60,0.15)'  },
  preferred:    { label: 'Preferred',    color: '#F39C12', bg: 'rgba(243,156,18,0.15)' },
  nice_to_have: { label: 'Nice to Have', color: '#3498DB', bg: 'rgba(52,152,219,0.15)' },
}

export default function GapSummaryPanel({ data }) {
  const score     = Math.round(data.overall_score || 0)
  const breakdown = data.breakdown || {}
  const matched   = data.matched_skills || []
  const missing   = data.missing_skills || []

  const scoreColor = score >= 80 ? '#27AE60' : score >= 55 ? '#F39C12' : '#E74C3C'
  const scoreLabel = score >= 80 ? 'Strong Fit' : score >= 55 ? 'Moderate Fit' : 'Needs Work'

  return (
    <>
      <div className="panel-title">📊 Gap Analysis Summary</div>

      <div className="gap-summary-card">
        {/* Score badge */}
        <div className="gap-summary-header">
          <div className="gap-summary-title">
            How well does your profile match the job?
          </div>
          <div className="gap-summary-score-badge" style={{ color: scoreColor, borderColor: scoreColor }}>
            <span className="gap-summary-score-num">{score}%</span>
            <span className="gap-summary-score-label">{scoreLabel}</span>
          </div>
        </div>

        {/* Tier bars */}
        {Object.keys(breakdown).length > 0 && (
          <div className="gap-tier-bars">
            {Object.entries(breakdown).map(([tier, info]) => {
              const meta = TIER_META[tier]
              if (!meta) return null
              const matchedCount = info.matched_count ?? (Array.isArray(info.matched) ? info.matched.length : 0)
              const missingCount = Array.isArray(info.missing) ? info.missing.length : 0
              const total = matchedCount + missingCount
              const pct = total > 0 ? Math.round((matchedCount / total) * 100) : 0
              return (
                <div key={tier} className="gap-tier-row">
                  <div className="gap-tier-label-row">
                    <span className="gap-tier-name" style={{ color: meta.color }}>{meta.label}</span>
                    <span className="gap-tier-counts">
                      <span style={{ color: '#6ee29a' }}>{matchedCount} matched</span>
                      {missingCount > 0 && <span style={{ color: '#f79083' }}> · {missingCount} missing</span>}
                    </span>
                    <span className="gap-tier-pct" style={{ color: meta.color }}>{pct}%</span>
                  </div>
                  <div className="gap-tier-bar-track">
                    <div className="gap-tier-bar-fill" style={{ width: `${pct}%`, background: meta.color }} />
                    {missingCount > 0 && (
                      <div className="gap-tier-bar-missing" style={{ width: `${100 - pct}%`, background: meta.bg }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Strengths vs gaps two-col */}
        {(matched.length > 0 || missing.length > 0) && (
          <div className="gap-two-col">
            {matched.length > 0 && (
              <div className="gap-col gap-col-strength">
                <div className="gap-col-header">
                  <span className="gap-col-icon">✓</span> Strengths
                </div>
                <div className="gap-col-chips">
                  {matched.slice(0, 8).map((s, i) => (
                    <span key={i} className="gap-chip gap-chip-match">{s}</span>
                  ))}
                  {matched.length > 8 && (
                    <span className="gap-chip-more">+{matched.length - 8} more</span>
                  )}
                </div>
              </div>
            )}
            {missing.length > 0 && (
              <div className="gap-col gap-col-missing">
                <div className="gap-col-header">
                  <span className="gap-col-icon">✗</span> Gaps to Close
                </div>
                <div className="gap-col-chips">
                  {missing.slice(0, 8).map((s, i) => (
                    <span key={i} className="gap-chip gap-chip-miss">{s}</span>
                  ))}
                  {missing.length > 8 && (
                    <span className="gap-chip-more">+{missing.length - 8} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
