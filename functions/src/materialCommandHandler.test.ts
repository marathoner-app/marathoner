import { describe, expect, it, vi } from 'vitest'

import {
  createPlanApprovalCommand,
  createProofMaterialCommand,
  materialCommandSignature,
  type MaterialCommandCommittedResult,
  type PlanApprovalReceiptResult,
  type ProofMaterialCommandEnvelope,
} from '../../src/domain/materialCommands/contract.js'
import {
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  planGenerationContractFixtures,
} from '../../src/domain/training/index.js'
import {
  executeMaterialCommand,
  resolveMaterialCommand,
  type PlanApprovalHandlerDependencies,
  type PlanApprovalStore,
  type MaterialCommandStore,
} from './materialCommandHandler.js'
import type {
  PlanApprovalArtifactPolicyRecord,
  PlanApprovalArtifactReviewState,
} from './planApprovalArtifactPolicy.js'

const ownerId = 'runner-one'
const commandId = 'proof-command-0001'
const planApprovalCommandId = 'approve-plan-command-0001'
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

class InMemoryMaterialCommandStore implements MaterialCommandStore {
  proofCount = 0
  receipts = new Map<
    string,
    { signature: string; result: MaterialCommandCommittedResult }
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
    return { kind: 'committed' as const, result }
  }

  async resolve(options: { commandId: string; ownerId: string }) {
    if (this.failure) throw this.failure
    return this.receipts.get(`${options.ownerId}:${options.commandId}`)?.result ?? null
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

function dependencies(
  store = new InMemoryMaterialCommandStore(),
  planApproval?: PlanApprovalHandlerDependencies,
) {
  return { store, planApproval, log: vi.fn() }
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
    const boundary = dependencies(new InMemoryMaterialCommandStore(), {
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
      envelope: planApprovalCommand,
      ownerId,
    })
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
})
