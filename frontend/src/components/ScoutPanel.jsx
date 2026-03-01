import ReactMarkdown from 'react-markdown'

/**
 * Parse the Scout agent's markdown table into an array of job objects.
 * Expected columns (order may vary): Job Title, Company, Match Level, Why it Matches, Source Link
 * Returns null if the markdown doesn't contain a parseable table.
 */
function parseScoutTable(markdown) {
  if (!markdown) return null

  const lines = markdown.split('\n')

  // Find the header row (contains "Job Title" or "Company")
  const headerIdx = lines.findIndex(
    l => l.includes('|') && (l.toLowerCase().includes('job title') || l.toLowerCase().includes('company'))
  )
  if (headerIdx === -1) return null

  // Parse header columns
  const headers = lines[headerIdx]
    .split('|')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean)

  // Skip the separator row (---|---)
  const dataStart = headerIdx + 2

  const jobs = []
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('|')) break

    const cells = line
      .split('|')
      .map(c => c.trim())
      .filter(Boolean)

    if (cells.length < 3) continue

    const get = (...keys) => {
      for (const k of keys) {
        const idx = headers.findIndex(h => h.includes(k))
        if (idx !== -1 && cells[idx]) return cells[idx]
      }
      return ''
    }

    // Extract href from markdown link syntax [text](url)
    const rawTitle = get('job title', 'title')
    const rawLink = get('source link', 'source', 'link')

    const titleMatch = rawTitle.match(/\[([^\]]+)\]\(([^)]+)\)/)
    const linkMatch = rawLink.match(/\[([^\]]+)\]\(([^)]+)\)/)

    const title = titleMatch ? titleMatch[1] : rawTitle
    const url = titleMatch ? titleMatch[2] : (linkMatch ? linkMatch[2] : null)
    const company = get('company')
    const match = get('match level', 'match')
    const reason = get('why it matches', 'why', 'reason')

    if (title) {
      jobs.push({ title, company, match, reason, url })
    }
  }

  return jobs.length > 0 ? jobs : null
}

const MATCH_STYLES = {
  high: { border: 'rgba(39,174,96,0.45)', bg: 'rgba(39,174,96,0.1)', color: '#6ee29a', label: 'High' },
  medium: { border: 'rgba(243,156,18,0.45)', bg: 'rgba(243,156,18,0.1)', color: '#f8c55a', label: 'Medium' },
  'strategic pivot': { border: 'rgba(74,144,217,0.45)', bg: 'rgba(74,144,217,0.1)', color: '#7ab8f5', label: 'Strategic Pivot' },
}

function matchStyle(level) {
  const key = (level || '').toLowerCase()
  return MATCH_STYLES[key] || MATCH_STYLES['medium']
}

function JobCard({ job, index }) {
  const ms = matchStyle(job.match)
  return (
    <div className="scout-job-card">
      <div className="scout-job-header">
        <div className="scout-job-title-wrap">
          <span className="scout-job-index">{String(index + 1).padStart(2, '0')}</span>
          <div>
            {job.url ? (
              <a
                className="scout-job-title"
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {job.title}
              </a>
            ) : (
              <span className="scout-job-title">{job.title}</span>
            )}
            {job.company && (
              <div className="scout-job-company">{job.company}</div>
            )}
          </div>
        </div>
        <span
          className="scout-match-badge"
          style={{ background: ms.bg, border: `1px solid ${ms.border}`, color: ms.color }}
        >
          {ms.label}
        </span>
      </div>

      {job.reason && (
        <p className="scout-job-reason">{job.reason}</p>
      )}

      <div className="scout-job-footer">
        {job.url && (
          <a
            className="scout-job-link"
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore Opportunity &rarr;
          </a>
        )}
      </div>
    </div>
  )
}

export default function ScoutPanel({ data }) {
  const company = data.target_company || 'Target Company'
  const markdown = data.markdown_result || ''

  const jobs = parseScoutTable(markdown)

  return (
    <div className="full-width">
      <div className="panel-title">
        🔍 Scout Agent —{' '}
        <span style={{ marginLeft: 6, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
          {company}
        </span>
      </div>

      {jobs ? (
        <div className="scout-jobs-grid">
          {jobs.map((job, i) => (
            <JobCard key={i} job={job} index={i} />
          ))}
        </div>
      ) : (
        /* Fallback: render raw markdown if table couldn't be parsed */
        <div className="markdown-body">
          <ReactMarkdown>{markdown || '*No results returned by Scout agent.*'}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
