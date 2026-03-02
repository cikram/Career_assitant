import { useState, useEffect, useRef } from 'react'

const G = '#1DB954', B = '#3b82f6', P = '#8b5cf6', O = '#f59e0b'

/* ── Inline SVG Icons ─────────────────────────────────── */
const s = { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
function Ico({ children, size = 18, ...rest }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} {...rest}>{children}</svg>
}
const IcoBolt    = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || G }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Ico>
const IcoFile    = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || G }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></Ico>
const IcoBarChart = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || B }}><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></Ico>
const IcoTarget  = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || B }}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></Ico>
const IcoMic     = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || P }}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></Ico>
const IcoRoute   = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || O }}><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></Ico>
const IcoSearch  = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || '#fff' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Ico>
const IcoTrendUp = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || G }}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></Ico>
const IcoBrain   = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || P }}><path d="M9.5 2A5.5 5.5 0 0 0 4 7.5c0 1.58.67 3 1.73 4.01L12 18l6.27-6.49A5.49 5.49 0 0 0 20 7.5 5.5 5.5 0 0 0 14.5 2c-1.56 0-2.96.65-3.96 1.69" /><path d="M12 18v4" /><circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none" /></Ico>
const IcoClipboard = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || P }}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></Ico>
const IcoSpeaker = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || O }}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M8 21h8" /><line x1="12" y1="17" x2="12" y2="21" /></Ico>
const IcoSparkle = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || G }}><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" /></Ico>
const IcoLineChart = ({ size, color }) => <Ico size={size} style={{ ...s, color: color || B }}><path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 5-9" /></Ico>

export default function ExplorePage({ onGetStarted }) {
  const [ready, setReady] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setReady(true)) }, [])

  return (
    <div className="ep-root" style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.6s ease' }}>
      <style>{CSS}</style>

      {/* ═══════════════════ HERO ════════════════════════ */}
      <section className="ep-hero">
        <div className="ep-grid-bg" />
        <Particles />
        <div className="ep-glow-orb ep-glow-1" />
        <div className="ep-glow-orb ep-glow-2" />
        <div className="ep-glow-orb ep-glow-3" />
        <div className="ep-glow-orb ep-glow-4" />
        <GlowLines />

        {/* Navbar */}
        <nav className="ep-nav">
          <div className="ep-nav-logo">
            <div className="ep-logo-icon"><span className="ep-logo-pulse" /><IcoBolt size={16} /></div>
            <span className="ep-logo-text">Career Analyst</span>
          </div>
          <div className="ep-nav-links">
            <a href="#how" className="ep-nav-link">How It Works</a>
            <a href="#features" className="ep-nav-link">Features</a>
            <button className="ep-nav-cta" onClick={onGetStarted}>Launch App →</button>
          </div>
        </nav>

        {/* Main Hero Layout - Structured like the image */}
        <div className="ep-hero-layout">
          {/* Left Side - Resume & Skills Cards */}
          <div className="ep-hero-left">
            <div className="ep-hero-card-group">
              <div className="ep-hero-card-primary">
                <ResumeShowcase />
              </div>
              <div className="ep-hero-card-secondary-row">
                <ChartsShowcase />
                <ScoreShowcase />
              </div>
            </div>
            <div className="ep-hero-card-group">
              <RadarShowcase />
            </div>
          </div>

          {/* Center - Headline & Workflow Pipeline */}
          <div className="ep-hero-center">
            <div className="ep-hero-center-content">
              <div className="ep-hero-badge">
                <span className="ep-badge-dot" />
                AI-powered career toolkit
              </div>
              <h1 className="ep-hero-title">
                YOUR FUTURE,<br />
                <span className="ep-title-accent">ACCELERATED BY AI</span>
              </h1>
              <button className="ep-cta ep-cta-hero" onClick={onGetStarted}>
                Learn More <span className="ep-cta-arrow">→</span>
              </button>
            </div>
          </div>

          {/* Right Side - Interview & Roadmap Cards */}
          <div className="ep-hero-right">
            <div className="ep-hero-card-group">
              <RoadmapShowcase />
            </div>
            <div className="ep-hero-card-group">
              <div className="ep-hero-card-primary">
                <InterviewShowcase />
              </div>
              <div className="ep-hero-card-secondary-row">
                <AnalyticsShowcase />
                <JobSearchShowcase />
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="ep-scroll-hint">
          <div className="ep-scroll-mouse"><div className="ep-scroll-wheel" /></div>
          <span>Scroll to explore</span>
        </div>
      </section>

      {/* ═════════════ AI PIPELINE FLOW ════════════════ */}
      <section className="ep-pipeline" id="how">
        <div className="ep-section-badge">HOW IT WORKS</div>
        <h2 className="ep-section-title">How it works</h2>
        <p className="ep-section-sub">Five steps from resume upload to interview-ready</p>
        <PipelineFlow />
      </section>

      {/* ═══════════ JOB SEARCH SHOWCASE ═══════════════ */}
      <section className="ep-jobs-section">
        <div className="ep-jobs-inner">
          <div className="ep-jobs-text">
            <div className="ep-section-badge" style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)', color: B }}>LIVE SEARCH</div>
            <h2 className="ep-section-title" style={{ textAlign: 'left' }}>Real-Time Job Market Intelligence</h2>
            <p className="ep-jobs-desc">
              Our AI scout performs live Google searches to find matching roles at your target company
              and competitors. Get real job postings, relevance scores, and direct application links
              — updated in real time as you analyze.
            </p>
            <div className="ep-jobs-features">
              {['Scans Google, LinkedIn, Indeed & more', 'Relevance scoring per job listing', 'One-click apply links', 'Competitor company discovery'].map((t, i) => (
                <div key={i} className="ep-jf">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <button className="ep-cta" onClick={onGetStarted} style={{ marginTop: 24 }}>
              Try Job Search <span className="ep-cta-arrow">→</span>
            </button>
          </div>
          <div className="ep-jobs-visual">
            <JobSearchLive />
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES ══════════════════════ */}
      <section className="ep-section" id="features">
        <div className="ep-section-badge">FEATURES</div>
        <h2 className="ep-section-title">Built for real results</h2>
        <p className="ep-section-sub">Every tool you need to go from application to offer</p>
        <div className="ep-features-grid">
          {FEATURES.map((f, i) => <FeatureCard key={i} f={f} i={i} />)}
        </div>
      </section>

      {/* ═══════════════ FOOTER CTA ═══════════════════ */}
      <section className="ep-footer">
        <div className="ep-footer-glow" />
        <Particles count={20} />
        <h2 className="ep-footer-title">Your next career move<br />starts here.</h2>
        <p className="ep-footer-sub">Upload your resume, pick a target role, and let the AI do the rest.</p>
        <button className="ep-cta ep-cta-lg" onClick={onGetStarted}>
          Get Started — It's Free <span className="ep-cta-arrow">→</span>
        </button>
      </section>
    </div>
  )
}

/* ═══ Particles ═════════════════════════════════════════ */
function Particles({ count = 40 }) {
  const particles = useRef(
    Array.from({ length: count }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      dur: Math.random() * 20 + 15,
      delay: Math.random() * -20,
      opacity: Math.random() * 0.4 + 0.1,
    }))
  ).current
  return (
    <div className="ep-particles">
      {particles.map((p, i) => (
        <div key={i} className="ep-particle" style={{
          left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size,
          animationDuration: `${p.dur}s`,
          animationDelay: `${p.delay}s`,
          opacity: p.opacity,
        }} />
      ))}
    </div>
  )
}

/* ═══ SVG Glow Lines ═══════════════════════════════════ */
function GlowLines() {
  return (
    <svg className="ep-glow-lines" viewBox="0 0 1400 800" fill="none">
      <defs>
        <linearGradient id="gl1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={G} stopOpacity="0" />
          <stop offset="40%" stopColor={G} stopOpacity="0.6" />
          <stop offset="60%" stopColor={G} stopOpacity="0.6" />
          <stop offset="100%" stopColor={G} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gl2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={B} stopOpacity="0" />
          <stop offset="50%" stopColor={B} stopOpacity="0.35" />
          <stop offset="100%" stopColor={B} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gl3" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={P} stopOpacity="0" />
          <stop offset="50%" stopColor={P} stopOpacity="0.2" />
          <stop offset="100%" stopColor={P} stopOpacity="0" />
        </linearGradient>
        <filter id="glowF"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <path d="M0,400 C200,370 350,280 550,340 S800,500 1000,380 S1250,250 1400,340" stroke="url(#gl1)" strokeWidth="1.5" filter="url(#glowF)" className="ep-line-draw" />
      <path d="M0,520 C250,470 400,560 650,480 S900,340 1100,450 S1300,540 1400,440" stroke="url(#gl1)" strokeWidth="1" filter="url(#glowF)" className="ep-line-draw" style={{ animationDelay: '0.4s' }} />
      <path d="M150,80 C300,180 500,120 750,240 S1000,360 1200,240 S1350,120 1400,180" stroke="url(#gl2)" strokeWidth="0.8" filter="url(#glowF)" className="ep-line-draw" style={{ animationDelay: '0.8s' }} />
      <path d="M1400,600 C1200,550 1000,650 800,580 S500,420 300,530 S100,620 0,560" stroke="url(#gl3)" strokeWidth="0.7" filter="url(#glowF)" className="ep-line-draw" style={{ animationDelay: '1.2s' }} />
    </svg>
  )
}

/* ═══ Showcase Cards ═══════════════════════════════════ */
function ResumeShowcase() {
  return (
    <div className="ep-sc ep-sc-resume-large">
      <div className="ep-sc-hdr"><IcoFile size={16} color={G} /><span className="ep-sc-lbl">AI Resume Analysis</span><span className="ep-sc-live">LIVE</span></div>
      <div className="ep-sc-body">
        <div className="ep-resume-doc-large">
          <div className="ep-resume-header">
            <div className="ep-resume-photo-large">
              <div className="ep-photo-placeholder" />
            </div>
            <div className="ep-resume-name">
              <div className="ep-name-line" />
              <div className="ep-name-line ep-name-line-short" />
            </div>
          </div>
          <div className="ep-resume-section">
            <div className="ep-section-title-line" />
            <div className="ep-resume-lines">
              {[85, 72, 90, 65, 78, 55, 82].map((w, i) => <div key={i} className="ep-line-block" style={{ width: `${w}%`, animationDelay: `${i * 0.06}s` }} />)}
            </div>
          </div>
          <div className="ep-resume-section">
            <div className="ep-section-title-line ep-section-title-short" />
            <div className="ep-resume-lines">
              {[70, 88, 60, 75].map((w, i) => <div key={i} className="ep-line-block" style={{ width: `${w}%`, animationDelay: `${(i + 7) * 0.06}s` }} />)}
            </div>
          </div>
        </div>
        <div className="ep-scan-line-large" />
        <div className="ep-resume-tags">
          <span className="ep-tag ep-tag-g">Python</span>
          <span className="ep-tag ep-tag-b">React</span>
          <span className="ep-tag ep-tag-p">ML</span>
          <span className="ep-tag ep-tag-g">SQL</span>
        </div>
      </div>
    </div>
  )
}

function ChartsShowcase() {
  return (
    <div className="ep-sc ep-sc-charts">
      <div className="ep-sc-hdr"><IcoBarChart size={15} color={B} /><span className="ep-sc-lbl">SKILL CHARTS</span></div>
      <div className="ep-sc-body">
        <div className="ep-bar-chart">
          {[{ h: 85, l: 'JS', c: G }, { h: 70, l: 'Py', c: B }, { h: 55, l: 'ML', c: P }, { h: 92, l: 'SQL', c: G }, { h: 40, l: 'AWS', c: O }].map((b, i) => (
            <div key={i} className="ep-bar-col">
              <div className="ep-bar" style={{ height: `${b.h}%`, background: `linear-gradient(180deg, ${b.c}, ${b.c}44)`, animationDelay: `${i * 0.1 + 0.6}s` }} />
              <span className="ep-bar-pct">{b.h}%</span>
              <span className="ep-bar-label">{b.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScoreShowcase() {
  const r = 34, c = 2 * Math.PI * r
  return (
    <div className="ep-sc ep-sc-score">
      <div className="ep-score-ring">
        <svg viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#2a2a2a" strokeWidth="5" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="url(#scoreGrad)" strokeWidth="5"
            strokeDasharray={`${0.9 * c} ${c}`} strokeLinecap="round" transform="rotate(-90 40 40)"
            className="ep-score-circle" />
          <defs>
            <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={G} /><stop offset="100%" stopColor={B} />
            </linearGradient>
          </defs>
        </svg>
        <div className="ep-score-text">
          <span className="ep-score-num">90%</span>
          <span className="ep-score-lbl">MATCH</span>
        </div>
      </div>
      <div className="ep-score-label-row">
        <span className="ep-score-bar-label">Alignment</span>
        <div className="ep-mini-bar"><div className="ep-mini-bar-fill" style={{ width: '90%', background: G }} /></div>
      </div>
    </div>
  )
}

function InterviewShowcase() {
  return (
    <div className="ep-sc ep-sc-interview-large">
      <div className="ep-sc-hdr"><IcoMic size={16} color="#ef4444" /><span className="ep-sc-lbl">AI Interview Simulator</span><span className="ep-sc-live ep-sc-live-red">REC</span></div>
      <div className="ep-sc-body ep-iv-body-large">
        <div className="ep-iv-center">
          <div className="ep-iv-mic-container">
            <div className="ep-iv-mic">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <div className="ep-iv-waves">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="ep-iv-wave-ring" style={{ '--wave-delay': `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
          <div className="ep-iv-robot">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5">
              <rect x="3" y="8" width="18" height="10" rx="2" />
              <path d="M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
              <circle cx="9" cy="13" r="1" fill="currentColor" />
              <circle cx="15" cy="13" r="1" fill="currentColor" />
              <path d="M9 18h6" />
            </svg>
          </div>
        </div>
        <div className="ep-iv-chat-bubbles">
          <div className="ep-iv-bubble ep-iv-bubble-ai">
            <div className="ep-iv-bubble-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="8" width="18" height="10" rx="2" />
                <path d="M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <span className="ep-iv-bubble-text">Hi: the associate aror you get candidate answer?</span>
          </div>
          <div className="ep-iv-bubble ep-iv-bubble-feedback">
            <div className="ep-iv-bubble-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="8" width="18" height="10" rx="2" />
                <path d="M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <span className="ep-iv-bubble-lbl">AI FEEDBACK</span>
            <span className="ep-iv-bubble-text">Strong on technical skills, focus on leadership examples</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function RoadmapShowcase() {
  const weeks = [
    { w: 'W1', t: 'Foundations', c: G },
    { w: 'W2', t: 'Deep Dive', c: B },
    { w: 'W3', t: 'Practice', c: P },
    { w: 'W4', t: 'Interview', c: O },
  ]
  return (
    <div className="ep-sc ep-sc-roadmap">
      <div className="ep-sc-hdr"><IcoRoute size={15} color={O} /><span className="ep-sc-lbl">CAREER ROADMAP</span></div>
      <div className="ep-sc-body">
        <div className="ep-rm-flow">
          {weeks.map((w, i) => (
            <div key={i} className="ep-rm-node" style={{ animationDelay: `${i * 0.12 + 0.4}s` }}>
              <div className="ep-rm-dot" style={{ background: w.c, boxShadow: `0 0 12px ${w.c}88` }} />
              <div className="ep-rm-info">
                <span className="ep-rm-w">{w.w}</span>
                <span className="ep-rm-t">{w.t}</span>
              </div>
              {i < 3 && <div className="ep-rm-line" style={{ background: `linear-gradient(90deg, ${weeks[i].c}88, ${weeks[i + 1].c}88)` }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function JobSearchShowcase() {
  return (
    <div className="ep-sc ep-sc-jobs">
      <div className="ep-sc-hdr"><IcoSearch size={15} color={G} /><span className="ep-sc-lbl">JOB SCOUT</span><span className="ep-sc-live">LIVE</span></div>
      <div className="ep-sc-body">
        <div className="ep-job-search-bar">
          <span className="ep-job-search-icon"><IcoSearch size={12} color="#888" /></span>
          <span className="ep-job-search-text">Senior ML Engineer</span>
          <span className="ep-job-search-cursor" />
        </div>
        {[
          { title: 'ML Engineer — Google', match: '94%', c: G },
          { title: 'AI Research — Meta', match: '87%', c: B },
          { title: 'Data Scientist — Stripe', match: '82%', c: P },
        ].map((j, i) => (
          <div key={i} className="ep-job-row" style={{ animationDelay: `${i * 0.15 + 0.5}s` }}>
            <div className="ep-job-row-dot" style={{ background: j.c }} />
            <span className="ep-job-row-title">{j.title}</span>
            <span className="ep-job-row-match" style={{ color: j.c }}>{j.match}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalyticsShowcase() {
  return (
    <div className="ep-sc ep-sc-analytics">
      <div className="ep-sc-hdr"><IcoTrendUp size={15} color={G} /><span className="ep-sc-lbl">ANALYTICS</span></div>
      <div className="ep-sc-body">
        <svg className="ep-area-chart" viewBox="0 0 140 50" fill="none">
          <defs>
            <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={G} stopOpacity="0.3" />
              <stop offset="100%" stopColor={G} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points="0,42 15,35 30,38 50,22 70,28 90,14 110,18 130,6 140,10 140,50 0,50" fill="url(#ag)" />
          <polyline points="0,42 15,35 30,38 50,22 70,28 90,14 110,18 130,6 140,10" stroke={G} strokeWidth="2" fill="none" className="ep-anim-line" />
        </svg>
        <div className="ep-analytics-row">
          <div className="ep-an-stat"><span className="ep-an-val" style={{ color: G }}>+42%</span><span className="ep-an-lbl">Match Rate</span></div>
          <div className="ep-an-stat"><span className="ep-an-val" style={{ color: B }}>156</span><span className="ep-an-lbl">Skills</span></div>
          <div className="ep-an-stat"><span className="ep-an-val" style={{ color: P }}>30d</span><span className="ep-an-lbl">Roadmap</span></div>
        </div>
      </div>
    </div>
  )
}

function RadarShowcase() {
  const pts = 5, r = 28, cx = 35, cy = 35
  const angles = Array.from({ length: pts }, (_, i) => (i * 2 * Math.PI) / pts - Math.PI / 2)
  const skills = [0.9, 0.7, 0.55, 0.85, 0.6]
  const labels = ['JS', 'Py', 'ML', 'DevOps', 'DB']
  const polygon = skills.map((s, i) => `${cx + r * s * Math.cos(angles[i])},${cy + r * s * Math.sin(angles[i])}`).join(' ')
  return (
    <div className="ep-sc ep-sc-radar">
      <div className="ep-sc-hdr"><IcoBrain size={15} color={P} /><span className="ep-sc-lbl">SKILL RADAR</span></div>
      <svg viewBox="0 0 70 70" className="ep-radar-svg">
        {[0.33, 0.66, 1].map(s => (
          <polygon key={s} points={angles.map(a => `${cx + r * s * Math.cos(a)},${cy + r * s * Math.sin(a)}`).join(' ')}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        ))}
        {angles.map((a, i) => (
          <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        ))}
        <polygon points={polygon} fill={`${G}22`} stroke={G} strokeWidth="1.2" className="ep-radar-fill" />
        {skills.map((s, i) => (
          <text key={i} x={cx + (r + 6) * Math.cos(angles[i])} y={cy + (r + 6) * Math.sin(angles[i])}
            textAnchor="middle" dominantBaseline="middle" fill="#888" fontSize="4" fontWeight="600">{labels[i]}</text>
        ))}
      </svg>
    </div>
  )
}

/* ═══ Central Workflow Pipeline (Hero) ═══════════════════ */
function CentralWorkflowPipeline() {
  return null
}

/* ═══ Pipeline Flow ════════════════════════════════════ */
const PIPE_ICONS = [
  (c) => <IcoFile size={18} color={c} />,
  (c) => <IcoTarget size={18} color={c} />,
  (c) => <IcoSearch size={18} color={c} />,
  (c) => <IcoRoute size={18} color={c} />,
  (c) => <IcoMic size={18} color={c} />,
]
function PipelineFlow() {
  const steps = [
    { title: 'Upload Resume', desc: 'Drop your PDF or image. Mistral OCR reads it instantly.', color: G, tag: 'OCR' },
    { title: 'Match & Score', desc: 'AI analyzes your skills against any job description.', color: B, tag: 'AI ANALYSIS' },
    { title: 'Job Search', desc: 'Live Google search finds roles at target companies.', color: P, tag: 'SCOUT' },
    { title: 'Roadmap', desc: '30-day personalized plan to close your skill gaps.', color: O, tag: 'STRATEGY' },
    { title: 'AI Interview', desc: 'Mock interview with AI that knows your resume.', color: G, tag: 'SIMULATOR' },
  ]
  return (
    <div className="ep-pipeline-track">
      <div className="ep-pipeline-line" />
      <div className="ep-pipeline-line-glow" />
      {steps.map((st, i) => (
        <div key={i} className="ep-pipe-step" style={{ '--ac': st.color, animationDelay: `${i * 0.15}s` }}>
          <div className="ep-pipe-dot-wrap">
            <div className="ep-pipe-dot" style={{ background: st.color, boxShadow: `0 0 20px ${st.color}66` }}>
              {PIPE_ICONS[i]('#fff')}
            </div>
            <div className="ep-pipe-ring" style={{ borderColor: `${st.color}44` }} />
          </div>
          <div className="ep-pipe-card">
            <span className="ep-pipe-tag" style={{ background: `${st.color}15`, color: st.color, borderColor: `${st.color}33` }}>{st.tag}</span>
            <h3 className="ep-pipe-title">{st.title}</h3>
            <p className="ep-pipe-desc">{st.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══ Live Job Search Visual ═══════════════════════════ */
function JobSearchLive() {
  const jobs = [
    { title: 'Senior ML Engineer', company: 'Google', location: 'Mountain View, CA', match: 94, color: G, posted: '2d ago' },
    { title: 'AI Research Scientist', company: 'Meta', location: 'New York, NY', match: 87, color: B, posted: '5d ago' },
    { title: 'Data Scientist Lead', company: 'Stripe', location: 'San Francisco, CA', match: 82, color: P, posted: '1d ago' },
    { title: 'ML Platform Engineer', company: 'Netflix', location: 'Los Gatos, CA', match: 79, color: O, posted: '3d ago' },
  ]
  return (
    <div className="ep-jl-card">
      <div className="ep-jl-header">
        <div className="ep-jl-search">
          <span className="ep-jl-search-icon"><IcoSearch size={16} color="#888" /></span>
          <span className="ep-jl-search-q">ML Engineer — San Francisco</span>
        </div>
        <div className="ep-jl-meta"><span className="ep-jl-count">23 results</span><span className="ep-jl-live-dot" /> Live</div>
      </div>
      <div className="ep-jl-list">
        {jobs.map((j, i) => (
          <div key={i} className="ep-jl-row" style={{ animationDelay: `${i * 0.12}s` }}>
            <div className="ep-jl-row-left">
              <div className="ep-jl-company-icon" style={{ background: `${j.color}18`, borderColor: `${j.color}33` }}>
                {j.company[0]}
              </div>
              <div>
                <div className="ep-jl-title">{j.title}</div>
                <div className="ep-jl-company">{j.company} · {j.location}</div>
              </div>
            </div>
            <div className="ep-jl-row-right">
              <span className="ep-jl-posted">{j.posted}</span>
              <div className="ep-jl-match" style={{ background: `${j.color}18`, color: j.color, borderColor: `${j.color}44` }}>
                {j.match}% match
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="ep-jl-footer">
        <span className="ep-jl-footer-text">Scanning 4 job platforms...</span>
        <div className="ep-jl-progress"><div className="ep-jl-progress-bar" /></div>
      </div>
    </div>
  )
}

/* ═══ Feature Card ═════════════════════════════════════ */
const FEAT_ICONS = [
  (c) => <IcoSearch size={22} color={c} />,
  (c) => <IcoBarChart size={22} color={c} />,
  (c) => <IcoClipboard size={22} color={c} />,
  (c) => <IcoSpeaker size={22} color={c} />,
  (c) => <IcoSparkle size={22} color={c} />,
  (c) => <IcoLineChart size={22} color={c} />,
]
const FEATURES = [
  { title: 'Live Job Market Scan', desc: 'Real-time Google search finds roles at your target company and competitors. Direct links to apply.', color: G },
  { title: 'Visual Skills Breakdown', desc: 'Interactive charts showing matched vs missing skills by priority tier with gap analysis.', color: B },
  { title: 'PDF Career Report', desc: 'Download a multi-page report with charts, scores, roadmap, and personalized recommendations.', color: P },
  { title: 'Voice-Powered Interview', desc: 'Speak your answers naturally — AI transcribes and evaluates your responses in real time.', color: O },
  { title: 'Personalized Questions', desc: 'Every interview question references your actual resume, skills, and target role.', color: G },
  { title: 'Performance Report', desc: 'Get a hire/no-hire recommendation, strengths, weaknesses, and preparation topics.', color: B },
]

function FeatureCard({ f, i }) {
  return (
    <div className="ep-feat" style={{ '--ac': f.color, animationDelay: `${i * 0.06}s` }}>
      <div className="ep-feat-icon" style={{ background: `${f.color}10`, borderColor: `${f.color}30` }}>{FEAT_ICONS[i](f.color)}</div>
      <h3 className="ep-feat-title">{f.title}</h3>
      <p className="ep-feat-desc">{f.desc}</p>
      <div className="ep-feat-glow" style={{ background: f.color }} />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════════════ */
const CSS = `
/* ── Base ──────────────────────────────────────────── */
.ep-root{width:100%;min-height:100vh;background:#0a0a0a;color:#fff;font-family:'Inter','Segoe UI',system-ui,sans-serif;overflow-x:hidden;overflow-y:auto;}

/* ── HERO ──────────────────────────────────────────── */
.ep-hero{position:relative;min-height:100vh;display:flex;flex-direction:column;overflow:hidden;padding:20px 24px 60px;}
.ep-grid-bg{position:absolute;inset:0;background-image:linear-gradient(rgba(29,185,84,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(29,185,84,0.06) 1px,transparent 1px);background-size:50px 50px;z-index:0;opacity:0.4;}
.ep-hero-layout{position:relative;z-index:10;display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:32px;max-width:1600px;margin:20px auto 0;align-items:start;padding:0 24px;}
.ep-hero-left,.ep-hero-right{display:flex;flex-direction:column;gap:20px;width:100%;}
.ep-hero-center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;position:relative;}
.ep-hero-center-content{text-align:center;z-index:5;}
.ep-hero-card-group{display:flex;flex-direction:column;gap:16px;width:100%;animation:ep-card-in 0.8s ease both;}
.ep-hero-card-group:nth-child(2){animation-delay:0.2s;}
.ep-hero-card-primary{width:100%;}
.ep-hero-card-secondary-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;margin-top:16px;}
@keyframes ep-card-in{from{opacity:0;transform:translateY(30px);}to{opacity:1;transform:translateY(0);}}

/* Particles */
.ep-particles{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;}
.ep-particle{position:absolute;border-radius:50%;background:#1DB954;animation:ep-drift linear infinite;}
@keyframes ep-drift{0%{transform:translateY(0) translateX(0);opacity:0;}10%{opacity:1;}90%{opacity:1;}100%{transform:translateY(-100vh) translateX(30px);opacity:0;}}

/* Glow orbs */
.ep-glow-orb{position:absolute;border-radius:50%;filter:blur(120px);z-index:0;pointer-events:none;}
.ep-glow-1{width:700px;height:700px;top:-15%;left:-8%;background:radial-gradient(circle,rgba(29,185,84,0.18) 0%,transparent 70%);animation:ep-orb 14s ease-in-out infinite;}
.ep-glow-2{width:600px;height:600px;bottom:-12%;right:-6%;background:radial-gradient(circle,rgba(59,130,246,0.12) 0%,transparent 70%);animation:ep-orb 18s ease-in-out infinite reverse;}
.ep-glow-3{width:500px;height:500px;top:25%;right:15%;background:radial-gradient(circle,rgba(139,92,246,0.1) 0%,transparent 70%);animation:ep-orb 12s ease-in-out infinite 3s;}
.ep-glow-4{width:400px;height:400px;bottom:20%;left:20%;background:radial-gradient(circle,rgba(245,158,11,0.08) 0%,transparent 70%);animation:ep-orb 16s ease-in-out infinite 5s;}
@keyframes ep-orb{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(40px,-30px) scale(1.08);}66%{transform:translate(-30px,20px) scale(0.92);}}

/* Glow lines */
.ep-glow-lines{position:absolute;inset:0;width:100%;height:100%;z-index:0;opacity:0.5;pointer-events:none;}
.ep-line-draw{stroke-dasharray:2200;stroke-dashoffset:2200;animation:ep-draw 3.5s ease-out forwards;}
@keyframes ep-draw{to{stroke-dashoffset:0;}}

/* ── Nav ───────────────────────────────────────────── */
.ep-nav{position:absolute;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:20px 40px;animation:ep-fade-down 0.8s ease both;}
@keyframes ep-fade-down{from{opacity:0;transform:translateY(-16px);}to{opacity:1;transform:translateY(0);}}
.ep-nav-logo{display:flex;align-items:center;gap:10px;}
.ep-logo-icon{width:36px;height:36px;border-radius:10px;background:rgba(29,185,84,0.08);border:1px solid rgba(29,185,84,0.25);display:flex;align-items:center;justify-content:center;font-size:1.1rem;position:relative;}
.ep-logo-pulse{position:absolute;inset:-3px;border-radius:12px;border:1px solid rgba(29,185,84,0.2);animation:ep-logo-p 2.5s ease-in-out infinite;}
@keyframes ep-logo-p{0%,100%{opacity:0.3;transform:scale(1);}50%{opacity:0;transform:scale(1.3);}}
.ep-logo-text{font-size:1.05rem;font-weight:800;letter-spacing:-0.02em;color:#fff;}
.ep-nav-links{display:flex;align-items:center;gap:24px;}
.ep-nav-link{color:#888;font-size:0.88rem;font-weight:500;text-decoration:none;transition:color 0.2s;}
.ep-nav-link:hover{color:#fff;}
.ep-nav-cta{padding:8px 20px;border-radius:8px;border:1px solid rgba(29,185,84,0.4);background:rgba(29,185,84,0.1);color:#1DB954;font-size:0.85rem;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit;}
.ep-nav-cta:hover{background:rgba(29,185,84,0.2);border-color:#1DB954;box-shadow:0 0 20px rgba(29,185,84,0.2);}

/* ── Hero Center ───────────────────────────────────── */
.ep-hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(29,185,84,0.08);border:1px solid rgba(29,185,84,0.25);border-radius:30px;padding:6px 20px;font-size:0.78rem;font-weight:600;color:#1DB954;letter-spacing:0.04em;margin-bottom:28px;animation:ep-up 0.8s ease both;}
.ep-badge-dot{width:7px;height:7px;border-radius:50%;background:#1DB954;box-shadow:0 0 10px #1DB954;animation:ep-pdot 2s ease-in-out infinite;}
@keyframes ep-pdot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.4;transform:scale(1.5);}}
.ep-hero-title{font-size:clamp(2rem,5vw,3.5rem);font-weight:900;line-height:1.1;letter-spacing:-0.03em;margin:0 0 24px;animation:ep-up 0.8s ease 0.1s both;text-transform:uppercase;}
.ep-title-accent{background:linear-gradient(135deg,#1DB954 0%,#3b82f6 50%,#8b5cf6 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.ep-cta-hero{margin-top:8px;}
@keyframes ep-up{from{opacity:0;transform:translateY(28px);}to{opacity:1;transform:translateY(0);}}

/* ── Central Workflow Pipeline ─────────────────────── */
.ep-workflow-pipeline{position:relative;width:100%;height:200px;margin-top:20px;}
.ep-workflow-svg{position:absolute;inset:0;width:100%;height:100%;}
.ep-workflow-line{stroke-dasharray:600;stroke-dashoffset:600;animation:ep-workflow-draw 2s ease-out 0.5s forwards;}
@keyframes ep-workflow-draw{to{stroke-dashoffset:0;}}
.ep-workflow-nodes{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:center;padding:0 20px;}
.ep-workflow-node{display:flex;flex-direction:column;align-items:center;gap:8px;animation:ep-up 0.6s ease both;}
.ep-workflow-node-circle{width:48px;height:48px;border-radius:50%;background:var(--node-color);display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px var(--node-color),0 0 40px var(--node-color);border:2px solid rgba(255,255,255,0.1);transition:all 0.3s;}
.ep-workflow-node:hover .ep-workflow-node-circle{transform:scale(1.15);box-shadow:0 0 30px var(--node-color),0 0 60px var(--node-color);}
.ep-workflow-node-label{font-size:0.65rem;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.05em;margin-top:4px;}

/* CTA */
.ep-cta{display:inline-flex;align-items:center;gap:10px;padding:14px 36px;font-size:1rem;font-weight:700;font-family:inherit;color:#fff;background:#1DB954;border:none;border-radius:12px;cursor:pointer;box-shadow:0 0 30px rgba(29,185,84,0.35),0 4px 20px rgba(0,0,0,0.3);transition:all 0.3s cubic-bezier(0.4,0,0.2,1);position:relative;overflow:hidden;}
.ep-cta::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,transparent 30%,rgba(255,255,255,0.15) 50%,transparent 70%);transform:translateX(-100%);transition:transform 0.5s;}
.ep-cta:hover::before{transform:translateX(100%);}
.ep-cta:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 0 50px rgba(29,185,84,0.5),0 8px 30px rgba(0,0,0,0.4);background:#22d35e;}
.ep-cta-arrow{font-size:1.2rem;transition:transform 0.2s;}.ep-cta:hover .ep-cta-arrow{transform:translateX(4px);}
.ep-cta-lg{padding:16px 44px;font-size:1.1rem;}
.ep-cta-secondary{color:#888;font-size:0.95rem;font-weight:500;text-decoration:none;padding:14px 24px;border-radius:12px;border:1px solid #2a2a2a;transition:all 0.2s;background:transparent;font-family:inherit;cursor:pointer;}
.ep-cta-secondary:hover{color:#fff;border-color:#555;background:rgba(255,255,255,0.04);}

/* Scroll hint */
.ep-scroll-hint{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;z-index:10;animation:ep-up 1s ease 0.8s both;color:#555;font-size:0.7rem;letter-spacing:0.06em;}
.ep-scroll-mouse{width:20px;height:30px;border:1.5px solid rgba(255,255,255,0.2);border-radius:10px;position:relative;}
.ep-scroll-wheel{width:3px;height:6px;background:rgba(29,185,84,0.6);border-radius:2px;position:absolute;top:5px;left:50%;transform:translateX(-50%);animation:ep-scroll-w 1.5s ease-in-out infinite;}
@keyframes ep-scroll-w{0%{transform:translateX(-50%) translateY(0);opacity:1;}100%{transform:translateX(-50%) translateY(10px);opacity:0;}}


/* ── Showcase Card ─────────────────────────────────── */
.ep-sc{background:rgba(22,22,22,0.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:16px 18px;box-shadow:0 8px 40px rgba(0,0,0,0.6),0 0 1px rgba(255,255,255,0.1);width:100%;transition:all 0.3s ease;}
.ep-sc:hover{border-color:rgba(255,255,255,0.12);box-shadow:0 12px 50px rgba(0,0,0,0.7),0 0 2px rgba(255,255,255,0.15);transform:translateY(-2px);}
.ep-sc-hdr{display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:0.9rem;}
.ep-sc-lbl{font-size:0.65rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.6);flex:1;}
.ep-sc-live{font-size:0.52rem;font-weight:800;color:#1DB954;background:rgba(29,185,84,0.15);border:1px solid rgba(29,185,84,0.3);border-radius:4px;padding:2px 6px;letter-spacing:0.06em;animation:ep-blink 2s ease-in-out infinite;}
.ep-sc-live-red{color:#ef4444;background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.3);}
@keyframes ep-blink{0%,100%{opacity:1;}50%{opacity:0.4;}}
.ep-sc-body{position:relative;}

/* Resume SC */
.ep-sc-resume{width:100%;}
.ep-sc-resume-large{width:100%;}
.ep-resume-doc{display:flex;gap:10px;padding:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;position:relative;overflow:hidden;}
.ep-resume-doc-large{padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;position:relative;overflow:hidden;}
.ep-resume-header{display:flex;gap:12px;margin-bottom:16px;align-items:start;}
.ep-resume-photo{width:36px;height:44px;border-radius:6px;background:linear-gradient(135deg,rgba(29,185,84,0.3),rgba(59,130,246,0.2));border:1px solid rgba(29,185,84,0.3);flex-shrink:0;}
.ep-resume-photo-large{width:50px;height:60px;border-radius:8px;background:linear-gradient(135deg,rgba(29,185,84,0.4),rgba(59,130,246,0.3));border:1px solid rgba(29,185,84,0.4);flex-shrink:0;position:relative;overflow:hidden;}
.ep-photo-placeholder{width:100%;height:100%;background:linear-gradient(135deg,#1DB95433,#3b82f633);border-radius:8px;}
.ep-resume-name{flex:1;display:flex;flex-direction:column;gap:6px;padding-top:4px;}
.ep-name-line{height:6px;border-radius:3px;background:rgba(255,255,255,0.1);width:70%;}
.ep-name-line-short{width:50%;}
.ep-resume-section{margin-bottom:14px;}
.ep-section-title-line{height:5px;border-radius:2px;background:rgba(29,185,84,0.2);width:40%;margin-bottom:10px;}
.ep-section-title-short{width:30%;}
.ep-resume-lines{display:flex;flex-direction:column;gap:4px;flex:1;padding-top:2px;}
.ep-line-block{height:4px;border-radius:2px;background:rgba(255,255,255,0.08);animation:ep-line-shimmer 2s ease infinite;}
@keyframes ep-line-shimmer{0%,100%{opacity:0.5;}50%{opacity:1;}}
.ep-scan-line{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#1DB954,transparent);box-shadow:0 0 15px #1DB954;animation:ep-scan 2.5s ease-in-out infinite;top:0;}
.ep-scan-line-large{position:absolute;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#1DB954,transparent);box-shadow:0 0 20px #1DB954,0 0 40px #1DB95444;animation:ep-scan 2.5s ease-in-out infinite;top:0;z-index:2;}
@keyframes ep-scan{0%,100%{top:0;opacity:0;}10%{opacity:1;}90%{opacity:1;}100%{top:100%;opacity:0;}}
.ep-resume-tags{display:flex;gap:5px;margin-top:12px;flex-wrap:wrap;}
.ep-tag{font-size:0.55rem;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.04em;}
.ep-tag-g{background:rgba(29,185,84,0.15);color:#1DB954;border:1px solid rgba(29,185,84,0.3);}
.ep-tag-b{background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);}
.ep-tag-p{background:rgba(139,92,246,0.15);color:#8b5cf6;border:1px solid rgba(139,92,246,0.3);}

/* Charts SC */
.ep-sc-charts{width:100%;}
.ep-bar-chart{display:flex;align-items:flex-end;gap:6px;height:65px;}
.ep-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;gap:2px;}
.ep-bar{width:100%;border-radius:3px 3px 0 0;animation:ep-bg 1s ease both;}
@keyframes ep-bg{from{height:0!important;}}
.ep-bar-pct{font-size:0.48rem;font-weight:700;color:rgba(255,255,255,0.5);}
.ep-bar-label{font-size:0.5rem;color:rgba(255,255,255,0.3);font-weight:600;}

/* Score SC */
.ep-sc-score{width:100%;padding:16px;}
.ep-score-ring{position:relative;width:80px;height:80px;margin:0 auto 8px;}
.ep-score-ring svg{width:100%;height:100%;}
.ep-score-circle{animation:ep-rf 1.5s ease 0.5s both;}
@keyframes ep-rf{from{stroke-dasharray:0 999;}}
.ep-score-text{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.ep-score-num{font-size:1.4rem;font-weight:900;color:#1DB954;line-height:1;}
.ep-score-lbl{font-size:0.5rem;color:#888;font-weight:600;letter-spacing:0.06em;margin-top:2px;}
.ep-score-label-row{display:flex;align-items:center;gap:6px;font-size:0.55rem;}
.ep-score-bar-label{color:#888;font-weight:600;white-space:nowrap;}
.ep-mini-bar{flex:1;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;}
.ep-mini-bar-fill{height:100%;border-radius:2px;animation:ep-mbar 1.5s ease 0.8s both;}
@keyframes ep-mbar{from{width:0!important;}}

/* Interview SC */
.ep-sc-interview{width:100%;}
.ep-sc-interview-large{width:100%;}
.ep-iv-body{display:flex;flex-direction:column;gap:8px;}
.ep-iv-body-large{display:flex;flex-direction:column;gap:16px;min-height:280px;}
.ep-iv-center{display:flex;align-items:center;justify-content:center;gap:24px;position:relative;padding:20px 0;}
.ep-iv-mic-container{position:relative;display:flex;align-items:center;justify-content:center;}
.ep-iv-mic{width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;position:relative;z-index:2;}
.ep-iv-waves{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
.ep-iv-wave-ring{position:absolute;width:60px;height:60px;border:2px solid #1DB954;border-radius:50%;opacity:0;animation:ep-wave-pulse 2s ease-out infinite;animation-delay:var(--wave-delay);}
@keyframes ep-wave-pulse{0%{transform:scale(0.8);opacity:0.8;}100%{transform:scale(2.5);opacity:0;}}
.ep-iv-robot{width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;color:#888;}
.ep-iv-chat-bubbles{display:flex;flex-direction:column;gap:10px;}
.ep-iv-bubble{background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:10px 12px;font-size:0.65rem;color:rgba(255,255,255,0.7);line-height:1.5;display:flex;flex-direction:column;gap:4px;position:relative;}
.ep-iv-bubble-ai{background:rgba(139,92,246,0.08);border-color:rgba(139,92,246,0.2);}
.ep-iv-bubble-feedback{background:rgba(29,185,84,0.08);border-color:rgba(29,185,84,0.2);}
.ep-iv-bubble-icon{width:16px;height:16px;border-radius:50%;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.3);display:flex;align-items:center;justify-content:center;margin-bottom:4px;color:#3b82f6;}
.ep-iv-bubble-text{font-size:0.6rem;line-height:1.4;}
.ep-iv-bubble-lbl{font-size:0.55rem;font-weight:700;color:#1DB954;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:2px;}

/* Roadmap SC */
.ep-sc-roadmap{width:100%;}
.ep-rm-flow{display:flex;flex-direction:column;gap:0;position:relative;}
.ep-rm-node{display:flex;align-items:center;gap:10px;padding:4px 0;position:relative;animation:ep-up 0.5s ease both;}
.ep-rm-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;z-index:1;}
.ep-rm-info{display:flex;gap:8px;align-items:center;}
.ep-rm-w{font-size:0.55rem;font-weight:800;color:rgba(255,255,255,0.4);letter-spacing:0.05em;}
.ep-rm-t{font-size:0.65rem;font-weight:600;color:rgba(255,255,255,0.7);}
.ep-rm-line{position:absolute;left:4px;top:14px;width:2px;height:100%;opacity:0.4;z-index:0;}

/* Jobs SC */
.ep-sc-jobs{width:100%;}
.ep-job-search-bar{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:6px 10px;margin-bottom:8px;}
.ep-job-search-icon{font-size:0.7rem;opacity:0.5;}
.ep-job-search-text{font-size:0.65rem;color:rgba(255,255,255,0.6);flex:1;}
.ep-job-search-cursor{width:1px;height:12px;background:#1DB954;animation:ep-blink 1s step-end infinite;}
.ep-job-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.02);margin-bottom:3px;animation:ep-up 0.4s ease both;}
.ep-job-row-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.ep-job-row-title{font-size:0.6rem;color:rgba(255,255,255,0.7);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ep-job-row-match{font-size:0.55rem;font-weight:800;flex-shrink:0;}

/* Analytics SC */
.ep-sc-analytics{width:100%;}
.ep-area-chart{width:100%;height:50px;margin-bottom:6px;}
.ep-anim-line{stroke-dasharray:300;stroke-dashoffset:300;animation:ep-draw 2s ease 0.4s forwards;}
.ep-analytics-row{display:flex;gap:10px;}
.ep-an-stat{display:flex;flex-direction:column;}
.ep-an-val{font-size:0.85rem;font-weight:800;}
.ep-an-lbl{font-size:0.48rem;color:#888;font-weight:600;}

/* Radar SC */
.ep-sc-radar{width:100%;padding:12px;}
.ep-radar-svg{width:100%;height:90px;}
.ep-radar-fill{animation:ep-radar-in 1s ease 0.5s both;}
@keyframes ep-radar-in{from{opacity:0;transform:scale(0.5);}to{opacity:1;transform:scale(1);}}

/* ═════ PIPELINE ═══════════════════════════════════ */
.ep-pipeline{max-width:1000px;margin:0 auto;padding:100px 24px 80px;position:relative;}
.ep-section-badge{display:inline-block;font-size:0.7rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;padding:5px 16px;border-radius:20px;border:1px solid rgba(29,185,84,0.3);background:rgba(29,185,84,0.08);color:#1DB954;margin-bottom:16px;text-align:center;width:fit-content;margin-left:auto;margin-right:auto;}
.ep-section-title{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:800;letter-spacing:-0.03em;text-align:center;margin:0 0 10px;}
.ep-section-sub{text-align:center;font-size:1rem;color:#888;margin:0 auto 56px;max-width:500px;}
.ep-pipeline-track{position:relative;display:flex;flex-direction:column;gap:0;padding-left:40px;}
.ep-pipeline-line{position:absolute;left:19px;top:0;bottom:0;width:2px;background:rgba(255,255,255,0.06);}
.ep-pipeline-line-glow{position:absolute;left:18px;top:0;width:4px;height:0;background:linear-gradient(180deg,#1DB954,#3b82f6,#8b5cf6,#f59e0b,#1DB954);border-radius:2px;animation:ep-pipe-fill 2s ease 0.5s forwards;box-shadow:0 0 12px rgba(29,185,84,0.3);}
@keyframes ep-pipe-fill{to{height:100%;}}
.ep-pipe-step{display:flex;align-items:flex-start;gap:20px;position:relative;padding-bottom:32px;animation:ep-up 0.6s ease both;}
.ep-pipe-dot-wrap{position:absolute;left:-40px;top:4px;width:38px;height:38px;}
.ep-pipe-dot{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.1rem;position:relative;z-index:2;}
.ep-pipe-ring{position:absolute;inset:-5px;border-radius:50%;border:1.5px solid;animation:ep-ring-p 2.5s ease-in-out infinite;}
@keyframes ep-ring-p{0%,100%{transform:scale(1);opacity:0.4;}50%{transform:scale(1.35);opacity:0;}}
.ep-pipe-card{flex:1;background:rgba(28,28,28,0.6);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:20px 24px;backdrop-filter:blur(10px);transition:all 0.3s;cursor:default;}
.ep-pipe-card:hover{border-color:rgba(255,255,255,0.12);background:rgba(28,28,28,0.85);transform:translateX(6px);box-shadow:0 8px 30px rgba(0,0,0,0.3);}
.ep-pipe-tag{display:inline-block;font-size:0.6rem;font-weight:800;letter-spacing:0.1em;padding:3px 10px;border-radius:6px;border:1px solid;margin-bottom:8px;}
.ep-pipe-title{font-size:1.1rem;font-weight:700;color:#fff;margin:0 0 6px;}
.ep-pipe-desc{font-size:0.85rem;color:#888;line-height:1.6;margin:0;}

/* ═════ JOBS SECTION ════════════════════════════════ */
.ep-jobs-section{padding:80px 24px;background:linear-gradient(180deg,transparent 0%,rgba(59,130,246,0.03) 50%,transparent 100%);position:relative;overflow:hidden;}
.ep-jobs-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1.2fr;gap:60px;align-items:center;}
.ep-jobs-text{display:flex;flex-direction:column;}
.ep-jobs-desc{font-size:1rem;color:#aaa;line-height:1.75;margin:16px 0 24px;}
.ep-jobs-features{display:flex;flex-direction:column;gap:10px;}
.ep-jf{display:flex;align-items:center;gap:10px;font-size:0.9rem;color:rgba(255,255,255,0.75);}
.ep-jf-icon{font-size:1rem;font-weight:700;}

/* Live jobs card */
.ep-jl-card{background:rgba(22,22,22,0.8);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:20px;box-shadow:0 12px 50px rgba(0,0,0,0.5);}
.ep-jl-header{margin-bottom:16px;display:flex;flex-direction:column;gap:10px;}
.ep-jl-search{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 14px;}
.ep-jl-search-icon{font-size:1rem;}
.ep-jl-search-q{font-size:0.9rem;color:rgba(255,255,255,0.7);font-weight:500;}
.ep-jl-meta{display:flex;align-items:center;gap:8px;font-size:0.75rem;color:#888;}
.ep-jl-count{font-weight:600;}
.ep-jl-live-dot{width:6px;height:6px;border-radius:50%;background:#1DB954;animation:ep-pdot 2s ease-in-out infinite;}
.ep-jl-list{display:flex;flex-direction:column;gap:6px;}
.ep-jl-row{display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:10px;transition:all 0.2s;animation:ep-up 0.5s ease both;}
.ep-jl-row:hover{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.08);}
.ep-jl-row-left{display:flex;align-items:center;gap:12px;flex:1;min-width:0;}
.ep-jl-company-icon{width:36px;height:36px;border-radius:10px;border:1px solid;display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:800;color:#fff;flex-shrink:0;}
.ep-jl-title{font-size:0.88rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ep-jl-company{font-size:0.72rem;color:#888;margin-top:2px;}
.ep-jl-row-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}
.ep-jl-posted{font-size:0.68rem;color:#666;}
.ep-jl-match{font-size:0.7rem;font-weight:700;padding:4px 10px;border-radius:8px;border:1px solid;white-space:nowrap;}
.ep-jl-footer{margin-top:14px;display:flex;align-items:center;gap:12px;}
.ep-jl-footer-text{font-size:0.72rem;color:#666;font-weight:500;}
.ep-jl-progress{flex:1;height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;}
.ep-jl-progress-bar{height:100%;width:65%;background:linear-gradient(90deg,#1DB954,#3b82f6);border-radius:2px;animation:ep-prog 3s ease-in-out infinite;}
@keyframes ep-prog{0%{width:0;transform:translateX(0);}50%{width:65%;}100%{width:100%;transform:translateX(0);}}

/* ═════ FEATURES ═══════════════════════════════════ */
.ep-section{max-width:1100px;margin:0 auto;padding:100px 24px;position:relative;}
.ep-features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
.ep-feat{background:#1c1c1c;border:1px solid #2a2a2a;border-radius:16px;padding:28px 24px;display:flex;flex-direction:column;gap:12px;transition:all 0.35s cubic-bezier(0.4,0,0.2,1);position:relative;overflow:hidden;animation:ep-up 0.5s ease both;}
.ep-feat:hover{border-color:color-mix(in srgb,var(--ac) 50%,transparent);transform:translateY(-6px);box-shadow:0 0 30px color-mix(in srgb,var(--ac) 15%,transparent),0 12px 40px rgba(0,0,0,0.3);}
.ep-feat-icon{width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;border:1px solid;}
.ep-feat-title{font-size:1rem;font-weight:700;color:#fff;margin:0;}
.ep-feat-desc{font-size:0.84rem;color:#888;line-height:1.65;margin:0;}
.ep-feat-glow{position:absolute;bottom:-40px;right:-40px;width:120px;height:120px;border-radius:50%;filter:blur(60px);opacity:0;transition:opacity 0.4s;pointer-events:none;}
.ep-feat:hover .ep-feat-glow{opacity:0.15;}

/* ═════ FOOTER ═════════════════════════════════════ */
.ep-footer{position:relative;display:flex;flex-direction:column;align-items:center;padding:120px 24px 140px;text-align:center;overflow:hidden;}
.ep-footer-glow{position:absolute;bottom:-150px;left:50%;transform:translateX(-50%);width:800px;height:400px;background:radial-gradient(ellipse,rgba(29,185,84,0.15) 0%,transparent 70%);pointer-events:none;}
.ep-footer-title{font-size:clamp(1.6rem,3.5vw,2.6rem);font-weight:900;letter-spacing:-0.03em;margin:0 0 14px;position:relative;line-height:1.2;}
.ep-footer-sub{font-size:1rem;color:#888;margin:0 0 40px;position:relative;max-width:480px;}

/* ═════ RESPONSIVE ═════════════════════════════════ */
@media(max-width:1400px){
  .ep-hero-layout{gap:28px;padding:0 20px;}
}
@media(max-width:1200px){
  .ep-hero-layout{grid-template-columns:1fr;gap:32px;margin-top:20px;}
  .ep-hero-left,.ep-hero-right{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;width:100%;}
  .ep-hero-card-group{width:100%;}
  .ep-hero-card-secondary-row{grid-template-columns:1fr;}
  .ep-workflow-pipeline{height:150px;}
  .ep-workflow-node-circle{width:40px;height:40px;}
}
@media(max-width:900px){
  .ep-features-grid{grid-template-columns:repeat(2,1fr);}
  .ep-jobs-inner{grid-template-columns:1fr;gap:40px;}
  .ep-nav-links .ep-nav-link{display:none;}
  .ep-hero-left,.ep-hero-right{grid-template-columns:1fr;gap:20px;}
  .ep-hero-card-secondary-row{grid-template-columns:1fr 1fr;}
  .ep-workflow-nodes{padding:0 10px;}
  .ep-workflow-node-circle{width:36px;height:36px;}
  .ep-workflow-node-label{font-size:0.55rem;}
}
@media(max-width:600px){
  .ep-features-grid{grid-template-columns:1fr;}
  .ep-hero{min-height:90vh;padding:20px 16px 40px;}
  .ep-pipeline-track{padding-left:30px;}
  .ep-hero-layout{margin-top:20px;gap:24px;padding:0 12px;}
  .ep-hero-left,.ep-hero-right{grid-template-columns:1fr;gap:16px;}
  .ep-hero-card-secondary-row{grid-template-columns:1fr;}
  .ep-workflow-pipeline{height:120px;}
  .ep-workflow-node-circle{width:32px;height:32px;}
}
`
