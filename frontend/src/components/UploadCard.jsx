import { useDropzone } from 'react-dropzone'
import { IconUpload } from './Icons'

export default function UploadCard({
  onSubmit,
  isSubmitting,
  analysisComplete,
  onNewAnalysis,
  file,
  setFile,
  targetCompany,
  setTargetCompany,
  jobDescription,
  setJobDescription,
}) {
  const locked = !!file  // dropzone is inactive once a file is chosen

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    multiple: false,
    disabled: locked,
    onDrop: (accepted) => {
      if (accepted.length > 0) setFile(accepted[0])
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    onSubmit({ file, targetCompany: (targetCompany.trim() || 'Google'), jobDescription: jobDescription.trim() })
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div
          {...getRootProps()}
          className={`upload-zone${isDragActive ? ' dragover' : ''}${locked ? ' upload-zone--locked' : ''}`}
          style={locked ? { cursor: 'default', pointerEvents: 'none' } : {}}
        >
          <input {...getInputProps()} />
          <div className="upload-icon"><IconUpload /></div>
          {locked ? (
            <>
              <h2>{file.name}</h2>
              <p>
                {file.type || 'File'} &nbsp;·&nbsp; {(file.size / 1024).toFixed(1)} KB
              </p>
            </>
          ) : (
            <>
              <h2>Drop your resume here</h2>
              <p>PDF, PNG or JPG — drag &amp; drop or click to browse</p>
            </>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="target-company">Target Company</label>
            {analysisComplete && !targetCompany.trim() ? (
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not specified</p>
            ) : (
              <input
                id="target-company"
                type="text"
                placeholder="e.g. Google, Microsoft, Meta…"
                value={targetCompany}
                onChange={e => setTargetCompany(e.target.value)}
                disabled={isSubmitting || analysisComplete}
              />
            )}
          </div>
        </div>

        <hr className="form-divider" />

        <div className="form-group form-group--full">
          <label htmlFor="job-description">Job Description</label>
          {analysisComplete && !jobDescription.trim() ? (
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not specified</p>
          ) : (
            <textarea
              id="job-description"
              rows={6}
              placeholder="Paste the job description here to get a tailored skills match and roadmap…"
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              disabled={isSubmitting || analysisComplete}
              style={analysisComplete ? { resize: 'none' } : {}}
            />
          )}
        </div>

        <div className="form-row" style={{ marginTop: '16px', justifyContent: 'center' }}>
          {analysisComplete ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onNewAnalysis}
            >
              New Analysis
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!file || isSubmitting}
            >
              {isSubmitting ? (
                <><span className="spinner" /> Analyzing…</>
              ) : (
                'Analyze Resume'
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
