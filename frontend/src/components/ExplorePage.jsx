import { useState, useEffect, useRef } from 'react'

const G = '#1DB954', B = '#3b82f6', P = '#8b5cf6'

/* ─── Noise/particle background ────────────────────────── */
function Particles({ count = 50 }) {
  const items = useRef(
    Array.from({ length: count }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      dur: Math.random() * 30 + 20,
      delay: Math.random() * -30,
      opacity: Math.random() * 0.25 + 0.05,
    }))
  ).current
  return (
    <div className="lp-particles" aria-hidden="true">
      {items.map((p, i) => (
        <div key={i} className="lp-particle" style={{
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

/* ─── Animated terminal lines in hero ──────────────────── */
const LINES = [
  { text: '> Analyzing resume...', color: '#666' },
  { text: '  Extracted 14 skills', color: G },
  { text: '> Matching job description...', color: '#666' },
  { text: '  Match score: 87% — Strong fit', color: '#f59e0b' },
  { text: '> Building 30-day roadmap...', color: '#666' },
  { text: '  Ready. 12 prep tasks generated._', color: G },
]

function Terminal() {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (n >= LINES.length) return
    const t = setTimeout(() => setN(v => v + 1), n === 0 ? 600 : 700)
    return () => clearTimeout(t)
  }, [n])
  return (
    <div className="lp-term">
      <div className="lp-term-bar">
        <span className="lp-dot lp-dot-r" /><span className="lp-dot lp-dot-y" /><span className="lp-dot lp-dot-g" />
        <span className="lp-term-title">skillora.ai</span>
      </div>
      <div className="lp-term-body">
        {LINES.slice(0, n).map((l, i) => (
          <div key={i} className="lp-term-line" style={{ color: l.color }}>
            {l.text}
            {i === n - 1 && n < LINES.length && <span className="lp-cursor" />}
          </div>
        ))}
        {n >= LINES.length && <span className="lp-cursor" />}
      </div>
    </div>
  )
}

/* ─── Product dashboard mockup ──────────────────────────── */
function DashboardMockup() {
  const r = 42, circ = 2 * Math.PI * r
  const skills = [
    { label: 'Python',     pct: 92, color: G },
    { label: 'React',      pct: 78, color: B },
    { label: 'ML/AI',      pct: 65, color: P },
    { label: 'System Design', pct: 54, color: '#f59e0b' },
  ]
  return (
    <div className="lp-dash">
      {/* Window chrome */}
      <div className="lp-dash-chrome">
        <span className="lp-dot lp-dot-r" /><span className="lp-dot lp-dot-y" /><span className="lp-dot lp-dot-g" />
        <span className="lp-dash-url">app.careeranalyst.ai / dashboard</span>
      </div>

      {/* Inner layout */}
      <div className="lp-dash-body">
        {/* Left sidebar */}
        <div className="lp-dash-sidebar">
          <div className="lp-dash-logo">CA</div>
          {['Dashboard', 'Resume', 'Jobs', 'Roadmap', 'Interview'].map((t, i) => (
            <div key={i} className={`lp-sb-item${i === 0 ? ' lp-sb-active' : ''}`}>{t}</div>
          ))}
        </div>

        {/* Main area */}
        <div className="lp-dash-main">
          {/* Top row */}
          <div className="lp-dash-row">
            {/* Resume card */}
            <div className="lp-dash-card lp-card-resume">
              <div className="lp-card-label">Resume Analysis</div>
              <div className="lp-resume-preview">
                <div className="lp-resume-avatar" />
                <div className="lp-resume-lines">
                  <div className="lp-rl lp-rl-80" />
                  <div className="lp-rl lp-rl-55" />
                  <div className="lp-rl lp-rl-70" />
                  <div className="lp-rl lp-rl-45" />
                </div>
              </div>
              <div className="lp-resume-tags">
                <span className="lp-tag" style={{ color: G, borderColor: `${G}44` }}>Python</span>
                <span className="lp-tag" style={{ color: B, borderColor: `${B}44` }}>React</span>
                <span className="lp-tag" style={{ color: P, borderColor: `${P}44` }}>ML</span>
                <span className="lp-tag" style={{ color: '#f59e0b', borderColor: '#f59e0b44' }}>SQL</span>
              </div>
            </div>

            {/* Match score card */}
            <div className="lp-dash-card lp-card-score">
              <div className="lp-card-label">Job Match</div>
              <div className="lp-score-ring-wrap">
                <svg viewBox="0 0 100 100" className="lp-score-svg">
                  <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                  <circle cx="50" cy="50" r={r} fill="none" stroke="url(#sg)" strokeWidth="7"
                    strokeDasharray={`${0.87 * circ} ${circ}`} strokeLinecap="round"
                    transform="rotate(-90 50 50)" className="lp-score-arc" />
                  <defs>
                    <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={G} /><stop offset="100%" stopColor={B} />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="lp-score-center">
                  <span className="lp-score-num">87%</span>
                  <span className="lp-score-sub">match</span>
                </div>
              </div>
              <div className="lp-score-role">Senior ML Engineer</div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="lp-dash-row">
            {/* Skill gap chart */}
            <div className="lp-dash-card lp-card-skills">
              <div className="lp-card-label">Skill Gaps</div>
              <div className="lp-skill-bars">
                {skills.map((s, i) => (
                  <div key={i} className="lp-skill-row">
                    <span className="lp-skill-name">{s.label}</span>
                    <div className="lp-skill-track">
                      <div className="lp-skill-fill" style={{
                        width: `${s.pct}%`,
                        background: `linear-gradient(90deg, ${s.color}cc, ${s.color}66)`,
                        animationDelay: `${i * 0.15 + 0.4}s`,
                      }} />
                    </div>
                    <span className="lp-skill-pct" style={{ color: s.color }}>{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interview card */}
            <div className="lp-dash-card lp-card-interview">
              <div className="lp-card-label">AI Interview</div>
              <div className="lp-iv-question">
                <div className="lp-iv-ai-badge">AI</div>
                <p className="lp-iv-text">"Describe a time you scaled a machine learning model to production."</p>
              </div>
              <div className="lp-iv-meter">
                <span className="lp-iv-meter-label">Confidence</span>
                <div className="lp-iv-meter-bar">
                  <div className="lp-iv-meter-fill" />
                </div>
                <span className="lp-iv-meter-val" style={{ color: G }}>74%</span>
              </div>
              <div className="lp-iv-chips">
                <span className="lp-iv-chip lp-iv-chip-g">Strong STAR structure</span>
                <span className="lp-iv-chip lp-iv-chip-y">Add metrics</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── How it works steps ────────────────────────────────── */
const STEPS = [
  {
    n: '01',
    title: 'Upload Your Resume',
    desc: 'Drop your PDF. Our AI extracts every skill, role, and achievement using Mistral OCR in seconds.',
    color: G,
  },
  {
    n: '02',
    title: 'Match Against Any Job',
    desc: 'Paste a job description and get an instant match score, skill gap breakdown, and priority recommendations.',
    color: B,
  },
  {
    n: '03',
    title: 'Train With AI Interview',
    desc: 'Answer AI-generated questions tailored to your resume. Get real-time feedback and a hire/no-hire score.',
    color: P,
  },
]

/* ─── Feature blocks ────────────────────────────────────── */
const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    color: G,
    title: 'Resume Intelligence',
    desc: 'Upload your resume and instantly get skill extraction, structured insights, and an ATS-ready profile built by AI.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      </svg>
    ),
    color: B,
    title: 'Market Match Analysis',
    desc: 'See your match score against real job descriptions. Identify missing skills, prioritized by employer demand.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
    color: P,
    title: 'AI Interview Simulator',
    desc: 'Practice with an AI that knows your resume. Get scored responses, feedback on structure, and a readiness rating.',
  },
]

/* ─── Stat strip ────────────────────────────────────────── */
const STATS = [
  { val: '< 30s', label: 'Resume parsed' },
  { val: '87%',   label: 'Avg. match lift' },
  { val: '5 min', label: 'To full report' },
  { val: '100%',  label: 'Free to try' },
]

/* ═══════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════ */
export default function ExplorePage({ onGetStarted }) {
  const [ready, setReady] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setReady(true)) }, [])

  return (
    <div className="lp-root" style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.5s ease' }}>
      <style>{CSS}</style>

      {/* ── NAV ────────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-nav-brand">
          <div className="lp-brand-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={G} stroke="none" />
            </svg>
          </div>
          <span className="lp-brand-name">Skillora</span>
        </div>
        <div className="lp-nav-links">
          <a href="#how" className="lp-nav-link">How it works</a>
          <a href="#features" className="lp-nav-link">Features</a>
          <button className="lp-btn lp-btn-ghost" onClick={onGetStarted}>Sign in</button>
          <button className="lp-btn lp-btn-primary" onClick={onGetStarted}>Launch App →</button>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="lp-hero">
        <Particles />
        <div className="lp-hero-glow lp-glow-a" aria-hidden="true" />
        <div className="lp-hero-glow lp-glow-b" aria-hidden="true" />
        <div className="lp-hero-glow lp-glow-c" aria-hidden="true" />

        <div className="lp-hero-inner">
          <div className="lp-hero-badge">
            <span className="lp-badge-pulse" />
            AI-powered
          </div>

          <h1 className="lp-hero-h1">
            Your future,<br />
            <span className="lp-hero-gradient">accelerated by AI.</span>
          </h1>

          <p className="lp-hero-sub">
            Upload your resume, match against any job, and walk into your next interview
            fully prepared — in under five minutes.
          </p>

          <div className="lp-hero-actions">
            <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={onGetStarted}>
              Launch App
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6 }}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
            <a href="#how" className="lp-btn lp-btn-ghost lp-btn-lg">See how it works</a>
          </div>

          <div className="lp-hero-trust">
            <span className="lp-trust-dot" />
            <span>Upload once. Get your full career analysis instantly.</span>
          </div>
        </div>

        {/* Product preview */}
        <div className="lp-hero-preview">
          <DashboardMockup />
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────── */}
      <section className="lp-section lp-how" id="how">
        <div className="lp-section-inner">
          <div className="lp-eyebrow">How it works</div>
          <h2 className="lp-section-h2">From resume to offer-ready in three steps</h2>
          <p className="lp-section-sub">No fluff. No manual forms. Just drop your resume and go.</p>

          <div className="lp-steps">
            {STEPS.map((s, i) => (
              <div key={i} className="lp-step" style={{ '--ac': s.color }}>
                <div className="lp-step-num" style={{ color: s.color, borderColor: `${s.color}33` }}>{s.n}</div>
                {i < STEPS.length - 1 && <div className="lp-step-connector" />}
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TERMINAL DEMO ──────────────────────────────────── */}
      <section className="lp-term-section">
        <div className="lp-term-section-inner">
          <div className="lp-term-left">
            <div className="lp-eyebrow">Live demo</div>
            <h2 className="lp-section-h2" style={{ textAlign: 'left', maxWidth: 380 }}>
              Watch the AI work in real time
            </h2>
            <p className="lp-section-sub" style={{ textAlign: 'left', marginLeft: 0 }}>
              The moment you upload, the engine starts. Skill extraction, scoring,
              roadmap generation — all in a single pass.
            </p>
            <button className="lp-btn lp-btn-primary" onClick={onGetStarted} style={{ marginTop: 8 }}>
              Try it now →
            </button>
          </div>
          <Terminal />
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────── */}
      <section className="lp-section lp-features" id="features">
        <div className="lp-section-inner">
          <div className="lp-eyebrow">Features</div>
          <h2 className="lp-section-h2">Everything you need to land the role</h2>
          <p className="lp-section-sub">Three core tools, seamlessly connected.</p>

          <div className="lp-feat-grid">
            {FEATURES.map((f, i) => (
              <div key={i} className="lp-feat-card" style={{ '--ac': f.color }}>
                <div className="lp-feat-icon" style={{ color: f.color }}>{f.icon}</div>
                <h3 className="lp-feat-title">{f.title}</h3>
                <p className="lp-feat-desc">{f.desc}</p>
                <div className="lp-feat-glow" style={{ background: f.color }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ─────────────────────────────────────── */}
      <section className="lp-footer-cta">
        <div className="lp-footer-glow" aria-hidden="true" />
        <div className="lp-footer-inner">
          <h2 className="lp-footer-h2">
            Your next career move<br />starts here.
          </h2>
          <p className="lp-footer-sub">
            Upload your resume, pick a target role, and let the AI handle the rest.
          </p>
          <button className="lp-btn lp-btn-primary lp-btn-xl" onClick={onGetStarted}>
            Get Started — It's Free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </button>
          <p className="lp-footer-note">No account required · Free forever for core features</p>
        </div>
      </section>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   CSS
   ═══════════════════════════════════════════════════════════ */
const CSS = `
/* ── Reset / base ───────────────────────────────────────── */
.lp-root{width:100%;min-height:100vh;background:#080808;color:#e8e8e8;font-family:'Inter','Segoe UI',system-ui,sans-serif;overflow-x:hidden;}
*{box-sizing:border-box;margin:0;padding:0;}

/* ── Particles ──────────────────────────────────────────── */
.lp-particles{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;}
.lp-particle{position:absolute;border-radius:50%;background:#1DB954;animation:lp-drift linear infinite;}
@keyframes lp-drift{0%{transform:translateY(0) translateX(0);opacity:0;}10%{opacity:1;}90%{opacity:1;}100%{transform:translateY(-80vh) translateX(20px);opacity:0;}}

/* ── Buttons ────────────────────────────────────────────── */
.lp-btn{display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-weight:600;border:none;cursor:pointer;transition:all 0.2s ease;border-radius:10px;text-decoration:none;white-space:nowrap;}
.lp-btn-primary{background:#1DB954;color:#000;padding:10px 22px;font-size:0.9rem;box-shadow:0 0 24px rgba(29,185,84,0.3);}
.lp-btn-primary:hover{background:#22d35e;box-shadow:0 0 36px rgba(29,185,84,0.45);transform:translateY(-1px);}
.lp-btn-ghost{background:transparent;color:#888;padding:10px 20px;font-size:0.9rem;border:1px solid rgba(255,255,255,0.1);}
.lp-btn-ghost:hover{color:#fff;border-color:rgba(255,255,255,0.25);background:rgba(255,255,255,0.04);}
.lp-btn-lg{padding:13px 30px;font-size:1rem;border-radius:12px;}
.lp-btn-xl{padding:16px 40px;font-size:1.05rem;border-radius:14px;}

/* ── Nav ────────────────────────────────────────────────── */
.lp-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:16px 48px;background:rgba(8,8,8,0.7);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.05);}
.lp-nav-brand{display:flex;align-items:center;gap:10px;}
.lp-brand-icon{width:32px;height:32px;border-radius:8px;background:rgba(29,185,84,0.12);border:1px solid rgba(29,185,84,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.lp-brand-name{font-size:1rem;font-weight:700;color:#fff;letter-spacing:-0.01em;}
.lp-nav-links{display:flex;align-items:center;gap:8px;}
.lp-nav-link{color:#777;font-size:0.88rem;font-weight:500;text-decoration:none;padding:8px 14px;border-radius:8px;transition:color 0.2s;}
.lp-nav-link:hover{color:#ddd;}

/* ── Hero ───────────────────────────────────────────────── */
.lp-hero{position:relative;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:120px 48px 80px;gap:64px;overflow:hidden;}
.lp-hero-glow{position:absolute;border-radius:50%;filter:blur(100px);pointer-events:none;z-index:0;}
.lp-glow-a{width:600px;height:600px;top:-100px;left:-100px;background:radial-gradient(circle,rgba(29,185,84,0.14) 0%,transparent 70%);animation:lp-orb 18s ease-in-out infinite;}
.lp-glow-b{width:500px;height:500px;top:0;right:-80px;background:radial-gradient(circle,rgba(59,130,246,0.10) 0%,transparent 70%);animation:lp-orb 22s ease-in-out infinite reverse;}
.lp-glow-c{width:400px;height:400px;bottom:0;left:40%;background:radial-gradient(circle,rgba(139,92,246,0.08) 0%,transparent 70%);animation:lp-orb 16s ease-in-out infinite 4s;}
@keyframes lp-orb{0%,100%{transform:translate(0,0);}50%{transform:translate(30px,-20px);}}

.lp-hero-inner{position:relative;z-index:5;display:flex;flex-direction:column;align-items:center;text-align:center;max-width:720px;animation:lp-up 0.9s ease both;}
@keyframes lp-up{from{opacity:0;transform:translateY(32px);}to{opacity:1;transform:translateY(0);}}

.lp-hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(29,185,84,0.07);border:1px solid rgba(29,185,84,0.22);border-radius:999px;padding:6px 18px;font-size:0.75rem;font-weight:600;color:#1DB954;letter-spacing:0.04em;margin-bottom:32px;}
.lp-badge-pulse{width:6px;height:6px;border-radius:50%;background:#1DB954;box-shadow:0 0 8px #1DB954;animation:lp-pulse 2s ease-in-out infinite;}
@keyframes lp-pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.4;transform:scale(1.5);}}

.lp-hero-h1{font-size:clamp(2.6rem,5.5vw,4rem);font-weight:900;line-height:1.08;letter-spacing:-0.04em;color:#fff;margin-bottom:24px;}
.lp-hero-gradient{background:linear-gradient(120deg,#1DB954 0%,#3b82f6 55%,#8b5cf6 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}

.lp-hero-sub{font-size:1.1rem;color:#888;line-height:1.7;max-width:540px;margin-bottom:36px;}

.lp-hero-actions{display:flex;align-items:center;gap:14px;margin-bottom:24px;}

.lp-hero-trust{display:flex;align-items:center;gap:8px;font-size:0.78rem;color:#555;}
.lp-trust-dot{width:5px;height:5px;border-radius:50%;background:#1DB954;}

/* Product preview */
.lp-hero-preview{position:relative;z-index:5;width:100%;max-width:900px;animation:lp-up 1s ease 0.25s both;}

/* ── Dashboard mockup ───────────────────────────────────── */
.lp-dash{background:rgba(14,14,14,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.04),0 0 60px rgba(29,185,84,0.06);}
.lp-dash-chrome{display:flex;align-items:center;gap:6px;padding:12px 20px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.07);}
.lp-dash-url{font-size:0.68rem;color:#555;font-family:'JetBrains Mono','Fira Code',monospace;margin-left:10px;}
.lp-dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex-shrink:0;}
.lp-dot-r{background:#ff5f57;}.lp-dot-y{background:#ffbd2e;}.lp-dot-g{background:#28c840;}

.lp-dash-body{display:flex;min-height:320px;}
.lp-dash-sidebar{width:100px;background:rgba(255,255,255,0.02);border-right:1px solid rgba(255,255,255,0.06);padding:16px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;}
.lp-dash-logo{width:32px;height:32px;background:rgba(29,185,84,0.15);border:1px solid rgba(29,185,84,0.3);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:#1DB954;margin-bottom:12px;}
.lp-sb-item{width:100%;padding:6px 8px;border-radius:6px;font-size:0.6rem;font-weight:600;color:#555;text-align:center;letter-spacing:0.02em;transition:all 0.2s;cursor:pointer;}
.lp-sb-active{color:#fff;background:rgba(255,255,255,0.07);}

.lp-dash-main{flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden;}
.lp-dash-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.lp-dash-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px 14px;}
.lp-card-label{font-size:0.58rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#555;margin-bottom:10px;}

/* Resume card */
.lp-resume-preview{display:flex;gap:10px;margin-bottom:8px;}
.lp-resume-avatar{width:32px;height:40px;border-radius:6px;background:linear-gradient(135deg,rgba(29,185,84,0.35),rgba(59,130,246,0.25));flex-shrink:0;}
.lp-resume-lines{display:flex;flex-direction:column;gap:5px;flex:1;padding-top:4px;}
.lp-rl{height:4px;border-radius:2px;background:rgba(255,255,255,0.1);animation:lp-shimmer 2.5s ease-in-out infinite;}
.lp-rl-80{width:80%;}.lp-rl-55{width:55%;}.lp-rl-70{width:70%;}.lp-rl-45{width:45%;}
@keyframes lp-shimmer{0%,100%{opacity:0.4;}50%{opacity:0.9;}}
.lp-resume-tags{display:flex;gap:4px;flex-wrap:wrap;}
.lp-tag{font-size:0.55rem;font-weight:700;padding:2px 8px;border-radius:6px;border:1px solid;background:transparent;}

/* Score card */
.lp-card-score{display:flex;flex-direction:column;align-items:center;}
.lp-score-ring-wrap{position:relative;width:80px;height:80px;margin:4px auto 8px;}
.lp-score-svg{width:100%;height:100%;}
.lp-score-arc{animation:lp-arc 1.6s ease 0.4s both;}
@keyframes lp-arc{from{stroke-dasharray:0 999;}}
.lp-score-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.lp-score-num{font-size:1.3rem;font-weight:900;color:#1DB954;line-height:1;}
.lp-score-sub{font-size:0.5rem;color:#666;font-weight:600;letter-spacing:0.06em;margin-top:2px;}
.lp-score-role{font-size:0.6rem;color:#555;text-align:center;}

/* Skills card */
.lp-skill-bars{display:flex;flex-direction:column;gap:7px;}
.lp-skill-row{display:flex;align-items:center;gap:8px;}
.lp-skill-name{font-size:0.6rem;color:#888;width:80px;flex-shrink:0;}
.lp-skill-track{flex:1;height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;}
.lp-skill-fill{height:100%;border-radius:3px;width:0;animation:lp-bar 1.2s ease forwards;}
@keyframes lp-bar{to{width:var(--w,100%);}}
.lp-skill-pct{font-size:0.58rem;font-weight:700;width:28px;text-align:right;flex-shrink:0;}

/* Interview card */
.lp-iv-question{background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:8px;padding:10px;margin-bottom:8px;display:flex;flex-direction:column;gap:6px;}
.lp-iv-ai-badge{font-size:0.52rem;font-weight:800;color:#3b82f6;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);padding:2px 6px;border-radius:4px;width:fit-content;letter-spacing:0.06em;}
.lp-iv-text{font-size:0.62rem;color:#bbb;line-height:1.5;}
.lp-iv-meter{display:flex;align-items:center;gap:6px;margin-bottom:6px;}
.lp-iv-meter-label{font-size:0.55rem;color:#666;width:58px;flex-shrink:0;}
.lp-iv-meter-bar{flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;}
.lp-iv-meter-fill{height:100%;width:74%;background:linear-gradient(90deg,#1DB954,#3b82f6);border-radius:2px;animation:lp-bar 1.5s ease 0.6s both;}
.lp-iv-meter-val{font-size:0.58rem;font-weight:700;}
.lp-iv-chips{display:flex;gap:5px;flex-wrap:wrap;}
.lp-iv-chip{font-size:0.52rem;font-weight:600;padding:2px 7px;border-radius:4px;letter-spacing:0.02em;}
.lp-iv-chip-g{background:rgba(29,185,84,0.12);color:#1DB954;border:1px solid rgba(29,185,84,0.25);}
.lp-iv-chip-y{background:rgba(245,158,11,0.12);color:#f59e0b;border:1px solid rgba(245,158,11,0.25);}

/* ── Stats strip ────────────────────────────────────────── */
.lp-stats-strip{border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.01);}
.lp-stats-inner{max-width:900px;margin:0 auto;padding:28px 48px;display:grid;grid-template-columns:repeat(4,1fr);gap:0;}
.lp-stat{display:flex;flex-direction:column;align-items:center;gap:4px;padding:0 20px;position:relative;}
.lp-stat+.lp-stat::before{content:'';position:absolute;left:0;top:10%;height:80%;width:1px;background:rgba(255,255,255,0.07);}
.lp-stat-val{font-size:1.5rem;font-weight:900;color:#fff;letter-spacing:-0.03em;}
.lp-stat-label{font-size:0.75rem;color:#666;font-weight:500;}

/* ── Sections shared ────────────────────────────────────── */
.lp-section{padding:100px 48px;}
.lp-section-inner{max-width:900px;margin:0 auto;}
.lp-eyebrow{font-size:0.72rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#1DB954;margin-bottom:14px;text-align:center;}
.lp-section-h2{font-size:clamp(1.7rem,3.5vw,2.4rem);font-weight:800;letter-spacing:-0.03em;color:#fff;text-align:center;margin-bottom:12px;line-height:1.2;}
.lp-section-sub{font-size:1rem;color:#666;text-align:center;max-width:480px;margin:0 auto 56px;line-height:1.7;}

/* ── Steps (how it works) ───────────────────────────────── */
.lp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:0;position:relative;}
.lp-step{display:flex;flex-direction:column;padding:32px 36px;position:relative;background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.07);border-radius:16px;margin:0 8px;transition:all 0.3s;}
.lp-step:hover{background:rgba(255,255,255,0.03);border-color:rgba(255,255,255,0.12);}
.lp-step-num{font-size:2rem;font-weight:900;font-variant-numeric:tabular-nums;border-bottom:1px solid;padding-bottom:16px;margin-bottom:16px;line-height:1;letter-spacing:-0.05em;}
.lp-step-title{font-size:1rem;font-weight:700;color:#fff;margin-bottom:10px;}
.lp-step-desc{font-size:0.875rem;color:#777;line-height:1.7;}

/* ── Terminal section ───────────────────────────────────── */
.lp-term-section{padding:80px 48px;background:linear-gradient(180deg,transparent 0%,rgba(29,185,84,0.03) 50%,transparent 100%);}
.lp-term-section-inner{max-width:900px;margin:0 auto;display:grid;grid-template-columns:1fr 1.1fr;gap:60px;align-items:center;}
.lp-term-left{display:flex;flex-direction:column;}
.lp-term-left .lp-eyebrow{text-align:left;}
.lp-term-left .lp-section-sub{text-align:left;}

/* Terminal widget */
.lp-term{background:rgba(8,12,8,0.95);border:1px solid rgba(29,185,84,0.2);border-radius:14px;overflow:hidden;box-shadow:0 0 40px rgba(29,185,84,0.06),0 16px 48px rgba(0,0,0,0.5);}
.lp-term-bar{display:flex;align-items:center;gap:7px;padding:10px 16px;background:rgba(29,185,84,0.04);border-bottom:1px solid rgba(29,185,84,0.12);}
.lp-term-title{font-size:0.62rem;color:rgba(29,185,84,0.4);font-family:'JetBrains Mono','Fira Code',monospace;letter-spacing:0.05em;margin-left:8px;}
.lp-term-body{padding:16px 20px;font-family:'JetBrains Mono','Fira Code','Consolas',monospace;font-size:0.7rem;line-height:2;min-height:160px;}
.lp-term-line{animation:lp-line-in 0.12s ease both;white-space:pre;}
@keyframes lp-line-in{from{opacity:0;transform:translateX(-6px);}to{opacity:1;transform:translateX(0);}}
.lp-cursor{display:inline-block;width:8px;height:0.9em;background:#1DB954;margin-left:2px;vertical-align:text-bottom;animation:lp-blink 1s step-end infinite;box-shadow:0 0 8px #1DB954;}
@keyframes lp-blink{0%,100%{opacity:1;}50%{opacity:0;}}

/* ── Features ───────────────────────────────────────────── */
.lp-feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
.lp-feat-card{position:relative;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 28px;display:flex;flex-direction:column;gap:14px;overflow:hidden;transition:all 0.3s;}
.lp-feat-card:hover{background:rgba(255,255,255,0.04);border-color:color-mix(in srgb,var(--ac) 40%,transparent);transform:translateY(-4px);box-shadow:0 20px 50px rgba(0,0,0,0.3),0 0 30px color-mix(in srgb,var(--ac) 8%,transparent);}
.lp-feat-icon{width:44px;height:44px;border-radius:12px;background:color-mix(in srgb,var(--ac) 10%,transparent);border:1px solid color-mix(in srgb,var(--ac) 25%,transparent);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.lp-feat-icon svg{width:22px;height:22px;}
.lp-feat-title{font-size:1rem;font-weight:700;color:#fff;}
.lp-feat-desc{font-size:0.875rem;color:#777;line-height:1.7;}
.lp-feat-glow{position:absolute;bottom:-50px;right:-50px;width:120px;height:120px;border-radius:50%;filter:blur(60px);opacity:0;transition:opacity 0.4s;pointer-events:none;}
.lp-feat-card:hover .lp-feat-glow{opacity:0.12;}

/* ── Footer CTA ─────────────────────────────────────────── */
.lp-footer-cta{position:relative;padding:140px 48px;display:flex;justify-content:center;overflow:hidden;}
.lp-footer-glow{position:absolute;bottom:-120px;left:50%;transform:translateX(-50%);width:800px;height:400px;background:radial-gradient(ellipse,rgba(29,185,84,0.14) 0%,transparent 70%);pointer-events:none;}
.lp-footer-inner{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;text-align:center;max-width:560px;}
.lp-footer-h2{font-size:clamp(2rem,4vw,3rem);font-weight:900;letter-spacing:-0.04em;color:#fff;line-height:1.1;margin-bottom:18px;}
.lp-footer-sub{font-size:1rem;color:#666;line-height:1.7;margin-bottom:36px;max-width:400px;}
.lp-footer-note{margin-top:18px;font-size:0.78rem;color:#444;}

/* ── Responsive ─────────────────────────────────────────── */
@media(max-width:1100px){
  .lp-dash-sidebar{width:80px;}
  .lp-sb-item{font-size:0.55rem;}
}
@media(max-width:900px){
  .lp-nav{padding:14px 24px;}
  .lp-nav-link{display:none;}
  .lp-hero{padding:100px 24px 60px;gap:48px;}
  .lp-stats-inner{grid-template-columns:repeat(2,1fr);padding:24px;}
  .lp-steps{grid-template-columns:1fr;}
  .lp-step{margin:0 0 16px;}
  .lp-feat-grid{grid-template-columns:1fr 1fr;}
  .lp-term-section-inner{grid-template-columns:1fr;gap:40px;}
  .lp-term-left .lp-section-h2{text-align:center;}
  .lp-term-left .lp-eyebrow{text-align:center;}
  .lp-term-left .lp-section-sub{text-align:center;margin:0 auto 16px;}
  .lp-dash-sidebar{display:none;}
  .lp-dash-row{grid-template-columns:1fr;}
  .lp-section{padding:72px 24px;}
  .lp-term-section{padding:60px 24px;}
}
@media(max-width:600px){
  .lp-hero-h1{font-size:2.2rem;}
  .lp-hero-actions{flex-direction:column;align-items:stretch;}
  .lp-btn-lg{width:100%;justify-content:center;}
  .lp-feat-grid{grid-template-columns:1fr;}
  .lp-stats-inner{grid-template-columns:1fr 1fr;}
  .lp-footer-cta{padding:80px 24px;}
}
`
