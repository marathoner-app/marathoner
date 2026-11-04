import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { FirestoreGarminOAuthStore } from './firestoreGarminOAuthStore.js'

const projectId = 'demo-marathoner'
const ownerId = 'garmin-oauth-owner'
const otherOwnerId = 'garmin-oauth-other-owner'
const app = initializeApp({ projectId }, 'garmin-oauth-store-integration')
const database = getFirestore(app)
const store = new FirestoreGarminOAuthStore(database)
const grant = {
  accessToken: 'private-access-token',
  refreshToken: 'private-refresh-token',
  expiresAt: '2026-11-04T21:00:00.000Z',
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

async function seedMembership(userId: string) {
  await database.doc(`betaMemberships/${userId}`).set({
    schemaVersion: 1,
    userId,
    status: 'approved',
    approvedAt: Timestamp.fromDate(new Date('2026-11-01T00:00:00.000Z')),
    approvedBy: 'garmin-oauth-emulator',
  })
}

beforeAll(clearFirestoreEmulator)
beforeEach(async () => {
  await clearFirestoreEmulator()
  await Promise.all([seedMembership(ownerId), seedMembership(otherOwnerId)])
})
afterAll(async () => deleteApp(app))

describe('Firestore Garmin OAuth custody', () => {
  it('requires membership and stores only a digest of browser state', async () => {
    await database.doc(`betaMemberships/${ownerId}`).delete()
    await expect(
      store.createAuthorization({
        createdAt: '2026-11-04T20:00:00.000Z',
        environment: 'beta',
        expiresAt: '2026-11-04T20:10:00.000Z',
        ownerId,
        stateDigest: 'state-digest-no-membership',
        codeVerifier: 'private-verifier',
      }),
    ).resolves.toBe('membership-required')

    await seedMembership(ownerId)
    await expect(
      store.createAuthorization({
        createdAt: '2026-11-04T20:00:00.000Z',
        environment: 'beta',
        expiresAt: '2026-11-04T20:10:00.000Z',
        ownerId,
        stateDigest: 'state-digest',
        codeVerifier: 'private-verifier',
      }),
    ).resolves.toBe('created')
    const snapshot = await database.doc('providerOAuthStates/state-digest').get()
    expect(snapshot.data()).toMatchObject({
      environment: 'beta',
      ownerId,
      codeVerifier: 'private-verifier',
      status: 'pending',
    })
    expect(JSON.stringify(snapshot.data())).not.toContain('browser-state')
  })

  it('reserves one callback, rejects another code, and completes one connection', async () => {
    await store.createAuthorization({
      createdAt: '2026-11-04T20:00:00.000Z',
      environment: 'beta',
      expiresAt: '2026-11-04T20:10:00.000Z',
      ownerId,
      stateDigest: 'state-digest',
      codeVerifier: 'private-verifier',
    })

    await expect(
      store.reserveCallback({
        codeDigest: 'first-code-digest',
        environment: 'beta',
        now: '2026-11-04T20:01:00.000Z',
        stateDigest: 'state-digest',
      }),
    ).resolves.toEqual({
      kind: 'reserved',
      ownerId,
      codeVerifier: 'private-verifier',
    })
    await expect(
      store.reserveCallback({
        codeDigest: 'different-code-digest',
        environment: 'beta',
        now: '2026-11-04T20:01:01.000Z',
        stateDigest: 'state-digest',
      }),
    ).resolves.toEqual({ kind: 'invalid' })
    await expect(
      store.completeCallback({
        connectedAt: '2026-11-04T20:02:00.000Z',
        environment: 'beta',
        grant,
        ownerId,
        stateDigest: 'state-digest',
      }),
    ).resolves.toEqual([])
    await expect(
      store.reserveCallback({
        codeDigest: 'first-code-digest',
        environment: 'beta',
        now: '2026-11-04T20:03:00.000Z',
        stateDigest: 'state-digest',
      }),
    ).resolves.toEqual({ kind: 'completed' })
    await expect(
      store.reserveCallback({
        codeDigest: 'different-code-digest',
        environment: 'beta',
        now: '2026-11-04T20:03:01.000Z',
        stateDigest: 'state-digest',
      }),
    ).resolves.toEqual({ kind: 'invalid' })

    await expect(
      store.readStatus({ environment: 'beta', ownerId }),
    ).resolves.toEqual({
      status: 'connected',
      connectedAt: '2026-11-04T20:02:00.000Z',
    })
    const state = await database.doc('providerOAuthStates/state-digest').get()
    expect(state.data()).toMatchObject({
      status: 'completed',
      ownerId: null,
      codeVerifier: null,
      codeDigest: 'first-code-digest',
    })
  })

  it('keeps grants environment scoped and deletes token material after disconnect', async () => {
    await store.createAuthorization({
      createdAt: '2026-11-04T20:00:00.000Z',
      environment: 'beta',
      expiresAt: '2026-11-04T20:10:00.000Z',
      ownerId,
      stateDigest: 'state-digest',
      codeVerifier: 'private-verifier',
    })
    await store.reserveCallback({
      codeDigest: 'code-digest',
      environment: 'beta',
      now: '2026-11-04T20:01:00.000Z',
      stateDigest: 'state-digest',
    })
    await store.completeCallback({
      connectedAt: '2026-11-04T20:02:00.000Z',
      environment: 'beta',
      grant,
      ownerId,
      stateDigest: 'state-digest',
    })

    await expect(
      store.readStatus({ environment: 'development', ownerId }),
    ).resolves.toEqual({ status: 'disconnected', connectedAt: null })
    await expect(
      store.reserveDisconnect({ environment: 'development', ownerId }),
    ).resolves.toEqual({ kind: 'disconnected' })
    await expect(
      store.reserveDisconnect({ environment: 'beta', ownerId }),
    ).resolves.toEqual({ kind: 'reserved', grants: [grant] })
    await store.completeDisconnect({ environment: 'beta', ownerId })
    await expect(
      database.doc(`users/${ownerId}/providerConnections/garmin`).get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
  })

  it('refuses owner mapping when approved membership changes before callback', async () => {
    await store.createAuthorization({
      createdAt: '2026-11-04T20:00:00.000Z',
      environment: 'beta',
      expiresAt: '2026-11-04T20:10:00.000Z',
      ownerId,
      stateDigest: 'revoked-membership-state',
      codeVerifier: 'private-verifier',
    })
    await store.reserveCallback({
      codeDigest: 'code-digest',
      environment: 'beta',
      now: '2026-11-04T20:01:00.000Z',
      stateDigest: 'revoked-membership-state',
    })
    await database.doc(`betaMemberships/${ownerId}`).update({
      status: 'deletion_pending',
    })

    await expect(
      store.completeCallback({
        connectedAt: '2026-11-04T20:02:00.000Z',
        environment: 'beta',
        grant,
        ownerId,
        stateDigest: 'revoked-membership-state',
      }),
    ).rejects.toThrow('membership')
    await expect(
      database.doc(`users/${ownerId}/providerConnections/garmin`).get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
  })

  it('never replaces a connection record from another environment', async () => {
    await database.doc(`users/${ownerId}/providerConnections/garmin`).set({
      schemaVersion: 1,
      provider: 'garmin_connect',
      status: 'connected',
      environment: 'development',
      ownerId,
      accessToken: 'development-access-token',
      refreshToken: null,
      expiresAt: null,
      connectedAt: '2026-11-04T19:00:00.000Z',
      updatedAt: '2026-11-04T19:00:00.000Z',
      pendingRevocationGrants: [],
    })
    await store.createAuthorization({
      createdAt: '2026-11-04T20:00:00.000Z',
      environment: 'beta',
      expiresAt: '2026-11-04T20:10:00.000Z',
      ownerId,
      stateDigest: 'cross-environment-state',
      codeVerifier: 'private-verifier',
    })
    await store.reserveCallback({
      codeDigest: 'code-digest',
      environment: 'beta',
      now: '2026-11-04T20:01:00.000Z',
      stateDigest: 'cross-environment-state',
    })

    await expect(
      store.completeCallback({
        connectedAt: '2026-11-04T20:02:00.000Z',
        environment: 'beta',
        grant,
        ownerId,
        stateDigest: 'cross-environment-state',
      }),
    ).rejects.toThrow('another environment')
    const connection = await database
      .doc(`users/${ownerId}/providerConnections/garmin`)
      .get()
    expect(connection.data()).toMatchObject({
      environment: 'development',
      accessToken: 'development-access-token',
    })
  })
})
