import { describe, expect, it, vi } from 'vitest'

import {
  createPlanApprovalCommand,
  createProofMaterialCommand,
  createRecommendationDecisionCommand,
  createRunCompletionCommand,
  createRunDeletionCommand,
  createRunUpdateCommand,
  materialCommandSignature,
  type MaterialCommandCommittedResult,
  type PlanApprovalReceiptResult,
  type ProofMaterialCommandEnvelope,
  type RecommendationDecisionReceiptResult,
  type RunCompletionReceiptResult,
  type RunDeletionReceiptResult,
  type RunUpdateReceiptResult,
} from '../../src/domain/materialCommands/contract.js'
import {
  createRecommendationId,
  type ActivationDecision,
  type RecommendationEvidenceV2,
} from '../../src/domain/recommendations/recommendationEvidence.js'
import { createIanaTimeZone, createUtcDateTime } from '../../src/domain/training/dates.js'
import { createCompletedRunId } from '../../src/domain/training/identifiers.js'
import {
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  planGenerationContractFixtures,
} from '../../src/domain/training/index.js'
import {
  createDistanceMeters,
  createDurationSeconds,
} from '../../src/domain/training/units.js'
import {
  executeMaterialCommand,
  resolveMaterialCommand,
  type PlanApprovalHandlerDependencies,
  type PlanApprovalStore,
  type MaterialCommandStore,
  type RecommendationDecisionHandlerDependencies,
  type RecommendationDecisionStore,
  type RecommendationEvidenceReader,
  type RunCompletionStore,
  type RunDeletionStore,
  type RunUpdateStore,
} from './materialCommandHandler.js'
import type {
  PlanApprovalArtifactPolicyRecord,
  PlanApprovalArtifactReviewState,
} from './planApprovalArtifactPolicy.js'

const ownerId = 'runner-one'
const commandId = 'proof-command-0001'
const planApprovalCommandId = 'approve-plan-command-0001'
const privateRunNote = 'private runner note for redaction proof'
const recommendationDecisionCommand = createRecommendationDecisionCommand(
  'decide-recommendation-command-0001',
  {
    recommendationId: createRecommendationId('recommendation-0001'),
    decision: 'accepted',
    expectedEvaluatedPlanRevision: 4,
  },
)
const supportedScopeId = 'synthetic-consistent-runner@1'
const generatedFixture = planGenerationContractFixtures.find(
  (fixture) => fixture.id === 'generated-exact-date-distance-target',
)
if (generatedFixture?.result.kind !== 'generated') {
  throw new Error('Expected the generated plan contract fixture.')
}
const planApprovalCommand = createPlanApprovalCommand(planApprovalCommandId, {
  expectedActivePlanRevision: null,
  input: generatedFixture.input,
  proposal: generatedFixture.result.plan,
})
const runCompletionCommand = createRunCompletionCommand(
  'complete-run-command-0001',
  {
    plannedWorkout: null,
    startedAt: createUtcDateTime('2026-10-08T12:00:00.000Z'),
    timeZone: createIanaTimeZone('America/Los_Angeles'),
    distance: createDistanceMeters(5_000),
    duration: createDurationSeconds(1_800),
    notes: privateRunNote,
  },
)
const runDeletionCommand = createRunDeletionCommand(
  'delete-run-command-0001',
  {
    completedRunId: createCompletedRunId('run-0001'),
    expectedCompletedRunUpdatedAt: createUtcDateTime(
      '2026-10-08T13:00:00.000Z',
    ),
    plannedWorkout: null,
  },
)
const runUpdateCommand = createRunUpdateCommand('update-run-command-0001', {
  completedRunId: createCompletedRunId('run-0001'),
  expectedCompletedRunUpdatedAt: createUtcDateTime(
    '2026-10-08T13:00:00.000Z',
  ),
  input: {
    plannedWorkout: null,
    startedAt: createUtcDateTime('2026-10-08T12:00:00.000Z'),
    timeZone: createIanaTimeZone('America/Los_Angeles'),
    distance: createDistanceMeters(5_000),
    duration: createDurationSeconds(1_775),
    notes: privateRunNote,
  },
})

class InMemoryMaterialCommandStore implements MaterialCommandStore {
  proofCount = 0
  receipts = new Map<
    string,
    { signature: string; result: MaterialCommandCommittedResult }
  >()
  resolutionResults = new Map<
    string,
    | MaterialCommandCommittedResult
    | RunCompletionReceiptResult
    | RunUpdateReceiptResult
    | RunDeletionReceiptResult
    | RecommendationDecisionReceiptResult
  >()
  failure: unknown = null

  async commitProof(options: {
    envelope: ProofMaterialCommandEnvelope
    ownerId: string
  }) {
    if (this.failure) throw this.failure
    const key = `${options.ownerId}:${options.envelope.commandId}`
    const signature = materialCommandSignature(options.envelope)
    const prior = this.receipts.get(key)
    if (prior) {
      return prior.signature === signature
        ? { kind: 'committed' as const, result: prior.result }
        : { kind: 'conflict' as const }
    }
    this.proofCount += 1
    const result: MaterialCommandCommittedResult = {
      status: 'committed',
      commandId: options.envelope.commandId,
      committedAt: '2026-10-05T00:00:00.000Z',
      proofCount: this.proofCount,
    }
    this.receipts.set(key, { signature, result })
    this.resolutionResults.set(key, result)
    return { kind: 'committed' as const, result }
  }

  async resolve(options: { commandId: string; ownerId: string }) {
    if (this.failure) throw this.failure
    return this.resolutionResults.get(
      `${options.ownerId}:${options.commandId}`,
    ) ?? null
  }
}

class InMemoryPlanApprovalStore implements PlanApprovalStore {
  readonly result: PlanApprovalReceiptResult = {
    status: 'plan_approved',
    commandId: planApprovalCommandId,
    planId: 'synthetic-plan-0001',
    activePlanRevision: 1,
    approvedAt: '2026-10-08T00:00:00.000Z',
  }

  commit = vi.fn(async () => ({ kind: 'approved' as const, result: this.result }))
}

class InMemoryRunCompletionStore implements RunCompletionStore {
  readonly result: RunCompletionReceiptResult = {
    status: 'run_completed',
    commandId: runCompletionCommand.commandId,
    completedRunId: createCompletedRunId('run-0001'),
    completedRunUpdatedAt: createUtcDateTime('2026-10-08T13:00:00.000Z'),
    completedPlannedWorkout: null,
  }

  commit = vi.fn(async () => ({ kind: 'completed' as const, result: this.result }))
}

class InMemoryRunDeletionStore implements RunDeletionStore {
  readonly result: RunDeletionReceiptResult = {
    status: 'run_deleted',
    commandId: runDeletionCommand.commandId,
    completedRunId: runDeletionCommand.command.completedRunId,
    deletedAt: createUtcDateTime('2026-10-08T14:00:00.000Z'),
    reopenedPlannedWorkout: null,
  }

  commit = vi.fn(async () => ({ kind: 'deleted' as const, result: this.result }))
}

class InMemoryRunUpdateStore implements RunUpdateStore {
  readonly result: RunUpdateReceiptResult = {
    status: 'run_updated',
    commandId: runUpdateCommand.commandId,
    completedRunId: runUpdateCommand.command.completedRunId,
    completedRunUpdatedAt: createUtcDateTime('2026-10-08T13:30:00.000Z'),
    reopenedPlannedWorkout: null,
    completedPlannedWorkout: null,
  }

  commit = vi.fn(async () => ({ kind: 'updated' as const, result: this.result }))
}

const stableAdaptationArtifactVersion = 'fixture-adaptation-policy@1.0.0'
const recommendationReceipt: RecommendationDecisionReceiptResult = {
  status: 'recommendation_decided',
  commandId: recommendationDecisionCommand.commandId,
  recommendationId:
    recommendationDecisionCommand.command.recommendationId,
  decision: recommendationDecisionCommand.command.decision,
  evaluatedPlanRevision:
    recommendationDecisionCommand.command.expectedEvaluatedPlanRevision,
  resultingPlanRevision: 5,
  decidedAt: createUtcDateTime('2026-10-27T18:05:00.000Z'),
}

class InMemoryRecommendationEvidenceReader
  implements RecommendationEvidenceReader
{
  read = vi.fn(async () => ({
    evaluationInput: {
      adaptationArtifactVersion: stableAdaptationArtifactVersion,
    },
  }) as RecommendationEvidenceV2)
}

class InMemoryRecommendationDecisionStore
  implements RecommendationDecisionStore
{
  resolveExisting = vi.fn(async () => ({ kind: 'missing' as const }))
  commit = vi.fn(async () => ({
    kind: 'decided' as const,
    result: recommendationReceipt,
  }))
}

function approvedPolicyRecord(): PlanApprovalArtifactPolicyRecord {
  return {
    supportedScopeId,
    inputSchemaVersion: planApprovalCommand.command.input.schemaVersion,
    generatorVersion:
      planApprovalCommand.command.proposal.provenance.generatorVersion,
    rulesetVersion: planApprovalCommand.command.input.rulesetVersion,
    generatedPlanSchemaVersion: planApprovalCommand.command.proposal.schemaVersion,
    resultSchemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
    reviewState: 'approved',
  }
}

function allowingActivationGate() {
  return {
    evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed' } as const)),
  }
}

function dependencies(
  store = new InMemoryMaterialCommandStore(),
  planApproval?: PlanApprovalHandlerDependencies,
  runCompletion?: { store: RunCompletionStore },
  runDeletion?: { store: RunDeletionStore },
  runUpdate?: { store: RunUpdateStore },
  recommendationDecision?: RecommendationDecisionHandlerDependencies,
) {
  return {
    store,
    planApproval,
    runCompletion,
    runDeletion,
    runUpdate,
    recommendationDecision,
    log: vi.fn(),
  }
}

describe('material-command handler', () => {
  it('requires authentication and rejects a payload-supplied owner', async () => {
    const boundary = dependencies()
    await expect(
      executeMaterialCommand(
        { authenticatedUserId: null, data: createProofMaterialCommand(commandId) },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'authentication_error' }),
    )

    await expect(
      executeMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: {
            ...createProofMaterialCommand(commandId),
            userId: 'runner-two',
          },
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'validation_error',
        code: 'ownership-field-prohibited',
      }),
    )
    expect(boundary.store.proofCount).toBe(0)
  })

  it('returns the original result for a repeated command without a second effect', async () => {
    const boundary = dependencies()
    const command = createProofMaterialCommand(commandId)

    const first = await executeMaterialCommand(
      { authenticatedUserId: ownerId, data: command },
      boundary,
    )
    const second = await executeMaterialCommand(
      { authenticatedUserId: ownerId, data: command },
      boundary,
    )

    expect(first).toEqual(second)
    expect(first).toEqual(
      expect.objectContaining({ status: 'committed', proofCount: 1 }),
    )
    expect(boundary.store.proofCount).toBe(1)
  })

  it('rejects one command ID reused for a different supported command', async () => {
    const boundary = dependencies()
    await executeMaterialCommand(
      {
        authenticatedUserId: ownerId,
        data: createProofMaterialCommand(commandId, 'default'),
      },
      boundary,
    )

    await expect(
      executeMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: createProofMaterialCommand(commandId, 'alternate'),
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'conflict', code: 'command-id-reused' }),
    )
    expect(boundary.store.proofCount).toBe(1)
  })

  it('returns typed version, retryable, and outcome-unknown results', async () => {
    const boundary = dependencies()
    await expect(
      executeMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: {
            ...createProofMaterialCommand(commandId),
            appProtocolVersion: 2,
          },
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'unsupported_version',
        code: 'unsupported-app-protocol-version',
      }),
    )

    boundary.store.failure = { code: 14 }
    await expect(
      executeMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: createProofMaterialCommand(commandId),
        },
        boundary,
      ),
    ).resolves.toEqual(expect.objectContaining({ status: 'retryable_error' }))

    boundary.store.failure = new Error('unknown failure')
    await expect(
      executeMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: createProofMaterialCommand(commandId),
        },
        boundary,
      ),
    ).resolves.toEqual(expect.objectContaining({ status: 'outcome_unknown' }))
  })

  it('resolves a committed command by authenticated owner and keeps logs redacted', async () => {
    const boundary = dependencies()
    const command = createProofMaterialCommand(commandId)
    const committed = await executeMaterialCommand(
      { authenticatedUserId: ownerId, data: command },
      boundary,
    )
    await executeMaterialCommand(
      {
        authenticatedUserId: ownerId,
        data: { ...command, note: 'private participant note' },
      },
      boundary,
    )
    const resolved = await resolveMaterialCommand(
      { authenticatedUserId: ownerId, data: { commandId } },
      boundary,
    )

    expect(resolved).toEqual(committed)
    const serializedLogs = JSON.stringify(boundary.log.mock.calls)
    expect(serializedLogs).not.toContain(ownerId)
    expect(serializedLogs).not.toContain(commandId)
    expect(serializedLogs).not.toContain('payload')
    expect(serializedLogs).not.toContain('private participant note')
  })

  it('rejects plan approval against the empty production policy before persistence', async () => {
    const boundary = dependencies()

    await expect(
      executeMaterialCommand(
        { authenticatedUserId: ownerId, data: planApprovalCommand },
        boundary,
      ),
    ).resolves.toEqual({
      status: 'authorization_error',
      commandId: planApprovalCommandId,
      code: 'plan-artifact-not-approved',
      message:
        'This generated plan is not approved for the active participant scope.',
    })
    expect(boundary.store.proofCount).toBe(0)
    expect(boundary.log).toHaveBeenCalledWith({
      event: 'material-command-result',
      commandType: 'plan.approve-generated',
      status: 'authorization_error',
    })
  })

  it('passes an exact synthetic approval to persistence with authenticated ownership', async () => {
    const planStore = new InMemoryPlanApprovalStore()
    const activationGate = allowingActivationGate()
    const boundary = dependencies(new InMemoryMaterialCommandStore(), {
      activationGate,
      policyRecords: [approvedPolicyRecord()],
      store: planStore,
      supportedScopeId,
    })

    await expect(
      executeMaterialCommand(
        { authenticatedUserId: ownerId, data: planApprovalCommand },
        boundary,
      ),
    ).resolves.toEqual(planStore.result)
    expect(planStore.commit).toHaveBeenCalledWith({
      artifactPolicyRecord: approvedPolicyRecord(),
      envelope: planApprovalCommand,
      ownerId,
    })
    expect(activationGate.evaluate).toHaveBeenCalledWith({
      capability: 'generation',
      artifactVersion: planApprovalCommand.command.input.rulesetVersion,
      appProtocolVersion: planApprovalCommand.appProtocolVersion,
      commandProtocolVersion: planApprovalCommand.envelopeVersion,
    })
  })

  it('fails closed before persistence when dynamic generation activation is denied', async () => {
    const planStore = new InMemoryPlanApprovalStore()
    const activationGate = {
      evaluate: vi.fn(async () => ({
        allowed: false,
        reason: 'capability_disabled',
      } as const)),
    }
    const boundary = dependencies(new InMemoryMaterialCommandStore(), {
      activationGate,
      policyRecords: [approvedPolicyRecord()],
      store: planStore,
      supportedScopeId,
    })

    await expect(
      executeMaterialCommand(
        { authenticatedUserId: ownerId, data: planApprovalCommand },
        boundary,
      ),
    ).resolves.toEqual({
      status: 'authorization_error',
      commandId: planApprovalCommandId,
      code: 'plan-activation-not-available',
      message:
        'Plan activation is currently unavailable. No training plan was changed.',
    })
    expect(planStore.commit).not.toHaveBeenCalled()
    expect(boundary.log).toHaveBeenCalledWith({
      event: 'material-command-result',
      commandType: 'plan.approve-generated',
      status: 'authorization_error',
    })
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(
      'capability_disabled',
    )
  })

  it('fails closed before persistence when the activation gate cannot decide', async () => {
    const planStore = new InMemoryPlanApprovalStore()
    const boundary = dependencies(new InMemoryMaterialCommandStore(), {
      activationGate: {
        evaluate: vi.fn(async () => {
          throw new Error('private control read failure')
        }),
      },
      policyRecords: [approvedPolicyRecord()],
      store: planStore,
      supportedScopeId,
    })

    await expect(
      executeMaterialCommand(
        { authenticatedUserId: ownerId, data: planApprovalCommand },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'authorization_error',
        code: 'plan-activation-not-available',
      }),
    )
    expect(planStore.commit).not.toHaveBeenCalled()
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(
      'private control read failure',
    )
  })

  it.each<PlanApprovalArtifactReviewState>([
    'missing',
    'draft',
    'ready_for_review',
    'conditional',
    'rejected',
    'retired',
  ])('returns a typed rejection before storage for a %s tuple', async (reviewState) => {
    const planStore = new InMemoryPlanApprovalStore()
    const boundary = dependencies(new InMemoryMaterialCommandStore(), {
      activationGate: allowingActivationGate(),
      policyRecords: [{ ...approvedPolicyRecord(), reviewState }],
      store: planStore,
      supportedScopeId,
    })

    await expect(
      executeMaterialCommand(
        { authenticatedUserId: ownerId, data: planApprovalCommand },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'authorization_error',
        code: 'plan-artifact-not-approved',
      }),
    )
    expect(planStore.commit).not.toHaveBeenCalled()
  })

  it('rejects a mismatched policy before the plan store and redacts policy data from logs', async () => {
    const planStore = new InMemoryPlanApprovalStore()
    const boundary = dependencies(new InMemoryMaterialCommandStore(), {
      activationGate: allowingActivationGate(),
      policyRecords: [
        {
          ...approvedPolicyRecord(),
          generatorVersion: 'another-generator@1.0.0',
        },
      ],
      store: planStore,
      supportedScopeId,
    })

    await executeMaterialCommand(
      { authenticatedUserId: ownerId, data: planApprovalCommand },
      boundary,
    )

    expect(planStore.commit).not.toHaveBeenCalled()
    const serializedLogs = JSON.stringify(boundary.log.mock.calls)
    expect(serializedLogs).not.toContain(ownerId)
    expect(serializedLogs).not.toContain(planApprovalCommandId)
    expect(serializedLogs).not.toContain(supportedScopeId)
    expect(serializedLogs).not.toContain('another-generator')
    expect(serializedLogs).not.toContain('fixture-generator')
    expect(serializedLogs).not.toContain('fixture-rules')
    expect(serializedLogs).not.toContain('input')
    expect(serializedLogs).not.toContain('proposal')
  })

  it('keeps run completion unavailable when its store is absent', async () => {
    const boundary = dependencies()

    await expect(
      executeMaterialCommand(
        { authenticatedUserId: ownerId, data: runCompletionCommand },
        boundary,
      ),
    ).resolves.toEqual({
      status: 'authorization_error',
      commandId: runCompletionCommand.commandId,
      code: 'approved-beta-membership-required',
      message: 'Completed-run commands are not enabled in this environment.',
    })
    expect(boundary.log).toHaveBeenCalledWith({
      event: 'material-command-result',
      commandType: 'run.complete',
      status: 'authorization_error',
    })
  })

  it('recognizes recommendation decisions but keeps them fail-closed before persistence', async () => {
    const boundary = dependencies()

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: recommendationDecisionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual({
      status: 'authorization_error',
      commandId: recommendationDecisionCommand.commandId,
      code: 'recommendation-decisions-not-enabled',
      message:
        'Recommendation decisions are not enabled in this environment. No training plan was changed.',
    })
    expect(boundary.store.proofCount).toBe(0)
    expect(boundary.log).toHaveBeenCalledWith({
      event: 'material-command-result',
      commandType: 'recommendation.decide',
      status: 'authorization_error',
    })
    const serializedLogs = JSON.stringify(boundary.log.mock.calls)
    expect(serializedLogs).not.toContain(ownerId)
    expect(serializedLogs).not.toContain(
      recommendationDecisionCommand.commandId,
    )
    expect(serializedLogs).not.toContain(
      recommendationDecisionCommand.command.recommendationId,
    )
    expect(serializedLogs).not.toContain(
      recommendationDecisionCommand.command.decision,
    )
    expect(serializedLogs).not.toContain('evaluatedPlanRevision')
  })

  it('requires App Check before reading recommendation evidence', async () => {
    const evidence = new InMemoryRecommendationEvidenceReader()
    const decisionStore = new InMemoryRecommendationDecisionStore()
    const activationGate = allowingActivationGate()
    const boundary = dependencies(
      new InMemoryMaterialCommandStore(),
      undefined,
      undefined,
      undefined,
      undefined,
      { activationGate, evidence, store: decisionStore },
    )

    await expect(
      executeMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: recommendationDecisionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'authorization_error',
        code: 'app-check-required',
      }),
    )
    expect(evidence.read).not.toHaveBeenCalled()
    expect(activationGate.evaluate).not.toHaveBeenCalled()
    expect(decisionStore.commit).not.toHaveBeenCalled()
  })

  it.each<ActivationDecision['reason']>([
    'invalid_control',
    'invalid_request',
    'capability_disabled',
    'stale_app_protocol',
    'stale_command_protocol',
    'draft_artifact',
    'artifact_not_approved',
  ])('keeps a %s adaptation decision out of persistence', async (reason) => {
    const evidence = new InMemoryRecommendationEvidenceReader()
    const decisionStore = new InMemoryRecommendationDecisionStore()
    const activationGate = {
      evaluate: vi.fn(async (): Promise<ActivationDecision> => ({
        allowed: false,
        reason,
      })),
    }
    const boundary = dependencies(
      new InMemoryMaterialCommandStore(),
      undefined,
      undefined,
      undefined,
      undefined,
      { activationGate, evidence, store: decisionStore },
    )

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: recommendationDecisionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual({
      status: 'authorization_error',
      commandId: recommendationDecisionCommand.commandId,
      code: 'recommendation-decisions-not-enabled',
      message:
        'Recommendation decisions are not enabled in this environment. No training plan was changed.',
    })
    expect(decisionStore.commit).not.toHaveBeenCalled()
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(reason)
  })

  it('returns an existing receipt or conflict before reevaluating activation', async () => {
    const evidence = new InMemoryRecommendationEvidenceReader()
    const decisionStore = new InMemoryRecommendationDecisionStore()
    const activationGate = {
      evaluate: vi.fn(async (): Promise<ActivationDecision> => ({
        allowed: false,
        reason: 'capability_disabled',
      })),
    }
    const boundary = dependencies(
      new InMemoryMaterialCommandStore(),
      undefined,
      undefined,
      undefined,
      undefined,
      { activationGate, evidence, store: decisionStore },
    )
    const invoke = () =>
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: recommendationDecisionCommand,
        },
        boundary,
      )

    decisionStore.resolveExisting.mockResolvedValueOnce({
      kind: 'decided',
      result: recommendationReceipt,
    })
    await expect(invoke()).resolves.toEqual(recommendationReceipt)

    decisionStore.resolveExisting.mockResolvedValueOnce({ kind: 'conflict' })
    await expect(invoke()).resolves.toEqual(
      expect.objectContaining({
        status: 'conflict',
        code: 'command-id-reused',
      }),
    )
    expect(evidence.read).not.toHaveBeenCalled()
    expect(activationGate.evaluate).not.toHaveBeenCalled()
    expect(decisionStore.commit).not.toHaveBeenCalled()
  })

  it('derives activation from server evidence and commits an allowed decision', async () => {
    const materialStore = new InMemoryMaterialCommandStore()
    const evidence = new InMemoryRecommendationEvidenceReader()
    const decisionStore = new InMemoryRecommendationDecisionStore()
    const activationGate = allowingActivationGate()
    const boundary = dependencies(
      materialStore,
      undefined,
      undefined,
      undefined,
      undefined,
      { activationGate, evidence, store: decisionStore },
    )

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: recommendationDecisionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual(recommendationReceipt)
    expect(evidence.read).toHaveBeenCalledWith({
      ownerId,
      recommendationId:
        recommendationDecisionCommand.command.recommendationId,
    })
    expect(activationGate.evaluate).toHaveBeenCalledWith({
      capability: 'adaptation',
      artifactVersion: stableAdaptationArtifactVersion,
      appProtocolVersion: recommendationDecisionCommand.appProtocolVersion,
      commandProtocolVersion: recommendationDecisionCommand.envelopeVersion,
    })
    expect(decisionStore.commit).toHaveBeenCalledWith({
      authorizedAdaptationArtifactVersion: stableAdaptationArtifactVersion,
      envelope: recommendationDecisionCommand,
      ownerId,
    })
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(ownerId)
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(
      stableAdaptationArtifactVersion,
    )

    materialStore.resolutionResults.set(
      `${ownerId}:${recommendationReceipt.commandId}`,
      recommendationReceipt,
    )
    await expect(
      resolveMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: { commandId: recommendationReceipt.commandId },
        },
        boundary,
      ),
    ).resolves.toEqual(recommendationReceipt)
    expect(boundary.log).toHaveBeenLastCalledWith({
      event: 'material-command-resolution',
      commandType: 'recommendation.decide',
      status: 'recommendation_decided',
    })
  })

  it('fails closed when recommendation evidence cannot be read', async () => {
    const evidence: RecommendationEvidenceReader = {
      read: vi.fn().mockRejectedValue(new Error('private evidence failure')),
    }
    const decisionStore = new InMemoryRecommendationDecisionStore()
    const activationGate = allowingActivationGate()
    const boundary = dependencies(
      new InMemoryMaterialCommandStore(),
      undefined,
      undefined,
      undefined,
      undefined,
      { activationGate, evidence, store: decisionStore },
    )

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: recommendationDecisionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'authorization_error',
        code: 'recommendation-decisions-not-enabled',
      }),
    )
    expect(activationGate.evaluate).not.toHaveBeenCalled()
    expect(decisionStore.commit).not.toHaveBeenCalled()
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(
      'private evidence failure',
    )
  })

  it('maps stale, conflict, and retryable recommendation store outcomes', async () => {
    const evidence = new InMemoryRecommendationEvidenceReader()
    const activationGate = allowingActivationGate()
    const decisionStore = new InMemoryRecommendationDecisionStore()
    const boundary = dependencies(
      new InMemoryMaterialCommandStore(),
      undefined,
      undefined,
      undefined,
      undefined,
      { activationGate, evidence, store: decisionStore },
    )
    const invoke = () =>
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: recommendationDecisionCommand,
        },
        boundary,
      )

    decisionStore.commit.mockResolvedValueOnce({
      kind: 'stale',
      result: {
        status: 'stale_revision',
        commandId: recommendationDecisionCommand.commandId,
        code: 'active-plan-revision-changed',
        message:
          'The active training plan changed before this approval was committed.',
        expectedActivePlanRevision: 4,
        actualActivePlanRevision: 5,
      },
    })
    await expect(invoke()).resolves.toEqual(
      expect.objectContaining({ status: 'stale_revision' }),
    )

    decisionStore.commit.mockResolvedValueOnce({ kind: 'conflict' })
    await expect(invoke()).resolves.toEqual(
      expect.objectContaining({ status: 'conflict' }),
    )

    decisionStore.commit.mockRejectedValueOnce({
      code: 'unavailable',
      message: 'private recommendation persistence failure',
    })
    await expect(invoke()).resolves.toEqual(
      expect.objectContaining({
        status: 'retryable_error',
        code: 'temporarily-unavailable',
      }),
    )
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(
      'private recommendation persistence failure',
    )
  })

  it('passes run completion to persistence with authenticated ownership and redacted logs', async () => {
    const materialStore = new InMemoryMaterialCommandStore()
    const runStore = new InMemoryRunCompletionStore()
    const boundary = dependencies(materialStore, undefined, { store: runStore })

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: runCompletionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual(runStore.result)
    expect(runStore.commit).toHaveBeenCalledWith({
      envelope: runCompletionCommand,
      ownerId,
    })
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(ownerId)
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(
      runCompletionCommand.commandId,
    )
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(
      privateRunNote,
    )
    expect(boundary.log).toHaveBeenCalledWith({
      event: 'material-command-result',
      commandType: 'run.complete',
      status: 'run_completed',
    })
  })

  it('requires App Check before a completed-run store can be called', async () => {
    const runStore = new InMemoryRunCompletionStore()
    const boundary = dependencies(
      new InMemoryMaterialCommandStore(),
      undefined,
      { store: runStore },
    )

    await expect(
      executeMaterialCommand(
        { authenticatedUserId: ownerId, data: runCompletionCommand },
        boundary,
      ),
    ).resolves.toEqual({
      status: 'authorization_error',
      commandId: runCompletionCommand.commandId,
      code: 'app-check-required',
      message: 'Open the supported Marathoner app before retrying this command.',
    })
    expect(runStore.commit).not.toHaveBeenCalled()
  })

  it('maps a run-store membership rejection without recording a write', async () => {
    const runStore: RunCompletionStore = {
      commit: vi.fn(async () => ({ kind: 'membership-required' as const })),
    }
    const boundary = dependencies(
      new InMemoryMaterialCommandStore(),
      undefined,
      { store: runStore },
    )

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: runCompletionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual({
      status: 'authorization_error',
      commandId: runCompletionCommand.commandId,
      code: 'approved-beta-membership-required',
      message:
        'An approved beta membership is required for completed-run commands.',
    })
  })

  it('keeps completion payloads and thrown error details out of logs', async () => {
    const sensitiveError = {
      code: 'unavailable',
      message: 'private persistence failure detail',
      ownerId,
      payload: runCompletionCommand.command.input,
    }
    const runStore: RunCompletionStore = {
      commit: vi.fn().mockRejectedValue(sensitiveError),
    }
    const boundary = dependencies(
      new InMemoryMaterialCommandStore(),
      undefined,
      { store: runStore },
    )

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: runCompletionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'retryable_error',
        code: 'temporarily-unavailable',
      }),
    )
    expect(boundary.log).toHaveBeenCalledWith({
      event: 'material-command-result',
      commandType: 'run.complete',
      status: 'retryable_error',
    })
    const serializedLogs = JSON.stringify(boundary.log.mock.calls)
    for (const sensitiveValue of [
      ownerId,
      runCompletionCommand.commandId,
      privateRunNote,
      sensitiveError.message,
      sensitiveError,
    ]) {
      expect(serializedLogs).not.toContain(
        typeof sensitiveValue === 'string'
          ? sensitiveValue
          : JSON.stringify(sensitiveValue),
      )
    }
  })

  it('maps run-completion conflicts and resolves stored completion receipts', async () => {
    const materialStore = new InMemoryMaterialCommandStore()
    const runStore: RunCompletionStore = {
      commit: vi.fn(async () => ({ kind: 'conflict' as const })),
    }
    const boundary = dependencies(materialStore, undefined, { store: runStore })

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: runCompletionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'conflict',
        code: 'command-id-reused',
      }),
    )

    const receipt = new InMemoryRunCompletionStore().result
    materialStore.resolutionResults.set(
      `${ownerId}:${receipt.commandId}`,
      receipt,
    )
    await expect(
      resolveMaterialCommand(
        { authenticatedUserId: ownerId, data: { commandId: receipt.commandId } },
        boundary,
      ),
    ).resolves.toEqual(receipt)
    expect(boundary.log).toHaveBeenLastCalledWith({
      event: 'material-command-resolution',
      commandType: 'run.complete',
      status: 'run_completed',
    })
  })

  it('keeps run updates unavailable when their store is absent', async () => {
    const boundary = dependencies()

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: runUpdateCommand,
        },
        boundary,
      ),
    ).resolves.toEqual({
      status: 'authorization_error',
      commandId: runUpdateCommand.commandId,
      code: 'approved-beta-membership-required',
      message: 'Completed-run commands are not enabled in this environment.',
    })
    expect(boundary.log).toHaveBeenCalledWith({
      event: 'material-command-result',
      commandType: 'run.update',
      status: 'authorization_error',
    })
  })

  it('requires App Check and membership before run updates', async () => {
    const runStore: RunUpdateStore = {
      commit: vi.fn(async () => ({ kind: 'membership-required' as const })),
    }
    const boundary = dependencies(
      new InMemoryMaterialCommandStore(),
      undefined,
      undefined,
      undefined,
      { store: runStore },
    )

    await expect(
      executeMaterialCommand(
        { authenticatedUserId: ownerId, data: runUpdateCommand },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'authorization_error',
        code: 'app-check-required',
      }),
    )
    expect(runStore.commit).not.toHaveBeenCalled()

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: runUpdateCommand,
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'authorization_error',
        code: 'approved-beta-membership-required',
      }),
    )
  })

  it('passes run updates to persistence and resolves their redacted receipts', async () => {
    const materialStore = new InMemoryMaterialCommandStore()
    const runStore = new InMemoryRunUpdateStore()
    const boundary = dependencies(
      materialStore,
      undefined,
      undefined,
      undefined,
      { store: runStore },
    )

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: runUpdateCommand,
        },
        boundary,
      ),
    ).resolves.toEqual(runStore.result)
    expect(runStore.commit).toHaveBeenCalledWith({
      envelope: runUpdateCommand,
      ownerId,
    })

    materialStore.resolutionResults.set(
      `${ownerId}:${runStore.result.commandId}`,
      runStore.result,
    )
    await expect(
      resolveMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: { commandId: runStore.result.commandId },
        },
        boundary,
      ),
    ).resolves.toEqual(runStore.result)
    expect(boundary.log).toHaveBeenLastCalledWith({
      event: 'material-command-resolution',
      commandType: 'run.update',
      status: 'run_updated',
    })
    const logs = JSON.stringify(boundary.log.mock.calls)
    expect(logs).not.toContain(ownerId)
    expect(logs).not.toContain(runUpdateCommand.commandId)
    expect(logs).not.toContain(privateRunNote)
  })

  it('maps a reused run-update command ID to the shared conflict result', async () => {
    const runStore: RunUpdateStore = {
      commit: vi.fn(async () => ({ kind: 'conflict' as const })),
    }
    const boundary = dependencies(
      new InMemoryMaterialCommandStore(),
      undefined,
      undefined,
      undefined,
      { store: runStore },
    )

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: runUpdateCommand,
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'conflict',
        code: 'command-id-reused',
      }),
    )
  })

  it('keeps run deletion unavailable when its store is absent', async () => {
    const boundary = dependencies()

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: runDeletionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual({
      status: 'authorization_error',
      commandId: runDeletionCommand.commandId,
      code: 'approved-beta-membership-required',
      message: 'Completed-run commands are not enabled in this environment.',
    })
    expect(boundary.log).toHaveBeenCalledWith({
      event: 'material-command-result',
      commandType: 'run.delete',
      status: 'authorization_error',
    })
  })

  it('requires App Check and membership before run deletion', async () => {
    const runStore: RunDeletionStore = {
      commit: vi.fn(async () => ({ kind: 'membership-required' as const })),
    }
    const boundary = dependencies(
      new InMemoryMaterialCommandStore(),
      undefined,
      undefined,
      { store: runStore },
    )

    await expect(
      executeMaterialCommand(
        { authenticatedUserId: ownerId, data: runDeletionCommand },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'authorization_error',
        code: 'app-check-required',
      }),
    )
    expect(runStore.commit).not.toHaveBeenCalled()

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: runDeletionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'authorization_error',
        code: 'approved-beta-membership-required',
      }),
    )
  })

  it('passes run deletion to persistence and resolves its redacted receipt', async () => {
    const materialStore = new InMemoryMaterialCommandStore()
    const runStore = new InMemoryRunDeletionStore()
    const boundary = dependencies(
      materialStore,
      undefined,
      undefined,
      { store: runStore },
    )

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: runDeletionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual(runStore.result)
    expect(runStore.commit).toHaveBeenCalledWith({
      envelope: runDeletionCommand,
      ownerId,
    })

    materialStore.resolutionResults.set(
      `${ownerId}:${runStore.result.commandId}`,
      runStore.result,
    )
    await expect(
      resolveMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: { commandId: runStore.result.commandId },
        },
        boundary,
      ),
    ).resolves.toEqual(runStore.result)
    expect(boundary.log).toHaveBeenLastCalledWith({
      event: 'material-command-resolution',
      commandType: 'run.delete',
      status: 'run_deleted',
    })
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(ownerId)
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(
      runDeletionCommand.commandId,
    )
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain(
      runDeletionCommand.command.completedRunId,
    )
  })

  it('maps a reused run-deletion command ID to the shared conflict result', async () => {
    const runStore: RunDeletionStore = {
      commit: vi.fn(async () => ({ kind: 'conflict' as const })),
    }
    const boundary = dependencies(
      new InMemoryMaterialCommandStore(),
      undefined,
      undefined,
      { store: runStore },
    )

    await expect(
      executeMaterialCommand(
        {
          appCheckVerified: true,
          authenticatedUserId: ownerId,
          data: runDeletionCommand,
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'conflict',
        code: 'command-id-reused',
      }),
    )
  })
})
