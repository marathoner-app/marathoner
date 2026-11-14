import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createActivityImportCommand,
  type MaterialCommandResult,
} from '../../src/domain/materialCommands/contract.js'
import { createProviderActivityId } from '../../src/domain/activityImport/contract.js'
import {
  createIanaTimeZone,
  createUtcDateTime,
} from '../../src/domain/training/dates.js'
import {
  createDistanceMeters,
  createDurationSeconds,
} from '../../src/domain/training/units.js'
import {
  processGarminPushDelivery,
  receiveGarminActivityPush,
} from './garminActivityPush.js'
import { FirestoreActivityImportStore } from './firestoreActivityImportStore.js'
import {
  FirestoreGarminActivityPushStore,
  garminPushDeliveryFromDocument,
} from './firestoreGarminActivityPushStore.js'
import {
  FirestoreGarminOAuthStore,
  garminProviderAccountDigest,
} from './firestoreGarminOAuthStore.js'

const projectId = 'demo-marathoner'
const ownerId = 'garmin-push-owner'
const providerUserId = 'synthetic-provider-user'
const app = initializeApp({ projectId }, 'garmin-push-store-integration')
const database = getFirestore(app)
const oauthStore = new FirestoreGarminOAuthStore(database)
const pushStore = new FirestoreGarminActivityPushStore(database)
const importStore = new FirestoreActivityImportStore(database, {
  createRunId: () => 'garmin-imported-run',
  now: () => new Date('2026-11-04T20:01:00.000Z'),
})

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

async function seedOwner() {
  await Promise.all([
    database.doc(`betaMemberships/${ownerId}`).set({
      schemaVersion: 1,
      userId: ownerId,
      status: 'approved',
      approvedAt: Timestamp.fromDate(new Date('2026-11-01T00:00:00.000Z')),
      approvedBy: 'garmin-push-emulator',
    }),
    database.doc(`users/${ownerId}`).set({
      schemaVersion: 1,
      userId: ownerId,
      timeZone: 'America/Los_Angeles',
    }),
  ])
}

async function connectOwner() {
  await oauthStore.createAuthorization({
    createdAt: '2026-11-04T19:55:00.000Z',
    environment: 'beta',
    expiresAt: '2026-11-04T20:05:00.000Z',
    ownerId,
    stateDigest: 'push-integration-state',
    codeVerifier: 'synthetic-private-verifier',
  })
  await oauthStore.reserveCallback({
    codeDigest: 'synthetic-code-digest',
    environment: 'beta',
    now: '2026-11-04T19:56:00.000Z',
    stateDigest: 'push-integration-state',
  })
  await oauthStore.completeCallback({
    connectedAt: '2026-11-04T19:57:00.000Z',
    environment: 'beta',
    grant: {
      accessToken: 'synthetic-access-token',
      refreshToken: 'synthetic-refresh-token',
      expiresAt: '2026-11-04T20:57:00.000Z',
      providerUserId,
    },
    ownerId,
    stateDigest: 'push-integration-state',
  })
}

function pushBody(userId = providerUserId) {
  return {
    activities: [
      {
        userId,
        summaryId: 'synthetic-summary-001',
        activityType: 'RUNNING',
        startTimeInSeconds: 1_793_822_400,
        startTimeOffsetInSeconds: -28_800,
        durationInSeconds: 3_600,
        distanceInMeters: 10_000,
        averageHeartRateInBeatsPerMinute: 151,
        maxHeartRateInBeatsPerMinute: 176,
      },
    ],
  }
}

async function receive(body: unknown) {
  return receiveGarminActivityPush(
    {
      body,
      bodyBytes: JSON.stringify(body).length,
      clientId: 'synthetic-client-id',
      clientIp: '203.0.113.42',
      contentType: 'application/json',
      method: 'POST',
    },
    {
      clientId: 'synthetic-client-id',
      enabled: true,
      log: vi.fn(),
      now: () => new Date('2026-11-04T20:00:00.000Z'),
      store: pushStore,
      trustedCidrs: ['203.0.113.0/24'],
    },
  )
}

async function queuedDelivery() {
  const queue = await database.collection('garminPushDeliveries').get()
  expect(queue.docs).toHaveLength(1)
  const document = queue.docs[0]
  if (!document) throw new Error('Expected a queued Garmin delivery.')
  const delivery = garminPushDeliveryFromDocument(document.id, document.data())
  if (delivery === null) throw new Error('Expected a valid Garmin delivery.')
  return delivery
}

async function submitImport(
  submittedOwnerId: string,
  command: Parameters<typeof importStore.commit>[0]['envelope'],
): Promise<MaterialCommandResult> {
  const result = await importStore.commit({
    envelope: command,
    ownerId: submittedOwnerId,
  })
  if (
    result.kind === 'membership-required' ||
    result.kind === 'conflict' ||
    result.kind === 'rejected'
  ) {
    throw new Error(`Unexpected import result: ${result.kind}`)
  }
  return result.result
}

beforeAll(clearFirestoreEmulator)
beforeEach(async () => {
  await clearFirestoreEmulator()
  await seedOwner()
})
afterAll(async () => deleteApp(app))

describe('Firestore Garmin push ingestion', () => {
  it('maps a connected provider user to one owner and creates one visible run', async () => {
    await connectOwner()

    await expect(receive(pushBody())).resolves.toEqual({
      httpStatus: 200,
      status: 'accepted',
    })
    const delivery = await queuedDelivery()
    await processGarminPushDelivery(delivery, {
      environment: 'beta',
      log: vi.fn(),
      now: () => new Date('2026-11-04T20:01:00.000Z'),
      store: pushStore,
      submitImport,
    })

    const runs = await database.collection(`users/${ownerId}/runs`).get()
    expect(runs.docs).toHaveLength(1)
    expect(runs.docs[0]?.data()).toMatchObject({
      userId: ownerId,
      distanceMeters: 10_000,
      durationSeconds: 3_600,
      averageHeartRateBpm: 151,
      maximumHeartRateBpm: 176,
      importProvider: 'garmin_connect',
      reportedOrigin: 'garmin',
      timeZone: 'America/Los_Angeles',
    })
    const queue = await database.collection('garminPushDeliveries').get()
    expect(queue.docs[0]?.data()).toMatchObject({
      status: 'processed',
      outcome: 'imported',
    })
    expect(JSON.stringify(queue.docs[0]?.data())).not.toContain(providerUserId)
    expect(JSON.stringify(queue.docs[0]?.data())).not.toContain(
      'synthetic-summary-001',
    )
  })

  it('keeps provider replay idempotent from queue receipt through run persistence', async () => {
    await connectOwner()
    await receive(pushBody())
    await receive(pushBody())
    const queue = await database.collection('garminPushDeliveries').get()
    expect(queue.docs).toHaveLength(1)
    const delivery = await queuedDelivery()
    const dependencies = {
      environment: 'beta' as const,
      log: vi.fn(),
      now: () => new Date('2026-11-04T20:01:00.000Z'),
      store: pushStore,
      submitImport,
    }
    await processGarminPushDelivery(delivery, dependencies)
    await processGarminPushDelivery(delivery, dependencies)
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))
  })

  it('holds an Apple Health copy for review instead of creating a second run', async () => {
    await connectOwner()
    const apple = createActivityImportCommand('apple-import-command-001', {
      schemaVersion: 'completed-activity-import@1',
      operation: 'upsert',
      provider: 'apple_health',
      providerActivityId: createProviderActivityId('apple-activity-001'),
      observedAt: createUtcDateTime('2026-11-04T19:59:00.000Z'),
      providerUpdatedAt: null,
      activityType: 'running',
      startedAt: createUtcDateTime('2026-11-04T20:00:00.000Z'),
      endedAt: null,
      durationSeconds: createDurationSeconds(3_600),
      timeZone: createIanaTimeZone('America/Los_Angeles'),
      distanceMeters: createDistanceMeters(10_000),
      reportedOrigin: 'garmin',
    })
    await importStore.commit({ envelope: apple, ownerId })
    await receive(pushBody())

    await processGarminPushDelivery(await queuedDelivery(), {
      environment: 'beta',
      log: vi.fn(),
      now: () => new Date('2026-11-04T20:01:00.000Z'),
      store: pushStore,
      submitImport,
    })

    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))
    const queue = await database.collection('garminPushDeliveries').get()
    expect(queue.docs[0]?.data()?.outcome).toBe('review_required')
  })

  it('ignores an unknown provider account without changing owner data', async () => {
    await receive(pushBody('unmapped-provider-user'))
    await processGarminPushDelivery(await queuedDelivery(), {
      environment: 'beta',
      log: vi.fn(),
      now: () => new Date('2026-11-04T20:01:00.000Z'),
      store: pushStore,
      submitImport,
    })
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ empty: true }))
  })

  it('removes the connection and account link after provider deregistration', async () => {
    await connectOwner()
    await receive({ deregistrations: [{ userId: providerUserId }] })
    await processGarminPushDelivery(await queuedDelivery(), {
      environment: 'beta',
      log: vi.fn(),
      now: () => new Date('2026-11-04T20:01:00.000Z'),
      store: pushStore,
      submitImport,
    })

    await expect(
      database.doc(`users/${ownerId}/providerConnections/garmin`).get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
    await expect(
      database
        .doc(
          `providerAccountLinks/${garminProviderAccountDigest(providerUserId)}`,
        )
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
  })

  it('removes the connection and account link after Activity permission is withdrawn', async () => {
    await connectOwner()
    const permissionChange = {
      userPermissionsChange: [
        {
          userId: providerUserId,
          summaryId: 'synthetic-permission-change',
          permissions: ['HEALTH_EXPORT'],
          changeTimeInSeconds: 1_793_822_400,
        },
      ],
    }
    await receive(permissionChange)
    await receive(permissionChange)
    await processGarminPushDelivery(await queuedDelivery(), {
      environment: 'beta',
      log: vi.fn(),
      now: () => new Date('2026-11-04T20:01:00.000Z'),
      store: pushStore,
      submitImport,
    })

    await expect(
      database.doc(`users/${ownerId}/providerConnections/garmin`).get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
    await expect(
      database
        .doc(
          `providerAccountLinks/${garminProviderAccountDigest(providerUserId)}`,
        )
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
    const queue = await database.collection('garminPushDeliveries').get()
    expect(queue.docs[0]?.data()).toMatchObject({
      status: 'processed',
      outcome: 'permission_revoked',
    })
    expect(JSON.stringify(queue.docs[0]?.data())).not.toContain(providerUserId)
    expect(JSON.stringify(queue.docs[0]?.data())).not.toContain('HEALTH_EXPORT')
  })

  it('keeps the connection when Activity permission remains granted', async () => {
    await connectOwner()
    await receive({
      userPermissionsChange: [
        {
          userId: providerUserId,
          summaryId: 'synthetic-permission-change',
          permissions: ['ACTIVITY_EXPORT', 'HEALTH_EXPORT'],
          changeTimeInSeconds: 1_793_822_400,
        },
      ],
    })
    await processGarminPushDelivery(await queuedDelivery(), {
      environment: 'beta',
      log: vi.fn(),
      now: () => new Date('2026-11-04T20:01:00.000Z'),
      store: pushStore,
      submitImport,
    })

    await expect(
      database.doc(`users/${ownerId}/providerConnections/garmin`).get(),
    ).resolves.toEqual(expect.objectContaining({ exists: true }))
    await expect(
      database
        .doc(
          `providerAccountLinks/${garminProviderAccountDigest(providerUserId)}`,
        )
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: true }))
  })
})
