import React from 'react'

// ── Feedback item helpers ──────────────────────────────────────────────────────

// Technical tools, frameworks, concepts, and skills to auto-bold in feedback text
const TERM_RE = /\b(Apache Beam|Apache Spark|AWS Glue|AWS|GCP|Google Cloud|Azure|Python|SQL|NoSQL|MLflow|Spark|Kafka|Airflow|Databricks|dbt|Hadoop|Flink|TensorFlow|PyTorch|scikit-learn|XGBoost|LightGBM|SMOTE|Pandas|NumPy|Docker|Kubernetes|Git|GitHub|CI\/CD|ETL|ELT|A\/B testing|STAR framework|STAR method|NLP|machine learning|deep learning|data engineering|data science|feature engineering|model deployment|Tableau|Power BI|Looker|BigQuery|Redshift|S3|leadership|communication|problem.solving|collaboration|teamwork|critical thinking|analytical thinking|structured thinking)\b/gi

/** Wraps matched technical terms in <strong> while preserving surrounding text. */
function applyBold(text) {
  const parts = []
  const re = new RegExp(TERM_RE.source, 'gi')
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(<strong key={m.index}>{m[0]}</strong>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : [text]
}

/**
 * Renders a single feedback bullet.
 * - Expands "(e.g., X, Y, Z)" / "(i.e., X, Y, Z)" into indented sub-bullets.
 * - Bolds recognised technical terms and skills throughout.
 */
function FeedbackItem({ text }) {
  // Match: "Intro text (e.g., Item1, Item2, Item3) optional suffix."
  const egMatch = text.match(/^(.*?)\s*\((?:e\.g\.?|i\.e\.?),?\s+([^)]+)\)\.?\s*(.*)$/i)

  if (egMatch) {
    const intro  = [egMatch[1].trim(), egMatch[3].trim()].filter(Boolean).join(' ')
    const examples = egMatch[2].split(/,\s*/).map(s => s.trim()).filter(Boolean)
    return (
      <>
        {intro && <span>{applyBold(intro)}</span>}
        <ul className="iv-sw-sublist">
          {examples.map((ex, i) => (
            <li key={i}><strong>{ex}</strong></li>
          ))}
        </ul>
      </>
    )
  }

  return <>{applyBold(text)}</>
}

// ── Second-person sanitiser ───────────────────────────────────────────────────
/**
 * Rewrites any LLM-generated text that refers to the interviewee in the third
 * person into direct second-person feedback.
 * Handles: candidate name injection, "the candidate", "this candidate",
 * possessive forms, and common third-person lead-ins.
 */
// Matches any apostrophe variant: straight ' curly ' ' and backtick `
const APOS = `['\u2018\u2019\u0060]`

function toSecondPerson(text, candidateName) {
  if (!text) return text
  let t = text

  // 1. Candidate name: possessive MUST run before bare-name so we never produce "you's"
  if (candidateName && candidateName.trim() && candidateName.trim().toLowerCase() !== 'candidate') {
    const escaped = candidateName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // "John Doe's" / "John Doe's" → "your"
    t = t.replace(new RegExp(`${escaped}${APOS}s`, 'gi'), 'your')
    // bare "John Doe" → "you"
    t = t.replace(new RegExp(`${escaped}`, 'gi'), 'you')
  }

  // 2. "the/this candidate's" / "candidate's" → "your"  (possessive first)
  t = t.replace(new RegExp(`\\b(the|this)\\s+candidate${APOS}s\\b`, 'gi'), 'your')
  t = t.replace(new RegExp(`\\bcandidate${APOS}s\\b`, 'gi'), 'your')
  // 3. All remaining "candidate" / "Candidate" references → "you"
  //    Excludes compound labels like "Candidate Name", "Candidate ID"
  t = t.replace(/\b(the|this)\s+candidate\b/gi, 'you')
  t = t.replace(/\bcandidate\b(?!\s+(?:name|id|number))/gi, 'you')

  // 4. Third-person pronouns → second-person (possessives before subject forms)
  t = t.replace(new RegExp(`\\bhe${APOS}s\\b`,  'gi'), "you're")
  t = t.replace(new RegExp(`\\bshe${APOS}s\\b`, 'gi'), "you're")
  t = t.replace(/\bhis\b/gi,  'your')
  t = t.replace(/\bher\b/gi,  'your')
  t = t.replace(/\bhim\b/gi,  'you')
  t = t.replace(/\bhe\b/gi,   'you')
  t = t.replace(/\bshe\b/gi,  'you')

  // 5. Capitalise you/your/you're at sentence start or after . ! ?
  t = t.replace(/((?:^|[.!?])\s*)(you're|your|you)\b/gi, (_, pre, word) =>
    pre + word.charAt(0).toUpperCase() + word.slice(1)
  )

  return t
}

// ── Grade helpers ──────────────────────────────────────────────────────────────

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

  const candidateName = session?.candidateName || ''
  const sanitise = (text) => toSecondPerson(text, candidateName)

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
            {session.targetRole} &nbsp;·&nbsp; {session.targetCompany}
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
            <p className="iv-executive-summary">{sanitise(report.executive_summary)}</p>
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
                  <span className="iv-breakdown-summary">{sanitise(qb.summary)}</span>
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
              {report.strengths.map((s, i) => <li key={i}><FeedbackItem text={sanitise(s)} /></li>)}
            </ul>
          </div>
        )}
        {report.weaknesses?.length > 0 && (
          <div className="iv-sw-card iv-sw-card--weaknesses">
            <div className="iv-sw-title" style={{ color: 'var(--danger)' }}>Weaknesses</div>
            <ul className="iv-sw-list">
              {report.weaknesses.map((w, i) => <li key={i}><FeedbackItem text={sanitise(w)} /></li>)}
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
                {report.areas_to_improve.map((a, i) => <li key={i}><FeedbackItem text={sanitise(a)} /></li>)}
              </ul>
            </div>
          )}
          {report.preparation_topics?.length > 0 && (
            <div className="iv-sw-card">
              <div className="iv-sw-title" style={{ color: 'var(--accent-blue)' }}>Preparation Topics</div>
              <ul className="iv-sw-list">
                {report.preparation_topics.map((t, i) => <li key={i}><FeedbackItem text={sanitise(t)} /></li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
