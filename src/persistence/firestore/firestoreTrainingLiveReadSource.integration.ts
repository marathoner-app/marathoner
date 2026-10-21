import { readFile } from 'node:fs/promises'
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  disableNetwork,
  enableNetwork,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
  type UserId,
} from '../../domain/training'
import {
  createTrainingSynchronizationKernel,
  reduceTrainingSynchronization,
  type TrainingSynchronizationKernel,
} from '../../training/trainingSynchronization'
import { createDocumentTrainingRepositories } from '../documentTrainingRepositories'
import { FirestoreDocumentStore } from './firestoreDocumentStore'
import {
  createFirebaseTrainingListenerBackend,
  createFirestoreTrainingLiveReadSourceWithBackend,
} from './firestoreTrainingLiveReadSource'

const projectId = 'demo-marathoner-live-read'
const ownerId = createUserId('runner-one')
const otherOwnerId = createUserId('runner-two')
const observedAt = createUtcDateTime('2026-10-21T18:00:00Z')
const timeZone = createIanaTimeZone('America/Los_Angeles')

let testEnvironment: RulesTestEnvironment

function authenticatedDatabase(userId: UserId): Firestore {
  return testEnvironment.authenticatedContext(userId)
    .firestore() as unknown as Firestore
}

function createHarness(database: Firestore, userId: UserId, generation = 1) {
  let kernel = createTrainingSynchronizationKernel({
    ownerId: userId,
    sessionGeneration: generation,
  })
  let batchCount = 0
  const source = createFirestoreTrainingLiveReadSourceWithBackend({
    backend: createFirebaseTrainingListenerBackend(database),
    ownerId: userId,
    sessionGeneration: generation,
    clock: () => observedAt,
  })
  const unsubscribe = source.subscribe((events) => {
    batchCount += 1
    kernel = events.reduce(reduceTrainingSynchronization, kernel)
  })

  return {
    get batchCount() {
      return batchCount
    },
    get kernel(): TrainingSynchronizationKernel {
      return kernel
    },
    unsubscribe,
  }
}

function repositories(database: Firestore, userId: UserId) {
  return createDocumentTrainingRepositories(
    new FirestoreDocumentStore(database),
    userId,
    () => observedAt,
  )
}

async function saveProfile(database: Firestore, userId: UserId, name: string) {
  await repositories(database, userId).profile.save({
    displayName: name,
    preferredDistanceUnit: 'mile',
    timeZone,
    experienceLevel: 'consistent',
    currentRunningFrequencyDaysPerWeek: 4,
    completionGoal: 'complete_first_marathon',
  })
}

function visibleProfileName(harness: ReturnType<typeof createHarness>) {
  const { state } = harness.kernel
  return 'snapshot' in state ? state.snapshot?.profile?.displayName : undefined
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile('firestore.rules', 'utf8'),
    },
  })
})

beforeEach(async () => {
  await testEnvironment.clearFirestore()
})

afterAll(async () => {
  await testEnvironment.cleanup()
})

describe('Firestore training live-read integration', () => {
  it('delivers a second authenticated client commit without reloading', async () => {
    const reader = authenticatedDatabase(ownerId)
    const writer = authenticatedDatabase(ownerId)
    const harness = createHarness(reader, ownerId)

    await expect
      .poll(() => harness.kernel.state.status, { timeout: 5_000 })
      .toBe('current')
    expect(visibleProfileName(harness)).toBeUndefined()

    await saveProfile(writer, ownerId, 'Second client update')

    await expect
      .poll(() => visibleProfileName(harness), { timeout: 5_000 })
      .toBe('Second client update')
    expect(harness.kernel.state.status).toBe('current')
    harness.unsubscribe()
  })

  it('becomes stale while offline and current after server-confirmed reconnection', async () => {
    const reader = authenticatedDatabase(ownerId)
    const writer = authenticatedDatabase(ownerId)
    const harness = createHarness(reader, ownerId)

    await expect
      .poll(() => harness.kernel.state.status, { timeout: 5_000 })
      .toBe('current')

    try {
      await disableNetwork(reader)
      await expect
        .poll(() => harness.kernel.state.status, { timeout: 5_000 })
        .toBe('stale')

      await saveProfile(writer, ownerId, 'Server update while offline')
      expect(visibleProfileName(harness)).toBeUndefined()

      await enableNetwork(reader)
      await expect
        .poll(() => visibleProfileName(harness), { timeout: 5_000 })
        .toBe('Server update while offline')
      expect(harness.kernel.state.status).toBe('current')
    } finally {
      await enableNetwork(reader)
      harness.unsubscribe()
    }
  })

  it('keeps owners isolated and stops delivery after teardown', async () => {
    const ownerReader = authenticatedDatabase(ownerId)
    const otherReader = authenticatedDatabase(otherOwnerId)
    const ownerWriter = authenticatedDatabase(ownerId)
    const otherWriter = authenticatedDatabase(otherOwnerId)
    const ownerHarness = createHarness(ownerReader, ownerId)
    const otherHarness = createHarness(otherReader, otherOwnerId)

    await expect
      .poll(() => ownerHarness.kernel.state.status, { timeout: 5_000 })
      .toBe('current')
    await expect
      .poll(() => otherHarness.kernel.state.status, { timeout: 5_000 })
      .toBe('current')
    await saveProfile(ownerWriter, ownerId, 'Owner one')

    await expect
      .poll(() => visibleProfileName(ownerHarness), { timeout: 5_000 })
      .toBe('Owner one')
    expect(visibleProfileName(otherHarness)).toBeUndefined()

    const batchesBeforeTeardown = ownerHarness.batchCount
    ownerHarness.unsubscribe()
    await saveProfile(ownerWriter, ownerId, 'Late owner update')
    await saveProfile(otherWriter, otherOwnerId, 'Owner two')

    await expect
      .poll(() => visibleProfileName(otherHarness), { timeout: 5_000 })
      .toBe('Owner two')
    expect(ownerHarness.batchCount).toBe(batchesBeforeTeardown)
    expect(visibleProfileName(ownerHarness)).toBe('Owner one')
    otherHarness.unsubscribe()
  })
})
