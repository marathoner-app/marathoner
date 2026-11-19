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

  if (diagnostics.length === 0) return null

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
      <details>
        <summary id="account-support-diagnostics-heading">
          Run-save troubleshooting
        </summary>
        <p>
          Marathoner kept {diagnostics.length === 1 ? 'one' : diagnostics.length}{' '}
          recent slow-run {diagnostics.length === 1 ? 'record' : 'records'} on
          this device. Copy this information only when support asks for it. It
          contains timing and app context, not account or run details.
        </p>
        <button type="button" onClick={() => void copy()}>
          Copy troubleshooting information
        </button>
        {copyStatus && <p role="status">{copyStatus}</p>}
        {showCopyFallback && (
          <label>
            Troubleshooting information
            <textarea
              readOnly
              value={report}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
        )}
        <p className="account-support-diagnostics-note">
          Records stay on this device, are never sent automatically, and expire
          after 14 days.
        </p>
      </details>
    </section>
  )
}
