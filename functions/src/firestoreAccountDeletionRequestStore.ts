import { randomUUID } from 'node:crypto'

import {
  FieldValue,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore'

import {
  isMaterialCommandResult,
  materialCommandSignature,
  type AccountDeletionRequestAcceptedResult,
  type AccountDeletionRequestEnvelope,
} from '../../src/domain/materialCommands/contract.js'
import {
  ACCOUNT_DELETION_MANIFEST_VERSION,
  ACCOUNT_DELETION_WORKFLOW_SCHEMA_VERSION,
} from './accountDeletionManifest.js'
import type { AccountDeletionRequestStore } from './accountDeletionRequestHandler.js'

const materialCommandReceiptSchemaVersion = 1
const completionWindowMilliseconds = 7 * 24 * 60 * 60 * 1_000

function receiptPath(ownerId: string, commandId: string) {
  return `materialCommandReceipts/${ownerId}/commands/${commandId}`
}

function deletionRequestPath(requestId: string) {
  return `accountDeletionRequests/${requestId}`
}

function exactKeys(data: DocumentData, keys: readonly string[]) {
  const actual = Object.keys(data).sort()
  const expected = [...keys].sort()
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  )
}

function isApprovedMembership(data: DocumentData | undefined, ownerId: string) {
  return (
    data !== undefined &&
    exactKeys(data, [
      'approvedAt',
      'approvedBy',
      'schemaVersion',
      'status',
      'userId',
    ]) &&
    data.schemaVersion === 1 &&
    data.userId === ownerId &&
    data.status === 'approved' &&
    typeof data.approvedBy === 'string' &&
    data.approvedBy.length > 0 &&
    data.approvedBy.length <= 128 &&
    typeof data.approvedAt?.toDate === 'function'
  )
}

function acceptedResult(data: unknown): AccountDeletionRequestAcceptedResult {
  if (!isMaterialCommandResult(data) || data.status !== 'accepted') {
    throw new Error('A stored account-deletion receipt is invalid.')
  }
  return data
}

function storedAuthLockStatus(
  data: DocumentData | undefined,
): 'complete' | 'pending' {
  if (!data || typeof data.status !== 'string') {
    throw new Error('A stored account-deletion request is invalid.')
  }
  if (data.status === 'access_locked') return 'complete'
  if (data.status === 'auth_lock_pending' || data.status === 'auth_lock_failed') {
    return 'pending'
  }
  throw new Error('A stored account-deletion request has an invalid status.')
}

export class FirestoreAccountDeletionRequestStore
  implements AccountDeletionRequestStore
{
  constructor(
    private readonly database: Firestore,
    private readonly options: {
      createRequestId?: () => string
      now?: () => Date
    } = {},
  ) {}

  async accept(options: {
    envelope: AccountDeletionRequestEnvelope
    ownerId: string
  }) {
    const receiptReference = this.database.doc(
      receiptPath(options.ownerId, options.envelope.commandId),
    )
    const membershipReference = this.database.doc(
      `betaMemberships/${options.ownerId}`,
    )
    const proposedRequestId =
      this.options.createRequestId?.() ?? randomUUID()
    const proposedRequestReference = this.database.doc(
      deletionRequestPath(proposedRequestId),
    )
    const signature = materialCommandSignature(options.envelope)

    return this.database.runTransaction(async (transaction) => {
      const receiptSnapshot = await transaction.get(receiptReference)
      if (receiptSnapshot.exists) {
        const receipt = receiptSnapshot.data()
        if (!receipt || receipt.signature !== signature) {
          return { kind: 'conflict' as const }
        }
        const result = acceptedResult(receipt.result)
        const requestSnapshot = await transaction.get(
          this.database.doc(deletionRequestPath(result.requestId)),
        )
        return {
          kind: 'accepted' as const,
          authLockStatus: storedAuthLockStatus(requestSnapshot.data()),
          result,
        }
      }

      const membershipSnapshot = await transaction.get(membershipReference)
      if (!isApprovedMembership(membershipSnapshot.data(), options.ownerId)) {
        return { kind: 'membership-required' as const }
      }

      const requestedAt = this.options.now?.() ?? new Date()
      const requestedAtIso = requestedAt.toISOString()
      const completionDueAt = new Date(
        requestedAt.getTime() + completionWindowMilliseconds,
      ).toISOString()
      const result: AccountDeletionRequestAcceptedResult = {
        status: 'accepted',
        commandId: options.envelope.commandId,
        requestId: proposedRequestId,
        requestedAt: requestedAtIso,
        completionDueAt,
        accessLocked: true,
      }

      transaction.update(membershipReference, {
        status: 'deletion_pending',
      })
      transaction.create(proposedRequestReference, {
        schemaVersion: ACCOUNT_DELETION_WORKFLOW_SCHEMA_VERSION,
        manifestVersion: ACCOUNT_DELETION_MANIFEST_VERSION,
        requestId: proposedRequestId,
        userId: options.ownerId,
        commandId: options.envelope.commandId,
        status: 'auth_lock_pending',
        stage: 'membership_locked',
        attemptCount: 0,
        requestedAt: requestedAtIso,
        completionDueAt,
        updatedAt: requestedAtIso,
      })
      transaction.create(receiptReference, {
        schemaVersion: materialCommandReceiptSchemaVersion,
        signature,
        result,
        createdAt: requestedAtIso,
      })

      return {
        kind: 'accepted' as const,
        authLockStatus: 'pending' as const,
        result,
      }
    })
  }

  async markAuthLockComplete(requestId: string): Promise<void> {
    await this.database.doc(deletionRequestPath(requestId)).update({
      status: 'access_locked',
      stage: 'access_locked',
      attemptCount: FieldValue.increment(1),
      lastErrorCode: FieldValue.delete(),
      updatedAt: (this.options.now?.() ?? new Date()).toISOString(),
    })
  }

  async markAuthLockFailed(requestId: string): Promise<void> {
    await this.database.doc(deletionRequestPath(requestId)).update({
      status: 'auth_lock_failed',
      stage: 'membership_locked',
      attemptCount: FieldValue.increment(1),
      lastErrorCode: 'auth-admin-failed',
      updatedAt: (this.options.now?.() ?? new Date()).toISOString(),
    })
  }
}
