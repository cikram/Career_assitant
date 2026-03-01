import { useState } from 'react'
import {
  IconRoadmap, IconFlag, IconBook, IconClock,
  IconVideo, IconWrench, IconExternalLink, IconLightbulb,
  IconArticle, IconPin, IconSun, IconMoon, IconCalendar,
  IconBarChart, IconSparkles, IconTarget,
} from './Icons'

// ── Text utilities ─────────────────────────────────────────────────────────────

function stripMd(text = '') {
  return text
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}

/** Split text at URLs and render them as <a> tags */
function RichText({ text = '' }) {
  const clean = stripMd(text)
  const URL_RE = /(https?:\/\/[^\s)>\]"',]+)/g
  const parts = clean.split(URL_RE)
  return (
    <>
      {parts.map((p, i) =>
        URL_RE.test(p)
          ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="rm-link">{p}</a>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

// ── Parser ─────────────────────────────────────────────────────────────────────

function parseRoadmap(markdown = '') {
  const lines = markdown.split('\n')
  const sections = []
  let current = null

  const flush = () => { if (current) sections.push(current) }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const weekMatch = line.match(/^#{3,4}\s+Week\s+(\d+)[:\s—–\-]+(.+)/i)
    if (weekMatch) {
      flush()
      current = { type: 'week', week: +weekMatch[1], theme: stripMd(weekMatch[2]), items: [] }
      continue
    }

    if (/^#{2,4}\s/.test(line)) {
      flush()
      const title = stripMd(line.replace(/^#{2,4}\s+/, ''))
      if (/30.day learning roadmap/i.test(title)) continue
      current = { type: 'section', title, items: [] }
      continue
    }

    if ((line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) && current) {
      const text = line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim()
      current.items.push(text)
      continue
    }

    if (current && !line.startsWith('#')) {
      const text = stripMd(line)
      if (text) current.items.push(text)
    }
  }
  flush()
  return sections
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const WEEK_PALETTE = [
  { accent: '#4A90D9', glow: '#4A90D930', dimBg: 'rgba(74,144,217,0.08)' },
  { accent: '#A06CD5', glow: '#A06CD530', dimBg: 'rgba(160,108,213,0.08)' },
  { accent: '#2ECC71', glow: '#2ECC7130', dimBg: 'rgba(46,204,113,0.08)' },
  { accent: '#F5A623', glow: '#F5A62330', dimBg: 'rgba(245,166,35,0.08)' },
]
function wc(n) { return WEEK_PALETTE[(n - 1) % WEEK_PALETTE.length] }

// ── Resource classification ────────────────────────────────────────────────────

const RES_TYPES = [
  { re: /coursera|udemy|linkedin learning|pluralsight|mooc|video course|youtube/i, Icon: IconVideo, color: '#4A90D9', label: 'Course' },
  { re: /\bbook\b|textbook/i, Icon: IconBook, color: '#A06CD5', label: 'Book' },
  { re: /github|repo|library|framework|package|pypi|npm/i, Icon: IconWrench, color: '#2ECC71', label: 'Tool' },
  { re: /docs|documentation|article|blog|medium|dev\.to/i, Icon: IconArticle, color: '#F5A623', label: 'Docs' },
  { re: /practice|project|exercise|challenge|build|kaggle/i, Icon: IconLightbulb, color: '#E74C3C', label: 'Project' },
  { re: /https?:\/\//, Icon: IconExternalLink, color: '#4A90D9', label: 'Link' },
]

function classifyRes(text) {
  for (const t of RES_TYPES) if (t.re.test(text)) return t
  return { Icon: IconPin, color: 'rgba(255,255,255,0.4)', label: null }
}

// ── Time commitment classification ────────────────────────────────────────────

const TIME_TYPES = [
  { re: /weekend|saturday|sunday/i, Icon: IconSun, color: '#A06CD5', label: 'Weekend' },
  { re: /morning/i, Icon: IconSun, color: '#F5A623', label: 'Morning' },
  { re: /evening|night/i, Icon: IconMoon, color: '#4A90D9', label: 'Evening' },
  { re: /weekday|mon|tue|wed|thu|fri/i, Icon: IconCalendar, color: '#2ECC71', label: 'Weekdays' },
  { re: /total|per week|per day|overall/i, Icon: IconBarChart, color: '#E74C3C', label: 'Total' },
  { re: /tip|note|recommend/i, Icon: IconSparkles, color: '#F5A623', label: 'Tip' },
]
function classifyTime(text) {
  for (const t of TIME_TYPES) if (t.re.test(text)) return t
  return { Icon: IconClock, color: 'rgba(255,255,255,0.4)', label: 'Daily' }
}
function extractHours(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:[–\-]\s*(\d+(?:\.\d+)?))?\s*hours?/i) || text.match(/(\d+)\s*hrs?/i)
  if (!m) return null
  return m[2] ? `${m[1]}–${m[2]}h` : `${m[1]}h`
}

// ── Resource card ──────────────────────────────────────────────────────────────

function ResourceCard({ text }) {
  const { Icon, color, label } = classifyRes(text)
  const clean = stripMd(text)

  // Pull out a URL embedded in the item, if any
  const urlMatch = clean.match(/https?:\/\/[^\s)>]+/)
  const url = urlMatch?.[0]

  // Display text = everything except the URL itself, or the URL as fallback
  let display = url ? clean.replace(url, '').replace(/[()[\]]/g, '').trim() : clean
  if (!display && url) display = url

  // Strip leading type prefix like "Course: " or "Book - "
  display = display.replace(/^(course|book|tool|docs?|article|project|practice|link)[:\s\-–]+/i, '').trim()

  const inner = (
    <>
      {/* Icon badge */}
      <span className="rm-res-icon-wrap" style={{ background: `${color}18`, borderColor: `${color}30`, color }}>
        <Icon />
      </span>

      {/* Text body */}
      <div className="rm-res-body">
        {label && (
          <span className="rm-res-type" style={{ color, borderColor: `${color}35` }}>{label}</span>
        )}
        <span className="rm-res-title">{display || url || clean}</span>
        {url && (
          <span className="rm-res-url">
            <IconExternalLink />
            {new URL(url).hostname}
          </span>
        )}
      </div>

      {/* Arrow affordance for links */}
      {url && (
        <span className="rm-res-arrow" style={{ color }}>
          <IconExternalLink />
        </span>
      )}
    </>
  )

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="rm-res-card rm-res-card--link" style={{ '--res-color': color }}>
        {inner}
      </a>
    )
  }
  return (
    <div className="rm-res-card" style={{ '--res-color': color }}>
      {inner}
    </div>
  )
}

// ── Day item ───────────────────────────────────────────────────────────────────

function DayItem({ text, accent }) {
  const m = text.match(/^(Day[\s\d,–\-]+)[:\s]+(.+?)(?:\s[—–\-]{1,2}\s(.+))?$/)
  if (m) {
    return (
      <div className="rm-day-item">
        <span className="rm-day-badge" style={{ background: `${accent}18`, color: accent }}>
          {m[1].trim()}
        </span>
        <div className="rm-day-body">
          <span className="rm-day-topic"><RichText text={m[2].trim()} /></span>
          {m[3] && <span className="rm-day-detail"><RichText text={m[3].trim()} /></span>}
        </div>
      </div>
    )
  }
  return (
    <div className="rm-day-item rm-day-item--plain">
      <span className="rm-day-dot" style={{ background: accent }} />
      <span className="rm-day-desc"><RichText text={text} /></span>
    </div>
  )
}

// ── Week card ──────────────────────────────────────────────────────────────────

function WeekCard({ section, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  const c = wc(section.week)

  return (
    <div className="rm-week-card" style={{ '--wk-accent': c.accent, '--wk-glow': c.glow, '--wk-dim': c.dimBg }}>
      <button className="rm-week-header" onClick={() => setOpen(o => !o)}>
        <div className="rm-week-num" style={{ background: c.accent, boxShadow: `0 0 18px ${c.glow}` }}>
          {section.week}
        </div>
        <div className="rm-week-info">
          <span className="rm-week-theme">{section.theme}</span>
        </div>
        <span className="rm-week-count">
          {section.items.length} {section.items.length === 1 ? 'task' : 'tasks'}
        </span>
        <svg className="rm-chevron-svg" style={{ color: c.accent }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
        </svg>
      </button>

      {open && (
        <div className="rm-week-body">
          {section.items.map((item, i) => (
            <DayItem key={i} text={item} accent={c.accent} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Milestone timeline ─────────────────────────────────────────────────────────

const MS_ACCENT = ['#4A90D9', '#A06CD5', '#2ECC71', '#F5A623']

function Milestones({ items }) {
  return (
    <div className="rm-milestones">
      {items.map((raw, i) => {
        const text = stripMd(raw)
        const m = text.match(/^End of Week\s*(\d+)[:\s]+(.+)/i)
        const wn = m ? +m[1] : null
        const color = MS_ACCENT[(wn ? wn - 1 : i) % MS_ACCENT.length]
        const isLast = i === items.length - 1
        return (
          <div key={i} className="rm-ms-row">
            <div className="rm-ms-spine">
              <div className="rm-ms-dot" style={{ background: color, boxShadow: `0 0 12px ${color}66` }}>
                <IconFlag />
              </div>
              {!isLast && <div className="rm-ms-line" style={{ background: `${color}30` }} />}
            </div>
            <div className="rm-ms-body" style={{ borderColor: `${color}25` }}>
              {m && <div className="rm-ms-week" style={{ color }}>End of Week {wn}</div>}
              <div className="rm-ms-outcome"><RichText text={m ? m[2] : text} /></div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Resources section ──────────────────────────────────────────────────────────

function Resources({ items }) {
  return (
    <div className="rm-resources">
      {items.map((raw, i) => (
        <ResourceCard key={i} text={typeof raw === 'string' ? raw : raw.text || ''} />
      ))}
    </div>
  )
}

// ── Time commitment ────────────────────────────────────────────────────────────

function TimeCommitment({ items }) {
  return (
    <div className="rm-time-list">
      {items.map((raw, i) => {
        const text = stripMd(typeof raw === 'string' ? raw : raw.text || '')
        const { Icon, color, label } = classifyTime(text)
        const hours = extractHours(text)
        return (
          <div key={i} className="rm-time-row" style={{ borderColor: `${color}20` }}>
            <span className="rm-time-icon" style={{ background: `${color}15`, color }}><Icon /></span>
            {label && <span className="rm-time-label" style={{ color }}>{label}</span>}
            <span className="rm-time-desc"><RichText text={text} /></span>
            {hours && <span className="rm-time-badge" style={{ color, borderColor: `${color}40` }}>{hours}</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── Generic section card ───────────────────────────────────────────────────────

function SectionCard({ section }) {
  const [open, setOpen] = useState(true)
  const lc = section.title.toLowerCase()
  const isMilestone = lc.includes('milestone')
  const isResource = lc.includes('resource')
  const isCommitment = lc.includes('time') || lc.includes('commitment') || lc.includes('daily')

  const { Icon, accent } = isMilestone ? { Icon: IconFlag, accent: '#F5A623' }
    : isResource ? { Icon: IconBook, accent: '#A06CD5' }
      : isCommitment ? { Icon: IconClock, accent: '#2ECC71' }
        : { Icon: IconSparkles, accent: '#4A90D9' }

  return (
    <div className="rm-section-card" style={{ '--sc-accent': accent }}>
      <button className="rm-section-header" onClick={() => setOpen(o => !o)}>
        <span className="rm-section-icon-wrap" style={{ color: accent, background: `${accent}15` }}>
          <Icon />
        </span>
        <span className="rm-section-title">{section.title}</span>
        <svg className="rm-chevron-svg" style={{ color: accent }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
        </svg>
      </button>

      {open && (
        <div className="rm-section-body">
          {isMilestone ? <Milestones items={section.items} /> :
            isResource ? <Resources items={section.items} /> :
              isCommitment ? <TimeCommitment items={section.items} /> :
                section.items.map((item, i) => (
                  <div key={i} className="rm-plain-item">
                    <span className="rm-plain-dot" style={{ background: accent }} />
                    <span className="rm-plain-text"><RichText text={typeof item === 'string' ? item : item.text} /></span>
                  </div>
                ))
          }
        </div>
      )}
    </div>
  )
}

// ── Week overview strip ────────────────────────────────────────────────────────

function WeekStrip({ weeks }) {
  if (!weeks.length) return null
  return (
    <div className="rm-strip">
      {weeks.map((w, i) => {
        const c = wc(w.week)
        return (
          <div key={i} className="rm-strip-step">
            {i < weeks.length - 1 && (
              <div className="rm-strip-connector" style={{ background: `${c.accent}35` }} />
            )}
            <div className="rm-strip-dot" style={{ background: c.accent, boxShadow: `0 0 14px ${c.glow}` }}>
              {w.week}
            </div>
            <div className="rm-strip-label" style={{ color: c.accent }}>Week {w.week}</div>
            <div className="rm-strip-theme">{w.theme}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function RoadmapPanel({ data }) {
  const sections = parseRoadmap(data?.roadmap_markdown || '')
  const weeks = sections.filter(s => s.type === 'week')
  const others = sections.filter(s => s.type === 'section' && !/gap analysis/i.test(s.title))

  if (!sections.length) {
    return (
      <div className="rm-empty">
        <span className="rm-empty-icon" style={{ color: 'rgba(255,255,255,0.25)' }}>
          <IconRoadmap />
        </span>
        <p>No roadmap data available yet.</p>
      </div>
    )
  }

  return (
    <div className="rm-root">
      {/* Header */}
      <div className="rm-header">
        <span className="rm-header-icon"><IconTarget /></span>
        <div>
          <div className="rm-header-title">30-Day Learning Roadmap</div>
          <div className="rm-header-subtitle">{weeks.length} weeks · personalised to your skills gap</div>
        </div>
      </div>

      {/* Overview strip */}
      <WeekStrip weeks={weeks} />

      {/* Cards */}
      <div className="rm-cards">
        {weeks.map((w, i) => <WeekCard key={i} section={w} defaultOpen={i === 0} />)}
        {others.map((s, i) => <SectionCard key={i} section={s} />)}
      </div>
    </div>
  )
}
