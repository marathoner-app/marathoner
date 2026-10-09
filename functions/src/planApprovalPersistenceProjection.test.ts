import { describe, expect, it } from 'vitest'

import {
  createPlanApprovalCommand,
  type PlanApprovalCommandEnvelope,
} from '../../src/domain/materialCommands/contract.js'
import {
  createDateOnly,
  createPlannedWorkoutId,
  createUtcDateTime,
  planGenerationContractFixtures,
  type GeneratedPlanV1,
  type PlanGenerationInputV1,
} from '../../src/domain/training/index.js'
import { createDocumentTrainingRepositories } from '../../src/persistence/documentTrainingRepositories.js'
import {
  plannedWorkoutToDocument,
  trainingPlanToDocument,
} from '../../src/persistence/firestore/converters.js'
import { InMemoryDocumentStore } from '../../src/persistence/testing/InMemoryDocumentStore.js'
import type { PlanApprovalArtifactPolicyRecord } from './planApprovalArtifactPolicy.js'
import {
  ACTIVE_PLAN_STATE_SCHEMA_VERSION,
  PLAN_GENERATION_PROVENANCE_SCHEMA_VERSION,
  PlanApprovalProjectionError,
  projectApprovedPlan,
  type PlanApprovalPersistenceProjectionOptions,
} from './planApprovalPersistenceProjection.js'

const ownerId = 'runner-one'
const planId = 'server-plan-0001'
const approvedAt = '2026-10-08T20:00:00.000Z'
const supportedScopeId = 'synthetic-consistent-runner@1'

const distanceFixture = planGenerationContractFixtures.find(
  (fixture) => fixture.id === 'generated-exact-date-distance-target',
)
const durationFixture = planGenerationContractFixtures.find(
  (fixture) => fixture.id === 'generated-target-window-duration-target',
)
if (
  distanceFixture?.result.kind !== 'generated' ||
  durationFixture?.result.kind !== 'generated'
) {
  throw new Error('Expected both generated plan contract fixtures.')
}

const recoveryReason = durationFixture.result.plan.reasonCodes[0]
if (recoveryReason === undefined) {
  throw new Error('Expected the generated fixture to contain a reason code.')
}
const recoveryPlan: GeneratedPlanV1 = {
  ...durationFixture.result.plan,
  targetRaceDate: createDateOnly('2030-02-14'),
  phases: [
    durationFixture.result.plan.phases[0]!,
    {
      ...durationFixture.result.plan.phases[1]!,
      phase: 'recovery',
    },
  ],
  weeks: [
    durationFixture.result.plan.weeks[0]!,
    {
      ...durationFixture.result.plan.weeks[1]!,
      phase: 'recovery',
      workouts: [
        ...durationFixture.result.plan.weeks[1]!.workouts,
        {
          id: createPlannedWorkoutId('fixture-window-recovery-rest'),
          kind: 'rest',
          scheduledDate: createDateOnly('2030-02-15'),
          reasonCodes: [recoveryReason],
        },
      ],
    },
  ],
}

function approvalCommand(
  commandId: string,
  proposal: GeneratedPlanV1 = distanceFixture.result.plan,
  input: PlanGenerationInputV1 = distanceFixture.input,
): PlanApprovalCommandEnvelope {
  return createPlanApprovalCommand(commandId, {
    expectedActivePlanRevision: null,
    input,
    proposal,
  })
}

function policyRecord(
  envelope: PlanApprovalCommandEnvelope,
): PlanApprovalArtifactPolicyRecord {
  return {
    supportedScopeId,
    inputSchemaVersion: envelope.command.input.schemaVersion,
    generatorVersion: envelope.command.proposal.provenance.generatorVersion,
    rulesetVersion: envelope.command.input.rulesetVersion,
    generatedPlanSchemaVersion: envelope.command.proposal.schemaVersion,
    resultSchemaVersion: 'plan-generation-result@1',
    reviewState: 'approved',
  }
}

function options(
  envelope = approvalCommand('approve-plan-projection-0001'),
): PlanApprovalPersistenceProjectionOptions {
  return {
    authenticatedOwnerId: ownerId,
    serverPlanId: planId,
    activePlanRevision: 1,
    approvedAt,
    envelope,
    artifactPolicyRecord: policyRecord(envelope),
  }
}

describe('plan-approval persistence projection', () => {
  it('projects one active plan and exact planned workouts beneath the authenticated owner', () => {
    const command = approvalCommand('approve-plan-projection-0001')
    const before = JSON.parse(JSON.stringify(command))

    const projected = projectApprovedPlan(options(command))

    expect(command).toEqual(before)
    expect(projected.plan).toEqual({
      path: `users/${ownerId}/plans/${planId}`,
      entity: {
        id: planId,
        userId: ownerId,
        name: command.command.proposal.name,
        startDate: command.command.proposal.startDate,
        targetRaceDate: command.command.proposal.targetRaceDate,
        endDate: command.command.proposal.endDate,
        completionGoal: 'complete_first_marathon',
        status: 'active',
        createdAt: approvedAt,
        updatedAt: approvedAt,
      },
    })
    expect(projected.workouts).toEqual([
      {
        path: `users/${ownerId}/plans/${planId}/workouts/fixture-week-1-easy`,
        entity: expect.objectContaining({
          id: 'fixture-week-1-easy',
          userId: ownerId,
          planId,
          kind: 'run',
          purpose: 'easy',
          targetDistance: 5_000,
          status: 'planned',
        }),
      },
      {
        path: `users/${ownerId}/plans/${planId}/workouts/fixture-week-1-rest`,
        entity: expect.objectContaining({
          id: 'fixture-week-1-rest',
          userId: ownerId,
          planId,
          kind: 'rest',
          status: 'planned',
        }),
      },
    ])
    expect(JSON.stringify(projected)).not.toContain('runner-two')
  })

  it('preserves duration targets, walk-run values, recovery dates, and every audit reason code', () => {
    const command = approvalCommand(
      'approve-plan-projection-0002',
      recoveryPlan,
      durationFixture.input,
    )

    const projected = projectApprovedPlan(options(command))

    expect(projected.plan.entity).toMatchObject({
      targetRaceDate: '2030-02-14',
      endDate: '2030-02-17',
    })
    expect(projected.workouts.map(({ entity }) => entity)).toEqual([
      expect.objectContaining({
        kind: 'run',
        phase: 'base_building',
        targetDuration: 1_800,
      }),
      expect.objectContaining({
        kind: 'walk_run',
        phase: 'recovery',
        targetDuration: 2_100,
      }),
      expect.objectContaining({
        kind: 'rest',
        phase: 'recovery',
        scheduledDate: '2030-02-15',
      }),
    ])
    expect(projected.provenance).toEqual({
      path: `users/${ownerId}/plans/${planId}/metadata/generation`,
      record: expect.objectContaining({
        schemaVersion: PLAN_GENERATION_PROVENANCE_SCHEMA_VERSION,
        trainingSchemaVersion: 1,
        userId: ownerId,
        planId,
        commandId: command.commandId,
        envelopeVersion: 1,
        appProtocolVersion: 1,
        commandSchemaVersion: 1,
        inputSchemaVersion: 'plan-generation-input@1',
        generatorVersion: 'fixture-generator@1.0.0',
        rulesetVersion: 'fixture-rules@1.0.0',
        generatedPlanSchemaVersion: 'generated-plan@1',
        resultSchemaVersion: 'plan-generation-result@1',
        supportedScopeId,
        artifactReviewState: 'approved',
        expectedActivePlanRevision: null,
        planReasonCodes: [...command.command.proposal.reasonCodes],
        phases: command.command.proposal.phases.map((phase) => ({
          phase: phase.phase,
          startWeek: phase.startWeek,
          endWeek: phase.endWeek,
          reasonCodes: [...phase.reasonCodes],
        })),
        weeks: command.command.proposal.weeks.map((week) => ({
          weekNumber: week.weekNumber,
          startDate: week.startDate,
          endDate: week.endDate,
          phase: week.phase,
          reasonCodes: [...week.reasonCodes],
        })),
        workouts: command.command.proposal.weeks.flatMap((week) =>
          week.workouts.map((workout) => ({
            workoutId: workout.id,
            reasonCodes: [...workout.reasonCodes],
          })),
        ),
        approvedAt,
      }),
    })
    expect(projected.activePlanState).toEqual({
      path: `users/${ownerId}/planState/active`,
      record: {
        schemaVersion: ACTIVE_PLAN_STATE_SCHEMA_VERSION,
        trainingSchemaVersion: 1,
        userId: ownerId,
        activePlanId: planId,
        activePlanRevision: 1,
        approvedAt,
        updatedAt: approvedAt,
      },
    })
  })

  it('round-trips the projected plan and workouts through the existing typed repositories', async () => {
    const command = approvalCommand(
      'approve-plan-projection-0003',
      recoveryPlan,
      durationFixture.input,
    )
    const projected = projectApprovedPlan(options(command))
    const store = new InMemoryDocumentStore()
    store.overwrite(
      projected.plan.path,
      trainingPlanToDocument(projected.plan.entity),
    )
    for (const workout of projected.workouts) {
      store.overwrite(workout.path, plannedWorkoutToDocument(workout.entity))
    }
    const repositories = createDocumentTrainingRepositories(
      store,
      projected.plan.entity.userId,
      () => createUtcDateTime(approvedAt),
    )

    await expect(
      repositories.plans.get(projected.plan.entity.id),
    ).resolves.toEqual(projected.plan.entity)
    await expect(
      repositories.workouts.listForPlan(projected.plan.entity.id),
    ).resolves.toEqual(projected.workouts.map(({ entity }) => entity))
  })

  it.each([
    ['owner', { authenticatedOwnerId: '../runner-two' }],
    ['plan ID', { serverPlanId: 'foreign/plan' }],
    ['revision', { activePlanRevision: 0 }],
    ['timestamp', { approvedAt: 'not-a-timestamp' }],
    [
      'artifact policy',
      {
        artifactPolicyRecord: {
          ...options().artifactPolicyRecord,
          reviewState: 'retired',
        },
      },
    ],
    [
      'proposal',
      {
        envelope: {
          ...options().envelope,
          command: {
            ...(options().envelope as PlanApprovalCommandEnvelope).command,
            proposal: {
              ...(options().envelope as PlanApprovalCommandEnvelope).command
                .proposal,
              weeks: [],
            },
          },
        },
      },
    ],
  ])('rejects an invalid %s before any persistence dependency exists', (_, change) => {
    expect(() => projectApprovedPlan({ ...options(), ...change })).toThrow(
      PlanApprovalProjectionError,
    )
  })
})
