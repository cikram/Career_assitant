const TIER_META = {
  required:     { label: 'Required',     weight: '1.0' },
  preferred:    { label: 'Preferred',    weight: '0.5' },
  nice_to_have: { label: 'Nice to Have', weight: '0.25' },
}

export default function ScorePanel({ data }) {
  const score = Math.round(data.overall_score || 0)
  const breakdown = data.breakdown || {}

  return (
    <>
      <div className="panel-title">🎯 Match Score</div>

      <div className="score-display">
        <div className="score-number">{score}%</div>
        <div className="score-label">
          {data.target_role && <span>{data.target_role}</span>}
          {data.target_role && data.company && <span> @ </span>}
          {data.company && <span>{data.company}</span>}
        </div>
      </div>

      <div className="score-bar-wrap">
        <div className="score-bar-fill" style={{ width: `${score}%` }} />
      </div>

      <table className="breakdown-table">
        <thead>
          <tr>
            <th>Tier</th>
            <th>Matched</th>
            <th>%</th>
            <th>Weight</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(breakdown).map(([tier, info]) => {
            const meta = TIER_META[tier] || { label: tier, weight: '-' }
            const matched = info.matched_count ?? (Array.isArray(info.matched) ? info.matched.length : 0)
            const total = info.total_count ?? (
              Array.isArray(info.matched) && Array.isArray(info.missing)
                ? info.matched.length + info.missing.length
                : 0
            )
            const pct = total > 0 ? Math.round((matched / total) * 100) : 0
            return (
              <tr key={tier}>
                <td><span className="chip chip-tier">{meta.label}</span></td>
                <td>{matched} / {total}</td>
                <td>{pct}%</td>
                <td>{meta.weight}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
