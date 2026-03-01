import { useState } from 'react'

// ── Parser ────────────────────────────────────────────────────────────────────
function parseRoadmap(markdown) {
  if (!markdown) return { sections: [] }

  const lines = markdown.split('\n')
  const sections = []
  let current = null

  const flush = () => { if (current) sections.push(current) }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const weekMatch = line.match(/^####\s+Week\s+(\d+)[:\s]+(.+)/i)
    if (weekMatch) {
      flush()
      current = { type: 'week', week: parseInt(weekMatch[1], 10), theme: weekMatch[2].trim(), items: [] }
      continue
    }

    if (line.startsWith('### ')) {
      flush()
      const title = line.slice(4).trim()
      // Skip the top-level roadmap heading — it's redundant with the panel title
      if (/30.day/i.test(title)) continue
      current = { type: 'section', title, items: [] }
      continue
    }

    if ((line.startsWith('- ') || line.startsWith('* ')) && current) {
      current.items.push(line.slice(2).trim())
      continue
    }

    if (current && !line.startsWith('#')) {
      current.items.push({ text: line, plain: true })
    }
  }
  flush()

  return { sections }
}

// ── Colors ────────────────────────────────────────────────────────────────────
const WEEK_COLORS = [
  { accent: '#4A90D9', bg: 'rgba(74,144,217,0.12)', border: 'rgba(74,144,217,0.35)' },
  { accent: '#9B59B6', bg: 'rgba(155,89,182,0.12)', border: 'rgba(155,89,182,0.35)' },
  { accent: '#27AE60', bg: 'rgba(39,174,96,0.12)', border: 'rgba(39,174,96,0.35)' },
  { accent: '#F39C12', bg: 'rgba(243,156,18,0.12)', border: 'rgba(243,156,18,0.35)' },
]

const SECTION_COLOR = { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' }

function weekColor(n) { return WEEK_COLORS[(n - 1) % WEEK_COLORS.length] }

// ── Week progress bar ─────────────────────────────────────────────────────────
function WeekProgressBar({ weeks }) {
  if (!weeks.length) return null
  return (
    <div className="roadmap-progress-track">
      {weeks.map((w, i) => {
        const c = weekColor(w.week)
        return (
          <div key={i} className="roadmap-progress-step">
            <div className="roadmap-progress-dot"
              style={{ background: c.accent, boxShadow: `0 0 10px ${c.accent}66` }}>
              {w.week}
            </div>
            <div className="roadmap-progress-label" style={{ color: c.accent }}>Week {w.week}</div>
            <div className="roadmap-progress-theme">{w.theme}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Item text renderer ────────────────────────────────────────────────────────
function ItemText({ item }) {
  const text = typeof item === 'string' ? item : item.text
  const isPlain = typeof item === 'object' && item.plain

  const dayMatch = text.match(/^(Day\s[\d\-–]+)[:\s]+(.+)$/i)
  if (dayMatch && !isPlain) {
    const [, dayLabel, rest] = dayMatch
    const [topic, ...details] = rest.split(/\s[—–-]{1,2}\s/)
    return (
      <span className="roadmap-item-content">
        <span className="roadmap-item-day">{dayLabel}</span>
        <span className="roadmap-item-topic">{topic.trim()}</span>
        {details.length > 0 && (
          <span className="roadmap-item-detail">{details.join(' — ').trim()}</span>
        )}
      </span>
    )
  }

  return <span className="roadmap-item-content">{text}</span>
}

// ── Week accordion card ───────────────────────────────────────────────────────
function WeekCard({ section, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  const c = weekColor(section.week)

  return (
    <div className="roadmap-week-card" style={{ borderColor: c.border, '--week-accent': c.accent }}>
      <button className="roadmap-week-header" style={{ background: c.bg }}
        onClick={() => setOpen(o => !o)}>
        <div className="roadmap-week-header-left">
          <span className="roadmap-week-badge" style={{ background: c.accent }}>Week {section.week}</span>
          <span className="roadmap-week-theme" style={{ color: c.accent }}>{section.theme}</span>
        </div>
        <span className="roadmap-week-chevron" style={{ color: c.accent }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="roadmap-week-body">
          {section.items.map((item, i) => (
            <div key={i} className="roadmap-item-row">
              <span className="roadmap-item-dot" style={{ background: c.accent }} />
              <ItemText item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Week colours for milestone badges ────────────────────────────────────────
const MILESTONE_WEEK_COLORS = ['#4A90D9', '#9B59B6', '#27AE60', '#F39C12']

// ── Milestones body ───────────────────────────────────────────────────────────
function MilestonesBody({ items }) {
  return (
    <div className="milestone-timeline">
      {items.map((item, i) => {
        const text = typeof item === 'string' ? item : item.text
        const wm = text.match(/^End of Week\s*(\d+)[:\s]+(.+)/i)
        const weekNum = wm ? parseInt(wm[1], 10) : null
        const color = MILESTONE_WEEK_COLORS[(weekNum ? weekNum - 1 : i) % MILESTONE_WEEK_COLORS.length]
        const isLast = i === items.length - 1
        return (
          <div key={i} className="milestone-row">
            {/* Left spine */}
            <div className="milestone-spine">
              <div className="milestone-badge" style={{ background: color, boxShadow: `0 0 10px ${color}55` }}>
                {weekNum ? `W${weekNum}` : i + 1}
              </div>
              {!isLast && <div className="milestone-spine-line" style={{ background: `${color}40` }} />}
            </div>
            {/* Content */}
            <div className="milestone-body" style={{ borderColor: `${color}30` }}>
              {wm ? (
                <>
                  <div className="milestone-week-label" style={{ color }}>End of Week {weekNum}</div>
                  <div className="milestone-outcome">{wm[2].trim()}</div>
                </>
              ) : (
                <div className="milestone-outcome">{text}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Resource type detection ───────────────────────────────────────────────────
const RESOURCE_PATTERNS = [
  { re: /^(course|video|mooc|udemy|coursera|pluralsight|linkedin learning)[:\s]/i, icon: '🎓', color: '#4A90D9', label: 'Course' },
  { re: /^(book|read|textbook)[:\s]/i, icon: '📖', color: '#9B59B6', label: 'Book' },
  { re: /^(tool|library|framework|package|github|repo)[:\s]/i, icon: '🔧', color: '#27AE60', label: 'Tool' },
  { re: /^(article|blog|docs|documentation)[:\s]/i, icon: '📄', color: '#F39C12', label: 'Article' },
  { re: /^(project|practice|exercise|challenge)[:\s]/i, icon: '💡', color: '#E74C3C', label: 'Practice' },
  { re: /https?:\/\//i, icon: '🔗', color: '#4A90D9', label: 'Link' },
]

function classifyResource(text) {
  for (const p of RESOURCE_PATTERNS) {
    if (p.re.test(text)) return p
  }
  return { icon: '📌', color: 'rgba(255,255,255,0.4)', label: null }
}

// ── Resources body ────────────────────────────────────────────────────────────
function ResourcesBody({ items }) {
  // Group by detected category prefix (e.g. "**Python:**", "**MLOps:**")
  const groups = []
  let currentGroup = null

  for (const raw of items) {
    const text = typeof raw === 'string' ? raw : raw.text
    // Bold category header: **Skill:** or **Skill Name**
    const groupMatch = text.match(/^\*{1,2}([^*:]+)[*:]{1,3}\s*(.*)$/)
    if (groupMatch && !groupMatch[2].trim()) {
      // Pure header line with no trailing content
      currentGroup = { header: groupMatch[1].trim(), entries: [] }
      groups.push(currentGroup)
      continue
    }
    // If no group yet, create a default one
    if (!currentGroup) {
      currentGroup = { header: null, entries: [] }
      groups.push(currentGroup)
    }
    currentGroup.entries.push(text)
  }

  // If everything ended up in one ungrouped block, just flat-render
  const allFlat = groups.length === 1 && !groups[0].header

  if (allFlat) {
    return (
      <div className="resource-cards">
        {groups[0].entries.map((text, i) => {
          const { icon, color, label } = classifyResource(text)
          // Strip leading type prefix if present (e.g. "Course: ...")
          const clean = text.replace(/^(course|book|tool|article|project|practice)[:\s]+/i, '').trim()
          const urlMatch = clean.match(/https?:\/\/\S+/)
          const displayText = urlMatch ? clean.replace(urlMatch[0], '').trim() || urlMatch[0] : clean
          return (
            <div key={i} className="resource-card" style={{ borderColor: `${color}40` }}>
              <span className="resource-icon" style={{ background: `${color}20`, color }}>{icon}</span>
              <div className="resource-text">
                {label && <span className="resource-type-badge" style={{ color, borderColor: `${color}50` }}>{label}</span>}
                {urlMatch
                  ? <a href={urlMatch[0]} target="_blank" rel="noopener noreferrer" className="resource-link">{displayText || urlMatch[0]}</a>
                  : <span className="resource-desc">{displayText}</span>
                }
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="resource-groups">
      {groups.map((g, gi) => (
        <div key={gi} className="resource-group">
          {g.header && <div className="resource-group-header">{g.header}</div>}
          <div className="resource-cards">
            {g.entries.map((text, i) => {
              const { icon, color, label } = classifyResource(text)
              const clean = text.replace(/^(course|book|tool|article|project|practice)[:\s]+/i, '').trim()
              const urlMatch = clean.match(/https?:\/\/\S+/)
              const displayText = urlMatch ? clean.replace(urlMatch[0], '').trim() || urlMatch[0] : clean
              return (
                <div key={i} className="resource-card" style={{ borderColor: `${color}40` }}>
                  <span className="resource-icon" style={{ background: `${color}20`, color }}>{icon}</span>
                  <div className="resource-text">
                    {label && <span className="resource-type-badge" style={{ color, borderColor: `${color}50` }}>{label}</span>}
                    {urlMatch
                      ? <a href={urlMatch[0]} target="_blank" rel="noopener noreferrer" className="resource-link">{displayText || urlMatch[0]}</a>
                      : <span className="resource-desc">{displayText}</span>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Time commitment body ──────────────────────────────────────────────────────

// Detect period keywords to assign icon + colour
const TIME_PERIODS = [
  { re: /weekend/i, icon: '🌅', color: '#9B59B6', label: 'Weekend' },
  { re: /saturday|sunday/i, icon: '🌅', color: '#9B59B6', label: 'Weekend' },
  { re: /morning/i, icon: '☀️', color: '#F39C12', label: 'Morning' },
  { re: /evening|night/i, icon: '🌙', color: '#4A90D9', label: 'Evening' },
  { re: /afternoon/i, icon: '🌤', color: '#27AE60', label: 'Afternoon' },
  { re: /weekday|mon|tue|wed|thu|fri/i, icon: '📅', color: '#4A90D9', label: 'Weekdays' },
  { re: /total|overall|per week/i, icon: '📊', color: '#E74C3C', label: 'Total' },
  { re: /tip|note|recommend/i, icon: '💡', color: '#F39C12', label: 'Tip' },
]

function classifyTimePeriod(text) {
  for (const p of TIME_PERIODS) {
    if (p.re.test(text)) return p
  }
  return { icon: '⏱', color: 'rgba(255,255,255,0.45)', label: null }
}

// Extract hour/minute quantities from text for the time badge
function extractTimeBadge(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:–|-to-)?\s*(\d+(?:\.\d+)?)?\s*hours?/i)
    || text.match(/(\d+(?:\.\d+)?)\s*hrs?/i)
    || text.match(/(\d+)\s*(?:–|-)?\s*(\d+)?\s*minutes?/i)
  if (!m) return null
  const lo = parseFloat(m[1])
  const hi = m[2] ? parseFloat(m[2]) : null
  const unit = /minute/i.test(m[0]) ? 'min' : 'hr'
  return hi ? `${lo}–${hi} ${unit}` : `${lo} ${unit}`
}

// Strip the period label prefix from display text (e.g. "Weekdays: ..." → "...")
function stripPrefix(text) {
  return text
    .replace(/^\*{1,2}[^*]+\*{1,2}[:\s]*/, '')   // **Bold:** prefix
    .replace(/^(weekday|weekend|morning|evening|afternoon|saturday|sunday|monday|tuesday|wednesday|thursday|friday|total|tip|note)[s]?[:\s-–]*/i, '')
    .trim()
}

function TimeCommitmentBody({ items }) {
  return (
    <div className="time-commitment-list">
      {items.map((raw, i) => {
        const text = typeof raw === 'string' ? raw : raw.text
        const { icon, color, label } = classifyTimePeriod(text)
        const timeBadge = extractTimeBadge(text)
        const display = stripPrefix(text)

        return (
          <div key={i} className="time-row" style={{ borderColor: `${color}30` }}>
            <div className="time-row-left">
              <span className="time-icon" style={{ background: `${color}18`, color }}>{icon}</span>
              {label && <span className="time-label" style={{ color }}>{label}</span>}
            </div>
            <div className="time-row-content">
              <span className="time-desc">{display}</span>
            </div>
            {timeBadge && (
              <div className="time-badge" style={{ background: `${color}18`, color, borderColor: `${color}50` }}>
                {timeBadge}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Generic section card ──────────────────────────────────────────────────────
function SectionCard({ section }) {
  const [open, setOpen] = useState(true)
  const isMilestone = section.title.toLowerCase().includes('milestone')
  const isResource = section.title.toLowerCase().includes('resource')
  const isCommitment = section.title.toLowerCase().includes('time') || section.title.toLowerCase().includes('commitment') || section.title.toLowerCase().includes('daily')
  const icon = isMilestone ? '🏁' : isResource ? '📚' : isCommitment ? '⏱' : '💡'

  const accentColor = isMilestone ? '#F39C12' : isResource ? '#9B59B6' : isCommitment ? '#27AE60' : 'rgba(255,255,255,0.2)'
  const headerBg = isMilestone ? 'rgba(243,156,18,0.08)' : isResource ? 'rgba(155,89,182,0.08)' : isCommitment ? 'rgba(39,174,96,0.08)' : SECTION_COLOR.bg
  const titleColor = isMilestone ? '#F39C12' : isResource ? '#C39BD3' : isCommitment ? '#6ee29a' : '#ECF0F1'

  return (
    <div className="roadmap-section-card" style={{ borderColor: SECTION_COLOR.border, borderLeftColor: accentColor }}>
      <button className="roadmap-week-header" style={{ background: headerBg }}
        onClick={() => setOpen(o => !o)}>
        <div className="roadmap-week-header-left">
          <span className="roadmap-section-icon">{icon}</span>
          <span className="roadmap-week-theme" style={{ color: titleColor }}>
            {section.title}
          </span>
        </div>
        <span className="roadmap-week-chevron" style={{ color: titleColor }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="roadmap-week-body">
          {isMilestone ? (
            <MilestonesBody items={section.items} />
          ) : isResource ? (
            <ResourcesBody items={section.items} />
          ) : isCommitment ? (
            <TimeCommitmentBody items={section.items} />
          ) : (
            section.items.map((item, i) => (
              <div key={i} className="roadmap-item-row">
                <span className="roadmap-item-dot" style={{ background: '#4A90D9' }} />
                <span className="roadmap-item-content">{typeof item === 'string' ? item : item.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RoadmapPanel({ data }) {
  const roadmap = data.roadmap_markdown || ''
  const { sections } = parseRoadmap(roadmap)

  const weeks = sections.filter(s => s.type === 'week')
  const others = sections.filter(s =>
    s.type === 'section' && !s.title.toLowerCase().includes('gap analysis')
  )

  if (!sections.length) {
    return (
      <>
        <div className="panel-title">🗺 30-Day Roadmap</div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>No roadmap data available.</p>
      </>
    )
  }

  return (
    <>
      <div className="panel-title">🗺 30-Day Roadmap</div>

      {/* Week overview track */}
      <WeekProgressBar weeks={weeks} />

      {/* Week accordion cards */}
      <div className="roadmap-cards">
        {weeks.map((w, i) => <WeekCard key={i} section={w} defaultOpen={i === 0} />)}
        {others.map((s, i) => <SectionCard key={i} section={s} />)}
      </div>
    </>
  )
}
