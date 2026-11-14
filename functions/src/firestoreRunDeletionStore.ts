import type { Firestore } from 'firebase-admin/firestore'

import {
  isRunDeletionReceiptResult,
  materialCommandSignature,
  type RunDeletionCommandEnvelope,
} from '../../src/domain/materialCommands/contract.js'
import { createUserId } from '../../src/domain/training/identifiers.js'
import {
  activityImportsCollectionPath,
  runDocumentPath,
  workoutCompletionGuardDocumentPath,
  workoutDocumentPath,
} from '../../src/persistence/firestore/paths.js'
import { projectRunDeletion } from './completedRunCommandProjection.js'
import { userDeletedActivityImportDocument } from './firestoreActivityImportStore.js'
import {
  adminTimestamp,
  completedRunFromAdminDocument,
  completionGuardFromAdminDocument,
  plannedWorkoutAdminDocument,
  plannedWorkoutFromAdminDocument,
} from './firestoreCompletedRunDocuments.js'
import {
  MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
  materialCommandReceiptPath,
} from './firestoreMaterialCommandStore.js'
import type { RunDeletionStore } from './materialCommandHandler.js'
import {
  approvedBetaMembershipPath,
  isApprovedBetaMembership,
} from './approvedBetaMembership.js'

export interface FirestoreRunDeletionStoreOptions {
  now?: () => Date
  // Test-only seam for proving that staged writes roll back together.
  onBeforeCommit?: () => void
}

function storedRunDeletionResult(data: unknown) {
  if (!isRunDeletionReceiptResult(data)) {
    throw new Error('A stored run-deletion receipt is invalid.')
  }
  return data
}

export class FirestoreRunDeletionStore implements RunDeletionStore {
  private readonly now: () => Date
  private readonly onBeforeCommit: () => void

  constructor(
    private readonly database: Firestore,
    options: FirestoreRunDeletionStoreOptions = {},
  ) {
    this.now = options.now ?? (() => new Date())
    this.onBeforeCommit = options.onBeforeCommit ?? (() => {})
  }

  async commit(options: {
    envelope: RunDeletionCommandEnvelope
    ownerId: string
  }) {
    const signature = materialCommandSignature(options.envelope)
    const deletedAt = this.now().toISOString()
    const ownerId = createUserId(options.ownerId)
    const receiptReference = this.database.doc(
      materialCommandReceiptPath(options.ownerId, options.envelope.commandId),
    )
    const membershipReference = this.database.doc(
      approvedBetaMembershipPath(options.ownerId),
    )
    const runReference = this.database.doc(
      runDocumentPath(ownerId, options.envelope.command.completedRunId),
    )
    const workoutReference = options.envelope.command.plannedWorkout

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
          kind: 'deleted' as const,
          result: storedRunDeletionResult(receipt.result),
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
      const importCollectionReference = this.database.collection(
        activityImportsCollectionPath(ownerId),
      )
      const completedRunImportsQuery = importCollectionReference.where(
        'completedRunId',
        '==',
        options.envelope.command.completedRunId,
      )
      const candidateImportsQuery = importCollectionReference.where(
        'candidateCompletedRunId',
        '==',
        options.envelope.command.completedRunId,
      )
      const [runSnapshot, workoutSnapshot, guardSnapshot] = await Promise.all([
        transaction.get(runReference),
        workoutDocumentReference === null
          ? Promise.resolve(null)
          : transaction.get(workoutDocumentReference),
        guardDocumentReference === null
          ? Promise.resolve(null)
          : transaction.get(guardDocumentReference),
      ])
      const [completedRunImportSnapshots, candidateImportSnapshots] =
        await Promise.all([
          transaction.get(completedRunImportsQuery),
          transaction.get(candidateImportsQuery),
        ])

      const decision = projectRunDeletion({
        authenticatedOwnerId: options.ownerId,
        deletedAt,
        envelope: options.envelope,
        loadedRun: completedRunFromAdminDocument(
          runSnapshot.id,
          runSnapshot.data(),
        ),
        loadedPlannedWorkout:
          workoutSnapshot === null
            ? null
            : plannedWorkoutFromAdminDocument(
                workoutSnapshot.id,
                workoutSnapshot.data(),
              ),
        loadedCompletionGuard:
          guardSnapshot === null
            ? null
            : completionGuardFromAdminDocument(guardSnapshot.data()),
      })
      if (!decision.ok) {
        return { kind: 'rejected' as const, result: decision.result }
      }

      const projection = decision.projection
      transaction.delete(this.database.doc(projection.deletedRun.path))
      const associatedImportDocuments = new Map(
        [
          ...completedRunImportSnapshots.docs,
          ...candidateImportSnapshots.docs,
        ].map((document) => [document.ref.path, document]),
      )
      for (const document of associatedImportDocuments.values()) {
        const suppressed = userDeletedActivityImportDocument(
          document.data(),
          projection.deletedRun.id,
          deletedAt,
        )
        if (suppressed === null) {
          throw new Error(
            'An activity-import record did not reference the deleted run.',
          )
        }
        transaction.set(document.ref, suppressed)
      }
      if (
        projection.reopenedPlannedWorkout !== null &&
        workoutDocumentReference !== null
      ) {
        transaction.set(
          workoutDocumentReference,
          plannedWorkoutAdminDocument(projection.reopenedPlannedWorkout.entity),
        )
      }
      if (
        projection.completionGuardToDelete !== null &&
        guardDocumentReference !== null
      ) {
        transaction.delete(guardDocumentReference)
      }
      transaction.create(receiptReference, {
        schemaVersion: MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
        signature,
        result: projection.receipt,
        createdAt: adminTimestamp(deletedAt),
      })
      this.onBeforeCommit()

      return { kind: 'deleted' as const, result: projection.receipt }
    })
  }
}
