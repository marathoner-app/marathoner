import { describe, expect, it } from 'vitest'

import {
  createRunCompletionCommand,
  createRunDeletionCommand,
  type CompletedRunCommandInputV1,
} from '../../src/domain/materialCommands/contract.js'
import {
  createCompletedRunId,
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createPlannedWorkoutId,
  createShoeId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type CompletedRun,
  type PlannedWorkout,
  type Shoe,
} from '../../src/domain/training/index.js'
import {
  RunCommandProjectionError,
  WORKOUT_COMPLETION_GUARD_SCHEMA_VERSION,
  projectRunCompletion,
  projectRunDeletion,
  type RunCompletionProjectionOptions,
  type RunDeletionProjectionOptions,
  type WorkoutCompletionGuardRecordV1,
} from './completedRunCommandProjection.js'

const ownerId = createUserId('runner-one')
const otherOwnerId = createUserId('runner-two')
const planId = createTrainingPlanId('plan-0001')
const workoutId = createPlannedWorkoutId('workout-0001')
const shoeId = createShoeId('shoe-0001')
const runId = createCompletedRunId('run-0001')
const observedWorkoutAt = createUtcDateTime('2026-10-08T12:00:00Z')
const committedAt = createUtcDateTime('2026-10-08T14:00:00Z')
const deletedAt = createUtcDateTime('2026-10-08T15:00:00Z')

const plannedWorkout: PlannedWorkout = {
  id: workoutId,
  userId: ownerId,
  planId,
  kind: 'run',
  purpose: 'easy',
  scheduledDate: createDateOnly('2026-10-08'),
  phase: 'base_building',
  status: 'planned',
  targetDistance: createDistanceMeters(5_000),
  createdAt: createUtcDateTime('2026-10-01T12:00:00Z'),
  updatedAt: observedWorkoutAt,
}

const activeShoe: Shoe = {
  id: shoeId,
  userId: ownerId,
  name: 'Daily trainer',
  startingDistance: createDistanceMeters(10_000),
  status: 'active',
  createdAt: createUtcDateTime('2026-09-01T12:00:00Z'),
  updatedAt: createUtcDateTime('2026-09-01T12:00:00Z'),
}

const completionInput: CompletedRunCommandInputV1 = {
  plannedWorkout: {
    planId,
    workoutId,
    expectedUpdatedAt: observedWorkoutAt,
  },
  shoeId,
  startedAt: createUtcDateTime('2026-10-08T13:15:00Z'),
  timeZone: createIanaTimeZone('America/Los_Angeles'),
  distance: createDistanceMeters(5_000),
  duration: createDurationSeconds(1_650),
  perceivedEffort: 'about_right',
  unusualPain: false,
  notes: 'Easy progression run.',
}

function completionOptions(
  change: Partial<RunCompletionProjectionOptions> = {},
): RunCompletionProjectionOptions {
  return {
    authenticatedOwnerId: ownerId,
    serverRunId: runId,
    committedAt,
    envelope: createRunCompletionCommand(
      'complete-run-projection-0001',
      completionInput,
    ),
    loadedPlannedWorkout: plannedWorkout,
    loadedShoe: activeShoe,
    loadedCompletionGuard: null,
    ...change,
  }
}

function completedRun(): CompletedRun {
  return {
    id: runId,
    userId: ownerId,
    plannedWorkoutPlanId: planId,
    plannedWorkoutId: workoutId,
    shoeId,
    startedAt: completionInput.startedAt,
    timeZone: completionInput.timeZone,
    distance: completionInput.distance,
    duration: completionInput.duration,
    perceivedEffort: completionInput.perceivedEffort,
    unusualPain: completionInput.unusualPain,
    notes: completionInput.notes,
    createdAt: committedAt,
    updatedAt: committedAt,
  }
}

function completedWorkout(): PlannedWorkout {
  return { ...plannedWorkout, status: 'completed', updatedAt: committedAt }
}

function completionGuard(
  change: Partial<WorkoutCompletionGuardRecordV1> = {},
): WorkoutCompletionGuardRecordV1 {
  return {
    schemaVersion: WORKOUT_COMPLETION_GUARD_SCHEMA_VERSION,
    trainingSchemaVersion: 1,
    userId: ownerId,
    planId,
    plannedWorkoutId: workoutId,
    completedRunId: runId,
    commandId: 'complete-run-projection-0001',
    createdAt: committedAt,
    ...change,
  }
}

function deletionOptions(
  change: Partial<RunDeletionProjectionOptions> = {},
): RunDeletionProjectionOptions {
  return {
    authenticatedOwnerId: ownerId,
    deletedAt,
    envelope: createRunDeletionCommand('delete-run-projection-0001', {
      completedRunId: runId,
      expectedCompletedRunUpdatedAt: committedAt,
      plannedWorkout: {
        planId,
        workoutId,
        expectedUpdatedAt: committedAt,
      },
    }),
    loadedRun: completedRun(),
    loadedPlannedWorkout: completedWorkout(),
    loadedCompletionGuard: completionGuard(),
    ...change,
  }
}

describe('completed-run command projection', () => {
  it('projects one exact run, workout update, uniqueness guard, and receipt', () => {
    const options = completionOptions()
    const before = JSON.parse(JSON.stringify(options.envelope))

    const decision = projectRunCompletion(options)

    expect(decision.ok).toBe(true)
    if (!decision.ok) throw new Error('Expected a completion projection.')
    expect(options.envelope).toEqual(before)
    expect(decision.projection.completedRun).toEqual({
      path: `users/${ownerId}/runs/${runId}`,
      entity: {
        id: runId,
        userId: ownerId,
        plannedWorkoutPlanId: planId,
        plannedWorkoutId: workoutId,
        shoeId,
        startedAt: '2026-10-08T13:15:00.000Z',
        timeZone: 'America/Los_Angeles',
        distance: 5_000,
        duration: 1_650,
        perceivedEffort: 'about_right',
        unusualPain: false,
        notes: 'Easy progression run.',
        createdAt: committedAt,
        updatedAt: committedAt,
      },
    })
    expect(decision.projection.completedPlannedWorkout).toEqual({
      path: `users/${ownerId}/plans/${planId}/workouts/${workoutId}`,
      entity: { ...plannedWorkout, status: 'completed', updatedAt: committedAt },
    })
    expect(decision.projection.completionGuard).toEqual({
      path:
        `users/${ownerId}/plans/${planId}/workouts/${workoutId}` +
        '/completionState/current',
      record: completionGuard(),
    })
    expect(decision.projection.receipt).toEqual({
      status: 'run_completed',
      commandId: 'complete-run-projection-0001',
      completedRunId: runId,
      completedRunUpdatedAt: committedAt,
      completedPlannedWorkout: {
        planId,
        workoutId,
        updatedAt: committedAt,
      },
    })
  })

  it('supports an unplanned shoeless run without inventing associations', () => {
    const envelope = createRunCompletionCommand(
      'complete-unplanned-projection-0001',
      {
        plannedWorkout: null,
        startedAt: completionInput.startedAt,
        timeZone: completionInput.timeZone,
        distance: completionInput.distance,
        duration: completionInput.duration,
      },
    )

    const decision = projectRunCompletion(
      completionOptions({
        envelope,
        loadedPlannedWorkout: null,
        loadedShoe: null,
      }),
    )

    expect(decision.ok).toBe(true)
    if (!decision.ok) throw new Error('Expected an unplanned-run projection.')
    expect(decision.projection.completedRun.entity).toEqual({
      id: runId,
      userId: ownerId,
      startedAt: completionInput.startedAt,
      timeZone: completionInput.timeZone,
      distance: completionInput.distance,
      duration: completionInput.duration,
      createdAt: committedAt,
      updatedAt: committedAt,
    })
    expect(decision.projection.completedPlannedWorkout).toBeNull()
    expect(decision.projection.completionGuard).toBeNull()
    expect(decision.projection.receipt.completedPlannedWorkout).toBeNull()
  })

  it.each([
    [
      'missing workout',
      { loadedPlannedWorkout: null },
      'validation_error',
      'planned-workout-not-completable',
    ],
    [
      'cross-owner workout',
      { loadedPlannedWorkout: { ...plannedWorkout, userId: otherOwnerId } },
      'authorization_error',
      'training-resource-access-denied',
    ],
    [
      'rest workout',
      {
        loadedPlannedWorkout: {
          ...plannedWorkout,
          kind: 'rest',
          purpose: undefined,
          targetDistance: undefined,
        },
      },
      'validation_error',
      'planned-workout-not-completable',
    ],
    [
      'inconsistent workout association',
      {
        loadedPlannedWorkout: {
          ...plannedWorkout,
          id: createPlannedWorkoutId('workout-0002'),
        },
      },
      'validation_error',
      'planned-workout-not-completable',
    ],
    [
      'stale workout',
      {
        loadedPlannedWorkout: {
          ...plannedWorkout,
          updatedAt: createUtcDateTime('2026-10-08T12:01:00Z'),
        },
      },
      'stale_revision',
      'planned-workout-version-changed',
    ],
    [
      'missing shoe',
      { loadedShoe: null },
      'validation_error',
      'shoe-not-available',
    ],
    [
      'retired shoe',
      {
        loadedShoe: {
          ...activeShoe,
          status: 'retired',
          retiredOn: createDateOnly('2026-10-01'),
        },
      },
      'validation_error',
      'shoe-not-available',
    ],
    [
      'cross-owner shoe',
      { loadedShoe: { ...activeShoe, userId: otherOwnerId } },
      'authorization_error',
      'training-resource-access-denied',
    ],
  ])('rejects a %s with a stable result', (_, change, status, code) => {
    const decision = projectRunCompletion(
      completionOptions(change as Partial<RunCompletionProjectionOptions>),
    )

    expect(decision).toEqual({
      ok: false,
      result: expect.objectContaining({ status, code }),
    })
  })

  it('returns the deterministic existing completion when the guard exists', () => {
    const decision = projectRunCompletion(
      completionOptions({ loadedCompletionGuard: completionGuard() }),
    )

    expect(decision).toEqual({
      ok: false,
      result: {
        status: 'conflict',
        commandId: 'complete-run-projection-0001',
        code: 'planned-workout-already-completed',
        message: 'This planned workout already has a completed run.',
        planId,
        plannedWorkoutId: workoutId,
        completedRunId: runId,
      },
    })
  })

  it('rejects future activity time without treating it as server audit time', () => {
    const envelope = createRunCompletionCommand(
      'complete-future-run-0001',
      {
        ...completionInput,
        startedAt: createUtcDateTime('2026-10-08T14:01:00Z'),
      },
    )

    expect(projectRunCompletion(completionOptions({ envelope }))).toEqual({
      ok: false,
      result: expect.objectContaining({
        status: 'validation_error',
        code: 'invalid-run-completion',
      }),
    })
  })

  it('rejects client ownership and audit timestamps before projection', () => {
    const command = createRunCompletionCommand(
      'complete-untrusted-authority-0001',
      completionInput,
    )
    const withOwner = {
      ...command,
      command: {
        ...command.command,
        input: { ...command.command.input, userId: otherOwnerId },
      },
    }
    const withAuditTime = {
      ...command,
      command: {
        ...command.command,
        input: { ...command.command.input, createdAt: observedWorkoutAt },
      },
    }

    expect(
      projectRunCompletion(completionOptions({ envelope: withOwner })),
    ).toEqual({
      ok: false,
      result: expect.objectContaining({
        code: 'ownership-field-prohibited',
      }),
    })
    expect(
      projectRunCompletion(completionOptions({ envelope: withAuditTime })),
    ).toEqual({
      ok: false,
      result: expect.objectContaining({ code: 'invalid-run-completion' }),
    })
  })
})

describe('completed-run deletion projection', () => {
  it('deletes the loaded run and its exact guard while reopening only its workout', () => {
    const options = deletionOptions()
    const originalRun = JSON.parse(JSON.stringify(options.loadedRun))

    const decision = projectRunDeletion(options)

    expect(decision.ok).toBe(true)
    if (!decision.ok) throw new Error('Expected a deletion projection.')
    expect(options.loadedRun).toEqual(originalRun)
    expect(decision.projection.deletedRun).toEqual({
      path: `users/${ownerId}/runs/${runId}`,
      id: runId,
    })
    expect(decision.projection.reopenedPlannedWorkout).toEqual({
      path: `users/${ownerId}/plans/${planId}/workouts/${workoutId}`,
      entity: { ...completedWorkout(), status: 'planned', updatedAt: deletedAt },
    })
    expect(decision.projection.completionGuardToDelete).toEqual({
      path:
        `users/${ownerId}/plans/${planId}/workouts/${workoutId}` +
        '/completionState/current',
      record: completionGuard(),
    })
    expect(decision.projection.receipt).toEqual({
      status: 'run_deleted',
      commandId: 'delete-run-projection-0001',
      completedRunId: runId,
      deletedAt,
      reopenedPlannedWorkout: { planId, workoutId, updatedAt: deletedAt },
    })
  })

  it('deletes an unplanned run without touching workout state', () => {
    const run = completedRun()
    const unplannedRun: CompletedRun = {
      ...run,
      plannedWorkoutPlanId: undefined,
      plannedWorkoutId: undefined,
    }
    const envelope = createRunDeletionCommand(
      'delete-unplanned-projection-0001',
      {
        completedRunId: runId,
        expectedCompletedRunUpdatedAt: committedAt,
        plannedWorkout: null,
      },
    )

    const decision = projectRunDeletion(
      deletionOptions({
        envelope,
        loadedRun: unplannedRun,
        loadedPlannedWorkout: null,
        loadedCompletionGuard: null,
      }),
    )

    expect(decision.ok).toBe(true)
    if (!decision.ok) throw new Error('Expected an unplanned deletion.')
    expect(decision.projection.reopenedPlannedWorkout).toBeNull()
    expect(decision.projection.completionGuardToDelete).toBeNull()
    expect(decision.projection.receipt.reopenedPlannedWorkout).toBeNull()
  })

  it.each([
    [
      'missing run',
      { loadedRun: null },
      'validation_error',
      'invalid-run-deletion',
    ],
    [
      'cross-owner run',
      { loadedRun: { ...completedRun(), userId: otherOwnerId } },
      'authorization_error',
      'training-resource-access-denied',
    ],
    [
      'stale run',
      {
        loadedRun: {
          ...completedRun(),
          updatedAt: createUtcDateTime('2026-10-08T14:01:00Z'),
        },
      },
      'stale_revision',
      'completed-run-version-changed',
    ],
    [
      'inconsistent run association',
      {
        loadedRun: {
          ...completedRun(),
          plannedWorkoutId: createPlannedWorkoutId('workout-0002'),
        },
      },
      'validation_error',
      'invalid-run-deletion',
    ],
    [
      'missing workout',
      { loadedPlannedWorkout: null },
      'validation_error',
      'invalid-run-deletion',
    ],
    [
      'stale workout',
      {
        loadedPlannedWorkout: {
          ...completedWorkout(),
          updatedAt: createUtcDateTime('2026-10-08T14:01:00Z'),
        },
      },
      'stale_revision',
      'planned-workout-version-changed',
    ],
    [
      'missing completion guard',
      { loadedCompletionGuard: null },
      'validation_error',
      'invalid-run-deletion',
    ],
    [
      'guard linked to another run',
      {
        loadedCompletionGuard: completionGuard({
          completedRunId: createCompletedRunId('run-0002'),
        }),
      },
      'validation_error',
      'invalid-run-deletion',
    ],
    [
      'cross-owner guard',
      { loadedCompletionGuard: completionGuard({ userId: otherOwnerId }) },
      'authorization_error',
      'training-resource-access-denied',
    ],
  ])('rejects a %s with a stable result', (_, change, status, code) => {
    const decision = projectRunDeletion(
      deletionOptions(change as Partial<RunDeletionProjectionOptions>),
    )

    expect(decision).toEqual({
      ok: false,
      result: expect.objectContaining({ status, code }),
    })
  })

  it('fails closed for invalid server-owned IDs, timestamps, and guard records', () => {
    expect(() =>
      projectRunCompletion(completionOptions({ serverRunId: 'users/run' })),
    ).toThrow(RunCommandProjectionError)
    expect(() =>
      projectRunDeletion(deletionOptions({ deletedAt: 'not-a-time' })),
    ).toThrow(RunCommandProjectionError)
    expect(() =>
      projectRunDeletion(
        deletionOptions({
          deletedAt: createUtcDateTime('2026-10-08T13:59:00Z'),
        }),
      ),
    ).toThrow(RunCommandProjectionError)
    expect(() =>
      projectRunDeletion(
        deletionOptions({
          loadedCompletionGuard: {
            ...completionGuard(),
            schemaVersion: 2 as 1,
          },
        }),
      ),
    ).toThrow(RunCommandProjectionError)
  })
})
