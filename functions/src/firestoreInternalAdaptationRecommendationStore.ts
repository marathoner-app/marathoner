import { isDeepStrictEqual } from 'node:util'

import {
  Timestamp,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore'

import { createUtcDateTime } from '../../src/domain/training/dates.js'
import {
  createTrainingPlanId,
  createUserId,
} from '../../src/domain/training/identifiers.js'
import type { ActivePlanState } from '../../src/domain/training/types.js'
import { TRAINING_SCHEMA_VERSION } from '../../src/persistence/trainingSchema.js'
import { isApprovedBetaMembership } from './approvedBetaMembership.js'
import {
  completedRunFromAdminDocument,
  plannedWorkoutFromAdminDocument,
  trainingPlanFromAdminDocument,
} from './firestoreCompletedRunDocuments.js'
import {
  recommendationEvidenceFromDocument,
  recommendationEvidencePath,
} from './firestoreRecommendationEvidenceStore.js'
import type {
  InternalAdaptationEvaluationOutcome,
  InternalAdaptationRecommendationStore,
  InternalAdaptationSnapshot,
} from './internalAdaptationRecommendationHandler.js'
import {
  isInternalAdaptationRecommendationResult,
  type InternalAdaptationRecommendationResult,
} from './internalAdaptationRecommendationContract.js'

const RECEIPT_SCHEMA_VERSION = 1

interface StoredReceipt {
  readonly schemaVersion: typeof RECEIPT_SCHEMA_VERSION
  readonly signature: string
  readonly result: InternalAdaptationRecommendationResult
  readonly createdAt: Timestamp
}

function receiptPath(ownerId: string, commandId: string) {
  return `users/${createUserId(ownerId)}/adaptationCommandReceipts/${commandId}`
}

function commandSignature(value: unknown): string {
  return JSON.stringify(value)
}

function storedReceipt(data: DocumentData | undefined): StoredReceipt {
  if (
    !data ||
    data.schemaVersion !== RECEIPT_SCHEMA_VERSION ||
    typeof data.signature !== 'string' ||
    !(data.createdAt instanceof Timestamp) ||
    !isInternalAdaptationRecommendationResult(data.result)
  ) {
    throw new Error('The stored internal adaptation receipt is invalid.')
  }
  return data as StoredReceipt
}

function activePlanState(
  data: DocumentData | undefined,
  ownerId: string,
): ActivePlanState {
  if (
    !data ||
    data.schemaVersion !== 1 ||
    data.trainingSchemaVersion !== TRAINING_SCHEMA_VERSION ||
    data.userId !== ownerId ||
    typeof data.activePlanId !== 'string' ||
    !Number.isSafeInteger(data.activePlanRevision) ||
    Number(data.activePlanRevision) < 1 ||
    !(data.approvedAt instanceof Timestamp) ||
    !(data.updatedAt instanceof Timestamp)
  ) {
    throw new Error('The active plan state is invalid.')
  }
  return {
    userId: createUserId(ownerId),
    activePlanId: createTrainingPlanId(data.activePlanId),
    activePlanRevision: Number(data.activePlanRevision),
    approvedAt: createUtcDateTime(data.approvedAt.toDate().toISOString()),
    updatedAt: createUtcDateTime(data.updatedAt.toDate().toISOString()),
  }
}

function planRulesetVersion(
  data: DocumentData | undefined,
  ownerId: string,
  planId: string,
): string {
  if (
    !data ||
    data.userId !== ownerId ||
    data.planId !== planId ||
    typeof data.rulesetVersion !== 'string'
  ) {
    throw new Error('The active plan generation provenance is invalid.')
  }
  return data.rulesetVersion
}

export class FirestoreInternalAdaptationRecommendationStore
  implements InternalAdaptationRecommendationStore
{
  constructor(
    private readonly database: Firestore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(options: Parameters<InternalAdaptationRecommendationStore['execute']>[0]) {
    const ownerId = createUserId(options.ownerId)
    const signature = commandSignature(options.command)
    const receiptReference = this.database.doc(
      receiptPath(ownerId, options.command.commandId),
    )
    const membershipReference = this.database.doc(`betaMemberships/${ownerId}`)
    const activeStateReference = this.database.doc(
      `users/${ownerId}/planState/active`,
    )

    return this.database.runTransaction(async (transaction) => {
      const [receiptSnapshot, membershipSnapshot, activeStateSnapshot] =
        await Promise.all([
          transaction.get(receiptReference),
          transaction.get(membershipReference),
          transaction.get(activeStateReference),
        ])
      if (receiptSnapshot.exists) {
        const receipt = storedReceipt(receiptSnapshot.data())
        return receipt.signature === signature
          ? { kind: 'completed' as const, result: receipt.result }
          : { kind: 'conflict' as const }
      }
      if (!isApprovedBetaMembership(membershipSnapshot.data(), ownerId)) {
        return { kind: 'membership-required' as const }
      }

      const activeState = activePlanState(activeStateSnapshot.data(), ownerId)
      const planReference = this.database.doc(
        `users/${ownerId}/plans/${activeState.activePlanId}`,
      )
      const provenanceReference = planReference.collection('metadata').doc('generation')
      const runsQuery = this.database.collection(`users/${ownerId}/runs`)
      const [planSnapshot, provenanceSnapshot, workoutSnapshots, runSnapshots] =
        await Promise.all([
          transaction.get(planReference),
          transaction.get(provenanceReference),
          transaction.get(planReference.collection('workouts')),
          transaction.get(runsQuery),
        ])
      const plan = trainingPlanFromAdminDocument(
        planReference.id,
        planSnapshot.data(),
      )
      if (
        plan === null ||
        plan.userId !== ownerId ||
        plan.id !== activeState.activePlanId ||
        plan.status !== 'active'
      ) {
        throw new Error('The active plan document is invalid.')
      }
      const workouts = workoutSnapshots.docs.map((snapshot) => {
        const workout = plannedWorkoutFromAdminDocument(
          snapshot.id,
          snapshot.data(),
        )
        if (workout === null) throw new Error('A workout document is invalid.')
        return workout
      })
      const runs = runSnapshots.docs.map((snapshot) => {
        const run = completedRunFromAdminDocument(snapshot.id, snapshot.data())
        if (run === null) throw new Error('A completed-run document is invalid.')
        return run
      })
      const snapshot: InternalAdaptationSnapshot = {
        activePlanState: activeState,
        plan,
        planRulesetVersion: planRulesetVersion(
          provenanceSnapshot.data(),
          ownerId,
          activeState.activePlanId,
        ),
        workouts,
        runs,
      }
      const outcome: InternalAdaptationEvaluationOutcome =
        options.evaluate(snapshot)
      let result = outcome.result

      if (outcome.evidence !== null) {
        if (
          outcome.evidence.decision !== 'pending' ||
          outcome.evidence.evaluatedPlanId !== activeState.activePlanId ||
          outcome.evidence.evaluationInput.activePlanRevision !==
            activeState.activePlanRevision ||
          outcome.evidence.evaluationInput.evaluatedPlanRevision !==
            activeState.activePlanRevision
        ) {
          throw new Error(
            'The pending recommendation no longer matches the active plan revision.',
          )
        }
        const recommendationCollection = this.database.collection(
          `users/${ownerId}/recommendationEvidence`,
        )
        const recommendationSnapshots = await transaction.get(
          recommendationCollection,
        )
        const sameRevision = recommendationSnapshots.docs
          .map((snapshot) =>
            recommendationEvidenceFromDocument(snapshot.data()),
          )
          .filter(
            (existing) =>
              existing.evaluatedPlanId === outcome.evidence?.evaluatedPlanId &&
              existing.evaluationInput.evaluatedPlanRevision ===
                outcome.evidence?.evaluationInput.evaluatedPlanRevision,
          )
        if (sameRevision.length > 1) {
          return { kind: 'conflict' as const }
        }
        const existing = sameRevision[0]
        if (existing !== undefined) {
          const sameRecommendation =
            isDeepStrictEqual(
              existing.evaluationInput,
              outcome.evidence.evaluationInput,
            ) &&
            isDeepStrictEqual(
              existing.evaluationResult,
              outcome.evidence.evaluationResult,
            ) &&
            isDeepStrictEqual(
              existing.planAdjustment,
              outcome.evidence.planAdjustment,
            )
          if (!sameRecommendation || existing.decision !== 'pending') {
            return { kind: 'conflict' as const }
          }
          result = {
            status: 'pending_recommendation_created',
            commandId: options.command.commandId,
            recommendationId: existing.recommendationId,
          }
        } else {
          const evidenceReference = this.database.doc(
            recommendationEvidencePath(
              ownerId,
              outcome.evidence.recommendationId,
            ),
          )
          transaction.create(evidenceReference, outcome.evidence)
        }
      }

      transaction.create(receiptReference, {
        schemaVersion: RECEIPT_SCHEMA_VERSION,
        signature,
        result,
        createdAt: Timestamp.fromDate(this.now()),
      } satisfies StoredReceipt)
      return { kind: 'completed' as const, result }
    })
  }
}
