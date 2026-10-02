import { beforeEach, describe, expect, it, vi } from 'vitest'

const firebase = vi.hoisted(() => {
  const app = { name: 'marathoner-capacitor-auth-spike' }
  const auth = { app }
  const indexedDbPersistence = { type: 'LOCAL', storage: 'indexedDB' }
  const localStoragePersistence = { type: 'LOCAL', storage: 'localStorage' }

  return {
    app,
    auth,
    indexedDbPersistence,
    localStoragePersistence,
    getApp: vi.fn(() => app),
    getApps: vi.fn(() => []),
    getAuth: vi.fn(() => auth),
    initializeApp: vi.fn(() => app),
    initializeAuth: vi.fn(() => auth),
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

vi.mock('./selectedFirebaseEnvironment', () => ({
  selectedFirebaseEnvironment: {
    config: {
      apiKey: 'mobile-key',
      authDomain: 'marathoner-d9bf9.firebaseapp.com',
      projectId: 'marathoner-d9bf9',
      appId: 'mobile-app',
    },
  },
}))

import { createMobileAuth } from './firebaseClient'

describe('Capacitor Firebase authentication client', () => {
  beforeEach(() => {
    firebase.getApps.mockReturnValue([])
    firebase.initializeApp.mockClear()
    firebase.initializeAuth.mockClear()
    firebase.getAuth.mockClear()
  })

  it('initializes Auth with durable WebView persistence and a fallback', () => {
    const config = {
      apiKey: 'mobile-key',
      authDomain: 'marathoner-d9bf9.firebaseapp.com',
      projectId: 'marathoner-d9bf9',
      appId: 'mobile-app',
    }

    expect(createMobileAuth(config)).toBe(firebase.auth)
    expect(firebase.initializeApp).toHaveBeenCalledWith(
      config,
      'marathoner-capacitor-auth-spike',
    )
    expect(firebase.initializeAuth).toHaveBeenCalledWith(firebase.app, {
      persistence: [
        firebase.indexedDbPersistence,
        firebase.localStoragePersistence,
      ],
    })
    expect(firebase.getAuth).not.toHaveBeenCalled()
  })
})
