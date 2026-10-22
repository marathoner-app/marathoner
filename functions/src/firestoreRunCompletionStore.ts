import { randomUUID } from 'node:crypto'

import type { Firestore } from 'firebase-admin/firestore'

import {
  isRunCompletionReceiptResult,
  materialCommandSignature,
  type RunCompletionCommandEnvelope,
} from '../../src/domain/materialCommands/contract.js'
import { createUserId } from '../../src/domain/training/identifiers.js'
import {
  runDocumentPath,
  shoeDocumentPath,
  workoutCompletionGuardDocumentPath,
  workoutDocumentPath,
} from '../../src/persistence/firestore/paths.js'
import { projectRunCompletion } from './completedRunCommandProjection.js'
import {
  adminTimestamp,
  completedRunAdminDocument,
  completionGuardAdminDocument,
  completionGuardFromAdminDocument,
  plannedWorkoutAdminDocument,
  plannedWorkoutFromAdminDocument,
  shoeFromAdminDocument,
} from './firestoreCompletedRunDocuments.js'
import {
  MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
  materialCommandReceiptPath,
} from './firestoreMaterialCommandStore.js'
import type { RunCompletionStore } from './materialCommandHandler.js'
import {
  approvedBetaMembershipPath,
  isApprovedBetaMembership,
} from './approvedBetaMembership.js'

export interface FirestoreRunCompletionStoreOptions {
  createRunId?: () => string
  now?: () => Date
}

function storedRunCompletionResult(data: unknown) {
  if (!isRunCompletionReceiptResult(data)) {
    throw new Error('A stored run-completion receipt is invalid.')
  }
  return data
}

export class FirestoreRunCompletionStore implements RunCompletionStore {
  private readonly createRunId: () => string
  private readonly now: () => Date

  constructor(
    private readonly database: Firestore,
    options: FirestoreRunCompletionStoreOptions = {},
  ) {
    this.createRunId = options.createRunId ?? (() => `run-${randomUUID()}`)
    this.now = options.now ?? (() => new Date())
  }

  async commit(options: {
    envelope: RunCompletionCommandEnvelope
    ownerId: string
  }) {
    const signature = materialCommandSignature(options.envelope)
    const committedAt = this.now().toISOString()
    const serverRunId = this.createRunId()
    const ownerId = createUserId(options.ownerId)
    const receiptReference = this.database.doc(
      materialCommandReceiptPath(options.ownerId, options.envelope.commandId),
    )
    const membershipReference = this.database.doc(
      approvedBetaMembershipPath(options.ownerId),
    )
    const workoutReference = options.envelope.command.input.plannedWorkout
    const shoeId = options.envelope.command.input.shoeId

    return this.database.runTransaction(async (transaction) => {
      const [membershipSnapshot, receiptSnapshot] = await Promise.all([
        transaction.get(membershipReference),
        transaction.get(receiptReference),
      ])
      if (
        !isApprovedBetaMembership(
          membershipSnapshot.data(),
          options.ownerId,
        )
      ) {
        return { kind: 'membership-required' as const }
      }
      if (receiptSnapshot.exists) {
        const receipt = receiptSnapshot.data()
        if (!receipt || receipt.signature !== signature) {
          return { kind: 'conflict' as const }
        }
        return {
          kind: 'completed' as const,
          result: storedRunCompletionResult(receipt.result),
        }
      }

      const workoutDocumentReference =
        workoutReference === null
          ? null
          : this.database.doc(
              workoutDocumentPath(
                ownerId,
                workoutReference.planId,
                workoutReference.workoutId,
              ),
            )
      const guardDocumentReference =
        workoutReference === null
          ? null
          : this.database.doc(
              workoutCompletionGuardDocumentPath(
                ownerId,
                workoutReference.planId,
                workoutReference.workoutId,
              ),
            )
      const shoeDocumentReference =
        shoeId === undefined
          ? null
          : this.database.doc(shoeDocumentPath(ownerId, shoeId))
      const [workoutSnapshot, guardSnapshot, shoeSnapshot] = await Promise.all([
        workoutDocumentReference === null
          ? Promise.resolve(null)
          : transaction.get(workoutDocumentReference),
        guardDocumentReference === null
          ? Promise.resolve(null)
          : transaction.get(guardDocumentReference),
        shoeDocumentReference === null
          ? Promise.resolve(null)
          : transaction.get(shoeDocumentReference),
      ])

      const decision = projectRunCompletion({
        authenticatedOwnerId: options.ownerId,
        serverRunId,
        committedAt,
        envelope: options.envelope,
        loadedPlannedWorkout:
          workoutSnapshot === null
            ? null
            : plannedWorkoutFromAdminDocument(
                workoutSnapshot.id,
                workoutSnapshot.data(),
              ),
        loadedShoe:
          shoeSnapshot === null
            ? null
            : shoeFromAdminDocument(shoeSnapshot.id, shoeSnapshot.data()),
        loadedCompletionGuard:
          guardSnapshot === null
            ? null
            : completionGuardFromAdminDocument(guardSnapshot.data()),
      })
      if (!decision.ok) {
        return { kind: 'rejected' as const, result: decision.result }
      }

      const projection = decision.projection
      transaction.create(
        this.database.doc(
          runDocumentPath(ownerId, projection.completedRun.entity.id),
        ),
        completedRunAdminDocument(projection.completedRun.entity),
      )
      if (
        projection.completedPlannedWorkout !== null &&
        workoutDocumentReference !== null
      ) {
        transaction.set(
          workoutDocumentReference,
          plannedWorkoutAdminDocument(
            projection.completedPlannedWorkout.entity,
          ),
        )
      }
      if (projection.completionGuard !== null) {
        transaction.create(
          this.database.doc(projection.completionGuard.path),
          completionGuardAdminDocument(projection.completionGuard.record),
        )
      }
      transaction.create(receiptReference, {
        schemaVersion: MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
        signature,
        result: projection.receipt,
        createdAt: adminTimestamp(committedAt),
      })

      return { kind: 'completed' as const, result: projection.receipt }
    })
  }
}
