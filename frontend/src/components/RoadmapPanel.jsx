import { useState } from 'react'
import {
  IconRoadmap, IconFlag, IconBook, IconClock,
  IconVideo, IconWrench, IconExternalLink, IconLightbulb,
  IconArticle, IconPin, IconSun, IconMoon, IconCalendar,
  IconBarChart, IconSparkles, IconTarget,
} from './Icons'

// ── Text utilities ─────────────────────────────────────────────────────────────

function stripMd(text = '') {
  if (typeof text !== 'string') return ''
  return text
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}

/** Render text that may contain markdown [label](url) links and/or bare https:// URLs */
function RichText({ text = '' }) {
  // Tokenize: split into alternating plain-text and link segments.
  // Handles both markdown [label](url) and bare https:// URLs.
  const tokens = []
  const MD_OR_URL = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s)>\]"',]+)/g
  let last = 0
  let m
  while ((m = MD_OR_URL.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: text.slice(last, m.index) })
    if (m[1]) {
      // markdown link: [label](url)
      tokens.push({ type: 'link', label: m[1], href: m[2] })
    } else {
      // bare URL
      tokens.push({ type: 'link', label: m[3], href: m[3] })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) })

  return (
    <>
      {tokens.map((tok, i) =>
        tok.type === 'link'
          ? <a key={i} href={tok.href} target="_blank" rel="noopener noreferrer" className="rm-link">{tok.label}</a>
          : <span key={i}>{stripMd(tok.value)}</span>
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

    // Detect bullet at any indentation level (the LLM often nests resource links
    // two spaces or four spaces in, e.g. "  - [MLflow Docs](https://...)")
    // We use `raw` (not trimmed) to detect indentation.
    const bulletMatch = raw.match(/^(\s*)[-*]\s+(.+)$/) || raw.match(/^(\s*)\d+\.\s+(.+)$/)
    if (bulletMatch && current) {
      const indent = bulletMatch[1].length
      const text   = bulletMatch[2].trim()

      // Top-level bullets (indent 0) that look like a skill/category heading
      // e.g. "**MLflow**:" or "**Courses:**" — store as a group label so the
      // renderer can show it as a sub-header, not as a clickable resource card.
      if (indent === 0 && /^\*{1,2}[^*]+\*{1,2}\s*:?\s*$/.test(text)) {
        current.items.push({ type: 'group', label: stripMd(text).replace(/:$/, '').trim() })
        continue
      }

      // Everything else (top-level or nested) is a real resource item.
      // Push the raw markdown text so ResourceCard can extract [label](url).
      // Skip '---' separators, empty strings, and whitespace-only items.
      if (text && text.trim() !== '---') current.items.push(text)
      continue
    }

    if (current && !line.startsWith('#')) {
      const text = stripMd(line)
      if (text && text.trim() !== '---') current.items.push(text)
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

// ── Fallback URL builder ───────────────────────────────────────────────────────

// Given a plain resource name with no embedded URL, build the most useful
// direct or search link depending on what the text looks like.
function buildFallbackUrl(text) {
  const t = text.toLowerCase()

  // Well-known platforms — link directly to their search pages
  if (/coursera/.test(t))          return `https://www.coursera.org/search?query=${encodeURIComponent(stripMd(text))}`
  if (/udemy/.test(t))             return `https://www.udemy.com/courses/search/?q=${encodeURIComponent(stripMd(text))}`
  if (/youtube/.test(t))           return `https://www.youtube.com/results?search_query=${encodeURIComponent(stripMd(text))}`
  if (/linkedin learning/.test(t)) return `https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(stripMd(text))}`
  if (/pluralsight/.test(t))       return `https://www.pluralsight.com/search?q=${encodeURIComponent(stripMd(text))}`
  if (/kaggle/.test(t))            return `https://www.kaggle.com/search?q=${encodeURIComponent(stripMd(text))}`
  if (/medium/.test(t))            return `https://medium.com/search?q=${encodeURIComponent(stripMd(text))}`
  if (/dev\.to/.test(t))           return `https://dev.to/search?q=${encodeURIComponent(stripMd(text))}`
  if (/github/.test(t))            return `https://github.com/search?q=${encodeURIComponent(stripMd(text))}`
  if (/npm/.test(t))               return `https://www.npmjs.com/search?q=${encodeURIComponent(stripMd(text))}`
  if (/pypi/.test(t))              return `https://pypi.org/search/?q=${encodeURIComponent(stripMd(text))}`

  // Books — Google Books search
  if (/\bbook\b|textbook/.test(t)) return `https://books.google.com/books?q=${encodeURIComponent(stripMd(text))}`

  // Default — Google search
  return `https://www.google.com/search?q=${encodeURIComponent(stripMd(text))}`
}

// ── Resource card ──────────────────────────────────────────────────────────────

function ResourceCard({ text }) {
  const { Icon, color, label } = classifyRes(text)

  // 1. Try to extract a URL from markdown link syntax [label](url) BEFORE stripping
  const mdLinkMatch = text.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/)
  const mdUrl     = mdLinkMatch?.[2] ?? null
  const mdLabel   = mdLinkMatch?.[1] ?? null

  // 2. Strip markdown for the display text
  const clean = stripMd(text)

  // 3. Also look for a bare https:// URL in the already-stripped text
  const bareUrlMatch = clean.match(/https?:\/\/[^\s)>]+/)
  const bareUrl = bareUrlMatch?.[0] ?? null

  // Prefer the markdown-extracted URL, then bare URL, then build a fallback
  const url = mdUrl ?? bareUrl ?? buildFallbackUrl(clean)

  // Display text: prefer the markdown link label, otherwise the cleaned text minus any bare URL
  let display = mdLabel
    ?? (bareUrl ? clean.replace(bareUrl, '').replace(/[()[\]]/g, '').trim() : clean)
  if (!display) display = clean

  // Strip leading type prefix like "Course: " or "Book - "
  display = display.replace(/^(course|book|tool|docs?|article|project|practice|link)[:\s\-–]+/i, '').trim()

  // Decide what hostname preview to show
  let hostname = ''
  try { hostname = new URL(url).hostname } catch { hostname = '' }
  // For fallback Google searches show a friendlier label instead of "google.com"
  const isSearch   = url.includes('google.com/search') || url.includes('/search?')
  const urlPreview = isSearch ? 'Search online' : hostname

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
        <span className="rm-res-title">{display || clean}</span>
        <span className="rm-res-url">
          <IconExternalLink />
          {urlPreview}
        </span>
      </div>

      {/* Arrow affordance */}
      <span className="rm-res-arrow" style={{ color }}>
        <IconExternalLink />
      </span>
    </>
  )

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="rm-res-card rm-res-card--link" style={{ '--res-color': color }}>
      {inner}
    </a>
  )
}

// ── Day item ───────────────────────────────────────────────────────────────────

// Split the activity string into individual tasks.
// Handles: " and ", commas-with-space as separators.
// Works on the stripped (plain-text) version for splitting,
// but we map back to the original raw segments so RichText can render links.
function splitTasks(rawActivities) {
  // Split on ", " or " and " — but not inside parentheses (URLs)
  // Strategy: split the plain-text version, then extract matching raw substrings
  return rawActivities
    .split(/(?<!\([^)]*),\s+|\s+and\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

function DayItem({ text: rawText, accent }) {
  // Coerce to string — items can be { type: 'group', label } objects if the
  // parser misclassifies a week bullet as a group heading.
  const text = typeof rawText === 'string' ? rawText : (rawText?.label ?? String(rawText ?? ''))
  // Strip bold/italic/links BEFORE matching so "**Day 1-2**:" is found correctly.
  // Keep `text` (raw) around so RichText can still render markdown links in tasks.
  const clean = stripMd(text)
  const m = clean.match(/^(Day[\s\d,–\-]+)[:\s]+(.+?)(?:\s[—–\-]{1,2}\s(.+))?$/)
  if (m) {
    // Extract the raw activities substring from the original text by finding
    // the em-dash separator position in the raw string.
    const dashIdx = text.search(/\s[—–]\s/)
    const rawActivities = dashIdx !== -1 ? text.slice(dashIdx).replace(/^\s*[—–]\s*/, '') : ''
    const tasks = rawActivities ? splitTasks(rawActivities) : []

    return (
      <div className="rm-day-item" style={{ '--day-accent': accent }}>
        <div className="rm-day-header">
          <span className="rm-day-badge" style={{ background: `${accent}20`, color: accent, borderColor: `${accent}40` }}>
            {m[1].trim()}
          </span>
          <span className="rm-day-topic">{m[2].trim()}</span>
        </div>
        {tasks.length > 0 && (
          <ul className="rm-day-tasks">
            {tasks.map((task, i) => (
              <li key={i} className="rm-day-task">
                <span className="rm-day-task-dot" style={{ background: accent }} />
                <RichText text={task} />
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }
  return (
    <div className="rm-day-item rm-day-item--plain" style={{ '--day-accent': accent }}>
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
          {section.items
            .filter(item => item && (typeof item === 'object' || (item.trim() !== '' && item.trim() !== '---')))
            .map((item, i) => (
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
      {items.map((raw, i) => {
        // Group label (e.g. "MLflow", "Courses") — rendered as a sub-header
        if (raw && typeof raw === 'object' && raw.type === 'group') {
          return (
            <div key={i} className="rm-res-group-label">{raw.label}</div>
          )
        }
        const text = typeof raw === 'string' ? raw : raw.text || ''
        return <ResourceCard key={i} text={text} />
      })}
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
        if (label === 'Daily') return null
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
                section.items
                  .filter(item => item && (typeof item === 'object' || (item.trim() !== '' && item.trim() !== '---')))
                  .map((item, i) => (
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
