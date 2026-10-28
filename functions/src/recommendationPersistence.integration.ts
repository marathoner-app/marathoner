import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
  ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
  createAdaptationArtifactVersion,
  createAdaptationExplanationKey,
  createAdaptationReasonCode,
  type AdaptationEvaluationInputV1,
  type DecidedAdaptationEvaluationResultV1,
} from '../../src/domain/training/adaptationEvaluation.js'
import { createUtcDateTime } from '../../src/domain/training/dates.js'
import { createTrainingPlanId } from '../../src/domain/training/identifiers.js'
import {
  OPERATOR_ACTIVATION_CONTROL_SCHEMA_VERSION,
  RECOMMENDATION_EVIDENCE_SCHEMA_VERSION,
  createRecommendationId,
  type OperatorActivationControlV1,
  type RecommendationEvidenceV2,
} from '../../src/domain/recommendations/recommendationEvidence.js'
import {
  FirestoreOperatorActivationControlStore,
  OPERATOR_ACTIVATION_CONTROL_PATH,
} from './firestoreOperatorActivationControlStore.js'
import {
  FirestoreRecommendationEvidenceStore,
  recommendationEvidencePath,
} from './firestoreRecommendationEvidenceStore.js'

const projectId = 'demo-marathoner'
const ownerId = 'recommendation-owner'
const recommendationId = createRecommendationId('recommendation-0001')
const adminApp = initializeApp({ projectId }, 'recommendation-persistence')
const database = getFirestore(adminApp)
const evidenceStore = new FirestoreRecommendationEvidenceStore(database)
const controlStore = new FirestoreOperatorActivationControlStore(database)

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

function evaluationInput(): AdaptationEvaluationInputV1 {
  return {
    schemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
    basePlanArtifactVersion: 'fixture-plan-family@0.1.0-draft',
    adaptationArtifactVersion: 'fixture-adaptation-policy@0.1.0-draft',
    activePlanStatus: 'active',
    activePlanRevision: 3,
    evaluatedPlanRevision: 3,
    safetyGateState: 'none_reported',
    inputCompletenessConfirmed: true,
    triggerKind: 'planned_run_completed',
    currentCoreWeek: 4,
    currentWeekKind: 'load',
    nextWeekKind: 'load',
    nextWeekIntroducesProgression: true,
    daysUntilRace: 100,
    currentWeek: {
      plannedRunCount: 4,
      completedRunCount: 4,
      skippedRunCount: 0,
      pendingRunCount: 0,
    },
    daysSinceLastCompletedPlannedRun: 1,
    recentEfforts: [
      'harder_than_expected',
      'harder_than_expected',
      'about_right',
    ],
    rescheduleCandidate: {
      present: false,
      workoutPurpose: null,
      delayCalendarDays: null,
      samePlanWeek: false,
      runnerConfirmedAvailable: false,
      targetDateEmpty: false,
      consecutiveRunDatesAfterMove: 0,
    },
  }
}

function evaluationResult(): DecidedAdaptationEvaluationResultV1 & {
  readonly kind: 'recommendation'
  readonly action: 'hold_progression'
  readonly runnerApprovalRequired: true
} {
  return {
    schemaVersion: ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
    kind: 'recommendation',
    action: 'hold_progression',
    reasonCode: createAdaptationReasonCode(
      'ADAPT-HOLD-REPEATED-HARD-EFFORT',
    ),
    explanationKey: createAdaptationExplanationKey(
      'adaptation.hold.repeated_hard_effort',
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
  }
}

function pendingEvidence(): RecommendationEvidenceV2 {
  return {
    schemaVersion: RECOMMENDATION_EVIDENCE_SCHEMA_VERSION,
    recommendationId,
    evaluatedPlanId: createTrainingPlanId('plan-0001'),
    evaluationInput: evaluationInput(),
    evaluationResult: evaluationResult(),
    planAdjustment: {
      action: 'hold_progression',
      sourceWeekNumber: 4,
      targetWeekNumber: 5,
    },
    decision: 'pending',
    recommendedAt: createUtcDateTime('2026-10-26T18:00:00.000Z'),
    decidedAt: null,
    resultingPlanRevision: null,
  }
}

function acceptedEvidence(): RecommendationEvidenceV2 {
  return {
    ...pendingEvidence(),
    decision: 'accepted',
    decidedAt: createUtcDateTime('2026-10-26T18:05:00.000Z'),
    resultingPlanRevision: 4,
  }
}

function declinedEvidence(): RecommendationEvidenceV2 {
  return {
    ...pendingEvidence(),
    decision: 'declined',
    decidedAt: createUtcDateTime('2026-10-26T18:05:00.000Z'),
  }
}

function activationControl(
  revision: number,
  updatedAt = '2026-10-26T18:00:00.000Z',
): OperatorActivationControlV1 {
  return {
    schemaVersion: OPERATOR_ACTIVATION_CONTROL_SCHEMA_VERSION,
    revision,
    updatedAt: createUtcDateTime(updatedAt),
    minimumAppProtocolVersion: 3,
    minimumCommandProtocolVersion: 2,
    capabilities: {
      generation: {
        enabled: false,
        approvedArtifactVersions: [],
      },
      guidance: {
        enabled: false,
        approvedArtifactVersions: [],
      },
      adaptation: {
        enabled: false,
        approvedArtifactVersions: [],
      },
    },
  }
}

beforeEach(clearFirestoreEmulator)

afterAll(async () => {
  await deleteApp(adminApp)
})

describe('Firestore recommendation evidence store', () => {
  it('creates pending evidence once and replays the exact record safely', async () => {
    const evidence = pendingEvidence()

    await expect(
      evidenceStore.createPending({ ownerId, evidence }),
    ).resolves.toEqual(evidence)
    await expect(
      evidenceStore.createPending({ ownerId, evidence }),
    ).resolves.toEqual(evidence)
    await expect(
      evidenceStore.read({ ownerId, recommendationId }),
    ).resolves.toEqual(evidence)
  })

  it('rejects invalid initial evidence and conflicting replacement attempts', async () => {
    const invalid = {
      ...pendingEvidence(),
      decidedAt: createUtcDateTime('2026-10-26T18:05:00.000Z'),
    }
    await expect(
      evidenceStore.createPending({
        ownerId,
        evidence: invalid as RecommendationEvidenceV2,
      }),
    ).rejects.toMatchObject({ code: 'invalid-evidence' })

    const evidence = pendingEvidence()
    await evidenceStore.createPending({ ownerId, evidence })
    await expect(
      evidenceStore.createPending({
        ownerId,
        evidence: {
          ...evidence,
          recommendedAt: createUtcDateTime('2026-10-26T18:01:00.000Z'),
        },
      }),
    ).rejects.toMatchObject({ code: 'evidence-conflict' })
  })

  it('records one final decision without permitting evidence rewrites', async () => {
    const pending = pendingEvidence()
    const accepted = acceptedEvidence()
    await evidenceStore.createPending({ ownerId, evidence: pending })

    await expect(
      evidenceStore.recordDecision({ ownerId, evidence: accepted }),
    ).resolves.toEqual(accepted)
    await expect(
      evidenceStore.recordDecision({ ownerId, evidence: accepted }),
    ).resolves.toEqual(accepted)
    await expect(
      evidenceStore.recordDecision({ ownerId, evidence: declinedEvidence() }),
    ).rejects.toMatchObject({ code: 'evidence-conflict' })
    await expect(
      evidenceStore.recordDecision({
        ownerId,
        evidence: {
          ...accepted,
          evaluatedPlanId: createTrainingPlanId('plan-0002'),
        },
      }),
    ).rejects.toMatchObject({ code: 'evidence-conflict' })
    await expect(
      evidenceStore.recordDecision({
        ownerId,
        evidence: {
          ...accepted,
          planAdjustment: {
            action: 'hold_progression',
            sourceWeekNumber: 5,
            targetWeekNumber: 6,
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'evidence-conflict' })
  })

  it('fails closed for missing or malformed stored evidence', async () => {
    await expect(
      evidenceStore.read({ ownerId, recommendationId }),
    ).rejects.toMatchObject({ code: 'evidence-not-found' })
    await database
      .doc(recommendationEvidencePath(ownerId, recommendationId))
      .set({ schemaVersion: 'unexpected' })
    await expect(
      evidenceStore.read({ ownerId, recommendationId }),
    ).rejects.toMatchObject({ code: 'stored-evidence-invalid' })
  })
})

describe('Firestore operator activation-control store', () => {
  it('creates revision one and advances one strictly newer revision', async () => {
    const first = activationControl(1)
    const second = activationControl(2, '2026-10-26T18:05:00.000Z')

    await expect(controlStore.read()).rejects.toMatchObject({
      code: 'control-not-found',
    })
    await expect(
      controlStore.replace({ control: first, expectedRevision: null }),
    ).resolves.toEqual(first)
    await expect(
      controlStore.replace({ control: first, expectedRevision: null }),
    ).resolves.toEqual(first)
    await expect(
      controlStore.replace({ control: second, expectedRevision: 1 }),
    ).resolves.toEqual(second)
    await expect(controlStore.read()).resolves.toEqual(second)
  })

  it('rejects stale, skipped, and non-monotonic control replacements', async () => {
    const first = activationControl(1)
    await controlStore.replace({ control: first, expectedRevision: null })

    await expect(
      controlStore.replace({
        control: activationControl(2, '2026-10-26T18:05:00.000Z'),
        expectedRevision: 0,
      }),
    ).rejects.toMatchObject({ code: 'control-conflict' })
    await expect(
      controlStore.replace({
        control: activationControl(3, '2026-10-26T18:05:00.000Z'),
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: 'invalid-revision-transition' })
    await expect(
      controlStore.replace({
        control: activationControl(2, '2026-10-26T18:00:00.000Z'),
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: 'invalid-update-time' })
  })

  it('rejects invalid input and malformed stored controls', async () => {
    await expect(
      controlStore.replace({
        control: {
          ...activationControl(1),
          revision: 0,
        } as OperatorActivationControlV1,
        expectedRevision: null,
      }),
    ).rejects.toMatchObject({ code: 'invalid-control' })

    await database
      .doc(OPERATOR_ACTIVATION_CONTROL_PATH)
      .set({ schemaVersion: 'unexpected' })
    await expect(controlStore.read()).rejects.toMatchObject({
      code: 'stored-control-invalid',
    })
    await expect(
      controlStore.replace({
        control: activationControl(2, '2026-10-26T18:05:00.000Z'),
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: 'stored-control-invalid' })
  })
})
