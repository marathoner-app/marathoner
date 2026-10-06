import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createAccountDeletionRequest } from '../../src/domain/materialCommands/contract.js'
import { FirestoreAccountDeletionRequestStore } from './firestoreAccountDeletionRequestStore.js'
import { FirestoreMaterialCommandStore } from './firestoreMaterialCommandStore.js'

const projectId = 'demo-marathoner'
const ownerId = 'deletion-request-owner'
const otherOwnerId = 'deletion-request-other'
const requestId = '11111111-1111-4111-8111-111111111111'
const requestedAt = new Date('2027-01-15T08:00:00.000Z')
const adminApp = initializeApp({ projectId }, 'account-deletion-integration')
const database = getFirestore(adminApp)

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

async function seedMembership(userId: string, status = 'approved') {
  await database.doc(`betaMemberships/${userId}`).set({
    schemaVersion: 1,
    userId,
    status,
    approvedAt: new Date('2027-01-01T08:00:00.000Z'),
    approvedBy: 'operator-fixture',
  })
}

function store() {
  return new FirestoreAccountDeletionRequestStore(database, {
    createRequestId: () => requestId,
    now: () => requestedAt,
  })
}

beforeAll(async () => {
  await clearFirestoreEmulator()
})

beforeEach(async () => {
  await clearFirestoreEmulator()
})

afterAll(async () => {
  await deleteApp(adminApp)
})

describe('account-deletion Firestore request store', () => {
  it('locks only the authenticated owner and returns one durable request', async () => {
    await seedMembership(ownerId)
    await seedMembership(otherOwnerId)
    const boundary = store()
    const envelope = createAccountDeletionRequest('delete-command-idempotent')

    const first = await boundary.accept({ envelope, ownerId })
    await boundary.markAuthLockComplete(requestId)
    const second = await boundary.accept({ envelope, ownerId })

    expect(first).toEqual(
      expect.objectContaining({
        kind: 'accepted',
        authLockStatus: 'pending',
        result: expect.objectContaining({
          requestId,
          completionDueAt: '2027-01-22T08:00:00.000Z',
          accessLocked: true,
        }),
      }),
    )
    expect(second).toEqual(
      expect.objectContaining({
        kind: 'accepted',
        authLockStatus: 'complete',
        result: (first as { result: unknown }).result,
      }),
    )

    const [membership, otherMembership, request, requests] = await Promise.all([
      database.doc(`betaMemberships/${ownerId}`).get(),
      database.doc(`betaMemberships/${otherOwnerId}`).get(),
      database.doc(`accountDeletionRequests/${requestId}`).get(),
      database.collection('accountDeletionRequests').get(),
    ])
    expect(membership.data()?.status).toBe('deletion_pending')
    expect(otherMembership.data()?.status).toBe('approved')
    expect(request.data()).toEqual(
      expect.objectContaining({
        userId: ownerId,
        commandId: envelope.commandId,
        status: 'access_locked',
        stage: 'access_locked',
        attemptCount: 1,
      }),
    )
    expect(requests.size).toBe(1)
  })

  it('rejects missing, non-approved, and malformed memberships without effects', async () => {
    const boundary = store()
    const envelope = createAccountDeletionRequest('delete-command-membership')

    await expect(boundary.accept({ envelope, ownerId })).resolves.toEqual({
      kind: 'membership-required',
    })
    await seedMembership(ownerId, 'deletion_pending')
    await expect(boundary.accept({ envelope, ownerId })).resolves.toEqual({
      kind: 'membership-required',
    })
    await seedMembership(ownerId)
    await database.doc(`betaMemberships/${ownerId}`).update({
      unexpectedField: true,
    })
    await expect(boundary.accept({ envelope, ownerId })).resolves.toEqual({
      kind: 'membership-required',
    })
    await expect(
      database.collection('accountDeletionRequests').get(),
    ).resolves.toEqual(expect.objectContaining({ empty: true }))
  })

  it('records a safe Auth lock failure and resolves the accepted command by ID', async () => {
    await seedMembership(ownerId)
    const boundary = store()
    const envelope = createAccountDeletionRequest('delete-command-recoverable')

    const accepted = await boundary.accept({ envelope, ownerId })
    await boundary.markAuthLockFailed(requestId)
    const request = await database
      .doc(`accountDeletionRequests/${requestId}`)
      .get()
    const resolved = await new FirestoreMaterialCommandStore(database).resolve({
      ownerId,
      commandId: envelope.commandId,
    })

    expect(accepted).toEqual(expect.objectContaining({ kind: 'accepted' }))
    expect(request.data()).toEqual(
      expect.objectContaining({
        status: 'auth_lock_failed',
        stage: 'membership_locked',
        attemptCount: 1,
        lastErrorCode: 'auth-admin-failed',
      }),
    )
    expect(resolved).toEqual(
      expect.objectContaining({
        status: 'accepted',
        commandId: envelope.commandId,
        requestId,
      }),
    )
  })
})
