import { describe, expect, it, vi } from 'vitest'

import {
  PLAN_APPROVAL_COMMAND_TYPE,
  type MaterialCommandResult,
  type PlanApprovalReceiptResult,
} from '../domain/materialCommands/contract'
import { planGenerationContractFixtures } from '../domain/training'
import type { MaterialCommandTransport } from './materialCommandClient'
import {
  createPlanApprovalClient,
  type PlanApprovalSubmission,
} from './planApprovalClient'

const commandId = 'approve-plan-command-0001'
const generatedFixture = planGenerationContractFixtures.find(
  (fixture) => fixture.id === 'generated-exact-date-distance-target',
)
if (generatedFixture?.result.kind !== 'generated') {
  throw new Error('Expected the generated plan contract fixture.')
}

const submission: PlanApprovalSubmission = {
  commandId,
  expectedActivePlanRevision: null,
  input: generatedFixture.input,
  proposal: generatedFixture.result.plan,
}
const approved: PlanApprovalReceiptResult = {
  status: 'plan_approved',
  commandId,
  planId: 'plan-generated-0001',
  activePlanRevision: 1,
  approvedAt: '2026-10-08T00:00:00.000Z',
}

function transport(result: unknown = approved): MaterialCommandTransport {
  return {
    submit: vi.fn().mockResolvedValue(result),
    resolve: vi.fn().mockResolvedValue(result),
  }
}

describe('plan-approval client', () => {
  it('submits the exact approved proposal with the caller-owned command ID', async () => {
    const boundary = transport()
    const client = createPlanApprovalClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.submit(submission)).resolves.toEqual(approved)
    expect(boundary.submit).toHaveBeenCalledWith({
      envelopeVersion: 1,
      appProtocolVersion: 1,
      commandId,
      command: {
        type: PLAN_APPROVAL_COMMAND_TYPE,
        schemaVersion: 1,
        expectedActivePlanRevision: null,
        input: submission.input,
        proposal: submission.proposal,
      },
    })

    await expect(client.submit(submission)).resolves.toEqual(approved)
    expect(boundary.submit).toHaveBeenCalledTimes(2)
    expect(vi.mocked(boundary.submit).mock.calls[1]?.[0]).toEqual(
      vi.mocked(boundary.submit).mock.calls[0]?.[0],
    )
  })

  it('resolves an existing command ID without submitting another command', async () => {
    const boundary = transport()
    const client = createPlanApprovalClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.resolve(commandId)).resolves.toEqual(approved)
    expect(boundary.resolve).toHaveBeenCalledWith(commandId)
    expect(boundary.submit).not.toHaveBeenCalled()
  })

  it('does not queue or submit while offline', async () => {
    const boundary = transport()
    const client = createPlanApprovalClient({
      isOnline: () => false,
      transport: boundary,
    })

    await expect(client.submit(submission)).resolves.toEqual(
      expect.objectContaining({
        status: 'retryable_error',
        commandId,
        code: 'temporarily-unavailable',
        message: expect.stringContaining('not queued'),
      }),
    )
    expect(boundary.submit).not.toHaveBeenCalled()
  })

  it.each<MaterialCommandResult>([
    {
      status: 'stale_revision',
      commandId,
      code: 'active-plan-revision-changed',
      message: 'The active plan changed.',
      expectedActivePlanRevision: null,
      actualActivePlanRevision: 2,
    },
    {
      status: 'validation_error',
      commandId,
      code: 'invalid-plan-proposal',
      message: 'The proposal is invalid.',
    },
    {
      status: 'unsupported_version',
      commandId,
      code: 'unsupported-command-schema-version',
      message: 'Update Marathoner before approving this plan.',
      supportedVersion: 1,
    },
    {
      status: 'conflict',
      commandId,
      code: 'command-id-reused',
      message: 'The command ID was reused.',
    },
    {
      status: 'retryable_error',
      commandId,
      code: 'temporarily-unavailable',
      message: 'Try again shortly.',
    },
    {
      status: 'outcome_unknown',
      commandId,
      code: 'resolve-by-command-id',
      message: 'Resolve this command before retrying.',
    },
    {
      status: 'authentication_error',
      commandId,
      code: 'verified-email-required',
      message: 'Verify the account email.',
    },
    {
      status: 'authorization_error',
      commandId,
      code: 'approved-beta-membership-required',
      message: 'Beta membership is required.',
    },
    {
      status: 'authorization_error',
      commandId,
      code: 'plan-artifact-not-approved',
      message: 'This generated plan is not approved.',
    },
    {
      status: 'authorization_error',
      commandId,
      code: 'app-check-required',
      message: 'Open the supported app.',
    },
    {
      status: 'authorization_error',
      commandId,
      code: 'app-check-token-replayed',
      message: 'Refresh the app session.',
    },
  ])('preserves the typed $status result and its safe code', async (result) => {
    const client = createPlanApprovalClient({
      isOnline: () => true,
      transport: transport(result),
    })

    await expect(client.submit(submission)).resolves.toEqual(result)
  })

  it.each([
    [
      { code: 'functions/unauthenticated' },
      'authentication_error',
      'authentication-required',
    ],
    [
      { code: 'functions/unavailable' },
      'retryable_error',
      'temporarily-unavailable',
    ],
    [
      { code: 'functions/deadline-exceeded' },
      'outcome_unknown',
      'resolve-by-command-id',
    ],
  ])('maps a thrown transport failure to %s', async (error, status, code) => {
    const boundary = transport()
    vi.mocked(boundary.submit).mockRejectedValueOnce(error)
    const client = createPlanApprovalClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.submit(submission)).resolves.toEqual(
      expect.objectContaining({ status, code, commandId }),
    )
  })

  it.each([
    { malformed: true },
    { ...approved, commandId: 'another-command-0001' },
    {
      status: 'committed',
      commandId,
      committedAt: '2026-10-08T00:00:00.000Z',
      proofCount: 1,
    },
    {
      status: 'run_completed',
      commandId,
      completedRunId: 'run-0001',
      completedRunUpdatedAt: '2026-10-08T00:00:00.000Z',
      completedPlannedWorkout: null,
    },
    {
      status: 'run_deleted',
      commandId,
      completedRunId: 'run-0001',
      deletedAt: '2026-10-08T00:00:00.000Z',
      reopenedPlannedWorkout: null,
    },
    {
      status: 'conflict',
      commandId,
      code: 'planned-workout-already-completed',
      message: 'This workout already has a completed run.',
      planId: 'plan-0001',
      plannedWorkoutId: 'workout-0001',
      completedRunId: 'run-0001',
    },
    {
      status: 'stale_revision',
      commandId,
      code: 'completed-run-version-changed',
      message: 'The completed run changed.',
      completedRunId: 'run-0001',
      expectedUpdatedAt: '2026-10-08T00:00:00.000Z',
      actualUpdatedAt: '2026-10-08T00:01:00.000Z',
    },
  ])('treats an unexpected response as outcome unknown', async (result) => {
    const client = createPlanApprovalClient({
      isOnline: () => true,
      transport: transport(result),
    })

    await expect(client.submit(submission)).resolves.toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        code: 'resolve-by-command-id',
        commandId,
      }),
    )
  })
})
