import { useCallback, useEffect, useState } from 'react'
import type {
  SharedRecordProof,
  SharedRecordProofSource,
} from '@marathoner/training-contract'
import { useAuth } from '../../../src/auth/useAuth'
import LoginButton from '../../../src/components/LoginButton'
import { sharedRecordSourceForMode } from './sourceClient'
import { sharedRecordClient } from './webSharedRecordClient'
import './shared-record-proof.css'

type RecordState =
  | { status: 'loading'; record: null }
  | { status: 'missing'; record: null }
  | { status: 'ready'; record: SharedRecordProof }
  | { status: 'error'; record: null }

const sourceClient = sharedRecordSourceForMode(import.meta.env.MODE)

export default function SharedRecordProofApp() {
  const auth = useAuth()
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const handleLogout = async () => {
    setLogoutError(null)

    try {
      await auth.logout()
    } catch {
      setLogoutError("We couldn't log you out. Please try again.")
    }
  }

  return (
    <main className="shared-record-proof">
      <p className="shared-record-eyebrow">ISSUE #87 · SHARED RECORD PROOF</p>
      <h1>Marathoner</h1>
      <p className="shared-record-subtitle">
        {sourceClient === 'capacitor'
          ? 'Capacitor iOS client'
          : 'Preserved web client'}
      </p>

      <section className="shared-record-card" aria-labelledby="auth-state-title">
        <h2 id="auth-state-title">Authentication state</h2>

        {auth.status === 'loading' && (
          <p role="status">Loading your session...</p>
        )}

        {auth.status === 'signedOut' && (
          <>
            <p>Signed out. Use the existing development account.</p>
            <LoginButton />
          </>
        )}

        {auth.status === 'signedIn' && (
          <>
            <p className="shared-record-success">Signed in</p>
            <p>{auth.user.email ?? 'Marathoner test account'}</p>
            <SharedRecordControls
              sourceClient={sourceClient}
              userId={auth.user.uid}
            />
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </>
        )}

        {logoutError && (
          <p className="shared-record-error" role="alert">
            {logoutError}
          </p>
        )}
      </section>

      <p className="shared-record-footer">
        Development proof only. No production training record is written.
      </p>
    </main>
  )
}

function SharedRecordControls({
  sourceClient,
  userId,
}: {
  sourceClient: SharedRecordProofSource
  userId: string
}) {
  const [recordState, setRecordState] = useState<RecordState>({
    status: 'loading',
    record: null,
  })
  const [isChanging, setIsChanging] = useState(false)

  const refresh = useCallback(async () => {
    setRecordState({ status: 'loading', record: null })

    try {
      const record = await sharedRecordClient.read(userId)
      setRecordState(
        record
          ? { status: 'ready', record }
          : { status: 'missing', record: null },
      )
    } catch {
      setRecordState({ status: 'error', record: null })
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const write = async () => {
    setIsChanging(true)

    try {
      const record = await sharedRecordClient.write(userId, sourceClient)
      setRecordState({ status: 'ready', record })
    } catch {
      setRecordState({ status: 'error', record: null })
    } finally {
      setIsChanging(false)
    }
  }

  const remove = async () => {
    setIsChanging(true)

    try {
      await sharedRecordClient.delete(userId)
      setRecordState({ status: 'missing', record: null })
    } catch {
      setRecordState({ status: 'error', record: null })
    } finally {
      setIsChanging(false)
    }
  }

  return (
    <section className="shared-record-data" aria-labelledby="record-state-title">
      <h3 id="record-state-title">Isolated sample record</h3>

      {recordState.status === 'loading' && (
        <p role="status">Reading the shared record...</p>
      )}
      {recordState.status === 'missing' && <p>No sample record exists.</p>}
      {recordState.status === 'error' && (
        <p className="shared-record-error" role="alert">
          The sample record request failed. Check the network and retry.
        </p>
      )}
      {recordState.status === 'ready' && (
        <dl>
          <div>
            <dt>Last writer</dt>
            <dd>{recordState.record.sourceClient}</dd>
          </div>
          <div>
            <dt>Sample run</dt>
            <dd>{recordState.record.sampleRunId}</dd>
          </div>
          <div>
            <dt>Distance</dt>
            <dd>{recordState.record.distanceMeters} meters</dd>
          </div>
        </dl>
      )}

      <div className="shared-record-actions">
        <button type="button" disabled={isChanging} onClick={() => void write()}>
          Write as {sourceClient}
        </button>
        <button
          type="button"
          disabled={isChanging}
          onClick={() => void refresh()}
        >
          Refresh
        </button>
        <button type="button" disabled={isChanging} onClick={() => void remove()}>
          Delete sample
        </button>
      </div>
    </section>
  )
}
