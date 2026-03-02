import React from 'react'
import { IconMic, IconStop, IconRefresh } from './Icons'

export default function RecordingControls({
  phase,           // 'idle' | 'recording' | 'transcribing' | 'done' | 'evaluated'
  onStart,
  onStop,
  onRetake,
  onAnalyse,       // submit transcript → analyse → speak feedback
  onAdvance,       // move to next question / finish (called after evaluation shown)
  isLastQuestion,
  isSubmitting,
  isSpeaking,      // true while TTS is reading question or feedback
}) {
  return (
    <div className="iv-recording-controls">

      {/* ── Idle: waiting to record ── */}
      {phase === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button
            className="iv-btn iv-btn-record"
            onClick={onStart}
            disabled={isSubmitting}
          >
            <span className="iv-btn-icon"><IconMic /></span>
            Start Recording
          </button>
        </div>
      )}

      {/* ── Recording ── */}
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

      {/* ── Transcribing ── */}
      {phase === 'transcribing' && (
        <div className="iv-transcribing">
          <div className="spinner" />
          <span>Transcribing audio...</span>
        </div>
      )}

      {/* ── Transcription done: retake or submit for analysis ── */}
      {phase === 'done' && (
        <div className="iv-done-controls">
          <button className="iv-btn iv-btn-retake" onClick={onRetake} disabled={isSubmitting}>
            <span className="iv-btn-icon"><IconRefresh /></span>
            Retake
          </button>
          <button
            className="iv-btn iv-btn-next"
            onClick={onAnalyse}
            disabled={isSubmitting || isSpeaking}
          >
            {isSubmitting ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16 }} />
                Analysing…
              </>
            ) : (
              'Submit Answer'
            )}
          </button>
        </div>
      )}

      {/* ── Evaluated: feedback shown, user decides when to continue ── */}
      {phase === 'evaluated' && (
        <div className="iv-done-controls">
          <button className="iv-btn iv-btn-retake" onClick={onRetake} disabled={isSubmitting}>
            <span className="iv-btn-icon"><IconRefresh /></span>
            Retake Answer
          </button>
          <button
            className="iv-btn iv-btn-next"
            onClick={onAdvance}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16 }} />
                {isLastQuestion ? 'Generating Report…' : 'Loading…'}
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
