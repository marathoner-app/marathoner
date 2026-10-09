import { describe, expect, it, vi } from 'vitest'

import {
  RUN_COMPLETION_COMMAND_TYPE,
  RUN_DELETION_COMMAND_TYPE,
  type MaterialCommandResult,
  type RunCompletionReceiptResult,
  type RunDeletionReceiptResult,
} from '../domain/materialCommands/contract'
import {
  createIanaTimeZone,
  createUtcDateTime,
} from '../domain/training/dates'
import {
  createCompletedRunId,
  createPlannedWorkoutId,
  createTrainingPlanId,
} from '../domain/training/identifiers'
import {
  createDistanceMeters,
  createDurationSeconds,
} from '../domain/training/units'
import {
  createCompletedRunCommandClient,
  type RunCompletionSubmission,
  type RunDeletionSubmission,
} from './completedRunCommandClient'
import type { MaterialCommandTransport } from './materialCommandClient'

const completionCommandId = 'complete-run-client-0001'
const deletionCommandId = 'delete-run-client-0001'
const completedRunId = createCompletedRunId('completed-run-client-0001')
const planId = createTrainingPlanId('plan-client-0001')
const workoutId = createPlannedWorkoutId('workout-client-0001')
const workoutUpdatedAt = createUtcDateTime('2026-10-08T12:00:00.000Z')
const completedRunUpdatedAt = createUtcDateTime('2026-10-08T13:00:00.000Z')

const completionSubmission: RunCompletionSubmission = {
  commandId: completionCommandId,
  input: {
    plannedWorkout: {
      planId,
      workoutId,
      expectedUpdatedAt: workoutUpdatedAt,
    },
    startedAt: createUtcDateTime('2026-10-08T12:15:00.000Z'),
    timeZone: createIanaTimeZone('America/Los_Angeles'),
    distance: createDistanceMeters(5_000),
    duration: createDurationSeconds(1_800),
    perceivedEffort: 'about_right',
    unusualPain: false,
    notes: 'Felt controlled.',
  },
}

const deletionSubmission: RunDeletionSubmission = {
  commandId: deletionCommandId,
  completedRunId,
  expectedCompletedRunUpdatedAt: completedRunUpdatedAt,
  plannedWorkout: {
    planId,
    workoutId,
    expectedUpdatedAt: completedRunUpdatedAt,
  },
}

const completionReceipt: RunCompletionReceiptResult = {
  status: 'run_completed',
  commandId: completionCommandId,
  completedRunId,
  completedRunUpdatedAt,
  completedPlannedWorkout: {
    planId,
    workoutId,
    updatedAt: completedRunUpdatedAt,
  },
}

const deletionReceipt: RunDeletionReceiptResult = {
  status: 'run_deleted',
  commandId: deletionCommandId,
  completedRunId,
  deletedAt: createUtcDateTime('2026-10-08T14:00:00.000Z'),
  reopenedPlannedWorkout: {
    planId,
    workoutId,
    updatedAt: createUtcDateTime('2026-10-08T14:00:00.000Z'),
  },
}

function transport(result: unknown): MaterialCommandTransport {
  return {
    submit: vi.fn().mockResolvedValue(result),
    resolve: vi.fn().mockResolvedValue(result),
  }
}

describe('completed-run command client', () => {
  it('builds completion envelopes and preserves the command across safe retries', async () => {
    const boundary = transport(completionReceipt)
    const client = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.submitCompletion(completionSubmission)).resolves.toEqual(
      completionReceipt,
    )
    await expect(client.submitCompletion(completionSubmission)).resolves.toEqual(
      completionReceipt,
    )

    expect(boundary.submit).toHaveBeenCalledTimes(2)
    expect(boundary.submit).toHaveBeenNthCalledWith(1, {
      envelopeVersion: 1,
      appProtocolVersion: 1,
      commandId: completionCommandId,
      command: {
        type: RUN_COMPLETION_COMMAND_TYPE,
        schemaVersion: 1,
        input: completionSubmission.input,
      },
    })
    expect(vi.mocked(boundary.submit).mock.calls[1]?.[0]).toEqual(
      vi.mocked(boundary.submit).mock.calls[0]?.[0],
    )
  })

  it('builds deletion envelopes without losing IDs or expected versions', async () => {
    const boundary = transport(deletionReceipt)
    const client = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.submitDeletion(deletionSubmission)).resolves.toEqual(
      deletionReceipt,
    )
    expect(boundary.submit).toHaveBeenCalledWith({
      envelopeVersion: 1,
      appProtocolVersion: 1,
      commandId: deletionCommandId,
      command: {
        type: RUN_DELETION_COMMAND_TYPE,
        schemaVersion: 1,
        completedRunId,
        expectedCompletedRunUpdatedAt: completedRunUpdatedAt,
        plannedWorkout: deletionSubmission.plannedWorkout,
      },
    })
  })

  it('builds unplanned completion and deletion envelopes with null associations', async () => {
    const unplannedCompletion = {
      commandId: 'complete-run-client-unplanned',
      input: {
        plannedWorkout: null,
        startedAt: createUtcDateTime('2026-10-08T15:00:00.000Z'),
        timeZone: createIanaTimeZone('America/Los_Angeles'),
        distance: createDistanceMeters(3_000),
        duration: createDurationSeconds(1_200),
      },
    } satisfies RunCompletionSubmission
    const unplannedCompletionReceipt: RunCompletionReceiptResult = {
      status: 'run_completed',
      commandId: unplannedCompletion.commandId,
      completedRunId: createCompletedRunId('completed-run-client-unplanned'),
      completedRunUpdatedAt: createUtcDateTime('2026-10-08T15:20:00.000Z'),
      completedPlannedWorkout: null,
    }
    const completionBoundary = transport(unplannedCompletionReceipt)
    const completionClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: completionBoundary,
    })

    await expect(
      completionClient.submitCompletion(unplannedCompletion),
    ).resolves.toEqual(unplannedCompletionReceipt)
    expect(completionBoundary.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: unplannedCompletion.commandId,
        command: expect.objectContaining({
          type: RUN_COMPLETION_COMMAND_TYPE,
          input: unplannedCompletion.input,
        }),
      }),
    )

    const unplannedDeletion = {
      commandId: 'delete-run-client-unplanned',
      completedRunId: unplannedCompletionReceipt.completedRunId,
      expectedCompletedRunUpdatedAt:
        unplannedCompletionReceipt.completedRunUpdatedAt,
      plannedWorkout: null,
    } satisfies RunDeletionSubmission
    const unplannedDeletionReceipt: RunDeletionReceiptResult = {
      status: 'run_deleted',
      commandId: unplannedDeletion.commandId,
      completedRunId: unplannedDeletion.completedRunId,
      deletedAt: createUtcDateTime('2026-10-08T15:30:00.000Z'),
      reopenedPlannedWorkout: null,
    }
    const deletionBoundary = transport(unplannedDeletionReceipt)
    const deletionClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: deletionBoundary,
    })

    await expect(
      deletionClient.submitDeletion(unplannedDeletion),
    ).resolves.toEqual(unplannedDeletionReceipt)
    expect(deletionBoundary.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: unplannedDeletion.commandId,
        command: expect.objectContaining({
          type: RUN_DELETION_COMMAND_TYPE,
          plannedWorkout: null,
        }),
      }),
    )
  })

  it('does not submit, resolve, queue, or replay while known offline', async () => {
    let online = false
    const boundary = transport(completionReceipt)
    const client = createCompletedRunCommandClient({
      isOnline: () => online,
      transport: boundary,
    })

    for (const result of [
      await client.submitCompletion(completionSubmission),
      await client.submitDeletion(deletionSubmission),
      await client.resolveCompletion(completionCommandId),
      await client.resolveDeletion(deletionCommandId),
    ]) {
      expect(result).toEqual(
        expect.objectContaining({
          status: 'retryable_error',
          code: 'temporarily-unavailable',
          message: expect.stringContaining('not queued'),
        }),
      )
    }
    expect(boundary.submit).not.toHaveBeenCalled()
    expect(boundary.resolve).not.toHaveBeenCalled()

    online = true
    await Promise.resolve()
    expect(boundary.submit).not.toHaveBeenCalled()
    expect(boundary.resolve).not.toHaveBeenCalled()
  })

  it('recovers an ambiguous completion by resolving the same command ID', async () => {
    const boundary = transport(completionReceipt)
    vi.mocked(boundary.submit).mockRejectedValueOnce({
      code: 'functions/deadline-exceeded',
    })
    const client = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.submitCompletion(completionSubmission)).resolves.toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        commandId: completionCommandId,
        code: 'resolve-by-command-id',
      }),
    )
    await expect(client.resolveCompletion(completionCommandId)).resolves.toEqual(
      completionReceipt,
    )
    expect(boundary.submit).toHaveBeenCalledTimes(1)
    expect(boundary.resolve).toHaveBeenCalledWith(completionCommandId)
  })

  it('recovers an ambiguous deletion by resolving the same command ID', async () => {
    const boundary = transport(deletionReceipt)
    vi.mocked(boundary.submit).mockRejectedValueOnce({
      code: 'functions/deadline-exceeded',
    })
    const client = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.submitDeletion(deletionSubmission)).resolves.toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        commandId: deletionCommandId,
        code: 'resolve-by-command-id',
      }),
    )
    await expect(client.resolveDeletion(deletionCommandId)).resolves.toEqual(
      deletionReceipt,
    )
    expect(boundary.resolve).toHaveBeenCalledWith(deletionCommandId)
  })

  it.each<MaterialCommandResult>([
    {
      status: 'conflict',
      commandId: completionCommandId,
      code: 'planned-workout-already-completed',
      message: 'This workout already has a completed run.',
      planId,
      plannedWorkoutId: workoutId,
      completedRunId,
    },
    {
      status: 'stale_revision',
      commandId: completionCommandId,
      code: 'planned-workout-version-changed',
      message: 'The planned workout changed.',
      planId,
      plannedWorkoutId: workoutId,
      expectedUpdatedAt: workoutUpdatedAt,
      actualUpdatedAt: createUtcDateTime('2026-10-08T12:01:00.000Z'),
    },
    {
      status: 'validation_error',
      commandId: completionCommandId,
      code: 'invalid-run-completion',
      message: 'The completion is invalid.',
    },
    {
      status: 'authentication_error',
      commandId: completionCommandId,
      code: 'verified-email-required',
      message: 'Verify the account email.',
    },
    {
      status: 'authorization_error',
      commandId: completionCommandId,
      code: 'app-check-required',
      message: 'Open the supported app.',
    },
    {
      status: 'authorization_error',
      commandId: completionCommandId,
      code: 'approved-beta-membership-required',
      message: 'Beta membership is required.',
    },
    {
      status: 'unsupported_version',
      commandId: completionCommandId,
      code: 'unsupported-command-schema-version',
      message: 'Update Marathoner before recording this run.',
      supportedVersion: 1,
    },
    {
      status: 'conflict',
      commandId: completionCommandId,
      code: 'command-id-reused',
      message: 'The command ID was reused.',
    },
    {
      status: 'retryable_error',
      commandId: completionCommandId,
      code: 'temporarily-unavailable',
      message: 'Try again shortly.',
    },
    {
      status: 'outcome_unknown',
      commandId: completionCommandId,
      code: 'resolve-by-command-id',
      message: 'Resolve this command before retrying.',
    },
  ])('preserves the typed $status result and safe code', async (result) => {
    const client = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: transport(result),
    })

    await expect(client.submitCompletion(completionSubmission)).resolves.toEqual(
      result,
    )
  })

  it.each<MaterialCommandResult>([
    {
      status: 'stale_revision',
      commandId: deletionCommandId,
      code: 'completed-run-version-changed',
      message: 'The completed run changed.',
      completedRunId,
      expectedUpdatedAt: completedRunUpdatedAt,
      actualUpdatedAt: createUtcDateTime('2026-10-08T13:01:00.000Z'),
    },
    {
      status: 'stale_revision',
      commandId: deletionCommandId,
      code: 'planned-workout-version-changed',
      message: 'The planned workout changed.',
      planId,
      plannedWorkoutId: workoutId,
      expectedUpdatedAt: workoutUpdatedAt,
      actualUpdatedAt: null,
    },
  ])('preserves the typed deletion $code outcome', async (result) => {
    const client = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: transport(result),
    })

    await expect(client.submitDeletion(deletionSubmission)).resolves.toEqual(
      result,
    )
  })

  it('treats malformed, unrelated, and wrong-receipt responses as unknown', async () => {
    const malformedClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: transport({ malformed: true }),
    })
    await expect(
      malformedClient.submitCompletion(completionSubmission),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        commandId: completionCommandId,
      }),
    )

    const unrelatedClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: transport({
        status: 'plan_approved',
        commandId: completionCommandId,
        planId,
        activePlanRevision: 1,
        approvedAt: '2026-10-08T13:00:00.000Z',
      }),
    })
    await expect(
      unrelatedClient.submitCompletion(completionSubmission),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'outcome_unknown' }),
    )

    const wrongReceiptClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: transport({
        ...deletionReceipt,
        commandId: completionCommandId,
      }),
    })
    await expect(
      wrongReceiptClient.submitCompletion(completionSubmission),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'outcome_unknown' }),
    )

    const wrongDeletionReceiptClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: transport({
        ...completionReceipt,
        commandId: deletionCommandId,
      }),
    })
    await expect(
      wrongDeletionReceiptClient.submitDeletion(deletionSubmission),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'outcome_unknown' }),
    )

    const wrongCommandClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: transport({
        ...completionReceipt,
        commandId: 'complete-run-client-another',
      }),
    })
    await expect(
      wrongCommandClient.submitCompletion(completionSubmission),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        commandId: completionCommandId,
      }),
    )
  })

  it('fails closed on operation-inapplicable receipts and failures', async () => {
    const completedRunStale = {
      status: 'stale_revision',
      commandId: completionCommandId,
      code: 'completed-run-version-changed',
      message: 'The completed run changed.',
      completedRunId,
      expectedUpdatedAt: completedRunUpdatedAt,
      actualUpdatedAt: null,
    } satisfies MaterialCommandResult
    const completionClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: transport(completedRunStale),
    })
    await expect(
      completionClient.submitCompletion(completionSubmission),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'outcome_unknown' }),
    )

    const duplicate = {
      status: 'conflict',
      commandId: deletionCommandId,
      code: 'planned-workout-already-completed',
      message: 'This workout already has a completed run.',
      planId,
      plannedWorkoutId: workoutId,
      completedRunId,
    } satisfies MaterialCommandResult
    const deletionClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: transport(duplicate),
    })
    await expect(
      deletionClient.submitDeletion(deletionSubmission),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'outcome_unknown' }),
    )

    const completionResolutionClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: transport({
        ...deletionReceipt,
        commandId: completionCommandId,
      }),
    })
    await expect(
      completionResolutionClient.resolveCompletion(completionCommandId),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'outcome_unknown' }),
    )

    const deletionResolutionClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: transport({
        ...completionReceipt,
        commandId: deletionCommandId,
      }),
    })
    await expect(
      deletionResolutionClient.resolveDeletion(deletionCommandId),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'outcome_unknown' }),
    )
  })
})
