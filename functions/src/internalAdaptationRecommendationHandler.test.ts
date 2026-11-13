import { describe, expect, it, vi } from 'vitest'

import {
  createDateOnly,
  createIanaTimeZone,
  createUtcDateTime,
} from '../../src/domain/training/dates.js'
import {
  createCompletedRunId,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
} from '../../src/domain/training/identifiers.js'
import type {
  ActivePlanState,
  CompletedRun,
  PlannedWorkout,
  TrainingPlan,
} from '../../src/domain/training/types.js'
import {
  createDistanceMeters,
  createDurationSeconds,
} from '../../src/domain/training/units.js'
import {
  INTERNAL_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
  type InternalAdaptationRecommendationCommand,
} from './internalAdaptationRecommendationContract.js'
import {
  evaluateInternalAdaptationRecommendation,
  executeInternalAdaptationRecommendation,
  type InternalAdaptationRecommendationStore,
  type InternalAdaptationSnapshot,
} from './internalAdaptationRecommendationHandler.js'
import { loadPinnedInternalAdaptationArtifacts } from './pinnedInternalAdaptationArtifacts.js'

const ownerId = createUserId('adaptation-owner')
const planId = createTrainingPlanId('adaptation-plan')
const createdAt = createUtcDateTime('2026-08-01T12:00:00.000Z')
const artifacts = loadPinnedInternalAdaptationArtifacts()

function workout(
  id: string,
  date: string,
  status: 'planned' | 'completed',
  distance: number,
): PlannedWorkout {
  return {
    id: createPlannedWorkoutId(id),
    userId: ownerId,
    planId,
    scheduledDate: createDateOnly(date),
    phase: 'marathon_training',
    status,
    kind: 'run',
    purpose: id.endsWith('4') ? 'long' : 'easy',
    targetDistance: createDistanceMeters(distance),
    createdAt,
    updatedAt: createdAt,
  }
}

function run(
  workoutValue: PlannedWorkout,
  effort: CompletedRun['perceivedEffort'],
): CompletedRun {
  if (workoutValue.kind === 'rest') throw new Error('Expected a run workout.')
  return {
    id: createCompletedRunId(`run-${workoutValue.id}`),
    userId: ownerId,
    plannedWorkoutPlanId: planId,
    plannedWorkoutId: workoutValue.id,
    startedAt: createUtcDateTime(`${workoutValue.scheduledDate}T18:00:00.000Z`),
    timeZone: createIanaTimeZone('UTC'),
    distance: createDistanceMeters(5_000),
    duration: createDurationSeconds(1_800),
    perceivedEffort: effort,
    unusualPain: false,
    createdAt,
    updatedAt: createdAt,
  }
}

function snapshot(
  efforts: readonly NonNullable<CompletedRun['perceivedEffort']>[] = [
    'about_right',
    'harder_than_expected',
    'about_right',
    'much_harder_than_expected',
  ],
): InternalAdaptationSnapshot {
  const current = [
    workout('current-1', '2026-10-26', 'completed', 5_000),
    workout('current-2', '2026-10-27', 'completed', 5_000),
    workout('current-3', '2026-10-29', 'completed', 5_000),
    workout('current-4', '2026-10-31', 'completed', 8_000),
  ]
  const next = [
    workout('next-1', '2026-11-02', 'planned', 6_000),
    workout('next-2', '2026-11-03', 'planned', 6_000),
    workout('next-3', '2026-11-05', 'planned', 6_000),
    workout('next-4', '2026-11-07', 'planned', 10_000),
  ]
  const plan: TrainingPlan = {
    id: planId,
    userId: ownerId,
    name: 'Founding beta completion plan',
    startDate: createDateOnly('2026-08-24'),
    targetRaceDate: createDateOnly('2027-01-31'),
    status: 'active',
    createdAt,
    updatedAt: createdAt,
  }
  const activePlanState: ActivePlanState = {
    userId: ownerId,
    activePlanId: planId,
    activePlanRevision: 3,
    approvedAt: createdAt,
    updatedAt: createdAt,
  }
  return {
    activePlanState,
    plan,
    planRulesetVersion: artifacts.basePlan.rules.rulesetVersion,
    workouts: [...current, ...next],
    runs: current.map((item, index) => run(item, efforts[index])),
  }
}

function command(): InternalAdaptationRecommendationCommand {
  return {
    schemaVersion: INTERNAL_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
    commandId: 'internal-adaptation-command-0001',
    triggerWorkoutId: createPlannedWorkoutId('current-4'),
    evaluationDate: createDateOnly('2026-10-31'),
    confirmedRescheduleTargetDate: null,
  }
}

describe('internal adaptation recommendation evaluation', () => {
  it('assembles one coherent pending hold recommendation from synchronized state', () => {
    const outcome = evaluateInternalAdaptationRecommendation(
      command(),
      snapshot(),
      artifacts,
      createUtcDateTime('2026-10-31T20:00:00.000Z'),
    )

    expect(outcome.result).toMatchObject({
      status: 'pending_recommendation_created',
      commandId: command().commandId,
    })
    expect(outcome.evidence).toMatchObject({
      decision: 'pending',
      evaluatedPlanId: planId,
      evaluationResult: {
        kind: 'recommendation',
        action: 'hold_progression',
      },
      planAdjustment: {
        action: 'hold_progression',
        sourceWeekNumber: 10,
        targetWeekNumber: 11,
      },
    })
  })

  it('records no pending evidence when the pinned evaluator recommends no change', () => {
    const outcome = evaluateInternalAdaptationRecommendation(
      command(),
      snapshot([
        'about_right',
        'about_right',
        'about_right',
        'about_right',
      ]),
      artifacts,
      createUtcDateTime('2026-10-31T20:00:00.000Z'),
    )

    expect(outcome.evidence).toBeNull()
    expect(outcome.result).toMatchObject({ status: 'no_change' })
  })

  it('keeps evaluating an active plan created from the prior compatible ruleset', () => {
    const legacyRulesetVersion = artifacts.compatibleBasePlans.find(
      ({ rules }) =>
        String(rules.rulesetVersion) === 'beta-rules@0.2.0-draft',
    )?.rules.rulesetVersion
    if (legacyRulesetVersion === undefined) {
      throw new Error('Expected the prior compatible base-plan artifact.')
    }

    const outcome = evaluateInternalAdaptationRecommendation(
      command(),
      { ...snapshot(), planRulesetVersion: legacyRulesetVersion },
      artifacts,
      createUtcDateTime('2026-10-31T20:00:00.000Z'),
    )

    expect(outcome.result).toMatchObject({
      status: 'pending_recommendation_created',
    })
    expect(outcome.evidence?.evaluationInput).toMatchObject({
      basePlanArtifactVersion: legacyRulesetVersion,
      adaptationArtifactVersion: 'beta-adaptation@0.3.0-draft',
    })
  })

  it('does not turn one harder run into a material plan change', () => {
    const outcome = evaluateInternalAdaptationRecommendation(
      command(),
      snapshot([
        'about_right',
        'about_right',
        'harder_than_expected',
        'about_right',
      ]),
      artifacts,
      createUtcDateTime('2026-10-31T20:00:00.000Z'),
    )

    expect(outcome.evidence).toBeNull()
    expect(outcome.result).toMatchObject({
      status: 'no_change',
      explanationKey: 'adaptation.no_change.single_hard_effort',
    })
  })

  it('suppresses adaptation when a completed run reports unusual pain', () => {
    const state = snapshot()
    const outcome = evaluateInternalAdaptationRecommendation(
      command(),
      {
        ...state,
        runs: state.runs.map((item, index) =>
          index === state.runs.length - 1
            ? { ...item, unusualPain: true }
            : item,
        ),
      },
      artifacts,
      createUtcDateTime('2026-10-31T20:00:00.000Z'),
    )

    expect(outcome.evidence).toBeNull()
    expect(outcome.result).toMatchObject({
      status: 'refused',
      code: 'ADAPT-REFUSE-SAFETY-GATE',
    })
  })

  it('refuses an active plan created from a different ruleset without evidence', () => {
    const outcome = evaluateInternalAdaptationRecommendation(
      command(),
      { ...snapshot(), planRulesetVersion: 'beta-rules@different' },
      artifacts,
      createUtcDateTime('2026-10-31T20:00:00.000Z'),
    )

    expect(outcome.evidence).toBeNull()
    expect(outcome.result).toMatchObject({
      status: 'refused',
      code: 'base-plan-artifact-mismatch',
    })
  })
})

describe('internal adaptation recommendation handler', () => {
  function store(): InternalAdaptationRecommendationStore {
    return {
      execute: vi.fn(async (options) => ({
        kind: 'completed' as const,
        result: options.evaluate(snapshot()).result,
      })),
    }
  }

  const request = command()

  it.each([
    {
      name: 'signed out',
      caller: { ownerId: null, appCheckVerified: true },
      enabled: true,
      status: 'authorization_error',
      code: 'authentication-required',
    },
    {
      name: 'missing App Check',
      caller: { ownerId, appCheckVerified: false },
      enabled: true,
      status: 'authorization_error',
      code: 'app-check-required',
    },
    {
      name: 'disabled',
      caller: { ownerId, appCheckVerified: true },
      enabled: false,
      status: 'disabled',
      code: 'internal-adaptation-disabled',
    },
  ])('refuses $name before loading owner state', async (testCase) => {
    const boundary = store()
    await expect(
      executeInternalAdaptationRecommendation({
        caller: testCase.caller,
        data: request,
        dependencies: {
          enabled: testCase.enabled,
          artifacts,
          store: boundary,
          log: vi.fn(),
        },
      }),
    ).resolves.toMatchObject({
      status: testCase.status,
      code: testCase.code,
    })
    expect(boundary.execute).not.toHaveBeenCalled()
  })

  it('returns a typed membership refusal without exposing owner data', async () => {
    const boundary: InternalAdaptationRecommendationStore = {
      execute: vi.fn(async () => ({ kind: 'membership-required' as const })),
    }
    await expect(
      executeInternalAdaptationRecommendation({
        caller: { ownerId, appCheckVerified: true },
        data: request,
        dependencies: {
          enabled: true,
          artifacts,
          store: boundary,
          log: vi.fn(),
        },
      }),
    ).resolves.toMatchObject({
      status: 'authorization_error',
      code: 'approved-beta-membership-required',
    })
  })

  it('rejects caller-supplied ownership before loading owner state', async () => {
    const boundary = store()
    await expect(
      executeInternalAdaptationRecommendation({
        caller: { ownerId, appCheckVerified: true },
        data: { ...request, ownerId: 'someone-else' },
        dependencies: {
          enabled: true,
          artifacts,
          store: boundary,
          log: vi.fn(),
        },
      }),
    ).resolves.toMatchObject({
      status: 'validation_error',
      code: 'invalid-internal-adaptation-command',
    })
    expect(boundary.execute).not.toHaveBeenCalled()
  })
})
