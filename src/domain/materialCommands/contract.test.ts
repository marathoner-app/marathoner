import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION,
  MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
  MATERIAL_COMMAND_ENVELOPE_VERSION,
  MATERIAL_COMMAND_PROOF_SCHEMA_VERSION,
  PLAN_APPROVAL_COMMAND_SCHEMA_VERSION,
  createAccountDeletionRequest,
  createPlanApprovalCommand,
  createProofMaterialCommand,
  isMaterialCommandResult,
  materialCommandSignature,
  parseMaterialCommand,
} from './contract'
import {
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  createPlanGenerationArtifactVersion,
  planGenerationContractFixtures,
  type GeneratedPlanV1,
  type PlanGenerationInputV1,
} from '../training'

const commandId = 'proof-command-0001'
const approvalCommandId = 'approve-plan-command-0001'

const generatedFixture = planGenerationContractFixtures.find(
  (fixture) => fixture.id === 'generated-exact-date-distance-target',
)
if (generatedFixture?.result.kind !== 'generated') {
  throw new Error('Expected the generated plan contract fixture.')
}
const generatedInput = generatedFixture.input
const generatedPlan = generatedFixture.result.plan

function approvalCommand(expectedActivePlanRevision: number | null = null) {
  return createPlanApprovalCommand(approvalCommandId, {
    expectedActivePlanRevision,
    input: generatedInput,
    proposal: generatedPlan,
  })
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('material-command contract', () => {
  it('creates and parses the supported proof command', () => {
    const command = createProofMaterialCommand(commandId)

    expect(parseMaterialCommand(command)).toEqual({
      ok: true,
      envelope: command,
    })
    expect(materialCommandSignature(command)).toBe(
      '1:1:proof.material-command:1:default',
    )
  })

  it('creates the payload-free account-deletion request', () => {
    const command = createAccountDeletionRequest('delete-command-0001')

    expect(parseMaterialCommand(command)).toEqual({
      ok: true,
      envelope: command,
    })
    expect(materialCommandSignature(command)).toBe(
      '1:1:account.request-deletion:1',
    )
  })

  it('creates and parses a generated-plan approval without caller ownership', () => {
    const command = approvalCommand()

    expect(parseMaterialCommand(command)).toEqual({
      ok: true,
      envelope: command,
    })
    expect(command.command.expectedActivePlanRevision).toBeNull()
    expect(command.command.input).toEqual(generatedInput)
    expect(command.command.proposal).toEqual(generatedPlan)
    expect(JSON.stringify(command)).not.toContain('userId')
    expect(command.command.proposal.endDate).toBe(
      generatedPlan.endDate,
    )
    expect(command.command.proposal.provenance).toEqual(
      generatedPlan.provenance,
    )
    expect(command.command.proposal.reasonCodes).toEqual(
      generatedPlan.reasonCodes,
    )
  })

  it('uses a stable, payload-sensitive plan-approval signature', () => {
    const command = approvalCommand()
    const reorderedInput: PlanGenerationInputV1 = {
      runner: generatedInput.runner,
      planStartDate: generatedInput.planStartDate,
      rulesetVersion: generatedInput.rulesetVersion,
      schemaVersion: generatedInput.schemaVersion,
    }
    const reordered = createPlanApprovalCommand('approve-plan-command-0002', {
      expectedActivePlanRevision: null,
      input: reorderedInput,
      proposal: generatedPlan,
    })
    const changedRevision = approvalCommand(1)
    const changedProposal = createPlanApprovalCommand(
      'approve-plan-command-0003',
      {
        expectedActivePlanRevision: null,
        input: generatedInput,
        proposal: {
          ...generatedPlan,
          name: 'A different valid proposal',
        },
      },
    )

    expect(materialCommandSignature(reordered)).toBe(
      materialCommandSignature(command),
    )
    expect(materialCommandSignature(changedRevision)).not.toBe(
      materialCommandSignature(command),
    )
    expect(materialCommandSignature(changedProposal)).not.toBe(
      materialCommandSignature(command),
    )
  })

  it('rejects unknown plan-command fields and invalid expected revisions', () => {
    expect(
      parseMaterialCommand({
        ...approvalCommand(),
        command: { ...approvalCommand().command, extra: true },
      }),
    ).toEqual({
      ok: false,
      result: expect.objectContaining({
        status: 'validation_error',
        code: 'invalid-envelope',
      }),
    })

    for (const expectedActivePlanRevision of [-1, 1.5]) {
      expect(
        parseMaterialCommand({
          ...approvalCommand(),
          command: {
            ...approvalCommand().command,
            expectedActivePlanRevision,
          },
        }),
      ).toEqual({
        ok: false,
        result: expect.objectContaining({
          status: 'validation_error',
          code: 'invalid-active-plan-revision',
        }),
      })
    }
  })

  it('rejects malformed, non-generated, and input-mismatched proposals', () => {
    const malformedProposal: GeneratedPlanV1 = {
      ...copy(generatedPlan),
      weeks: [],
    }
    const unsupportedFixture = planGenerationContractFixtures.find(
      (fixture) => fixture.id === 'unsupported-result-shape',
    )
    if (unsupportedFixture?.result.kind !== 'unsupported') {
      throw new Error('Expected the unsupported contract fixture.')
    }
    const invalidResult = {
      schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
      kind: 'invalid_input',
      issues: [
        {
          code: 'required',
          field: 'runner',
          message: 'Runner context is required.',
        },
      ],
    }
    const mismatchedInput: PlanGenerationInputV1 = {
      ...generatedInput,
      rulesetVersion: createPlanGenerationArtifactVersion(
        'other-fixture-rules@1.0.0',
      ),
    }

    for (const change of [
      { proposal: malformedProposal },
      { proposal: unsupportedFixture.result },
      { proposal: invalidResult },
      { input: mismatchedInput },
      { input: { ...generatedInput, extra: true } },
    ]) {
      expect(
        parseMaterialCommand({
          ...approvalCommand(),
          command: { ...approvalCommand().command, ...change },
        }),
      ).toEqual({
        ok: false,
        result: expect.objectContaining({
          status: 'validation_error',
          code: 'invalid-plan-proposal',
        }),
      })
    }
  })

  it('rejects ownership supplied by the request payload', () => {
    const command = {
      ...createProofMaterialCommand(commandId),
      command: {
        ...createProofMaterialCommand(commandId).command,
        payload: { userId: 'another-runner' },
      },
    }

    expect(parseMaterialCommand(command)).toEqual({
      ok: false,
      result: expect.objectContaining({
        status: 'validation_error',
        code: 'ownership-field-prohibited',
      }),
    })
  })

  it('rejects ownership or target selectors nested in plan approval data', () => {
    expect(
      parseMaterialCommand({
        ...approvalCommand(),
        command: {
          ...approvalCommand().command,
          input: {
            ...generatedInput,
            runner: {
              ...generatedInput.runner,
              userId: 'another-runner',
            },
          },
        },
      }),
    ).toEqual({
      ok: false,
      result: expect.objectContaining({
        status: 'validation_error',
        code: 'ownership-field-prohibited',
      }),
    })

    expect(
      parseMaterialCommand({
        ...approvalCommand(),
        command: {
          ...approvalCommand().command,
          proposal: {
            ...generatedPlan,
            path: 'users/another-runner/plans/target',
          },
        },
      }),
    ).toEqual({
      ok: false,
      result: expect.objectContaining({
        status: 'validation_error',
        code: 'target-field-prohibited',
      }),
    })
  })

  it.each(['email', 'path', 'projectId'])(
    'rejects caller-supplied deletion target field %s',
    (field) => {
      expect(
        parseMaterialCommand({
          ...createAccountDeletionRequest('delete-command-target'),
          [field]: 'another-target',
        }),
      ).toEqual({
        ok: false,
        result: expect.objectContaining({
          status: 'validation_error',
          code: 'target-field-prohibited',
        }),
      })
    },
  )

  it.each([
    [
      'envelopeVersion',
      { envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION + 1 },
      'unsupported-envelope-version',
    ],
    [
      'appProtocolVersion',
      { appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION + 1 },
      'unsupported-app-protocol-version',
    ],
    [
      'command schema',
      {
        command: {
          type: 'proof.material-command',
          schemaVersion: MATERIAL_COMMAND_PROOF_SCHEMA_VERSION + 1,
          proofVariant: 'default',
        },
      },
      'unsupported-command-schema-version',
    ],
    [
      'deletion command schema',
      {
        command: {
          type: 'account.request-deletion',
          schemaVersion: ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION + 1,
        },
      },
      'unsupported-command-schema-version',
    ],
    [
      'plan-approval command schema',
      {
        command: {
          ...approvalCommand().command,
          schemaVersion: PLAN_APPROVAL_COMMAND_SCHEMA_VERSION + 1,
        },
      },
      'unsupported-command-schema-version',
    ],
  ])('returns a typed result for an unsupported %s', (_, change, code) => {
    const command = { ...createProofMaterialCommand(commandId), ...change }

    expect(parseMaterialCommand(command)).toEqual({
      ok: false,
      result: expect.objectContaining({
        status: 'unsupported_version',
        code,
      }),
    })
  })

  it('recognizes the typed accepted deletion result', () => {
    expect(
      isMaterialCommandResult({
        status: 'accepted',
        commandId: 'delete-command-0001',
        requestId: '11111111-1111-4111-8111-111111111111',
        requestedAt: '2026-10-05T00:00:00.000Z',
        completionDueAt: '2026-10-12T00:00:00.000Z',
        accessLocked: true,
      }),
    ).toBe(true)
  })

  it('recognizes the exact replayable plan-approval receipt', () => {
    const receipt = {
      status: 'plan_approved',
      commandId: approvalCommandId,
      planId: 'plan-generated-0001',
      activePlanRevision: 1,
      approvedAt: '2026-10-08T00:00:00.000Z',
    }

    expect(isMaterialCommandResult(receipt)).toBe(true)
    expect(isMaterialCommandResult(copy(receipt))).toBe(true)
    expect(isMaterialCommandResult({ ...receipt, activePlanRevision: 0 })).toBe(
      false,
    )
    expect(isMaterialCommandResult({ ...receipt, unexpected: true })).toBe(
      false,
    )
  })

  it('recognizes only complete stale-revision and invalid-proposal results', () => {
    const stale = {
      status: 'stale_revision',
      commandId: approvalCommandId,
      code: 'active-plan-revision-changed',
      message: 'The active plan changed before this proposal was approved.',
      expectedActivePlanRevision: null,
      actualActivePlanRevision: 2,
    }

    expect(isMaterialCommandResult(stale)).toBe(true)
    expect(
      isMaterialCommandResult({
        ...stale,
        actualActivePlanRevision: undefined,
      }),
    ).toBe(false)
    expect(
      isMaterialCommandResult({
        status: 'validation_error',
        commandId: approvalCommandId,
        code: 'invalid-plan-proposal',
        message: 'The generated plan proposal is invalid.',
      }),
    ).toBe(true)
  })

  it('recognizes the fail-closed plan-artifact policy result', () => {
    expect(
      isMaterialCommandResult({
        status: 'authorization_error',
        commandId: approvalCommandId,
        code: 'plan-artifact-not-approved',
        message: 'This generated plan is not approved.',
      }),
    ).toBe(true)
  })

  it('rejects malformed command IDs and unknown command fields', () => {
    expect(
      parseMaterialCommand({
        ...createProofMaterialCommand(commandId),
        commandId: 'short',
      }),
    ).toEqual({
      ok: false,
      result: expect.objectContaining({ status: 'validation_error' }),
    })
    expect(
      parseMaterialCommand({
        ...createProofMaterialCommand(commandId),
        extra: true,
      }),
    ).toEqual({
      ok: false,
      result: expect.objectContaining({ status: 'validation_error' }),
    })
  })
})
