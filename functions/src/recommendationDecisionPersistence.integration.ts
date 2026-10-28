import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createRecommendationDecisionCommand } from '../../src/domain/materialCommands/contract.js'
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
  type AdaptationAction,
} from '../../src/domain/training/adaptationEvaluation.js'
import { createUtcDateTime } from '../../src/domain/training/dates.js'
import {
  createPlannedWorkoutId,
  createTrainingPlanId,
} from '../../src/domain/training/identifiers.js'
import type { AdaptationPlanAdjustmentV1 } from '../../src/domain/training/adaptationPlanProjection.js'
import { materialCommandReceiptPath } from './firestoreMaterialCommandStore.js'
import {
  FirestoreRecommendationDecisionStore,
  planRevisionSnapshotPath,
} from './firestoreRecommendationDecisionStore.js'
import {
  FirestoreRecommendationEvidenceStore,
} from './firestoreRecommendationEvidenceStore.js'

const projectId = 'demo-marathoner'
const ownerId = 'recommendation-decision-owner'
const planId = createTrainingPlanId('recommendation-plan-0001')
const recommendationId = createRecommendationId(
  'recommendation-decision-0001',
)
const decidedAt = new Date('2026-10-27T18:05:00.000Z')
const adminApp = initializeApp({ projectId }, 'recommendation-decision-persistence')
const database = getFirestore(adminApp)
const evidenceStore = new FirestoreRecommendationEvidenceStore(database)
const decisionStore = new FirestoreRecommendationDecisionStore(database, {
  now: () => decidedAt,
})

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

async function clearFirestoreEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is required.')
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
  if (!response.ok) {
    throw new Error(`Could not clear Firestore emulator: ${response.status}`)
  }
}

function adjustmentFor(
  action: Exclude<AdaptationAction, 'no_change'>,
): AdaptationPlanAdjustmentV1 {
  return action === 'reschedule'
    ? {
        action,
        workoutId: createPlannedWorkoutId('week-4-easy'),
        weekNumber: 4,
        weekStartDate: '2026-10-26',
        weekEndDate: '2026-11-01',
        targetDate: '2026-10-27',
      }
    : {
        action,
        sourceWeekNumber: 4,
        targetWeekNumber: 5,
      }
}

function pendingEvidence(
  action: Exclude<AdaptationAction, 'no_change'> = 'hold_progression',
): RecommendationEvidenceV2 {
  return {
    schemaVersion: RECOMMENDATION_EVIDENCE_SCHEMA_VERSION,
    recommendationId,
    evaluatedPlanId: planId,
    evaluationInput: {
      schemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
      basePlanArtifactVersion: 'fixture-plan-family@0.1.0-draft',
      adaptationArtifactVersion: 'fixture-adaptation-policy@0.1.0-draft',
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
      recentEfforts: [
        'harder_than_expected',
        'harder_than_expected',
        'about_right',
      ],
      rescheduleCandidate:
        action === 'reschedule'
          ? {
              present: true,
              workoutPurpose: 'easy',
              delayCalendarDays: 1,
              samePlanWeek: true,
              runnerConfirmedAvailable: true,
              targetDateEmpty: true,
              consecutiveRunDatesAfterMove: 0,
            }
          : {
              present: false,
              workoutPurpose: null,
              delayCalendarDays: null,
              samePlanWeek: false,
              runnerConfirmedAvailable: false,
              targetDateEmpty: false,
              consecutiveRunDatesAfterMove: 0,
            },
    },
    evaluationResult: {
      schemaVersion: ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
      kind: 'recommendation',
      action,
      reasonCode: createAdaptationReasonCode(
        action === 'reschedule'
          ? 'ADAPT-RESCHEDULE-EASY-RUN'
          : action === 'repeat_period'
            ? 'ADAPT-REPEAT-PERIOD'
            : 'ADAPT-HOLD-REPEATED-HARD-EFFORT',
      ),
      explanationKey: createAdaptationExplanationKey(
        `adaptation.${action}.fixture`,
      ),
      runnerApprovalRequired: true,
      provenance: {
        inputSchemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
        evaluatorVersion: createAdaptationArtifactVersion(
          'fixture-adaptation-evaluator@0.1.0-draft',
        ),
        basePlanArtifactVersion: createAdaptationArtifactVersion(
          'fixture-plan-family@0.1.0-draft',
        ),
        adaptationArtifactVersion: createAdaptationArtifactVersion(
          'fixture-adaptation-policy@0.1.0-draft',
        ),
      },
    },
    planAdjustment: adjustmentFor(action),
    decision: 'pending',
    recommendedAt: createUtcDateTime('2026-10-27T18:00:00.000Z'),
    decidedAt: null,
    resultingPlanRevision: null,
  }
}

async function seedActivePlan(options: {
  activePlanRevision?: number
  reschedule?: boolean
} = {}) {
  const planReference = database.doc(`users/${ownerId}/plans/${planId}`)
  await planReference.set({
    schemaVersion: 1,
    userId: ownerId,
    name: 'Recommendation transaction fixture',
    startDate: '2026-10-05',
    targetRaceDate: '2027-02-14',
    completionGoal: 'complete_first_marathon',
    status: 'active',
    createdAt: Timestamp.fromDate(new Date('2026-10-01T18:00:00.000Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-10-01T18:00:00.000Z')),
  })
  await Promise.all(
    workoutFixtures.map(([id, scheduledDate, purpose, targetDistanceMeters]) =>
      planReference.collection('workouts').doc(id).set({
        schemaVersion: 1,
        userId: ownerId,
        planId,
        scheduledDate,
        phase: 'base_building',
        status:
          options.reschedule === true && id === 'week-4-easy'
            ? 'skipped'
            : 'planned',
        kind: 'run',
        purpose,
        targetDistanceMeters,
        createdAt: Timestamp.fromDate(
          new Date('2026-10-01T18:00:00.000Z'),
        ),
        updatedAt: Timestamp.fromDate(
          new Date('2026-10-01T18:00:00.000Z'),
        ),
      }),
    ),
  )
  await database.doc(`users/${ownerId}/planState/active`).set({
    schemaVersion: 1,
    trainingSchemaVersion: 1,
    userId: ownerId,
    activePlanId: planId,
    activePlanRevision: options.activePlanRevision ?? 3,
    approvedAt: Timestamp.fromDate(new Date('2026-10-01T18:00:00.000Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-10-01T18:00:00.000Z')),
  })
}

beforeEach(clearFirestoreEmulator)

afterAll(async () => {
  await deleteApp(adminApp)
})

describe('Firestore recommendation decision transaction', () => {
  it('declines evidence and writes its receipt without changing the plan', async () => {
    const evidence = pendingEvidence()
    await evidenceStore.createPending({ ownerId, evidence })
    const command = createRecommendationDecisionCommand(
      'decline-recommendation-0001',
      {
        recommendationId,
        decision: 'declined',
        expectedEvaluatedPlanRevision: 3,
      },
    )

    const first = await decisionStore.commit({ ownerId, envelope: command })
    const replay = await decisionStore.commit({ ownerId, envelope: command })

    expect(first).toEqual(replay)
    expect(first).toEqual({
      kind: 'decided',
      result: {
        status: 'recommendation_decided',
        commandId: command.commandId,
        recommendationId,
        decision: 'declined',
        evaluatedPlanRevision: 3,
        resultingPlanRevision: null,
        decidedAt: decidedAt.toISOString(),
      },
    })
    await expect(evidenceStore.read({ ownerId, recommendationId })).resolves.toEqual({
      ...evidence,
      decision: 'declined',
      decidedAt: decidedAt.toISOString(),
    })
    expect(
      (await database.doc(`users/${ownerId}/planState/active`).get()).exists,
    ).toBe(false)
    expect(
      (
        await database
          .collection(`users/${ownerId}/planRevisionSnapshots`)
          .get()
      ).empty,
    ).toBe(true)
  })

  it.each(['repeat_period', 'hold_progression', 'reschedule'] as const)(
    'atomically accepts a %s adjustment and preserves the evaluated revision',
    async (action) => {
      const evidence = pendingEvidence(action)
      await seedActivePlan({ reschedule: action === 'reschedule' })
      await evidenceStore.createPending({ ownerId, evidence })
      const command = createRecommendationDecisionCommand(
        `accept-${action}-recommendation-0001`,
        {
          recommendationId,
          decision: 'accepted',
          expectedEvaluatedPlanRevision: 3,
        },
      )

      const first = await decisionStore.commit({ ownerId, envelope: command })
      const replay = await decisionStore.commit({ ownerId, envelope: command })

      expect(first).toEqual(replay)
      expect(first).toEqual({
        kind: 'decided',
        result: {
          status: 'recommendation_decided',
          commandId: command.commandId,
          recommendationId,
          decision: 'accepted',
          evaluatedPlanRevision: 3,
          resultingPlanRevision: 4,
          decidedAt: decidedAt.toISOString(),
        },
      })
      const activeState = (
        await database.doc(`users/${ownerId}/planState/active`).get()
      ).data()
      expect(activeState?.activePlanId).toBe(planId)
      expect(activeState?.activePlanRevision).toBe(4)
      await expect(evidenceStore.read({ ownerId, recommendationId })).resolves.toEqual({
        ...evidence,
        decision: 'accepted',
        decidedAt: decidedAt.toISOString(),
        resultingPlanRevision: 4,
      })

      const snapshotPath = planRevisionSnapshotPath(ownerId, planId, 3)
      const snapshot = (await database.doc(snapshotPath).get()).data()
      expect(snapshot).toEqual(
        expect.objectContaining({
          activePlanRevision: 3,
          planId,
          sourceRecommendationId: recommendationId,
        }),
      )
      expect(
        (
          await database
            .doc(`${snapshotPath}/workouts/week-5-easy`)
            .get()
        ).data()?.targetDistanceMeters,
      ).toBe(5_500)

      const changedWorkoutId =
        action === 'reschedule' ? 'week-4-easy' : 'week-5-easy'
      const changed = (
        await database
          .doc(`users/${ownerId}/plans/${planId}/workouts/${changedWorkoutId}`)
          .get()
      ).data()
      if (action === 'reschedule') {
        expect(changed).toEqual(
          expect.objectContaining({
            scheduledDate: '2026-10-27',
            status: 'planned',
          }),
        )
      } else {
        expect(changed?.targetDistanceMeters).toBe(5_000)
      }
      expect(
        (
          await database
            .doc(materialCommandReceiptPath(ownerId, command.commandId))
            .get()
        ).exists,
      ).toBe(true)
    },
  )

  it('returns a stale result without writing any decision state', async () => {
    const evidence = pendingEvidence()
    await seedActivePlan({ activePlanRevision: 4 })
    await evidenceStore.createPending({ ownerId, evidence })
    const command = createRecommendationDecisionCommand(
      'stale-recommendation-0001',
      {
        recommendationId,
        decision: 'accepted',
        expectedEvaluatedPlanRevision: 3,
      },
    )

    await expect(decisionStore.commit({ ownerId, envelope: command })).resolves.toEqual({
      kind: 'stale',
      result: expect.objectContaining({
        status: 'stale_revision',
        expectedActivePlanRevision: 3,
        actualActivePlanRevision: 4,
      }),
    })
    await expect(evidenceStore.read({ ownerId, recommendationId })).resolves.toEqual(evidence)
    expect(
      (
        await database
          .doc(materialCommandReceiptPath(ownerId, command.commandId))
          .get()
      ).exists,
    ).toBe(false)
    expect(
      (
        await database
          .collection(`users/${ownerId}/planRevisionSnapshots`)
          .get()
      ).empty,
    ).toBe(true)
  })

  it('rejects conflicting command reuse without changing the first outcome', async () => {
    const evidence = pendingEvidence()
    await seedActivePlan()
    await evidenceStore.createPending({ ownerId, evidence })
    const commandId = 'conflicting-recommendation-0001'
    const declined = createRecommendationDecisionCommand(commandId, {
      recommendationId,
      decision: 'declined',
      expectedEvaluatedPlanRevision: 3,
    })
    const accepted = createRecommendationDecisionCommand(commandId, {
      recommendationId,
      decision: 'accepted',
      expectedEvaluatedPlanRevision: 3,
    })

    await expect(
      decisionStore.commit({ ownerId, envelope: declined }),
    ).resolves.toEqual(expect.objectContaining({ kind: 'decided' }))
    await expect(
      decisionStore.commit({ ownerId, envelope: accepted }),
    ).resolves.toEqual({ kind: 'conflict' })
    expect(
      (await evidenceStore.read({ ownerId, recommendationId })).decision,
    ).toBe('declined')
    expect(
      (await database.doc(`users/${ownerId}/planState/active`).get()).data()
        ?.activePlanRevision,
    ).toBe(3)
  })
})
