import { randomUUID } from 'node:crypto'

import {
  Timestamp,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore'

import {
  isMaterialCommandResult,
  materialCommandSignature,
  type PlanApprovalCommandEnvelope,
  type PlanApprovalReceiptResult,
  type PlanApprovalStaleRevisionResult,
} from '../../src/domain/materialCommands/contract.js'
import { isIdentifierValue } from '../../src/domain/training/identifiers.js'
import type {
  PlannedWorkout,
  TrainingPlan,
} from '../../src/domain/training/types.js'
import { TRAINING_SCHEMA_VERSION } from '../../src/persistence/trainingSchema.js'
import {
  MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
  materialCommandReceiptPath,
} from './firestoreMaterialCommandStore.js'
import type { PlanApprovalArtifactPolicyRecord } from './planApprovalArtifactPolicy.js'
import {
  projectApprovedPlan,
  type ActivePlanStateRecordV1,
  type PlanGenerationProvenanceRecordV1,
} from './planApprovalPersistenceProjection.js'
import type { PlanApprovalStore } from './materialCommandHandler.js'

const FIRESTORE_TRANSACTION_WRITE_LIMIT = 500

interface StoredActivePlanState {
  activePlanId: string
  activePlanRevision: number
}

export interface FirestorePlanApprovalStoreOptions {
  createPlanId?: () => string
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
): StoredActivePlanState | null {
  if (data === undefined) return null
  if (
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
    !isIdentifierValue(data.activePlanId) ||
    !Number.isSafeInteger(data.activePlanRevision) ||
    data.activePlanRevision < 1 ||
    !(data.approvedAt instanceof Timestamp) ||
    !(data.updatedAt instanceof Timestamp)
  ) {
    throw new Error('The stored active-plan state is invalid.')
  }
  return {
    activePlanId: data.activePlanId,
    activePlanRevision: data.activePlanRevision,
  }
}

function assertRetirablePlan(data: DocumentData | undefined, ownerId: string) {
  if (
    data === undefined ||
    data.schemaVersion !== TRAINING_SCHEMA_VERSION ||
    data.userId !== ownerId ||
    data.status !== 'active'
  ) {
    throw new Error('The prior active plan cannot be retired safely.')
  }
}

function timestamp(value: string): Timestamp {
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) {
    throw new Error('A projected timestamp is invalid.')
  }
  return Timestamp.fromMillis(milliseconds)
}

function trainingPlanDocument(plan: TrainingPlan): DocumentData {
  return {
    schemaVersion: TRAINING_SCHEMA_VERSION,
    userId: plan.userId,
    name: plan.name,
    startDate: plan.startDate,
    targetRaceDate: plan.targetRaceDate,
    ...(plan.endDate === undefined ? {} : { endDate: plan.endDate }),
    ...(plan.completionGoal === undefined
      ? {}
      : { completionGoal: plan.completionGoal }),
    status: plan.status,
    createdAt: timestamp(plan.createdAt),
    updatedAt: timestamp(plan.updatedAt),
  }
}

function plannedWorkoutDocument(workout: PlannedWorkout): DocumentData {
  return {
    schemaVersion: TRAINING_SCHEMA_VERSION,
    userId: workout.userId,
    planId: workout.planId,
    scheduledDate: workout.scheduledDate,
    phase: workout.phase,
    status: workout.status,
    kind: workout.kind,
    ...(workout.notes === undefined ? {} : { notes: workout.notes }),
    ...(workout.kind === 'run' ? { purpose: workout.purpose } : {}),
    ...(workout.kind === 'rest' || workout.targetDistance === undefined
      ? {}
      : { targetDistanceMeters: workout.targetDistance }),
    ...(workout.kind === 'rest' || workout.targetDuration === undefined
      ? {}
      : { targetDurationSeconds: workout.targetDuration }),
    createdAt: timestamp(workout.createdAt),
    updatedAt: timestamp(workout.updatedAt),
  }
}

function activePlanStateDocument(record: ActivePlanStateRecordV1): DocumentData {
  return {
    ...record,
    approvedAt: timestamp(record.approvedAt),
    updatedAt: timestamp(record.updatedAt),
  }
}

function provenanceDocument(
  record: PlanGenerationProvenanceRecordV1,
): DocumentData {
  return {
    ...record,
    approvedAt: timestamp(record.approvedAt),
  }
}

function storedPlanApprovalResult(data: unknown): PlanApprovalReceiptResult {
  if (!isMaterialCommandResult(data) || data.status !== 'plan_approved') {
    throw new Error('A stored plan-approval receipt is invalid.')
  }
  return data
}

function staleResult(
  envelope: PlanApprovalCommandEnvelope,
  actualActivePlanRevision: number | null,
): PlanApprovalStaleRevisionResult {
  return {
    status: 'stale_revision',
    commandId: envelope.commandId,
    code: 'active-plan-revision-changed',
    message: 'The active training plan changed before this approval was committed.',
    expectedActivePlanRevision:
      envelope.command.expectedActivePlanRevision,
    actualActivePlanRevision,
  }
}

export class FirestorePlanApprovalStore implements PlanApprovalStore {
  private readonly createPlanId: () => string
  private readonly now: () => Date

  constructor(
    private readonly database: Firestore,
    options: FirestorePlanApprovalStoreOptions = {},
  ) {
    this.createPlanId =
      options.createPlanId ?? (() => `plan-${randomUUID()}`)
    this.now = options.now ?? (() => new Date())
  }

  async commit(options: {
    artifactPolicyRecord: PlanApprovalArtifactPolicyRecord
    envelope: PlanApprovalCommandEnvelope
    ownerId: string
  }) {
    const signature = materialCommandSignature(options.envelope)
    const approvedAt = this.now().toISOString()
    let serverPlanId: string | null = null
    const receiptReference = this.database.doc(
      materialCommandReceiptPath(options.ownerId, options.envelope.commandId),
    )
    const activeStateReference = this.database.doc(
      `users/${options.ownerId}/planState/active`,
    )

    return this.database.runTransaction(async (transaction) => {
      const [receiptSnapshot, activeStateSnapshot] = await Promise.all([
        transaction.get(receiptReference),
        transaction.get(activeStateReference),
      ])

      if (receiptSnapshot.exists) {
        const receipt = receiptSnapshot.data()
        if (!receipt || receipt.signature !== signature) {
          return { kind: 'conflict' as const }
        }
        return {
          kind: 'approved' as const,
          result: storedPlanApprovalResult(receipt.result),
        }
      }

      const activeState = parseActivePlanState(
        activeStateSnapshot.data(),
        options.ownerId,
      )
      const actualActivePlanRevision =
        activeState?.activePlanRevision ?? null
      if (
        options.envelope.command.expectedActivePlanRevision !==
        actualActivePlanRevision
      ) {
        return {
          kind: 'stale' as const,
          result: staleResult(options.envelope, actualActivePlanRevision),
        }
      }

      let priorPlanReference = null
      if (activeState !== null) {
        priorPlanReference = this.database.doc(
          `users/${options.ownerId}/plans/${activeState.activePlanId}`,
        )
        const priorPlanSnapshot = await transaction.get(priorPlanReference)
        assertRetirablePlan(priorPlanSnapshot.data(), options.ownerId)
      }

      const nextRevision = (actualActivePlanRevision ?? 0) + 1
      if (!Number.isSafeInteger(nextRevision)) {
        throw new Error('The next active-plan revision is invalid.')
      }
      serverPlanId ??= this.createPlanId()
      const projection = projectApprovedPlan({
        authenticatedOwnerId: options.ownerId,
        serverPlanId,
        activePlanRevision: nextRevision,
        approvedAt,
        envelope: options.envelope,
        artifactPolicyRecord: options.artifactPolicyRecord,
      })
      const writeCount =
        projection.workouts.length + 4 + (priorPlanReference === null ? 0 : 1)
      if (writeCount > FIRESTORE_TRANSACTION_WRITE_LIMIT) {
        throw new Error('The projected plan exceeds the transaction write limit.')
      }

      const result: PlanApprovalReceiptResult = {
        status: 'plan_approved',
        commandId: options.envelope.commandId,
        planId: projection.plan.entity.id,
        activePlanRevision: nextRevision,
        approvedAt,
      }

      if (priorPlanReference !== null) {
        transaction.update(priorPlanReference, {
          status: 'archived',
          updatedAt: timestamp(approvedAt),
        })
      }
      transaction.create(
        this.database.doc(projection.plan.path),
        trainingPlanDocument(projection.plan.entity),
      )
      for (const workout of projection.workouts) {
        transaction.create(
          this.database.doc(workout.path),
          plannedWorkoutDocument(workout.entity),
        )
      }
      transaction.create(
        this.database.doc(projection.provenance.path),
        provenanceDocument(projection.provenance.record),
      )
      transaction.set(
        this.database.doc(projection.activePlanState.path),
        activePlanStateDocument(projection.activePlanState.record),
      )
      transaction.create(receiptReference, {
        schemaVersion: MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
        signature,
        result,
        createdAt: approvedAt,
      })

      return { kind: 'approved' as const, result }
    })
  }
}
