import { IconBrain } from './Icons'

export default function SkillsPanel({ data }) {
  const matched = data.matched_skills || []
  const missing = data.missing_skills || []

  return (
    <>
      <div className="panel-title"><IconBrain /> Skills Analysis</div>
      <div className="skills-inner-grid">
        <div className="skills-sub-card">
          <div className="skill-section-title">Matched Skills</div>
          <div className="chips">
            {matched.length > 0
              ? matched.map((s, i) => (
                <span key={i} className="chip chip-matched">{s}</span>
              ))
              : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem' }}>None</span>
            }
          </div>
        </div>
        <div className="skills-sub-card">
          <div className="skill-section-title">Missing Skills</div>
          <div className="chips">
            {missing.length > 0
              ? missing.map((s, i) => (
                <span key={i} className="chip chip-missing">{s}</span>
              ))
              : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem' }}>None</span>
            }
          </div>
        </div>
      </div>
    </>
  )
}
