import { useEffect, useState, type ReactNode } from 'react'
import Title from './Title'
import { appCheckStartupMessage } from '../services/appCheckBootstrap'
import { initializeFirebaseClient } from '../services/firebaseClient'
import { releaseNativeStartupOverlayAfterPaint } from '../services/nativeStartup'

type BootstrapStatus = 'loading' | 'ready' | 'error'

interface FirebaseBootstrapGateProps {
  children: ReactNode
  initialize?: () => Promise<unknown>
}

export default function FirebaseBootstrapGate({
  children,
  initialize = initializeFirebaseClient,
}: FirebaseBootstrapGateProps) {
  const [status, setStatus] = useState<BootstrapStatus>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => releaseNativeStartupOverlayAfterPaint(), [])

  useEffect(() => {
    let active = true
    setStatus('loading')

    void initialize().then(
      () => {
        if (active) setStatus('ready')
      },
      () => {
        if (active) setStatus('error')
      },
    )

    return () => {
      active = false
    }
  }, [attempt, initialize])

  if (status === 'ready') return children

  return (
    <main className="main">
      <Title />
      {status === 'loading' ? (
        <p className="auth-message" role="status">
          Verifying this Marathoner app...
        </p>
      ) : (
        <div className="startup-error" role="alert">
          <p>{appCheckStartupMessage}</p>
          <p>
            If this continues, contact{' '}
            <a href="mailto:kevin@marathonerapp.com?subject=Marathoner%20app%20verification%20help">
              Marathoner support
            </a>
            .
          </p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}
    </main>
  )
}
