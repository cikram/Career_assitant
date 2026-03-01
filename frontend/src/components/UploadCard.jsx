import { useState, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { IconUpload } from './Icons'

const ALLOWED_EXTS = ['.pdf', '.png', '.jpg', '.jpeg']
const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg']

export default function UploadCard({ onSubmit, isSubmitting }) {
  const [file, setFile] = useState(null)
  const [targetCompany, setTargetCompany] = useState('')
  const [jobDescription, setJobDescription] = useState('')

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    multiple: false,
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
          className={`upload-zone${isDragActive ? ' dragover' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="upload-icon"><IconUpload /></div>
          <h2>Drop your resume here</h2>
          <p>PDF, PNG or JPG — drag &amp; drop or click to browse</p>
          {file && (
            <div className="file-chosen">{file.name}</div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="target-company">Target Company</label>
            <input
              id="target-company"
              type="text"
              placeholder="e.g. Google, Microsoft, Meta…"
              value={targetCompany}
              onChange={e => setTargetCompany(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <hr className="form-divider" />

        <div className="form-group form-group--full">
          <label htmlFor="job-description">Job Description</label>
          <textarea
            id="job-description"
            rows={6}
            placeholder="Paste the job description here to get a tailored skills match and roadmap…"
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-row" style={{ marginTop: '16px', justifyContent: 'center' }}>
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
        </div>
      </form>
    </div>
  )
}
