import { beforeEach, describe, expect, it, vi } from 'vitest'

const firebase = vi.hoisted(() => {
  const app = {
    name: '[DEFAULT]',
    options: {
      apiKey: 'development-ios-key',
      appId: 'development-app',
      projectId: 'development-project',
    },
  }
  const auth = { app }
  const firestore = { app }

  return {
    app,
    auth,
    firestore,
    getApp: vi.fn(() => app),
    getApps: vi.fn(() => [app].slice(0, 0)),
    getAuth: vi.fn(() => auth),
    initializeApp: vi.fn(() => app),
    initializeAuth: vi.fn(() => auth),
    initializeFirestore: vi.fn(() => firestore),
    indexedDbPersistence: { storage: 'indexedDB' },
    localStoragePersistence: { storage: 'localStorage' },
    memoryCache: { storage: 'memory' },
    memoryLocalCache: vi.fn(),
  }
})

vi.mock('firebase/app', () => ({
  getApp: firebase.getApp,
  getApps: firebase.getApps,
  initializeApp: firebase.initializeApp,
}))

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: firebase.localStoragePersistence,
  getAuth: firebase.getAuth,
  indexedDBLocalPersistence: firebase.indexedDbPersistence,
  initializeAuth: firebase.initializeAuth,
}))

vi.mock('firebase/firestore', () => ({
  initializeFirestore: firebase.initializeFirestore,
  memoryLocalCache: firebase.memoryLocalCache,
}))

import { createFirebaseClient } from './firebaseClientFactory'

const config = {
  apiKey: 'development-ios-key',
  appId: 'development-app',
  projectId: 'development-project',
}
const initializeAppCheck = vi.fn(async () => undefined)

describe('Firebase client factory', () => {
  beforeEach(() => {
    firebase.getApps.mockReturnValue([])
    vi.clearAllMocks()
  })

  it('initializes App Check, memory-only Firestore, then browser Auth', async () => {
    const order: string[] = []
    initializeAppCheck.mockImplementationOnce(async () => {
      order.push('app-check')
    })
    firebase.memoryLocalCache.mockImplementationOnce(() => {
      order.push('memory-cache')
      return firebase.memoryCache
    })
    firebase.initializeFirestore.mockImplementationOnce(() => {
      order.push('firestore')
      return firebase.firestore
    })
    firebase.getAuth.mockImplementationOnce(() => {
      order.push('auth')
      return firebase.auth
    })

    await expect(
      createFirebaseClient(config, false, initializeAppCheck),
    ).resolves.toEqual({
      app: firebase.app,
      auth: firebase.auth,
      firestore: firebase.firestore,
    })
    expect(order).toEqual([
      'app-check',
      'memory-cache',
      'firestore',
      'auth',
    ])
    expect(firebase.initializeApp).toHaveBeenCalledWith(config)
    expect(firebase.initializeFirestore).toHaveBeenCalledWith(firebase.app, {
      localCache: firebase.memoryCache,
    })
    expect(firebase.getAuth).toHaveBeenCalledWith(firebase.app)
    expect(firebase.initializeAuth).not.toHaveBeenCalled()
  })

  it('uses durable IndexedDB-first persistence in a native shell', async () => {
    await createFirebaseClient(config, true, initializeAppCheck)

    expect(firebase.initializeAuth).toHaveBeenCalledWith(firebase.app, {
      persistence: [
        firebase.indexedDbPersistence,
        firebase.localStoragePersistence,
      ],
    })
    expect(firebase.getAuth).not.toHaveBeenCalled()
  })

  it('reuses a matching default Firebase app with the reviewed native Auth persistence', async () => {
    firebase.getApps.mockReturnValue([firebase.app])

    await expect(
      createFirebaseClient(config, true, initializeAppCheck),
    ).resolves.toEqual({
      app: firebase.app,
      auth: firebase.auth,
      firestore: firebase.firestore,
    })
    expect(firebase.initializeApp).not.toHaveBeenCalled()
    expect(firebase.initializeAuth).toHaveBeenCalledWith(firebase.app, {
      persistence: [
        firebase.indexedDbPersistence,
        firebase.localStoragePersistence,
      ],
    })
    expect(firebase.getAuth).not.toHaveBeenCalled()
  })

  it('keeps native persistence when retrying after App Check leaves only the app initialized', async () => {
    firebase.getApps
      .mockReturnValueOnce([])
      .mockReturnValueOnce([firebase.app])
    initializeAppCheck
      .mockRejectedValueOnce(new Error('first attestation attempt failed'))
      .mockResolvedValueOnce(undefined)

    await expect(
      createFirebaseClient(config, true, initializeAppCheck),
    ).rejects.toThrow('first attestation attempt failed')
    await expect(
      createFirebaseClient(config, true, initializeAppCheck),
    ).resolves.toEqual({
      app: firebase.app,
      auth: firebase.auth,
      firestore: firebase.firestore,
    })

    expect(firebase.initializeApp).toHaveBeenCalledOnce()
    expect(firebase.initializeAuth).toHaveBeenCalledOnce()
    expect(firebase.initializeAuth).toHaveBeenCalledWith(firebase.app, {
      persistence: [
        firebase.indexedDbPersistence,
        firebase.localStoragePersistence,
      ],
    })
    expect(firebase.getAuth).not.toHaveBeenCalled()
  })

  it('fails closed when an existing app targets another environment', async () => {
    firebase.getApps.mockReturnValue([
      {
        ...firebase.app,
        options: { ...firebase.app.options, projectId: 'unexpected-project' },
      },
    ])

    await expect(
      createFirebaseClient(config, true, initializeAppCheck),
    ).rejects.toThrow('does not match the selected projectId')
    expect(initializeAppCheck).not.toHaveBeenCalled()
    expect(firebase.getAuth).not.toHaveBeenCalled()
  })

  it('does not acquire Auth when App Check startup fails', async () => {
    initializeAppCheck.mockRejectedValueOnce(new Error('attestation failed'))

    await expect(
      createFirebaseClient(config, false, initializeAppCheck),
    ).rejects.toThrow('attestation failed')

    expect(firebase.getAuth).not.toHaveBeenCalled()
    expect(firebase.initializeAuth).not.toHaveBeenCalled()
  })
})
