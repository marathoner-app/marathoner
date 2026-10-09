import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  ACCOUNT_DELETION_RUNNER_STEPS,
  AccountDeletionRunner,
  AccountDeletionRunnerError,
  FirestoreAccountDeletionWorkflowStore,
  type AccountDeletionPrivateRecordGateway,
  type AccountDeletionRunnerLogEntry,
  type AccountDeletionRunnerStep,
} from './accountDeletionRunner.js'
import { FirebaseAccountAccessManager } from './firebaseAccountAccessManager.js'

const projectId = 'demo-marathoner'
const requestId = '11111111-1111-4111-8111-111111111111'
const ownerId = 'deletion-runner-owner'
const otherOwnerId = 'deletion-runner-other'
const ownerEmail = 'deletion-runner-owner@example.test'
const otherEmail = 'deletion-runner-other@example.test'
const commandId = 'delete-command-runner-fixture'
const requestedAt = '2027-01-15T08:00:00.000Z'
const completedAt = '2027-01-16T08:00:00.000Z'
const expiresAt = '2027-02-15T08:00:00.000Z'

const adminApp = initializeApp({ projectId }, 'account-deletion-runner')
const database = getFirestore(adminApp)
const auth = getAuth(adminApp)

class FictionalPrivateRecordGateway
  implements AccountDeletionPrivateRecordGateway
{
  exists = true

  async deleteDeclaredRecords() {
    this.exists = false
  }

  async verifyDeclaredRecordsAbsent() {
    if (this.exists) throw new Error('Fictional private record remains.')
  }
}

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

async function clearAuthEmulator() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST
  if (!host) throw new Error('FIREBASE_AUTH_EMULATOR_HOST is required.')
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${projectId}/accounts`,
    { method: 'DELETE' },
  )
  if (!response.ok) {
    throw new Error(`Could not clear Auth emulator: ${response.status}`)
  }
}

async function seedOwnedData(
  store: Firestore,
  userId: string,
  membershipStatus: 'approved' | 'deletion_pending',
) {
  const documents = [
    [`users/${userId}`, { schemaVersion: 1, userId }],
    [`users/${userId}/plans/plan-one`, { schemaVersion: 1, userId }],
    [
      `users/${userId}/plans/plan-one/workouts/workout-one`,
      { schemaVersion: 1, userId, planId: 'plan-one' },
    ],
    [
      `users/${userId}/plans/plan-one/metadata/generation`,
      { schemaVersion: 1, userId, planId: 'plan-one' },
    ],
    [
      `users/${userId}/planState/active`,
      { schemaVersion: 1, userId, activePlanId: 'plan-one' },
    ],
    [`users/${userId}/runs/run-one`, { schemaVersion: 1, userId }],
    [`users/${userId}/shoes/shoe-one`, { schemaVersion: 1, userId }],
    [
      `users/${userId}/unexpected/missing-parent/deep/canary`,
      { fictional: true },
    ],
    [
      `materialCommandReceipts/${userId}/commands/fixture-command`,
      { fictional: true },
    ],
    [
      `materialCommandReceipts/${userId}/commands/approve-plan-fixture`,
      { schemaVersion: 1, result: { status: 'plan_approved' } },
    ],
    [`materialCommandProofs/${userId}`, { fictional: true }],
    [
      `betaMemberships/${userId}`,
      {
        schemaVersion: 1,
        userId,
        status: membershipStatus,
        approvedAt: new Date('2027-01-01T08:00:00.000Z'),
        approvedBy: 'operator-fixture',
      },
    ],
  ] as const

  await Promise.all(
    documents.map(([path, data]) => store.doc(path).set(data)),
  )
}

async function seedRequest(
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await database.doc(`accountDeletionRequests/${requestId}`).set({
    schemaVersion: 1,
    manifestVersion: 1,
    requestId,
    userId: ownerId,
    commandId,
    status: 'auth_lock_failed',
    stage: 'membership_locked',
    attemptCount: 1,
    requestedAt,
    completionDueAt: '2027-01-22T08:00:00.000Z',
    updatedAt: requestedAt,
    lastErrorCode: 'auth-admin-failed',
    ...overrides,
  })
}

async function seedFixture() {
  await Promise.all([
    auth.createUser({ uid: ownerId, email: ownerEmail, emailVerified: true }),
    auth.createUser({
      uid: otherOwnerId,
      email: otherEmail,
      emailVerified: true,
    }),
  ])
  await Promise.all([
    seedOwnedData(database, ownerId, 'deletion_pending'),
    seedOwnedData(database, otherOwnerId, 'approved'),
    seedRequest(),
  ])
}

function createRunner(options: {
  afterStep?: (step: AccountDeletionRunnerStep) => Promise<void>
  logs?: AccountDeletionRunnerLogEntry[]
  now?: Date
  privateRecords?: FictionalPrivateRecordGateway
} = {}) {
  const logs = options.logs ?? []
  const privateRecords =
    options.privateRecords ?? new FictionalPrivateRecordGateway()
  return {
    logs,
    privateRecords,
    runner: new AccountDeletionRunner({
      accountAccess: new FirebaseAccountAccessManager(auth),
      store: new FirestoreAccountDeletionWorkflowStore(database),
      privateRecords,
      now: () => options.now ?? new Date(completedAt),
      log: (entry) => logs.push(entry),
      ...(options.afterStep ? { afterStep: options.afterStep } : {}),
    }),
  }
}

async function expectOwnerDeletedAndOtherOwnerUntouched() {
  await expect(auth.getUser(ownerId)).rejects.toMatchObject({
    code: 'auth/user-not-found',
  })
  await expect(auth.getUser(otherOwnerId)).resolves.toEqual(
    expect.objectContaining({ uid: otherOwnerId, email: otherEmail }),
  )
  const ownedPaths = [
    `users/${ownerId}`,
    `users/${ownerId}/plans/plan-one`,
    `users/${ownerId}/plans/plan-one/workouts/workout-one`,
    `users/${ownerId}/plans/plan-one/metadata/generation`,
    `users/${ownerId}/planState/active`,
    `users/${ownerId}/runs/run-one`,
    `users/${ownerId}/shoes/shoe-one`,
    `users/${ownerId}/unexpected/missing-parent/deep/canary`,
    `materialCommandReceipts/${ownerId}/commands/fixture-command`,
    `materialCommandReceipts/${ownerId}/commands/approve-plan-fixture`,
    `materialCommandProofs/${ownerId}`,
    `betaMemberships/${ownerId}`,
  ]
  const otherOwnerPaths = [
    `users/${otherOwnerId}`,
    `users/${otherOwnerId}/plans/plan-one`,
    `users/${otherOwnerId}/plans/plan-one/workouts/workout-one`,
    `users/${otherOwnerId}/plans/plan-one/metadata/generation`,
    `users/${otherOwnerId}/planState/active`,
    `users/${otherOwnerId}/runs/run-one`,
    `users/${otherOwnerId}/shoes/shoe-one`,
    `users/${otherOwnerId}/unexpected/missing-parent/deep/canary`,
    `materialCommandReceipts/${otherOwnerId}/commands/fixture-command`,
    `materialCommandReceipts/${otherOwnerId}/commands/approve-plan-fixture`,
    `materialCommandProofs/${otherOwnerId}`,
    `betaMemberships/${otherOwnerId}`,
  ]
  for (const path of ownedPaths) {
    await expect(database.doc(path).get()).resolves.toEqual(
      expect.objectContaining({ exists: false }),
    )
  }
  for (const path of otherOwnerPaths) {
    await expect(database.doc(path).get()).resolves.toEqual(
      expect.objectContaining({ exists: true }),
    )
  }
}

beforeAll(async () => {
  await Promise.all([clearFirestoreEmulator(), clearAuthEmulator()])
})

beforeEach(async () => {
  await Promise.all([clearFirestoreEmulator(), clearAuthEmulator()])
})

afterAll(async () => {
  await Promise.all([clearFirestoreEmulator(), clearAuthEmulator()])
  await deleteApp(adminApp)
})

describe('account-deletion runner', () => {
  it('deletes the exact owner manifest, preserves another owner, and anonymizes the receipt', async () => {
    await seedFixture()
    const { logs, privateRecords, runner } = createRunner()

    await expect(runner.run(requestId)).resolves.toEqual({
      status: 'completed',
      requestId,
      completedAt,
      expiresAt,
    })
    await expect(runner.run(requestId)).resolves.toEqual({
      status: 'already_completed',
      requestId,
      completedAt,
      expiresAt,
    })

    await expectOwnerDeletedAndOtherOwnerUntouched()
    expect(privateRecords.exists).toBe(false)
    const receipt = (
      await database.doc(`accountDeletionRequests/${requestId}`).get()
    ).data()
    expect(receipt).toEqual({
      schemaVersion: 1,
      manifestVersion: 1,
      requestId,
      status: 'completed',
      requestedAt,
      completedAt,
      expiresAt,
    })

    const serializedLogs = JSON.stringify(logs)
    expect(serializedLogs).not.toContain(ownerId)
    expect(serializedLogs).not.toContain(ownerEmail)
    expect(serializedLogs).not.toContain(commandId)
    expect(logs.map(({ step }) => step)).toEqual(
      ACCOUNT_DELETION_RUNNER_STEPS,
    )
  })

  it.each(ACCOUNT_DELETION_RUNNER_STEPS)(
    'recovers idempotently after an injected interruption following %s',
    async (injectedStep) => {
      await seedFixture()
      let shouldInterrupt = true
      const privateRecords = new FictionalPrivateRecordGateway()
      const first = createRunner({
        privateRecords,
        afterStep: async (step) => {
          if (shouldInterrupt && step === injectedStep) {
            shouldInterrupt = false
            throw new Error('injected')
          }
        },
      }).runner

      if (injectedStep === 'completed') {
        await expect(first.run(requestId)).resolves.toEqual(
          expect.objectContaining({ status: 'completed' }),
        )
      } else {
        await expect(first.run(requestId)).rejects.toBeInstanceOf(
          AccountDeletionRunnerError,
        )
        const pending = (
          await database.doc(`accountDeletionRequests/${requestId}`).get()
        ).data()
        expect(pending).toEqual(
          expect.objectContaining({
            status: 'deletion_failed',
            lastErrorCode: 'operator-interrupted',
          }),
        )
      }

      const retry = createRunner({ privateRecords }).runner
      await expect(retry.run(requestId)).resolves.toEqual(
        expect.objectContaining({
          status:
            injectedStep === 'completed' ? 'already_completed' : 'completed',
        }),
      )
      await expectOwnerDeletedAndOtherOwnerUntouched()
    },
    30_000,
  )

  it('keeps Authentication until every manifest verifier succeeds', async () => {
    await seedFixture()
    const privateRecords = new FictionalPrivateRecordGateway()
    privateRecords.deleteDeclaredRecords = async () => undefined
    const { runner } = createRunner({ privateRecords })

    await expect(runner.run(requestId)).rejects.toMatchObject({
      code: 'manifest-verification-failed',
    })
    await expect(auth.getUser(ownerId)).resolves.toEqual(
      expect.objectContaining({ uid: ownerId, disabled: true }),
    )
    const pending = (
      await database.doc(`accountDeletionRequests/${requestId}`).get()
    ).data()
    expect(pending).toEqual(
      expect.objectContaining({
        status: 'deletion_failed',
        stage: 'membership_removed',
        lastErrorCode: 'manifest-verification-failed',
      }),
    )
  })

  it('treats missing records and user-not-found as safe retry outcomes after verification', async () => {
    await seedRequest({
      status: 'deletion_failed',
      stage: 'manifest_verified',
      attemptCount: 4,
      lastErrorCode: 'authentication-delete-failed',
    })
    const privateRecords = new FictionalPrivateRecordGateway()
    privateRecords.exists = false
    const { runner } = createRunner({ privateRecords })

    await expect(runner.run(requestId)).resolves.toEqual(
      expect.objectContaining({ status: 'completed' }),
    )
    const receipt = (
      await database.doc(`accountDeletionRequests/${requestId}`).get()
    ).data()
    expect(receipt).not.toHaveProperty('userId')
  })

  it('refuses an approved membership or unsupported manifest without effects', async () => {
    await seedFixture()
    await database.doc(`betaMemberships/${ownerId}`).update({
      status: 'approved',
    })
    const { runner } = createRunner()

    await expect(runner.run(requestId)).rejects.toMatchObject({
      code: 'request-invalid',
    })
    await expect(auth.getUser(ownerId)).resolves.toEqual(
      expect.objectContaining({ disabled: false }),
    )
    await database.doc(`betaMemberships/${ownerId}`).update({
      status: 'deletion_pending',
    })
    await database.doc(`accountDeletionRequests/${requestId}`).update({
      manifestVersion: 2,
    })
    await expect(runner.run(requestId)).rejects.toMatchObject({
      code: 'request-invalid',
    })
    await expect(database.doc(`users/${ownerId}`).get()).resolves.toEqual(
      expect.objectContaining({ exists: true }),
    )
  })

  it('purges only the exact anonymous receipt after its retention date', async () => {
    await seedFixture()
    await createRunner().runner.run(requestId)

    await expect(
      createRunner().runner.purgeExpiredReceipt(requestId),
    ).rejects.toThrow('has not expired')
    const afterExpiry = createRunner({
      now: new Date('2027-02-15T08:00:00.001Z'),
    }).runner
    await afterExpiry.purgeExpiredReceipt(requestId)
    await expect(
      database.doc(`accountDeletionRequests/${requestId}`).get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
  })
})
