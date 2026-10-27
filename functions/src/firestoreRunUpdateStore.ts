import type { Firestore } from 'firebase-admin/firestore'

import {
  isRunUpdateReceiptResult,
  materialCommandSignature,
  type RunUpdateCommandEnvelope,
} from '../../src/domain/materialCommands/contract.js'
import { createUserId } from '../../src/domain/training/identifiers.js'
import {
  runDocumentPath,
  shoeDocumentPath,
  workoutCompletionGuardDocumentPath,
  workoutDocumentPath,
} from '../../src/persistence/firestore/paths.js'
import { projectRunUpdate } from './completedRunCommandProjection.js'
import {
  adminTimestamp,
  completedRunAdminDocument,
  completedRunFromAdminDocument,
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
import type { RunUpdateStore } from './materialCommandHandler.js'
import {
  approvedBetaMembershipPath,
  isApprovedBetaMembership,
} from './approvedBetaMembership.js'

export interface FirestoreRunUpdateStoreOptions {
  now?: () => Date
  // Test-only seam for proving that staged writes roll back together.
  onBeforeCommit?: () => void
}

function storedRunUpdateResult(data: unknown) {
  if (!isRunUpdateReceiptResult(data)) {
    throw new Error('A stored run-update receipt is invalid.')
  }
  return data
}

export class FirestoreRunUpdateStore implements RunUpdateStore {
  private readonly now: () => Date
  private readonly onBeforeCommit: () => void

  constructor(
    private readonly database: Firestore,
    options: FirestoreRunUpdateStoreOptions = {},
  ) {
    this.now = options.now ?? (() => new Date())
    this.onBeforeCommit = options.onBeforeCommit ?? (() => {})
  }

  async commit(options: {
    envelope: RunUpdateCommandEnvelope
    ownerId: string
  }) {
    const signature = materialCommandSignature(options.envelope)
    const requestedUpdateTime = this.now()
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
          kind: 'updated' as const,
          result: storedRunUpdateResult(receipt.result),
        }
      }

      const runSnapshot = await transaction.get(runReference)
      const run = completedRunFromAdminDocument(
        runSnapshot.id,
        runSnapshot.data(),
      )
      const requestedUpdateMilliseconds = requestedUpdateTime.getTime()
      if (!Number.isFinite(requestedUpdateMilliseconds)) {
        throw new Error('The server update time is invalid.')
      }
      const priorRunUpdatedMilliseconds =
        run === null ? null : Date.parse(run.updatedAt)
      const updatedAt = new Date(
        priorRunUpdatedMilliseconds === null
          ? requestedUpdateMilliseconds
          : Math.max(
              requestedUpdateMilliseconds,
              priorRunUpdatedMilliseconds + 1,
            ),
      ).toISOString()
      const previousAssociation =
        run?.plannedWorkoutPlanId === undefined ||
        run.plannedWorkoutId === undefined
          ? null
          : {
              planId: run.plannedWorkoutPlanId,
              workoutId: run.plannedWorkoutId,
            }
      const nextAssociation = options.envelope.command.input.plannedWorkout
      const previousWorkoutReference =
        previousAssociation === null
          ? null
          : this.database.doc(
              workoutDocumentPath(
                ownerId,
                previousAssociation.planId,
                previousAssociation.workoutId,
              ),
            )
      const previousGuardReference =
        previousAssociation === null
          ? null
          : this.database.doc(
              workoutCompletionGuardDocumentPath(
                ownerId,
                previousAssociation.planId,
                previousAssociation.workoutId,
              ),
            )
      const nextWorkoutReference =
        nextAssociation === null
          ? null
          : this.database.doc(
              workoutDocumentPath(
                ownerId,
                nextAssociation.planId,
                nextAssociation.workoutId,
              ),
            )
      const nextGuardReference =
        nextAssociation === null
          ? null
          : this.database.doc(
              workoutCompletionGuardDocumentPath(
                ownerId,
                nextAssociation.planId,
                nextAssociation.workoutId,
              ),
            )
      const shoeId = options.envelope.command.input.shoeId
      const shoeReference =
        shoeId === undefined
          ? null
          : this.database.doc(shoeDocumentPath(ownerId, shoeId))
      const [
        previousWorkoutSnapshot,
        previousGuardSnapshot,
        nextWorkoutSnapshot,
        nextGuardSnapshot,
        shoeSnapshot,
      ] = await Promise.all([
        previousWorkoutReference === null
          ? Promise.resolve(null)
          : transaction.get(previousWorkoutReference),
        previousGuardReference === null
          ? Promise.resolve(null)
          : transaction.get(previousGuardReference),
        nextWorkoutReference === null
          ? Promise.resolve(null)
          : transaction.get(nextWorkoutReference),
        nextGuardReference === null
          ? Promise.resolve(null)
          : transaction.get(nextGuardReference),
        shoeReference === null
          ? Promise.resolve(null)
          : transaction.get(shoeReference),
      ])

      const decision = projectRunUpdate({
        authenticatedOwnerId: options.ownerId,
        updatedAt,
        envelope: options.envelope,
        loadedRun: run,
        loadedPreviousPlannedWorkout:
          previousWorkoutSnapshot === null
            ? null
            : plannedWorkoutFromAdminDocument(
                previousWorkoutSnapshot.id,
                previousWorkoutSnapshot.data(),
              ),
        loadedPreviousCompletionGuard:
          previousGuardSnapshot === null
            ? null
            : completionGuardFromAdminDocument(
                previousGuardSnapshot.data(),
              ),
        loadedNextPlannedWorkout:
          nextWorkoutSnapshot === null
            ? null
            : plannedWorkoutFromAdminDocument(
                nextWorkoutSnapshot.id,
                nextWorkoutSnapshot.data(),
              ),
        loadedNextCompletionGuard:
          nextGuardSnapshot === null
            ? null
            : completionGuardFromAdminDocument(nextGuardSnapshot.data()),
        loadedShoe:
          shoeSnapshot === null
            ? null
            : shoeFromAdminDocument(shoeSnapshot.id, shoeSnapshot.data()),
      })
      if (!decision.ok) {
        return { kind: 'rejected' as const, result: decision.result }
      }

      const projection = decision.projection
      transaction.set(
        runReference,
        completedRunAdminDocument(projection.updatedRun.entity),
      )
      if (projection.reopenedPlannedWorkout !== null) {
        transaction.set(
          this.database.doc(projection.reopenedPlannedWorkout.path),
          plannedWorkoutAdminDocument(
            projection.reopenedPlannedWorkout.entity,
          ),
        )
      }
      if (projection.completionGuardToDelete !== null) {
        transaction.delete(
          this.database.doc(projection.completionGuardToDelete.path),
        )
      }
      if (projection.completedPlannedWorkout !== null) {
        transaction.set(
          this.database.doc(projection.completedPlannedWorkout.path),
          plannedWorkoutAdminDocument(
            projection.completedPlannedWorkout.entity,
          ),
        )
      }
      if (projection.completionGuardToCreate !== null) {
        transaction.create(
          this.database.doc(projection.completionGuardToCreate.path),
          completionGuardAdminDocument(
            projection.completionGuardToCreate.record,
          ),
        )
      }
      transaction.create(receiptReference, {
        schemaVersion: MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
        signature,
        result: projection.receipt,
        createdAt: adminTimestamp(updatedAt),
      })
      this.onBeforeCommit()

      return { kind: 'updated' as const, result: projection.receipt }
    })
  }
}
