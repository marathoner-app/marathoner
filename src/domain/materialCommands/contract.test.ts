import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION,
  MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
  MATERIAL_COMMAND_ENVELOPE_VERSION,
  MATERIAL_COMMAND_PROOF_SCHEMA_VERSION,
  PLAN_APPROVAL_COMMAND_SCHEMA_VERSION,
  RUN_COMPLETION_COMMAND_SCHEMA_VERSION,
  RUN_DELETION_COMMAND_SCHEMA_VERSION,
  createAccountDeletionRequest,
  createPlanApprovalCommand,
  createProofMaterialCommand,
  createRunCompletionCommand,
  createRunDeletionCommand,
  isMaterialCommandResult,
  isRunCommandStaleRevisionResult,
  isRunCompletionDuplicateResult,
  isRunCompletionReceiptResult,
  isRunDeletionReceiptResult,
  materialCommandSignature,
  parseMaterialCommand,
  type CompletedRunCommandInputV1,
  type PlannedWorkoutCommandReferenceV1,
} from './contract'
import {
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  createCompletedRunId,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createPlanGenerationArtifactVersion,
  createPlannedWorkoutId,
  createShoeId,
  createTrainingPlanId,
  createUtcDateTime,
  planGenerationContractFixtures,
  type GeneratedPlanV1,
  type PlanGenerationInputV1,
} from '../training'

const commandId = 'proof-command-0001'
const approvalCommandId = 'approve-plan-command-0001'
const completionCommandId = 'complete-run-command-0001'
const deletionCommandId = 'delete-run-command-0001'

const plannedWorkout: PlannedWorkoutCommandReferenceV1 = {
  planId: createTrainingPlanId('plan-0001'),
  workoutId: createPlannedWorkoutId('workout-0001'),
  expectedUpdatedAt: createUtcDateTime('2026-10-08T12:00:00Z'),
}

const completedRunInput: CompletedRunCommandInputV1 = {
  plannedWorkout,
  shoeId: createShoeId('shoe-0001'),
  startedAt: createUtcDateTime('2026-10-08T13:15:00Z'),
  timeZone: createIanaTimeZone('America/Los_Angeles'),
  distance: createDistanceMeters(5_000),
  duration: createDurationSeconds(1_650),
  perceivedEffort: 'about_right',
  unusualPain: false,
  notes: 'Easy progression run.',
}

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

  it('creates and parses a completed-run command without caller ownership', () => {
    const command = createRunCompletionCommand(
      completionCommandId,
      completedRunInput,
    )

    expect(parseMaterialCommand(command)).toEqual({
      ok: true,
      envelope: command,
    })
    expect(command.command.input).toEqual(completedRunInput)
    expect(JSON.stringify(command)).not.toContain('userId')
    expect(command.command.input).toMatchObject({
      plannedWorkout,
      shoeId: 'shoe-0001',
      startedAt: '2026-10-08T13:15:00.000Z',
      timeZone: 'America/Los_Angeles',
      distance: 5_000,
      duration: 1_650,
      perceivedEffort: 'about_right',
      unusualPain: false,
      notes: 'Easy progression run.',
    })
  })

  it('creates and parses an unplanned run and a run deletion', () => {
    const unplanned = createRunCompletionCommand(
      'complete-unplanned-run-0001',
      {
        plannedWorkout: null,
        startedAt: completedRunInput.startedAt,
        timeZone: completedRunInput.timeZone,
        distance: completedRunInput.distance,
        duration: completedRunInput.duration,
      },
    )
    const deletion = createRunDeletionCommand(deletionCommandId, {
      completedRunId: createCompletedRunId('run-0001'),
      expectedCompletedRunUpdatedAt: createUtcDateTime(
        '2026-10-08T14:00:00Z',
      ),
      plannedWorkout,
    })

    expect(parseMaterialCommand(unplanned)).toEqual({
      ok: true,
      envelope: unplanned,
    })
    expect(parseMaterialCommand(deletion)).toEqual({
      ok: true,
      envelope: deletion,
    })
    expect(deletion.command).toMatchObject({
      completedRunId: 'run-0001',
      expectedCompletedRunUpdatedAt: '2026-10-08T14:00:00.000Z',
      plannedWorkout,
    })
  })

  it('uses stable, payload-sensitive run-command signatures', () => {
    const completion = createRunCompletionCommand(
      completionCommandId,
      completedRunInput,
    )
    const reorderedInput: CompletedRunCommandInputV1 = {
      notes: completedRunInput.notes,
      duration: completedRunInput.duration,
      distance: completedRunInput.distance,
      timeZone: completedRunInput.timeZone,
      startedAt: completedRunInput.startedAt,
      shoeId: completedRunInput.shoeId,
      plannedWorkout: {
        expectedUpdatedAt: plannedWorkout.expectedUpdatedAt,
        workoutId: plannedWorkout.workoutId,
        planId: plannedWorkout.planId,
      },
      unusualPain: completedRunInput.unusualPain,
      perceivedEffort: completedRunInput.perceivedEffort,
    }
    const reordered = createRunCompletionCommand(
      'complete-run-command-0002',
      reorderedInput,
    )
    const changed = createRunCompletionCommand(
      'complete-run-command-0003',
      { ...completedRunInput, duration: createDurationSeconds(1_651) },
    )
    const deletion = createRunDeletionCommand(deletionCommandId, {
      completedRunId: createCompletedRunId('run-0001'),
      expectedCompletedRunUpdatedAt: createUtcDateTime(
        '2026-10-08T14:00:00Z',
      ),
      plannedWorkout,
    })
    const changedDeletion = createRunDeletionCommand(
      'delete-run-command-0002',
      {
        completedRunId: createCompletedRunId('run-0001'),
        expectedCompletedRunUpdatedAt: createUtcDateTime(
          '2026-10-08T14:00:01Z',
        ),
        plannedWorkout,
      },
    )

    expect(materialCommandSignature(reordered)).toBe(
      materialCommandSignature(completion),
    )
    expect(materialCommandSignature(changed)).not.toBe(
      materialCommandSignature(completion),
    )
    expect(materialCommandSignature(changedDeletion)).not.toBe(
      materialCommandSignature(deletion),
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

  it('rejects incomplete or malformed completed-run input', () => {
    const command = createRunCompletionCommand(
      completionCommandId,
      completedRunInput,
    )

    for (const input of [
      {
        ...completedRunInput,
        plannedWorkout: {
          planId: plannedWorkout.planId,
          expectedUpdatedAt: plannedWorkout.expectedUpdatedAt,
        },
      },
      { ...completedRunInput, distance: 0 },
      { ...completedRunInput, duration: 1.5 },
      { ...completedRunInput, timeZone: 'Not/A_Time_Zone' },
      { ...completedRunInput, perceivedEffort: 'impossible' },
      { ...completedRunInput, notes: '   ' },
      { ...completedRunInput, extra: true },
    ]) {
      expect(
        parseMaterialCommand({
          ...command,
          command: { ...command.command, input },
        }),
      ).toEqual({
        ok: false,
        result: expect.objectContaining({
          status: 'validation_error',
          code: 'invalid-run-completion',
        }),
      })
    }
  })

  it('rejects malformed completed-run deletion fields', () => {
    const command = createRunDeletionCommand(deletionCommandId, {
      completedRunId: createCompletedRunId('run-0001'),
      expectedCompletedRunUpdatedAt: createUtcDateTime(
        '2026-10-08T14:00:00Z',
      ),
      plannedWorkout,
    })

    for (const change of [
      { completedRunId: 'users/another-runner/run-0001' },
      { expectedCompletedRunUpdatedAt: 'yesterday' },
      {
        plannedWorkout: {
          workoutId: plannedWorkout.workoutId,
          expectedUpdatedAt: plannedWorkout.expectedUpdatedAt,
        },
      },
      { extra: true },
    ]) {
      expect(
        parseMaterialCommand({
          ...command,
          command: { ...command.command, ...change },
        }),
      ).toEqual({
        ok: false,
        result: expect.objectContaining({
          status: 'validation_error',
          code: 'invalid-run-deletion',
        }),
      })
    }
  })

  it.each(['userId', 'ownerId', 'uid', 'email', 'projectId', 'path'])(
    'rejects prohibited run-command field %s anywhere in the payload',
    (field) => {
      const command = createRunCompletionCommand(
        completionCommandId,
        completedRunInput,
      )
      const parsed = parseMaterialCommand({
        ...command,
        command: {
          ...command.command,
          input: {
            ...command.command.input,
            plannedWorkout: {
              ...plannedWorkout,
              [field]: 'caller-selected-target',
            },
          },
        },
      })

      expect(parsed).toEqual({
        ok: false,
        result: expect.objectContaining({
          status: 'validation_error',
          code: ['userId', 'ownerId', 'uid'].includes(field)
            ? 'ownership-field-prohibited'
            : 'target-field-prohibited',
        }),
      })
    },
  )

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
    [
      'run-completion command schema',
      {
        command: {
          ...createRunCompletionCommand(
            completionCommandId,
            completedRunInput,
          ).command,
          schemaVersion: RUN_COMPLETION_COMMAND_SCHEMA_VERSION + 1,
        },
      },
      'unsupported-command-schema-version',
    ],
    [
      'run-deletion command schema',
      {
        command: {
          ...createRunDeletionCommand(deletionCommandId, {
            completedRunId: createCompletedRunId('run-0001'),
            expectedCompletedRunUpdatedAt: createUtcDateTime(
              '2026-10-08T14:00:00Z',
            ),
            plannedWorkout,
          }).command,
          schemaVersion: RUN_DELETION_COMMAND_SCHEMA_VERSION + 1,
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

  it('recognizes only exact replayable run completion and deletion receipts', () => {
    const completedPlannedWorkout = {
      planId: 'plan-0001',
      workoutId: 'workout-0001',
      updatedAt: '2026-10-08T14:00:00.000Z',
    }
    const completionReceipt = {
      status: 'run_completed',
      commandId: completionCommandId,
      completedRunId: 'run-0001',
      completedRunUpdatedAt: '2026-10-08T14:00:00.000Z',
      completedPlannedWorkout,
    }
    const deletionReceipt = {
      status: 'run_deleted',
      commandId: deletionCommandId,
      completedRunId: 'run-0001',
      deletedAt: '2026-10-08T15:00:00.000Z',
      reopenedPlannedWorkout: {
        ...completedPlannedWorkout,
        updatedAt: '2026-10-08T15:00:00.000Z',
      },
    }

    expect(isRunCompletionReceiptResult(completionReceipt)).toBe(true)
    expect(isRunDeletionReceiptResult(deletionReceipt)).toBe(true)
    expect(isMaterialCommandResult(completionReceipt)).toBe(true)
    expect(isMaterialCommandResult(deletionReceipt)).toBe(true)
    expect(
      isRunCompletionReceiptResult({ ...completionReceipt, extra: true }),
    ).toBe(false)
    expect(
      isRunDeletionReceiptResult({
        ...deletionReceipt,
        reopenedPlannedWorkout: {
          ...deletionReceipt.reopenedPlannedWorkout,
          updatedAt: 'not-a-time',
        },
      }),
    ).toBe(false)
  })

  it('distinguishes duplicate completion and run-specific stale results', () => {
    const duplicate = {
      status: 'conflict',
      commandId: completionCommandId,
      code: 'planned-workout-already-completed',
      message: 'This workout already has a completed run.',
      planId: 'plan-0001',
      plannedWorkoutId: 'workout-0001',
      completedRunId: 'run-0001',
    }
    const staleRun = {
      status: 'stale_revision',
      commandId: deletionCommandId,
      code: 'completed-run-version-changed',
      message: 'The completed run changed before deletion.',
      completedRunId: 'run-0001',
      expectedUpdatedAt: '2026-10-08T14:00:00.000Z',
      actualUpdatedAt: '2026-10-08T14:01:00.000Z',
    }
    const staleWorkout = {
      status: 'stale_revision',
      commandId: deletionCommandId,
      code: 'planned-workout-version-changed',
      message: 'The planned workout changed before deletion.',
      planId: 'plan-0001',
      plannedWorkoutId: 'workout-0001',
      expectedUpdatedAt: '2026-10-08T14:00:00.000Z',
      actualUpdatedAt: null,
    }

    expect(isRunCompletionDuplicateResult(duplicate)).toBe(true)
    expect(isRunCommandStaleRevisionResult(staleRun)).toBe(true)
    expect(isRunCommandStaleRevisionResult(staleWorkout)).toBe(true)
    expect(isMaterialCommandResult(duplicate)).toBe(true)
    expect(isMaterialCommandResult(staleRun)).toBe(true)
    expect(isMaterialCommandResult(staleWorkout)).toBe(true)
    expect(
      isRunCompletionDuplicateResult({
        ...duplicate,
        completedRunId: 'users/runner/run-0001',
      }),
    ).toBe(false)
    expect(
      isRunCommandStaleRevisionResult({
        ...staleRun,
        expectedUpdatedAt: 'not-a-time',
      }),
    ).toBe(false)
  })

  it.each([
    ['validation_error', 'invalid-run-completion'],
    ['authentication_error', 'authentication-required'],
    ['authorization_error', 'training-resource-access-denied'],
    ['retryable_error', 'temporarily-unavailable'],
    ['outcome_unknown', 'resolve-by-command-id'],
  ])('recognizes the run-command %s state', (status, code) => {
    expect(
      isMaterialCommandResult({
        status,
        commandId: completionCommandId,
        code,
        message: 'Typed run-command failure.',
      }),
    ).toBe(true)
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
