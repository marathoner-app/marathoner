import { describe, expect, it } from 'vitest'

import {
  RECOMMENDATION_EVIDENCE_SCHEMA_VERSION,
  createRecommendationId,
  type RecommendationEvidenceV2,
} from '../../src/domain/recommendations/recommendationEvidence.js'
import {
  ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
  ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
  createAdaptationArtifactVersion,
  createAdaptationExplanationKey,
  createAdaptationReasonCode,
} from '../../src/domain/training/adaptationEvaluation.js'
import {
  createDateOnly,
  createUtcDateTime,
} from '../../src/domain/training/dates.js'
import {
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
} from '../../src/domain/training/identifiers.js'
import type {
  PlannedWorkout,
  TrainingPlan,
} from '../../src/domain/training/types.js'
import { createDistanceMeters } from '../../src/domain/training/units.js'
import {
  projectRecommendationDecisionWorkouts,
  RecommendationDecisionStoreError,
} from './firestoreRecommendationDecisionStore.js'

const ownerId = createUserId('recommendation-owner')
const planId = createTrainingPlanId('recommendation-plan')
const createdAt = createUtcDateTime('2026-10-01T18:00:00.000Z')
const decidedAt = createUtcDateTime('2026-10-27T18:05:00.000Z')

const plan: TrainingPlan = {
  id: planId,
  userId: ownerId,
  name: 'Recommendation plan',
  startDate: createDateOnly('2026-10-05'),
  targetRaceDate: createDateOnly('2027-02-14'),
  status: 'active',
  createdAt,
  updatedAt: createdAt,
}

const workoutFixtures = [
  ['week-4-easy', '2026-10-26', 'easy', 5_000],
  ['week-4-tempo', '2026-10-28', 'tempo', 6_000],
  ['week-4-long', '2026-10-30', 'long', 7_000],
  ['week-4-recovery', '2026-11-01', 'recovery', 8_000],
  ['week-5-easy', '2026-11-02', 'easy', 5_500],
  ['week-5-tempo', '2026-11-04', 'tempo', 6_500],
  ['week-5-long', '2026-11-06', 'long', 7_500],
  ['week-5-recovery', '2026-11-08', 'recovery', 8_500],
] as const

function workouts(
  changes: Partial<PlannedWorkout> = {},
): readonly PlannedWorkout[] {
  return workoutFixtures.map(
    ([id, scheduledDate, purpose, targetDistance]): PlannedWorkout => ({
      id: createPlannedWorkoutId(id),
      userId: ownerId,
      planId,
      scheduledDate: createDateOnly(scheduledDate),
      phase: 'base_building',
      status: 'planned',
      kind: 'run',
      purpose,
      targetDistance: createDistanceMeters(targetDistance),
      createdAt,
      updatedAt: createdAt,
      ...changes,
    }),
  )
}

function evidence(
  action: 'hold_progression' | 'reschedule',
): RecommendationEvidenceV2 {
  return {
    schemaVersion: RECOMMENDATION_EVIDENCE_SCHEMA_VERSION,
    recommendationId: createRecommendationId('recommendation-0001'),
    evaluatedPlanId: planId,
    evaluationInput: {
      schemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
      basePlanArtifactVersion: 'fixture-plan@0.1.0-draft',
      adaptationArtifactVersion: 'fixture-adaptation@0.1.0-draft',
      activePlanStatus: 'active',
      activePlanRevision: 3,
      evaluatedPlanRevision: 3,
      safetyGateState: 'none_reported',
      inputCompletenessConfirmed: true,
      triggerKind:
        action === 'reschedule'
          ? 'planned_run_skipped'
          : 'planned_run_completed',
      currentCoreWeek: 4,
      currentWeekKind: 'load',
      nextWeekKind: 'load',
      nextWeekIntroducesProgression: true,
      daysUntilRace: 100,
      currentWeek: {
        plannedRunCount: 4,
        completedRunCount: action === 'reschedule' ? 3 : 4,
        skippedRunCount: action === 'reschedule' ? 1 : 0,
        pendingRunCount: 0,
      },
      daysSinceLastCompletedPlannedRun: 1,
      recentEfforts: ['harder_than_expected', 'harder_than_expected'],
      rescheduleCandidate: {
        present: action === 'reschedule',
        workoutPurpose: action === 'reschedule' ? 'easy' : null,
        delayCalendarDays: action === 'reschedule' ? 1 : null,
        samePlanWeek: action === 'reschedule',
        runnerConfirmedAvailable: action === 'reschedule',
        targetDateEmpty: action === 'reschedule',
        consecutiveRunDatesAfterMove: 0,
      },
    },
    evaluationResult: {
      schemaVersion: ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
      kind: 'recommendation',
      action,
      reasonCode: createAdaptationReasonCode('ADAPT-TEST-RECOMMENDATION'),
      explanationKey: createAdaptationExplanationKey(
        `adaptation.${action}.test`,
      ),
      runnerApprovalRequired: true,
      provenance: {
        inputSchemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
        evaluatorVersion: createAdaptationArtifactVersion(
          'fixture-evaluator@0.1.0-draft',
        ),
        basePlanArtifactVersion: createAdaptationArtifactVersion(
          'fixture-plan@0.1.0-draft',
        ),
        adaptationArtifactVersion: createAdaptationArtifactVersion(
          'fixture-adaptation@0.1.0-draft',
        ),
      },
    },
    planAdjustment:
      action === 'reschedule'
        ? {
            action,
            workoutId: createPlannedWorkoutId('week-4-easy'),
            weekNumber: 4,
            weekStartDate: createDateOnly('2026-10-26'),
            weekEndDate: createDateOnly('2026-11-01'),
            targetDate: createDateOnly('2026-10-27'),
          }
        : {
            action,
            sourceWeekNumber: 4,
            targetWeekNumber: 5,
          },
    decision: 'pending',
    recommendedAt: createUtcDateTime('2026-10-27T18:00:00.000Z'),
    decidedAt: null,
    resultingPlanRevision: null,
  }
}

describe('recommendation decision workout projection', () => {
  it('projects a hold without mutating the evaluated snapshot', () => {
    const source = workouts()

    const result = projectRecommendationDecisionWorkouts({
      decidedAt,
      evidence: evidence('hold_progression'),
      plan,
      workouts: source,
    })

    expect(result.resultingPlanRevision).toBe(4)
    expect(result.updatedWorkouts).toHaveLength(4)
    expect(result.updatedWorkouts[0]).toEqual(
      expect.objectContaining({
        id: 'week-5-easy',
        targetDistance: 5_000,
        updatedAt: decidedAt,
      }),
    )
    expect(source[4]).toEqual(
      expect.objectContaining({ targetDistance: 5_500, updatedAt: createdAt }),
    )
  })

  it('turns an accepted skipped reschedule back into a planned workout', () => {
    const source = workouts().map((workout) =>
      workout.id === 'week-4-easy'
        ? { ...workout, status: 'skipped' as const }
        : workout,
    )

    const result = projectRecommendationDecisionWorkouts({
      decidedAt,
      evidence: evidence('reschedule'),
      plan,
      workouts: source,
    })

    expect(result.updatedWorkouts).toEqual([
      expect.objectContaining({
        id: 'week-4-easy',
        scheduledDate: '2026-10-27',
        status: 'planned',
      }),
    ])
  })

  it('refuses to rewrite a non-planned future prescription', () => {
    const source = workouts().map((workout) =>
      workout.id === 'week-5-easy'
        ? { ...workout, status: 'completed' as const }
        : workout,
    )

    expect(() =>
      projectRecommendationDecisionWorkouts({
        decidedAt,
        evidence: evidence('hold_progression'),
        plan,
        workouts: source,
      }),
    ).toThrow(
      expect.objectContaining<Partial<RecommendationDecisionStoreError>>({
        code: 'invalid-workout-transition',
      }),
    )
  })
})
