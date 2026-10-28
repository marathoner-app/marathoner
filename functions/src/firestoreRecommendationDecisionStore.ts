import {
  Timestamp,
  type DocumentReference,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore'

import {
  isMaterialCommandResult,
  materialCommandSignature,
  type PlanApprovalStaleRevisionResult,
  type RecommendationDecisionCommandEnvelope,
  type RecommendationDecisionReceiptResult,
} from '../../src/domain/materialCommands/contract.js'
import {
  validateRecommendationEvidence,
  type RecommendationEvidenceV2,
} from '../../src/domain/recommendations/recommendationEvidence.js'
import { createUtcDateTime } from '../../src/domain/training/dates.js'
import {
  ADAPTATION_PLAN_PROJECTION_INPUT_SCHEMA_VERSION,
  projectAdaptationPlan,
  type AdaptationPlanWorkoutV1,
} from '../../src/domain/training/adaptationPlanProjection.js'
import {
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
} from '../../src/domain/training/identifiers.js'
import type {
  PlannedWorkout,
  TrainingPlan,
} from '../../src/domain/training/types.js'
import {
  validatePlannedWorkout,
  validateWorkoutForPlan,
} from '../../src/domain/training/validation.js'
import { TRAINING_SCHEMA_VERSION } from '../../src/persistence/trainingSchema.js'
import {
  adminTimestamp,
  plannedWorkoutAdminDocument,
  plannedWorkoutFromAdminDocument,
  trainingPlanFromAdminDocument,
} from './firestoreCompletedRunDocuments.js'
import {
  MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
  materialCommandReceiptPath,
} from './firestoreMaterialCommandStore.js'
import {
  recommendationEvidenceFromDocument,
  recommendationEvidencePath,
} from './firestoreRecommendationEvidenceStore.js'

const FIRESTORE_TRANSACTION_WRITE_LIMIT = 500
export const PLAN_REVISION_SNAPSHOT_SCHEMA_VERSION = 1

interface StoredActivePlanState {
  activePlanId: string
  activePlanRevision: number
}

export type RecommendationDecisionStoreErrorCode =
  | 'evidence-conflict'
  | 'invalid-active-plan'
  | 'invalid-projection'
  | 'invalid-workout-transition'

export class RecommendationDecisionStoreError extends Error {
  constructor(readonly code: RecommendationDecisionStoreErrorCode) {
    super(`Recommendation decision persistence failed: ${code}.`)
  }
}

export interface FirestoreRecommendationDecisionStoreOptions {
  now?: () => Date
}

function hasExactKeys(data: DocumentData, expected: readonly string[]): boolean {
  const actual = Object.keys(data).sort()
  const sortedExpected = [...expected].sort()
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  )
}

function parseActivePlanState(
  data: DocumentData | undefined,
  ownerId: string,
): StoredActivePlanState {
  if (
    data === undefined ||
    !hasExactKeys(data, [
      'schemaVersion',
      'trainingSchemaVersion',
      'userId',
      'activePlanId',
      'activePlanRevision',
      'approvedAt',
      'updatedAt',
    ]) ||
    data.schemaVersion !== 1 ||
    data.trainingSchemaVersion !== TRAINING_SCHEMA_VERSION ||
    data.userId !== ownerId ||
    typeof data.activePlanId !== 'string' ||
    !Number.isSafeInteger(data.activePlanRevision) ||
    Number(data.activePlanRevision) < 1 ||
    !(data.approvedAt instanceof Timestamp) ||
    !(data.updatedAt instanceof Timestamp)
  ) {
    throw new RecommendationDecisionStoreError('invalid-active-plan')
  }
  return {
    activePlanId: createTrainingPlanId(data.activePlanId),
    activePlanRevision: Number(data.activePlanRevision),
  }
}

function storedDecisionResult(
  data: unknown,
): RecommendationDecisionReceiptResult {
  if (!isMaterialCommandResult(data) || data.status !== 'recommendation_decided') {
    throw new Error('A stored recommendation-decision receipt is invalid.')
  }
  return data
}

function staleResult(
  envelope: RecommendationDecisionCommandEnvelope,
  actualActivePlanRevision: number | null,
): PlanApprovalStaleRevisionResult {
  return {
    status: 'stale_revision',
    commandId: envelope.commandId,
    code: 'active-plan-revision-changed',
    message:
      'The active training plan changed before this recommendation decision was committed.',
    expectedActivePlanRevision:
      envelope.command.expectedEvaluatedPlanRevision,
    actualActivePlanRevision,
  }
}

function calendarDay(value: string): number {
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(milliseconds)) {
    throw new RecommendationDecisionStoreError('invalid-projection')
  }
  return milliseconds / (24 * 60 * 60 * 1_000)
}

function projectionTarget(
  workout: Exclude<PlannedWorkout, { readonly kind: 'rest' }>,
): AdaptationPlanWorkoutV1['target'] {
  const hasDistance = workout.targetDistance !== undefined
  const hasDuration = workout.targetDuration !== undefined
  if (hasDistance === hasDuration) {
    throw new RecommendationDecisionStoreError('invalid-projection')
  }
  return workout.targetDistance !== undefined
    ? { kind: 'distance', distance: workout.targetDistance }
    : { kind: 'duration', duration: workout.targetDuration! }
}

function projectionWorkouts(
  plan: TrainingPlan,
  workouts: readonly PlannedWorkout[],
): readonly AdaptationPlanWorkoutV1[] {
  const planStartDay = calendarDay(plan.startDate)
  return workouts
    .filter(
      (workout): workout is Exclude<PlannedWorkout, { readonly kind: 'rest' }> =>
        workout.kind !== 'rest',
    )
    .map((workout) => {
      if (workout.userId !== plan.userId || workout.planId !== plan.id) {
        throw new RecommendationDecisionStoreError('invalid-active-plan')
      }
      const dayOffset = calendarDay(workout.scheduledDate) - planStartDay
      if (dayOffset < 0) {
        throw new RecommendationDecisionStoreError('invalid-projection')
      }
      const base = {
        id: workout.id,
        weekNumber: Math.floor(dayOffset / 7) + 1,
        scheduledDate: workout.scheduledDate,
        phase: workout.phase,
        target: projectionTarget(workout),
      }
      return workout.kind === 'run'
        ? { ...base, kind: 'run' as const, purpose: workout.purpose }
        : { ...base, kind: 'walk_run' as const }
    })
}

export function projectRecommendationDecisionWorkouts(options: {
  decidedAt: string
  evidence: RecommendationEvidenceV2
  plan: TrainingPlan
  workouts: readonly PlannedWorkout[]
}): {
  resultingPlanRevision: number
  updatedWorkouts: readonly PlannedWorkout[]
} {
  let projection
  try {
    projection = projectAdaptationPlan({
      schemaVersion: ADAPTATION_PLAN_PROJECTION_INPUT_SCHEMA_VERSION,
      planId: options.plan.id,
      activePlanRevision: options.evidence.evaluationInput.activePlanRevision,
      evaluatedPlanRevision:
        options.evidence.evaluationInput.evaluatedPlanRevision,
      targetRaceDate: options.plan.targetRaceDate,
      workouts: projectionWorkouts(options.plan, options.workouts),
      adjustment: options.evidence.planAdjustment,
    })
  } catch {
    throw new RecommendationDecisionStoreError('invalid-projection')
  }

  const byId = new Map(options.workouts.map((workout) => [workout.id, workout]))
  const updatedWorkouts = projection.changes.map(({ after }) => {
    const existing = byId.get(after.id)
    if (existing === undefined || existing.kind === 'rest') {
      throw new RecommendationDecisionStoreError('invalid-projection')
    }
    if (
      existing.kind !== after.kind ||
      (existing.kind === 'run' && after.kind === 'run' && existing.purpose !== after.purpose)
    ) {
      throw new RecommendationDecisionStoreError('invalid-projection')
    }
    if (
      (projection.action === 'reschedule' && existing.status !== 'skipped') ||
      (projection.action !== 'reschedule' && existing.status !== 'planned')
    ) {
      throw new RecommendationDecisionStoreError('invalid-workout-transition')
    }

    const updated: PlannedWorkout = {
      ...existing,
      scheduledDate: after.scheduledDate,
      status: projection.action === 'reschedule' ? 'planned' : existing.status,
      targetDistance:
        after.target.kind === 'distance' ? after.target.distance : undefined,
      targetDuration:
        after.target.kind === 'duration' ? after.target.duration : undefined,
      updatedAt: createUtcDateTime(options.decidedAt),
    }
    if (
      validatePlannedWorkout(updated).length > 0 ||
      validateWorkoutForPlan(updated, options.plan).length > 0
    ) {
      throw new RecommendationDecisionStoreError('invalid-projection')
    }
    return updated
  })

  return {
    resultingPlanRevision: projection.resultingPlanRevision,
    updatedWorkouts,
  }
}

function finalizedEvidence(options: {
  decidedAt: string
  decision: 'accepted' | 'declined'
  evidence: RecommendationEvidenceV2
  resultingPlanRevision: number | null
}): RecommendationEvidenceV2 {
  const evidence: RecommendationEvidenceV2 = {
    ...options.evidence,
    decision: options.decision,
    decidedAt: createUtcDateTime(options.decidedAt),
    resultingPlanRevision: options.resultingPlanRevision,
  }
  if (validateRecommendationEvidence(evidence).length > 0) {
    throw new RecommendationDecisionStoreError('evidence-conflict')
  }
  return evidence
}

export function planRevisionSnapshotPath(
  ownerId: string,
  planId: string,
  revision: number,
): string {
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new RecommendationDecisionStoreError('invalid-projection')
  }
  return `users/${createUserId(ownerId)}/planRevisionSnapshots/${createTrainingPlanId(planId)}--revision-${revision}`
}

export class FirestoreRecommendationDecisionStore {
  private readonly now: () => Date

  constructor(
    private readonly database: Firestore,
    options: FirestoreRecommendationDecisionStoreOptions = {},
  ) {
    this.now = options.now ?? (() => new Date())
  }

  async commit(options: {
    envelope: RecommendationDecisionCommandEnvelope
    ownerId: string
  }): Promise<
    | { kind: 'decided'; result: RecommendationDecisionReceiptResult }
    | { kind: 'stale'; result: PlanApprovalStaleRevisionResult }
    | { kind: 'conflict' }
  > {
    const ownerId = createUserId(options.ownerId)
    const signature = materialCommandSignature(options.envelope)
    const decidedAt = createUtcDateTime(this.now().toISOString())
    const receiptReference = this.database.doc(
      materialCommandReceiptPath(ownerId, options.envelope.commandId),
    )
    const evidenceReference = this.database.doc(
      recommendationEvidencePath(
        ownerId,
        options.envelope.command.recommendationId,
      ),
    )
    const activeStateReference = this.database.doc(
      `users/${ownerId}/planState/active`,
    )

    return this.database.runTransaction(async (transaction) => {
      const [receiptSnapshot, evidenceSnapshot, activeStateSnapshot] =
        await Promise.all([
          transaction.get(receiptReference),
          transaction.get(evidenceReference),
          transaction.get(activeStateReference),
        ])

      if (receiptSnapshot.exists) {
        const receipt = receiptSnapshot.data()
        if (!receipt || receipt.signature !== signature) {
          return { kind: 'conflict' as const }
        }
        return {
          kind: 'decided' as const,
          result: storedDecisionResult(receipt.result),
        }
      }

      const evidence = recommendationEvidenceFromDocument(
        evidenceSnapshot.data(),
      )
      if (
        evidence.decision !== 'pending' ||
        evidence.recommendationId !== options.envelope.command.recommendationId
      ) {
        return { kind: 'conflict' as const }
      }

      if (
        options.envelope.command.expectedEvaluatedPlanRevision !==
        evidence.evaluationInput.evaluatedPlanRevision
      ) {
        return {
          kind: 'stale' as const,
          result: staleResult(options.envelope, null),
        }
      }

      const activeState =
        options.envelope.command.decision === 'accepted'
          ? parseActivePlanState(activeStateSnapshot.data(), ownerId)
          : null
      if (
        activeState !== null &&
        (activeState.activePlanId !== evidence.evaluatedPlanId ||
          activeState.activePlanRevision !==
            options.envelope.command.expectedEvaluatedPlanRevision)
      ) {
        return {
          kind: 'stale' as const,
          result: staleResult(
            options.envelope,
            activeState.activePlanRevision,
          ),
        }
      }

      let resultingPlanRevision: number | null = null
      let acceptedWrites:
        | {
            planReference: DocumentReference
            planSnapshotData: DocumentData
            snapshotPath: string
            updatedWorkouts: readonly PlannedWorkout[]
            workoutSnapshots: readonly {
              id: string
              data: DocumentData
            }[]
          }
        | undefined

      if (options.envelope.command.decision === 'accepted') {
        if (activeState === null) {
          throw new RecommendationDecisionStoreError('invalid-active-plan')
        }
        const planReference = this.database.doc(
          `users/${ownerId}/plans/${activeState.activePlanId}`,
        )
        const [planSnapshot, workoutQuerySnapshot] = await Promise.all([
          transaction.get(planReference),
          transaction.get(planReference.collection('workouts')),
        ])
        const plan = trainingPlanFromAdminDocument(
          planReference.id,
          planSnapshot.data(),
        )
        if (
          plan === null ||
          plan.userId !== ownerId ||
          plan.id !== evidence.evaluatedPlanId ||
          plan.status !== 'active'
        ) {
          throw new RecommendationDecisionStoreError('invalid-active-plan')
        }
        const workouts = workoutQuerySnapshot.docs.map((snapshot) => {
          const workout = plannedWorkoutFromAdminDocument(
            snapshot.id,
            snapshot.data(),
          )
          if (workout === null) {
            throw new RecommendationDecisionStoreError('invalid-active-plan')
          }
          return workout
        })
        const projected = projectRecommendationDecisionWorkouts({
          decidedAt,
          evidence,
          plan,
          workouts,
        })
        resultingPlanRevision = projected.resultingPlanRevision
        const snapshotPath = planRevisionSnapshotPath(
          ownerId,
          activeState.activePlanId,
          activeState.activePlanRevision,
        )
        acceptedWrites = {
          planReference,
          planSnapshotData: planSnapshot.data()!,
          snapshotPath,
          updatedWorkouts: projected.updatedWorkouts,
          workoutSnapshots: workoutQuerySnapshot.docs.map((snapshot) => ({
            id: createPlannedWorkoutId(snapshot.id),
            data: snapshot.data(),
          })),
        }

        const writeCount =
          acceptedWrites.workoutSnapshots.length +
          acceptedWrites.updatedWorkouts.length +
          7
        if (writeCount > FIRESTORE_TRANSACTION_WRITE_LIMIT) {
          throw new RecommendationDecisionStoreError('invalid-projection')
        }
      }

      const finalEvidence = finalizedEvidence({
        decidedAt,
        decision: options.envelope.command.decision,
        evidence,
        resultingPlanRevision,
      })
      const result: RecommendationDecisionReceiptResult = {
        status: 'recommendation_decided',
        commandId: options.envelope.commandId,
        recommendationId: evidence.recommendationId,
        decision: options.envelope.command.decision,
        evaluatedPlanRevision:
          options.envelope.command.expectedEvaluatedPlanRevision,
        resultingPlanRevision,
        decidedAt,
      }

      if (acceptedWrites !== undefined && resultingPlanRevision !== null) {
        if (activeState === null) {
          throw new RecommendationDecisionStoreError('invalid-active-plan')
        }
        const snapshotReference = this.database.doc(acceptedWrites.snapshotPath)
        transaction.create(snapshotReference, {
          schemaVersion: PLAN_REVISION_SNAPSHOT_SCHEMA_VERSION,
          trainingSchemaVersion: TRAINING_SCHEMA_VERSION,
          userId: ownerId,
          planId: activeState.activePlanId,
          activePlanRevision: activeState.activePlanRevision,
          sourceRecommendationId: evidence.recommendationId,
          capturedAt: adminTimestamp(decidedAt),
        })
        transaction.create(
          snapshotReference.collection('records').doc('plan'),
          acceptedWrites.planSnapshotData,
        )
        for (const workout of acceptedWrites.workoutSnapshots) {
          transaction.create(
            snapshotReference.collection('workouts').doc(workout.id),
            workout.data,
          )
        }
        transaction.update(acceptedWrites.planReference, {
          updatedAt: adminTimestamp(decidedAt),
        })
        for (const workout of acceptedWrites.updatedWorkouts) {
          transaction.set(
            acceptedWrites.planReference
              .collection('workouts')
              .doc(workout.id),
            plannedWorkoutAdminDocument(workout),
          )
        }
        transaction.update(activeStateReference, {
          activePlanRevision: resultingPlanRevision,
          updatedAt: adminTimestamp(decidedAt),
        })
      }

      transaction.set(evidenceReference, finalEvidence)
      transaction.create(receiptReference, {
        schemaVersion: MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
        signature,
        result,
        createdAt: decidedAt,
      })

      return { kind: 'decided' as const, result }
    })
  }
}
