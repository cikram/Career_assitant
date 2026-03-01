const CONTACT_FIELDS = ['email', 'phone', 'linkedin', 'location', 'github', 'website']

export default function ResumeCard({ data }) {
  const name = data.name || 'Unknown Candidate'
  const contact = data.contact || {}
  const letter = name[0]?.toUpperCase() || '?'

  // Collect contact values: known fields first, then any remaining string fields
  const chips = []
  const seen = new Set()

  CONTACT_FIELDS.forEach(f => {
    const val = contact[f] || contact[f.charAt(0).toUpperCase() + f.slice(1)]
    if (val && typeof val === 'string') {
      chips.push(val)
      seen.add(f.toLowerCase())
    }
  })

  Object.entries(contact).forEach(([k, v]) => {
    if (typeof v === 'string' && v && !seen.has(k.toLowerCase())) {
      chips.push(v)
    }
  })

  return (
    <div className="resume-card-inner">
      <div className="resume-avatar">{letter}</div>
      <div className="resume-info">
        <h3>{name}</h3>
        <div className="resume-contacts">
          {chips.map((chip, i) => (
            <span key={i} className="contact-chip">{chip}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
