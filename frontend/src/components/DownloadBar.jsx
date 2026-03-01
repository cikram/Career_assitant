export default function DownloadBar({ jobId }) {
  return (
    <div className="download-bar">
      <p>Your full career analysis report is ready.</p>
      <a
        href={`/download/pdf/${jobId}`}
        className="btn btn-success"
        target="_blank"
        rel="noreferrer"
      >
        ⬇ Download PDF Report
      </a>
    </div>
  )
}
