import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
} from '../../src/domain/methodology/closedBetaMethodologyConsent.js'
import {
  closedBetaMethodologyConsentPath,
  FirestoreClosedBetaMethodologyConsentStore,
} from './firestoreClosedBetaMethodologyConsentStore.js'

const emulatorProjectId = 'demo-marathoner'
const ownerId = 'methodology-consent-owner'
const manifestVersion = 'closed-beta-provisional-methodology@0.1.0'
const now = new Date('2026-11-11T22:00:00.000Z')
const adminApp = initializeApp(
  { projectId: emulatorProjectId },
  'closed-beta-methodology-consent',
)
const database = getFirestore(adminApp)
const store = new FirestoreClosedBetaMethodologyConsentStore(database, () => now)

async function clearFirestoreEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is required.')
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${emulatorProjectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
  if (!response.ok) throw new Error(`Could not clear Firestore: ${response.status}`)
}

async function seedMembership() {
  await database.doc(`betaMemberships/${ownerId}`).set({
    schemaVersion: 1,
    userId: ownerId,
    status: 'approved',
    approvedAt: Timestamp.fromDate(new Date('2026-11-11T20:00:00.000Z')),
    approvedBy: 'closed-beta-operator',
  })
}

beforeEach(clearFirestoreEmulator)
afterAll(async () => deleteApp(adminApp))

describe('Firestore closed-beta methodology consent', () => {
  it('requires consent, records a server timestamp, and returns the durable acceptance', async () => {
    await seedMembership()
    const options = {
      ownerId,
      consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
      manifestVersion,
    } as const

    await expect(store.get(options)).resolves.toEqual({
      kind: 'required',
      reason: 'missing',
    })
    await expect(store.accept(options)).resolves.toMatchObject({
      kind: 'accepted',
      acceptance: { acceptedAt: now.toISOString(), manifestVersion },
    })
    await expect(store.get(options)).resolves.toMatchObject({
      kind: 'accepted',
      acceptance: { acceptedAt: now.toISOString(), manifestVersion },
    })
  })

  it('requires acceptance again when the manifest version changes', async () => {
    await seedMembership()
    await store.accept({
      ownerId,
      consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
      manifestVersion: 'closed-beta-provisional-methodology@0.0.9',
    })
    await expect(
      store.get({
        ownerId,
        consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
        manifestVersion,
      }),
    ).resolves.toEqual({ kind: 'required', reason: 'version_changed' })
  })

  it('does not create acceptance without approved membership', async () => {
    await expect(
      store.accept({
        ownerId,
        consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
        manifestVersion,
      }),
    ).resolves.toEqual({ kind: 'membership-required' })
    await expect(
      database.doc(closedBetaMethodologyConsentPath(ownerId)).get(),
    ).resolves.toMatchObject({ exists: false })
  })
})
