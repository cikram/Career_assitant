const CHART_CONFIGS = [
  { key: 'donut',          label: 'Overall Match' },
  { key: 'tier_bar',       label: 'Tier Breakdown' },
  { key: 'matched_missing', label: 'Matched vs Missing' },
  { key: 'radar',          label: 'Skill Radar' },
]

export default function ChartsPanel({ data }) {
  const chartData = data.chart_data || {}

  return (
    <>
      <div className="panel-title">📊 Visual Analysis</div>
      <div className="charts-grid">
        {CHART_CONFIGS.map(({ key, label }) => {
          const b64 = chartData[key]
          if (!b64) return null
          return (
            <div key={key} className="chart-box">
              <img
                src={`data:image/png;base64,${b64}`}
                alt={label}
                title={label}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}
