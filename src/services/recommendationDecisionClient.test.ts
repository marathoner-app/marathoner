import { describe, expect, it, vi } from 'vitest'

import {
  RECOMMENDATION_DECISION_COMMAND_TYPE,
  type MaterialCommandResult,
  type RecommendationDecisionReceiptResult,
} from '../domain/materialCommands/contract'
import { createRecommendationId } from '../domain/recommendations/recommendationEvidence'
import { createUtcDateTime } from '../domain/training/dates'
import type { MaterialCommandTransport } from './materialCommandClient'
import {
  createRecommendationDecisionClient,
  type RecommendationDecisionSubmission,
} from './recommendationDecisionClient'

const acceptedCommandId = 'recommendation-decision-client-accept-0001'
const declinedCommandId = 'recommendation-decision-client-decline-0001'
const recommendationId = createRecommendationId(
  'recommendation-decision-client-0001',
)

const acceptedSubmission: RecommendationDecisionSubmission = {
  commandId: acceptedCommandId,
  recommendationId,
  decision: 'accepted',
  expectedEvaluatedPlanRevision: 4,
}

const declinedSubmission: RecommendationDecisionSubmission = {
  ...acceptedSubmission,
  commandId: declinedCommandId,
  decision: 'declined',
}

const acceptedReceipt: RecommendationDecisionReceiptResult = {
  status: 'recommendation_decided',
  commandId: acceptedCommandId,
  recommendationId,
  decision: 'accepted',
  evaluatedPlanRevision: 4,
  resultingPlanRevision: 5,
  decidedAt: createUtcDateTime('2026-10-27T01:30:00.000Z'),
}

const declinedReceipt: RecommendationDecisionReceiptResult = {
  ...acceptedReceipt,
  commandId: declinedCommandId,
  decision: 'declined',
  resultingPlanRevision: null,
}

function transport(result: unknown): MaterialCommandTransport {
  return {
    submit: vi.fn().mockResolvedValue(result),
    resolve: vi.fn().mockResolvedValue(result),
  }
}

describe('recommendation-decision client', () => {
  it('submits an exact accepted decision and preserves it across safe retries', async () => {
    const boundary = transport(acceptedReceipt)
    const client = createRecommendationDecisionClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.submit(acceptedSubmission)).resolves.toEqual(
      acceptedReceipt,
    )
    await expect(client.submit(acceptedSubmission)).resolves.toEqual(
      acceptedReceipt,
    )

    expect(boundary.submit).toHaveBeenCalledTimes(2)
    expect(boundary.submit).toHaveBeenNthCalledWith(1, {
      envelopeVersion: 1,
      appProtocolVersion: 1,
      commandId: acceptedCommandId,
      command: {
        type: RECOMMENDATION_DECISION_COMMAND_TYPE,
        schemaVersion: 1,
        recommendationId,
        decision: 'accepted',
        expectedEvaluatedPlanRevision: 4,
      },
    })
    expect(vi.mocked(boundary.submit).mock.calls[1]?.[0]).toEqual(
      vi.mocked(boundary.submit).mock.calls[0]?.[0],
    )
  })

  it('submits an exact declined decision and preserves the declined receipt', async () => {
    const boundary = transport(declinedReceipt)
    const client = createRecommendationDecisionClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.submit(declinedSubmission)).resolves.toEqual(
      declinedReceipt,
    )
    expect(boundary.submit).toHaveBeenCalledWith({
      envelopeVersion: 1,
      appProtocolVersion: 1,
      commandId: declinedCommandId,
      command: {
        type: RECOMMENDATION_DECISION_COMMAND_TYPE,
        schemaVersion: 1,
        recommendationId,
        decision: 'declined',
        expectedEvaluatedPlanRevision: 4,
      },
    })
  })

  it('resolves an existing command ID without submitting another command', async () => {
    const boundary = transport(acceptedReceipt)
    const client = createRecommendationDecisionClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.resolve(acceptedCommandId)).resolves.toEqual(
      acceptedReceipt,
    )
    expect(boundary.resolve).toHaveBeenCalledWith(acceptedCommandId)
    expect(boundary.submit).not.toHaveBeenCalled()
  })

  it('does not submit, resolve, queue, or replay while known offline', async () => {
    let online = false
    const boundary = transport(acceptedReceipt)
    const client = createRecommendationDecisionClient({
      isOnline: () => online,
      transport: boundary,
    })

    for (const result of [
      await client.submit(acceptedSubmission),
      await client.resolve(acceptedCommandId),
    ]) {
      expect(result).toEqual(
        expect.objectContaining({
          status: 'retryable_error',
          commandId: acceptedCommandId,
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

  it('recovers an ambiguous decision by resolving the same command ID', async () => {
    const boundary = transport(acceptedReceipt)
    vi.mocked(boundary.submit).mockRejectedValueOnce({
      code: 'functions/deadline-exceeded',
    })
    const client = createRecommendationDecisionClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.submit(acceptedSubmission)).resolves.toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        commandId: acceptedCommandId,
        code: 'resolve-by-command-id',
      }),
    )
    await expect(client.resolve(acceptedCommandId)).resolves.toEqual(
      acceptedReceipt,
    )
    expect(boundary.submit).toHaveBeenCalledTimes(1)
    expect(boundary.resolve).toHaveBeenCalledWith(acceptedCommandId)
  })

  it.each<MaterialCommandResult>([
    {
      status: 'stale_revision',
      commandId: acceptedCommandId,
      code: 'active-plan-revision-changed',
      message: 'The active plan changed.',
      expectedActivePlanRevision: 4,
      actualActivePlanRevision: 5,
    },
    {
      status: 'validation_error',
      commandId: acceptedCommandId,
      code: 'invalid-recommendation-decision',
      message: 'The recommendation decision is invalid.',
    },
    {
      status: 'authentication_error',
      commandId: acceptedCommandId,
      code: 'verified-email-required',
      message: 'Verify the account email.',
    },
    {
      status: 'authorization_error',
      commandId: acceptedCommandId,
      code: 'recommendation-decisions-not-enabled',
      message: 'Recommendation decisions are not enabled.',
    },
    {
      status: 'unsupported_version',
      commandId: acceptedCommandId,
      code: 'unsupported-command-schema-version',
      message: 'Update Marathoner before deciding.',
      supportedVersion: 1,
    },
    {
      status: 'conflict',
      commandId: acceptedCommandId,
      code: 'command-id-reused',
      message: 'The command ID was reused.',
    },
    {
      status: 'retryable_error',
      commandId: acceptedCommandId,
      code: 'temporarily-unavailable',
      message: 'Try again shortly.',
    },
    {
      status: 'outcome_unknown',
      commandId: acceptedCommandId,
      code: 'resolve-by-command-id',
      message: 'Resolve this command before retrying.',
    },
  ])('preserves the typed $status outcome and safe code', async (result) => {
    const client = createRecommendationDecisionClient({
      isOnline: () => true,
      transport: transport(result),
    })

    await expect(client.submit(acceptedSubmission)).resolves.toEqual(result)
  })

  it.each([
    { malformed: true },
    { ...acceptedReceipt, commandId: 'another-command-0001' },
    {
      status: 'plan_approved',
      commandId: acceptedCommandId,
      planId: 'plan-0001',
      activePlanRevision: 1,
      approvedAt: '2026-10-27T01:30:00.000Z',
    },
    {
      status: 'run_updated',
      commandId: acceptedCommandId,
      completedRunId: 'completed-run-0001',
      completedRunUpdatedAt: '2026-10-27T01:30:00.000Z',
      reopenedPlannedWorkout: null,
      completedPlannedWorkout: null,
    },
    {
      status: 'conflict',
      commandId: acceptedCommandId,
      code: 'planned-workout-already-completed',
      message: 'This workout already has a completed run.',
      planId: 'plan-0001',
      plannedWorkoutId: 'workout-0001',
      completedRunId: 'completed-run-0001',
    },
    {
      status: 'stale_revision',
      commandId: acceptedCommandId,
      code: 'completed-run-version-changed',
      message: 'The completed run changed.',
      completedRunId: 'completed-run-0001',
      expectedUpdatedAt: '2026-10-27T01:30:00.000Z',
      actualUpdatedAt: '2026-10-27T01:31:00.000Z',
    },
  ])('treats an unrelated or malformed response as outcome unknown', async (result) => {
    const client = createRecommendationDecisionClient({
      isOnline: () => true,
      transport: transport(result),
    })

    await expect(client.submit(acceptedSubmission)).resolves.toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        commandId: acceptedCommandId,
        code: 'resolve-by-command-id',
      }),
    )
  })
})
