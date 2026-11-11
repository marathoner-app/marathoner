import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  artifactVersionsFromManifest,
  CLOSED_BETA_METHODOLOGY_CONTROL_PATH,
  CLOSED_BETA_METHODOLOGY_CONTROL_SCHEMA_VERSION,
  CLOSED_BETA_PROJECT_ID,
  type ClosedBetaMethodologyEligibilityRequest,
} from './closedBetaMethodologyEligibility.js'
import { FirestoreClosedBetaMethodologyEligibilityStore } from './firestoreClosedBetaMethodologyEligibilityStore.js'
import { loadPinnedClosedBetaMethodologyManifest } from './pinnedClosedBetaMethodologyManifest.js'

const emulatorProjectId = 'demo-marathoner'
const ownerId = 'closed-beta-eligibility-owner'
const manifest = loadPinnedClosedBetaMethodologyManifest()
const artifactVersions = artifactVersionsFromManifest(manifest)
const adminApp = initializeApp(
  { projectId: emulatorProjectId },
  'closed-beta-methodology-eligibility',
)
const database = getFirestore(adminApp)
const store = new FirestoreClosedBetaMethodologyEligibilityStore(
  database,
  manifest,
)

async function clearFirestoreEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is required.')
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${emulatorProjectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
  if (!response.ok) throw new Error(`Could not clear Firestore: ${response.status}`)
}

function request(
  overrides: Partial<ClosedBetaMethodologyEligibilityRequest> = {},
): ClosedBetaMethodologyEligibilityRequest {
  return {
    ownerId,
    projectId: CLOSED_BETA_PROJECT_ID,
    capability: 'adaptation',
    serverArtifactVersion: artifactVersions.adaptation,
    inputDisposition: 'supported',
    ...overrides,
  }
}

async function seedMembershipAndControl() {
  await Promise.all([
    database.doc(`betaMemberships/${ownerId}`).set({
      schemaVersion: 1,
      userId: ownerId,
      status: 'approved',
      approvedAt: Timestamp.fromDate(new Date('2026-11-11T19:00:00.000Z')),
      approvedBy: 'closed-beta-operator',
    }),
    database.doc(CLOSED_BETA_METHODOLOGY_CONTROL_PATH).set({
      schemaVersion: CLOSED_BETA_METHODOLOGY_CONTROL_SCHEMA_VERSION,
      revision: 1,
      enabled: true,
      manifestVersion: manifest.manifestVersion,
      artifactVersions,
      updatedAt: '2026-11-11T20:00:00.000Z',
    }),
  ])
}

beforeEach(clearFirestoreEmulator)
afterAll(async () => deleteApp(adminApp))

describe('Firestore closed-beta methodology eligibility', () => {
  it('returns allowed evidence from one consistent membership and control read', async () => {
    await seedMembershipAndControl()

    await expect(store.evaluate(request())).resolves.toMatchObject({
      status: 'allowed',
      evidence: {
        manifestVersion: manifest.manifestVersion,
        controlRevision: 1,
        artifactVersions,
        capability: 'adaptation',
      },
    })
  })

  it('fails closed for missing and malformed memberships with one generic result', async () => {
    await seedMembershipAndControl()
    await database.doc(`betaMemberships/${ownerId}`).delete()
    await expect(store.evaluate(request())).resolves.toEqual({
      status: 'denied',
      code: 'closed-beta-access-required',
    })

    await database.doc(`betaMemberships/${ownerId}`).set({
      schemaVersion: 1,
      userId: ownerId,
      status: 'pending',
      approvedAt: Timestamp.fromDate(new Date('2026-11-11T19:00:00.000Z')),
      approvedBy: 'closed-beta-operator',
    })
    await expect(store.evaluate(request())).resolves.toEqual({
      status: 'denied',
      code: 'closed-beta-access-required',
    })
  })

  it('fails closed for a stale or disabled operator control', async () => {
    await seedMembershipAndControl()
    await database.doc(CLOSED_BETA_METHODOLOGY_CONTROL_PATH).update({
      manifestVersion: 'closed-beta-provisional-methodology@0.0.9',
    })
    await expect(store.evaluate(request())).resolves.toEqual({
      status: 'stale_version',
      code: 'methodology-manifest-version-stale',
    })

    await database.doc(CLOSED_BETA_METHODOLOGY_CONTROL_PATH).update({
      enabled: false,
      manifestVersion: manifest.manifestVersion,
    })
    await expect(store.evaluate(request())).resolves.toEqual({
      status: 'denied',
      code: 'closed-beta-methodology-disabled',
    })
  })
})
