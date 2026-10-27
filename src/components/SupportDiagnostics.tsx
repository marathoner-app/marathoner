import { useState } from 'react'

import {
  formatSlowRunDiagnostics,
  readSlowRunDiagnostics,
} from '../diagnostics/slowRunDiagnostics'

export default function SupportDiagnostics() {
  const [diagnostics] = useState(readSlowRunDiagnostics)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [showCopyFallback, setShowCopyFallback] = useState(false)
  const report = formatSlowRunDiagnostics(diagnostics)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setShowCopyFallback(false)
      setCopyStatus('Run diagnostics copied.')
    } catch {
      setShowCopyFallback(true)
      setCopyStatus('Copy the selected diagnostics below.')
    }
  }

  return (
    <section
      className="account-support-diagnostics"
      aria-labelledby="account-support-diagnostics-heading"
    >
      <h3 id="account-support-diagnostics-heading">Support diagnostics</h3>
      {diagnostics.length === 0 ? (
        <p>
          This device has not recorded a run save that took longer than five
          seconds.
        </p>
      ) : (
        <>
          <p>
            Marathoner kept {diagnostics.length === 1 ? 'one' : diagnostics.length}{' '}
            recent slow-run {diagnostics.length === 1 ? 'record' : 'records'} on
            this device. Copy them when support asks; they contain timing and app
            context, not account or run details.
          </p>
          <button type="button" onClick={() => void copy()}>
            Copy slow-run diagnostics
          </button>
          {copyStatus && <p role="status">{copyStatus}</p>}
          {showCopyFallback && (
            <label>
              Slow-run diagnostics
              <textarea readOnly value={report} onFocus={(event) => event.currentTarget.select()} />
            </label>
          )}
        </>
      )}
      <p className="account-support-diagnostics-note">
        Records stay on this device, are never sent automatically, and expire
        after 14 days.
      </p>
    </section>
  )
}
