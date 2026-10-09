import type { FirebaseApp } from 'firebase/app'
import type {
  AppCheck,
  AppCheckOptions,
  AppCheckToken,
} from 'firebase/app-check'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AppCheckStartupError,
  createAppCheckInitializer,
} from './appCheckBootstrap'

const app = { name: '[DEFAULT]' } as FirebaseApp
const enterpriseProvider = {
  kind: 'enterprise',
} as unknown as AppCheckOptions['provider']
const nativeProvider = {
  kind: 'native',
} as unknown as AppCheckOptions['provider']
const appCheck = { app } as AppCheck

type AppCheckDebugGlobal = typeof globalThis & {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean
}

function createDependencies() {
  let nativeProviderGetToken: (() => Promise<AppCheckToken>) | null = null

  const dependencies = {
    createEnterpriseProvider: vi.fn(() => enterpriseProvider),
    createCustomProvider: vi.fn((providerGetToken: () => Promise<AppCheckToken>) => {
      nativeProviderGetToken = providerGetToken
      return nativeProvider
    }),
    initializeJsAppCheck: vi.fn(() => appCheck),
    getJsToken: vi.fn(async () => {
      if (nativeProviderGetToken !== null) await nativeProviderGetToken()
      return { token: 'js-app-check-token' }
    }),
    initializeNativeAppCheck: vi.fn(async () => undefined),
    getNativeToken: vi.fn(async () => ({
      token: 'native-app-check-token',
      expireTimeMillis: 2_000,
    })),
    now: vi.fn(() => 1_000),
    timeoutMs: 50,
  }

  return dependencies
}

beforeEach(() => {
  delete (globalThis as AppCheckDebugGlobal).FIREBASE_APPCHECK_DEBUG_TOKEN
})

describe('App Check bootstrap', () => {
  it('uses the selected Enterprise site key and proves a browser token', async () => {
    const dependencies = createDependencies()
    const initialize = createAppCheckInitializer(dependencies)

    await initialize({
      app,
      appCheckSiteKey: 'environment-specific-site-key',
      isNativePlatform: false,
    })

    expect(dependencies.createEnterpriseProvider).toHaveBeenCalledWith(
      'environment-specific-site-key',
    )
    expect(dependencies.initializeJsAppCheck).toHaveBeenCalledWith(app, {
      provider: enterpriseProvider,
      isTokenAutoRefreshEnabled: true,
    })
    expect(dependencies.getJsToken).toHaveBeenCalledWith(appCheck, true)
    expect(dependencies.initializeNativeAppCheck).not.toHaveBeenCalled()
  })

  it('feeds a native App Attest token through the JavaScript custom provider', async () => {
    const dependencies = createDependencies()
    const initialize = createAppCheckInitializer(dependencies)

    await initialize({
      app,
      appCheckSiteKey: 'unused-on-native',
      isNativePlatform: true,
    })

    expect(dependencies.initializeNativeAppCheck).toHaveBeenCalledOnce()
    expect(dependencies.createCustomProvider).toHaveBeenCalledOnce()
    expect(dependencies.getNativeToken).toHaveBeenCalledOnce()
    expect(dependencies.initializeJsAppCheck).toHaveBeenCalledWith(app, {
      provider: nativeProvider,
      isTokenAutoRefreshEnabled: true,
    })
  })

  it('rejects an expired native token without exposing it', async () => {
    const dependencies = createDependencies()
    dependencies.getNativeToken.mockResolvedValueOnce({
      token: 'must-not-appear-in-the-error',
      expireTimeMillis: 999,
    })
    const initialize = createAppCheckInitializer(dependencies)

    const result = initialize({
      app,
      appCheckSiteKey: 'unused-on-native',
      isNativePlatform: true,
    })

    await expect(result).rejects.toBeInstanceOf(AppCheckStartupError)
    await expect(result).rejects.not.toThrow('must-not-appear-in-the-error')
  })

  it('retries token proof without initializing App Check a second time', async () => {
    const dependencies = createDependencies()
    dependencies.getJsToken
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ token: 'recovered-token' })
    const initialize = createAppCheckInitializer(dependencies)
    const options = {
      app,
      appCheckSiteKey: 'environment-specific-site-key',
      isNativePlatform: false,
    }

    await expect(initialize(options)).rejects.toBeInstanceOf(
      AppCheckStartupError,
    )
    await expect(initialize(options)).resolves.toBeUndefined()

    expect(dependencies.initializeJsAppCheck).toHaveBeenCalledOnce()
    expect(dependencies.getJsToken).toHaveBeenCalledTimes(2)
  })

  it('performs a fresh native initialization after an asynchronous rejection', async () => {
    const dependencies = createDependencies()
    dependencies.initializeNativeAppCheck
      .mockRejectedValueOnce(new Error('native bridge unavailable'))
      .mockResolvedValueOnce(undefined)
    const initialize = createAppCheckInitializer(dependencies)
    const options = {
      app,
      appCheckSiteKey: 'unused-on-native',
      isNativePlatform: true,
    }

    await expect(initialize(options)).rejects.toBeInstanceOf(
      AppCheckStartupError,
    )
    await expect(initialize(options)).resolves.toBeUndefined()

    expect(dependencies.initializeNativeAppCheck).toHaveBeenCalledTimes(2)
  })

  it('performs a fresh native initialization after the first attempt times out', async () => {
    vi.useFakeTimers()
    const dependencies = createDependencies()
    dependencies.timeoutMs = 25
    dependencies.initializeNativeAppCheck
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce(undefined)
    const initialize = createAppCheckInitializer(dependencies)
    const options = {
      app,
      appCheckSiteKey: 'unused-on-native',
      isNativePlatform: true,
    }

    const firstAttempt = expect(initialize(options)).rejects.toBeInstanceOf(
      AppCheckStartupError,
    )
    await vi.advanceTimersByTimeAsync(24)
    expect(dependencies.initializeNativeAppCheck).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    await firstAttempt

    await expect(initialize(options)).resolves.toBeUndefined()

    expect(dependencies.initializeNativeAppCheck).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('turns a stalled provider into a bounded startup failure', async () => {
    vi.useFakeTimers()
    const dependencies = createDependencies()
    dependencies.timeoutMs = 25
    dependencies.getJsToken.mockReturnValueOnce(new Promise(() => undefined))
    const initialize = createAppCheckInitializer(dependencies)

    const assertion = expect(
      initialize({
        app,
        appCheckSiteKey: 'environment-specific-site-key',
        isNativePlatform: false,
      }),
    ).rejects.toBeInstanceOf(AppCheckStartupError)

    await vi.advanceTimersByTimeAsync(25)
    await assertion
    vi.useRealTimers()
  })

  it('accepts only the explicitly configured browser debug token', async () => {
    const dependencies = createDependencies()
    const initialize = createAppCheckInitializer(dependencies)
    const debugToken = '11111111-1111-4111-8111-111111111111'

    await initialize({
      app,
      appCheckSiteKey: 'environment-specific-site-key',
      debugToken,
      isNativePlatform: false,
    })

    expect(
      (globalThis as AppCheckDebugGlobal).FIREBASE_APPCHECK_DEBUG_TOKEN,
    ).toBe(debugToken)
  })

  it('rejects an implicit runtime debug token', async () => {
    const dependencies = createDependencies()
    const initialize = createAppCheckInitializer(dependencies)
    ;(globalThis as AppCheckDebugGlobal).FIREBASE_APPCHECK_DEBUG_TOKEN = true

    await expect(
      initialize({
        app,
        appCheckSiteKey: 'environment-specific-site-key',
        isNativePlatform: false,
      }),
    ).rejects.toBeInstanceOf(AppCheckStartupError)

    expect(dependencies.createEnterpriseProvider).not.toHaveBeenCalled()
  })

  it('rejects a runtime debug token from another environment', async () => {
    const dependencies = createDependencies()
    const initialize = createAppCheckInitializer(dependencies)
    ;(globalThis as AppCheckDebugGlobal).FIREBASE_APPCHECK_DEBUG_TOKEN =
      '22222222-2222-4222-8222-222222222222'

    await expect(
      initialize({
        app,
        appCheckSiteKey: 'environment-specific-site-key',
        debugToken: '11111111-1111-4111-8111-111111111111',
        isNativePlatform: false,
      }),
    ).rejects.toBeInstanceOf(AppCheckStartupError)

    expect(dependencies.createEnterpriseProvider).not.toHaveBeenCalled()
  })
})
