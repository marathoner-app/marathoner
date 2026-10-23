import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  MaterialCommandResult,
  RunCompletionReceiptResult,
} from '../domain/materialCommands/contract'
import {
  createIanaTimeZone,
  createUtcDateTime,
} from '../domain/training/dates'
import {
  createDistanceMeters,
  createDurationSeconds,
} from '../domain/training/units'
import type { CompletedRunCommandClient } from '../services/completedRunCommandClient'
import './BetaRunCommandRehearsal.css'

type RehearsalStage =
  | 'idle'
  | 'submitting_completion'
  | 'awaiting_creation_listener'
  | 'submitting_deletion'
  | 'awaiting_deletion_listener'
  | 'passed'
  | 'failed'

interface RehearsalFailure {
  code: string
  cleanupRequired: boolean
  status: string
}

interface BetaRunCommandRehearsalProps {
  client: CompletedRunCommandClient
  completedRunIds: readonly string[]
}

function commandId(action: 'complete' | 'delete'): string {
  return `beta-rehearsal-${action}-${crypto.randomUUID()}`
}

function localTimeZone() {
  const candidate = Intl.DateTimeFormat().resolvedOptions().timeZone
  return createIanaTimeZone(candidate || 'Etc/UTC')
}

function resultCode(result: MaterialCommandResult): string {
  return 'code' in result ? result.code : 'unexpected-result'
}

async function resolveCompletionIfNeeded(
  client: CompletedRunCommandClient,
  result: Awaited<ReturnType<CompletedRunCommandClient['submitCompletion']>>,
) {
  return result.status === 'outcome_unknown' && result.commandId
    ? client.resolveCompletion(result.commandId)
    : result
}

async function resolveDeletionIfNeeded(
  client: CompletedRunCommandClient,
  result: Awaited<ReturnType<CompletedRunCommandClient['submitDeletion']>>,
) {
  return result.status === 'outcome_unknown' && result.commandId
    ? client.resolveDeletion(result.commandId)
    : result
}

export function BetaRunCommandRehearsal({
  client,
  completedRunIds,
}: BetaRunCommandRehearsalProps) {
  const [stage, setStage] = useState<RehearsalStage>('idle')
  const [completionReceipt, setCompletionReceipt] =
    useState<RunCompletionReceiptResult | null>(null)
  const [deletionCommandId, setDeletionCommandId] = useState<string | null>(
    null,
  )
  const [failure, setFailure] = useState<RehearsalFailure | null>(null)
  const deletionStarted = useRef(false)

  const recordFailure = useCallback(
    (result: MaterialCommandResult, cleanupRequired: boolean) => {
      setFailure({
        code: resultCode(result),
        cleanupRequired,
        status: result.status,
      })
      setStage('failed')
    },
    [],
  )

  const deleteSyntheticRun = useCallback(
    async (
      receipt: RunCompletionReceiptResult,
      currentDeletionCommandId: string,
    ) => {
      setStage('submitting_deletion')
      const firstResult = await client.submitDeletion({
        commandId: currentDeletionCommandId,
        completedRunId: receipt.completedRunId,
        expectedCompletedRunUpdatedAt: receipt.completedRunUpdatedAt,
        plannedWorkout: null,
      })
      const result = await resolveDeletionIfNeeded(client, firstResult)

      if (result.status !== 'run_deleted') {
        recordFailure(result, true)
        return
      }

      setFailure(null)
      setStage('awaiting_deletion_listener')
    },
    [client, recordFailure],
  )

  useEffect(() => {
    if (
      stage !== 'awaiting_creation_listener' ||
      completionReceipt === null ||
      deletionStarted.current ||
      !completedRunIds.includes(completionReceipt.completedRunId)
    ) {
      return
    }

    deletionStarted.current = true
    const nextDeletionCommandId = commandId('delete')
    setDeletionCommandId(nextDeletionCommandId)
    void deleteSyntheticRun(completionReceipt, nextDeletionCommandId)
  }, [completedRunIds, completionReceipt, deleteSyntheticRun, stage])

  useEffect(() => {
    if (
      stage === 'awaiting_deletion_listener' &&
      completionReceipt !== null &&
      !completedRunIds.includes(completionReceipt.completedRunId)
    ) {
      setStage('passed')
    }
  }, [completedRunIds, completionReceipt, stage])

  const runRehearsal = async () => {
    deletionStarted.current = false
    setCompletionReceipt(null)
    setDeletionCommandId(null)
    setFailure(null)
    setStage('submitting_completion')

    const firstResult = await client.submitCompletion({
      commandId: commandId('complete'),
      input: {
        plannedWorkout: null,
        startedAt: createUtcDateTime(new Date().toISOString()),
        timeZone: localTimeZone(),
        distance: createDistanceMeters(5_000),
        duration: createDurationSeconds(1_800),
        perceivedEffort: 'about_right',
        unusualPain: false,
      },
    })
    const result = await resolveCompletionIfNeeded(client, firstResult)

    if (result.status !== 'run_completed') {
      recordFailure(result, false)
      return
    }

    setCompletionReceipt(result)
    setStage('awaiting_creation_listener')
  }

  const retryCleanup = () => {
    if (completionReceipt === null || deletionCommandId === null) return
    void deleteSyntheticRun(completionReceipt, deletionCommandId)
  }

  const pending =
    stage === 'submitting_completion' ||
    stage === 'awaiting_creation_listener' ||
    stage === 'submitting_deletion' ||
    stage === 'awaiting_deletion_listener'

  const statusMessage =
    stage === 'submitting_completion'
      ? 'Submitting the fixed synthetic run...'
      : stage === 'awaiting_creation_listener'
        ? 'The command committed. Waiting for the signed-in run listener...'
        : stage === 'submitting_deletion'
          ? 'The listener converged. Removing the same synthetic run...'
          : stage === 'awaiting_deletion_listener'
            ? 'The deletion committed. Waiting for the listener to confirm cleanup...'
            : stage === 'passed'
              ? 'Passed: create, listener convergence, delete, and cleanup all succeeded.'
              : null

  return (
    <section
      className="beta-run-command-rehearsal"
      aria-labelledby="beta-run-command-rehearsal-title"
    >
      <p className="beta-run-command-eyebrow">Owner-only beta check</p>
      <h2 id="beta-run-command-rehearsal-title">Live run-command rehearsal</h2>
      <p>
        Creates a fixed fictional 5 km run, waits for the signed-in listener,
        deletes that same record, and confirms it disappears. No command or
        account identifiers are shown.
      </p>

      {stage === 'idle' && (
        <button type="button" onClick={() => void runRehearsal()}>
          Run reversible beta check
        </button>
      )}

      {statusMessage && (
        <p className="beta-run-command-status" role="status" aria-live="polite">
          {statusMessage}
        </p>
      )}

      {failure && (
        <div className="beta-run-command-error" role="alert">
          <p>
            Rehearsal stopped with {failure.status} / {failure.code}.
          </p>
          {failure.cleanupRequired ? (
            <>
              <p>The synthetic run may still exist. Retry its exact deletion before cleaning up the fixture account.</p>
              <button type="button" onClick={retryCleanup}>
                Retry synthetic-run cleanup
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void runRehearsal()}>
              Retry beta check
            </button>
          )}
        </div>
      )}

      {stage === 'passed' && (
        <button type="button" onClick={() => void runRehearsal()}>
          Run the check again
        </button>
      )}

      {pending && <span className="sr-only">Beta rehearsal in progress.</span>}
    </section>
  )
}
