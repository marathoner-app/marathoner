import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { foundingBetaGuidanceManifest } from '../../src/domain/guidance/foundingBetaGuidanceManifest.js'
import {
  CLOSED_BETA_GUIDANCE_CONTROL_PATH,
  CLOSED_BETA_GUIDANCE_CONTROL_SCHEMA_VERSION,
  FirestoreClosedBetaGuidanceStore,
} from './firestoreClosedBetaGuidanceStore.js'

const emulatorProjectId = 'demo-marathoner'
const ownerId = 'guidance-owner'
const artifactVersion = 'beta-guidance@0.1.0-draft'
const adminApp = initializeApp({ projectId: emulatorProjectId }, 'closed-beta-guidance')
const database = getFirestore(adminApp)
const store = new FirestoreClosedBetaGuidanceStore(database)
const easyGuidance = foundingBetaGuidanceManifest.find(
  ({ topic }) => topic === 'easy_effort',
)
if (easyGuidance === undefined) throw new Error('Easy guidance fixture is missing.')

async function clearFirestoreEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is required.')
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${emulatorProjectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
  if (!response.ok) throw new Error(`Could not clear Firestore: ${response.status}`)
}

async function seedControl(disabledGuidanceIds: readonly string[] = []) {
  await database.doc(CLOSED_BETA_GUIDANCE_CONTROL_PATH).set({
    schemaVersion: CLOSED_BETA_GUIDANCE_CONTROL_SCHEMA_VERSION,
    revision: 1,
    enabled: true,
    artifactVersions: [
      'beta-guidance@0.1.0-draft',
      'beta-safety@0.1.0-draft',
    ],
    disabledGuidanceIds,
    updatedAt: Timestamp.fromDate(new Date('2026-11-11T18:00:00.000Z')),
  })
}

function presentationOptions(now = '2026-11-11T19:00:00.000Z') {
  return {
    ownerId,
    candidates: [easyGuidance],
    activeTriggerCodes: ['EASY-WORKOUT-UPCOMING'],
    provisionalArtifactVersion: artifactVersion,
    now,
  }
}

beforeEach(clearFirestoreEmulator)
afterAll(async () => deleteApp(adminApp))

describe('Firestore closed-beta guidance history', () => {
  it('records one presentation, reuses it, and suppresses the dismissed version', async () => {
    await seedControl()
    const first = await store.present(presentationOptions())
    expect(first).toMatchObject({ kind: 'available', item: easyGuidance })
    if (first.kind !== 'available') throw new Error('Expected guidance.')

    await expect(store.present(presentationOptions())).resolves.toMatchObject({
      kind: 'available',
      presentationId: first.presentationId,
    })
    await expect(
      store.dismiss({
        ownerId,
        presentationId: first.presentationId,
        artifactVersion,
        now: '2026-11-11T19:05:00.000Z',
      }),
    ).resolves.toBe('dismissed')
    await expect(
      store.present(presentationOptions('2026-11-13T19:00:00.000Z')),
    ).resolves.toEqual({ kind: 'none' })
  })

  it('honors global and item-level remote disable controls immediately', async () => {
    await expect(store.present(presentationOptions())).resolves.toEqual({
      kind: 'disabled',
    })
    await seedControl([easyGuidance.id])
    await expect(store.present(presentationOptions())).resolves.toEqual({
      kind: 'none',
    })
  })

  it('fails closed instead of repeating guidance when history is malformed', async () => {
    await seedControl()
    await database.doc(`users/${ownerId}/guidanceHistory/malformed`).set({
      schemaVersion: 'closed-beta-guidance-history@1',
      guidanceId: easyGuidance.id,
    })

    await expect(store.present(presentationOptions())).resolves.toEqual({
      kind: 'disabled',
    })
  })
})
