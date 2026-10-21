import { describe, expect, it } from 'vitest'

import { findTrainingCachePolicyViolations } from './training-cache-policy.mjs'

const memoryOnlyFactory = `
  import { initializeFirestore, memoryLocalCache } from 'firebase/firestore'
  const firestore = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  })
`

describe('training cache policy', () => {
  it('accepts explicit memory-only Firestore with no training storage adapter', () => {
    expect(
      findTrainingCachePolicyViolations({
        firebaseClientFactory: memoryOnlyFactory,
        trainingSources: new Map([
          ['src/training/provider.ts', 'export const provider = {}'],
        ]),
      }),
    ).toEqual([])
  })

  it.each([
    'persistentLocalCache',
    'persistentSingleTabManager',
    'persistentMultipleTabManager',
    'enableIndexedDbPersistence',
    'enableMultiTabIndexedDbPersistence',
  ])('rejects the durable Firestore API %s', (api) => {
    expect(
      findTrainingCachePolicyViolations({
        firebaseClientFactory: `${memoryOnlyFactory}\n${api}()`,
        trainingSources: new Map(),
      }),
    ).toContain(`Firebase client contains forbidden ${api}`)
  })

  it.each(['localStorage', 'sessionStorage', 'indexedDB', 'AsyncStorage', 'SQLite'])(
    'rejects a training snapshot path through %s',
    (storage) => {
      expect(
        findTrainingCachePolicyViolations({
          firebaseClientFactory: memoryOnlyFactory,
          trainingSources: new Map([
            ['src/training/cache.ts', `${storage}.setItem('training', data)`],
          ]),
        }),
      ).toContain(
        `src/training/cache.ts contains forbidden durable storage ${storage}`,
      )
    },
  )

  it('rejects an implicit or missing Firestore cache choice', () => {
    expect(
      findTrainingCachePolicyViolations({
        firebaseClientFactory: 'const firestore = getFirestore(app)',
        trainingSources: new Map(),
      }),
    ).toEqual([
      'Firebase client does not import memoryLocalCache',
      'Firestore is not initialized with memoryLocalCache()',
    ])
  })
})
