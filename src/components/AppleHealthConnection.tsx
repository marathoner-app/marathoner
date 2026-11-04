import { useEffect, useState } from 'react'

import {
  connectHealthKit,
  disconnectHealthKit,
  getHealthKitConnectionState,
  synchronizeHealthKit,
  type HealthKitConnectionState,
  type HealthKitImportSummary,
} from '../services/healthKitImport'

interface AppleHealthConnectionProps {
  accountScope: string
}

type PendingOperation = 'connect' | 'synchronize' | 'disconnect' | null

function summaryMessage(summary: HealthKitImportSummary): string {
  const changed = summary.created + summary.updated + summary.deleted
  if (summary.failed > 0) {
    return `${changed} workout ${changed === 1 ? 'change was' : 'changes were'} saved. ${summary.failed} could not be saved and can be tried again.`
  }
  if (summary.reviewRequired > 0) {
    return `${changed} workout ${changed === 1 ? 'change was' : 'changes were'} saved. Marathoner held back ${summary.reviewRequired} possible ${summary.reviewRequired === 1 ? 'duplicate' : 'duplicates'}, so no second run was added.`
  }
  if (changed > 0) {
    return `${changed} Apple Health workout ${changed === 1 ? 'change is' : 'changes are'} now in Marathoner.`
  }
  if (summary.skipped > 0) {
    return 'No complete running workouts were available to import.'
  }
  return 'Apple Health is up to date.'
}

const initialState: HealthKitConnectionState = {
  availability: 'web',
  monitoring: false,
  authorizationRequestStatus: 'unknown',
}

export default function AppleHealthConnection({
  accountScope,
}: AppleHealthConnectionProps) {
  const [connection, setConnection] = useState(initialState)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<PendingOperation>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reviewRequiredCount, setReviewRequiredCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setConnection(await getHealthKitConnectionState(accountScope))
  }

  useEffect(() => {
    let active = true
    void getHealthKitConnectionState(accountScope)
      .then((state) => {
        if (active) setConnection(state)
      })
      .catch(() => {
        if (active) setError('Marathoner could not check Apple Health right now.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [accountScope])

  const run = async (
    operation: Exclude<PendingOperation, null>,
    action: () => Promise<HealthKitImportSummary | void>,
  ) => {
    setPending(operation)
    setMessage(null)
    setReviewRequiredCount(0)
    setError(null)
    try {
      const summary = await action()
      if (summary) {
        setMessage(summaryMessage(summary))
        setReviewRequiredCount(summary.reviewRequired)
      }
      await refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Marathoner could not update Apple Health right now.',
      )
    } finally {
      setPending(null)
    }
  }

  const busy = pending !== null

  return (
    <section
      className="apple-health-section"
      aria-labelledby="apple-health-heading"
    >
      <h3 id="apple-health-heading">Apple Health workouts</h3>
      {loading ? (
        <p role="status">Checking this iPhone...</p>
      ) : connection.availability === 'web' ? (
        <p>
          Apple Health connection is available in the Marathoner app on iPhone.
        </p>
      ) : connection.availability === 'unavailable' ? (
        <p>Apple Health workout access is not available on this device.</p>
      ) : connection.availability === 'disconnected' ? (
        <>
          <p>
            Import completed running workouts from the last 30 days, then keep
            new runs in sync. Marathoner reads workout time, duration, distance,
            and source. It does not write to Apple Health or read all-day health
            data.
          </p>
          <p className="apple-health-privacy-note">
            Apple lets you choose which workout access to allow. Marathoner
            cannot see whether an individual read permission was denied.
          </p>
          <button
            type="button"
            className="apple-health-primary"
            disabled={busy}
            onClick={() => void run('connect', () => connectHealthKit(accountScope))}
          >
            {pending === 'connect' ? 'Opening Apple Health...' : 'Connect Apple Health'}
          </button>
        </>
      ) : (
        <>
          <p>
            Automatic workout import is on for this iPhone. If an expected run
            does not appear, open the Health app, tap your profile picture, then
            choose Apps and Marathoner to review workout access.
          </p>
          <div className="apple-health-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run('synchronize', () => synchronizeHealthKit(accountScope))
              }
            >
              {pending === 'synchronize' ? 'Checking for runs...' : 'Check for runs now'}
            </button>
            <button
              type="button"
              className="apple-health-disconnect"
              disabled={busy}
              onClick={() =>
                void run('disconnect', () => disconnectHealthKit(accountScope))
              }
            >
              {pending === 'disconnect' ? 'Stopping import...' : 'Stop importing on this iPhone'}
            </button>
          </div>
        </>
      )}
      {message && <p role="status">{message}</p>}
      {reviewRequiredCount > 0 && (
        <div className="apple-health-actions" aria-label="Possible duplicate decision">
          <button
            type="button"
            onClick={() => {
              setReviewRequiredCount(0)
              setMessage(
                'Kept the existing run. Marathoner did not add a duplicate.',
              )
            }}
          >
            Keep existing run
          </button>
          <button
            type="button"
            onClick={() => {
              setReviewRequiredCount(0)
              setMessage(
                'Open Track and log the other run manually. Marathoner did not add a duplicate.',
              )
            }}
          >
            They were separate runs
          </button>
        </div>
      )}
      {error && (
        <p className="apple-health-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
