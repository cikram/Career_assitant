import React from 'react'
import { IconMic, IconMicOff, IconStop, IconRefresh } from './Icons'

export default function RecordingControls({
  phase,           // 'idle' | 'recording' | 'transcribing' | 'done'
  onStart,
  onStop,
  onRetake,
  onNext,
  isLastQuestion,
  isSubmitting,
  isSpeaking,      // true while TTS is reading the question
}) {
  return (
    <div className="iv-recording-controls">
      {phase === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {isSpeaking && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Wait for the interviewer to finish speaking…
            </span>
          )}
          <button
            className="iv-btn iv-btn-record"
            onClick={onStart}
            disabled={isSubmitting || isSpeaking}
          >
            <span className="iv-btn-icon"><IconMic /></span>
            Start Recording
          </button>
        </div>
      )}

      {phase === 'recording' && (
        <div className="iv-recording-active">
          <div className="iv-recording-indicator">
            <span className="iv-recording-pulse" />
            <span className="iv-recording-label">Recording...</span>
          </div>
          <button className="iv-btn iv-btn-stop" onClick={onStop}>
            <span className="iv-btn-icon"><IconStop /></span>
            End Recording
          </button>
        </div>
      )}

      {phase === 'transcribing' && (
        <div className="iv-transcribing">
          <div className="spinner" />
          <span>Transcribing audio...</span>
        </div>
      )}

      {phase === 'done' && (
        <div className="iv-done-controls">
          <button className="iv-btn iv-btn-retake" onClick={onRetake}>
            <span className="iv-btn-icon"><IconRefresh /></span>
            Retake
          </button>
          <button
            className="iv-btn iv-btn-next"
            onClick={onNext}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16 }} />
                Analysing...
              </>
            ) : isLastQuestion ? (
              'Finish Interview'
            ) : (
              'Next Question'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
