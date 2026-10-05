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

  return {
    app,
    auth,
    getApp: vi.fn(() => app),
    getApps: vi.fn(() => [app].slice(0, 0)),
    getAuth: vi.fn(() => auth),
    initializeApp: vi.fn(() => app),
    initializeAuth: vi.fn(() => auth),
    indexedDbPersistence: { storage: 'indexedDB' },
    localStoragePersistence: { storage: 'localStorage' },
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

import { createFirebaseClient } from './firebaseClientFactory'

const config = {
  apiKey: 'development-ios-key',
  appId: 'development-app',
  projectId: 'development-project',
}

describe('Firebase client factory', () => {
  beforeEach(() => {
    firebase.getApps.mockReturnValue([])
    vi.clearAllMocks()
  })

  it('preserves the browser Auth initialization path', () => {
    expect(createFirebaseClient(config, false)).toEqual({
      app: firebase.app,
      auth: firebase.auth,
    })
    expect(firebase.initializeApp).toHaveBeenCalledWith(config)
    expect(firebase.getAuth).toHaveBeenCalledWith(firebase.app)
    expect(firebase.initializeAuth).not.toHaveBeenCalled()
  })

  it('uses durable IndexedDB-first persistence in a native shell', () => {
    createFirebaseClient(config, true)

    expect(firebase.initializeAuth).toHaveBeenCalledWith(firebase.app, {
      persistence: [
        firebase.indexedDbPersistence,
        firebase.localStoragePersistence,
      ],
    })
    expect(firebase.getAuth).not.toHaveBeenCalled()
  })

  it('reuses only a matching default Firebase app', () => {
    firebase.getApps.mockReturnValue([firebase.app])

    expect(createFirebaseClient(config, true)).toEqual({
      app: firebase.app,
      auth: firebase.auth,
    })
    expect(firebase.initializeApp).not.toHaveBeenCalled()
    expect(firebase.initializeAuth).not.toHaveBeenCalled()
    expect(firebase.getAuth).toHaveBeenCalledWith(firebase.app)
  })

  it('fails closed when an existing app targets another environment', () => {
    firebase.getApps.mockReturnValue([
      {
        ...firebase.app,
        options: { ...firebase.app.options, projectId: 'unexpected-project' },
      },
    ])

    expect(() => createFirebaseClient(config, true)).toThrow(
      'does not match the selected projectId',
    )
  })
})
