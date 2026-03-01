import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts'
import { IconPresentation } from './Icons'

const COLORS = {
  accent: '#3b82f6',
  success: '#1DB954',
  warning: '#f59e0b',
  danger: '#ef4444',
  background: 'rgba(255, 255, 255, 0.05)',
  text: 'rgba(255, 255, 255, 0.6)',
  grid: 'rgba(255, 255, 255, 0.08)'
}

export default function ChartsPanel({ data }) {
  const score = data.overall_score || 0
  const bd = data.breakdown || {}

  // 1. Donut Data
  const donutData = [
    { name: 'Match', value: score, color: COLORS.success },
    { name: 'Remaining', value: 100 - score, color: 'rgba(255,255,255,0.05)' }
  ]

  // 2. Tier Data (Coverage %)
  const tierData = Object.entries(bd).map(([key, val]) => ({
    name: key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    coverage: val.tier_pct
  }))

  // 3. Matched vs Missing Counts
  const countsData = Object.entries(bd).map(([key, val]) => ({
    name: key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    matched: val.matched_count,
    missing: val.total_count - val.matched_count
  }))

  // 4. Radar Data (Top Matched Skills)
  const topSkills = data.matched_skills?.slice(0, 8).map(s => ({
    subject: s.length > 12 ? s.substring(0, 10) + '..' : s,
    val: 80 + Math.random() * 20 // Simulated strength for visualization
  })) || []

  return (
    <>
      <div className="panel-title"><IconPresentation /> Visual Analysis</div>
      <div className="charts-grid">

        {/* Chart 1: Overall Match (Donut) */}
        <div className="chart-box glass-card">
          <div className="chart-label">Overall Match Score</div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#1DB954" stopOpacity={1} />
                  <stop offset="100%" stopColor="#0a5c2a" stopOpacity={1} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <Pie
                data={donutData}
                innerRadius="68%"
                outerRadius="88%"
                paddingAngle={0}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                {donutData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? "url(#scoreGradient)" : entry.color}
                    style={{ filter: index === 0 ? 'url(#glow)' : 'none' }}
                  />
                ))}
              </Pie>
              <text
                x="50%"
                y="48%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.02em' }}
              >
                {score}%
              </text>
              <text
                x="50%"
                y="62%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.4)"
                style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}
              >
                Match
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Tier Coverage (Bar) */}
        <div className="chart-box glass-card">
          <div className="chart-label">Coverage by Tier (%)</div>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={tierData} layout="vertical" margin={{ left: 10, right: 30, top: 10 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                </linearGradient>
              </defs>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis
                type="category"
                dataKey="name"
                stroke={COLORS.text}
                fontSize={11}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
              />
              <Bar dataKey="coverage" fill="url(#barGrad)" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Matched vs Missing (Grouped Bar) */}
        <div className="chart-box glass-card">
          <div className="chart-label">Skill Counts by Tier</div>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={countsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="name" stroke={COLORS.text} fontSize={14} fontWeight={700} axisLine={false} tickLine={false} />
              <YAxis stroke={COLORS.text} fontSize={14} fontWeight={700} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', fontSize: '14px' }}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '13px', paddingBottom: '35px', fontWeight: 600 }} />
              <Bar name="Matched" dataKey="matched" fill="#1DB954" radius={[5, 5, 0, 0]} barSize={30} />
              <Bar name="Missing" dataKey="missing" fill="#ef4444" radius={[5, 5, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Skill Radar */}
        <div className="chart-box glass-card">
          <div className="chart-label">Candidate Skills Overview</div>
          {topSkills.length >= 3 ? (
            <ResponsiveContainer width="100%" height="95%">
              <RadarChart cx="50%" cy="50%" outerRadius="90%" data={topSkills}>
                <PolarGrid stroke={COLORS.grid} />
                <PolarAngleAxis dataKey="subject" stroke={COLORS.text} fontSize={13} fontWeight={700} />
                <Radar
                  name="Skills"
                  dataKey="val"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.25}
                  strokeWidth={3}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart-state">Add more skills to see radar</div>
          )}
        </div>

      </div>
    </>
  )
}
