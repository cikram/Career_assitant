export default function ErrorBanner({ title, detail }) {
  return (
    <div className="error-banner">
      <h3>⚠ {title}</h3>
      {detail && <pre className="error-detail">{detail}</pre>}
    </div>
  )
}
