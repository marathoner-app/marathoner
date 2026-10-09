import { FirebaseAppCheck } from '@capacitor-firebase/app-check'
import type { FirebaseApp } from 'firebase/app'
import {
  CustomProvider,
  ReCaptchaEnterpriseProvider,
  getToken,
  initializeAppCheck,
  type AppCheck,
  type AppCheckOptions,
  type AppCheckToken,
} from 'firebase/app-check'

export const appCheckStartupTimeoutMs = 10_000
export const appCheckStartupMessage =
  "Marathoner couldn't verify this app. Check your connection, make sure you're using the current build, and try again."

type AppCheckProvider = AppCheckOptions['provider']

interface NativeTokenResult {
  token: string
  expireTimeMillis?: number
}

interface AppCheckBootstrapDependencies {
  createEnterpriseProvider: (siteKey: string) => AppCheckProvider
  createCustomProvider: (
    getToken: () => Promise<AppCheckToken>,
  ) => AppCheckProvider
  initializeJsAppCheck: (
    app: FirebaseApp,
    options: AppCheckOptions,
  ) => AppCheck
  getJsToken: (
    appCheck: AppCheck,
    forceRefresh: boolean,
  ) => Promise<{ token: string }>
  initializeNativeAppCheck: () => Promise<void>
  getNativeToken: () => Promise<NativeTokenResult>
  now: () => number
  timeoutMs: number
}

export interface AppCheckBootstrapOptions {
  app: FirebaseApp
  appCheckSiteKey: string
  debugToken?: string
  isNativePlatform: boolean
}

export class AppCheckStartupError extends Error {
  readonly cause: unknown

  constructor(cause: unknown) {
    super(appCheckStartupMessage)
    this.name = 'AppCheckStartupError'
    this.cause = cause
  }
}

type AppCheckDebugGlobal = typeof globalThis & {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean
}

function configureDebugToken(debugToken: string | undefined): void {
  const debugGlobal = globalThis as AppCheckDebugGlobal
  const existingDebugToken = debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN

  if (debugToken) {
    if (
      existingDebugToken !== undefined &&
      existingDebugToken !== debugToken
    ) {
      throw new Error(
        'App Check found a debug token that does not match the explicit local configuration.',
      )
    }

    debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken
    return
  }

  if (existingDebugToken !== undefined && existingDebugToken !== false) {
    throw new Error(
      'App Check debug mode is active without explicit local configuration.',
    )
  }
}

function requireToken(token: string): string {
  if (typeof token !== 'string' || token.trim() === '') {
    throw new Error('App Check returned an empty token.')
  }

  return token
}

function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      reject(new Error('App Check startup timed out.'))
    }, timeoutMs)

    operation.then(
      (result) => {
        globalThis.clearTimeout(timeout)
        resolve(result)
      },
      (error: unknown) => {
        globalThis.clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

const defaultDependencies: AppCheckBootstrapDependencies = {
  createEnterpriseProvider: (siteKey) =>
    new ReCaptchaEnterpriseProvider(siteKey),
  createCustomProvider: (providerGetToken) =>
    new CustomProvider({ getToken: providerGetToken }),
  initializeJsAppCheck: (app, options) => initializeAppCheck(app, options),
  getJsToken: (appCheck, forceRefresh) =>
    getToken(appCheck, forceRefresh),
  initializeNativeAppCheck: () =>
    FirebaseAppCheck.initialize({ isTokenAutoRefreshEnabled: true }),
  getNativeToken: () => FirebaseAppCheck.getToken({ forceRefresh: false }),
  now: () => Date.now(),
  timeoutMs: appCheckStartupTimeoutMs,
}

export function createAppCheckInitializer(
  dependencies: AppCheckBootstrapDependencies = defaultDependencies,
) {
  let initializedApp: FirebaseApp | null = null
  let appCheck: AppCheck | null = null
  let nativeInitialization: Promise<void> | null = null

  return async function initializeAppCheckBeforeServices({
    app,
    appCheckSiteKey,
    debugToken,
    isNativePlatform,
  }: AppCheckBootstrapOptions): Promise<void> {
    try {
      if (appCheckSiteKey.trim() === '') {
        throw new Error('The selected App Check site key is missing.')
      }

      configureDebugToken(debugToken)

      if (initializedApp !== null && initializedApp !== app) {
        throw new Error(
          'App Check cannot reuse an initializer for a different Firebase app.',
        )
      }

      if (appCheck === null) {
        let provider: AppCheckProvider

        if (isNativePlatform) {
          if (debugToken) {
            throw new Error(
              'Browser App Check debug tokens cannot initialize the native provider.',
            )
          }

          if (nativeInitialization === null) {
            const initializationAttempt =
              dependencies.initializeNativeAppCheck()
            const trackedInitialization = initializationAttempt.catch(
              (error: unknown) => {
                if (nativeInitialization === trackedInitialization) {
                  nativeInitialization = null
                }
                throw error
              },
            )
            nativeInitialization = trackedInitialization
          }

          const currentInitialization = nativeInitialization
          try {
            await withTimeout(
              currentInitialization,
              dependencies.timeoutMs,
            )
          } catch (error) {
            if (nativeInitialization === currentInitialization) {
              nativeInitialization = null
            }
            throw error
          }

          provider = dependencies.createCustomProvider(async () => {
            const nativeToken = await dependencies.getNativeToken()
            const expireTimeMillis = nativeToken.expireTimeMillis

            if (
              typeof expireTimeMillis !== 'number' ||
              expireTimeMillis <= dependencies.now()
            ) {
              throw new Error(
                'The native App Check token has no valid expiration time.',
              )
            }

            return {
              token: requireToken(nativeToken.token),
              expireTimeMillis,
            }
          })
        } else {
          provider = dependencies.createEnterpriseProvider(appCheckSiteKey)
        }

        appCheck = dependencies.initializeJsAppCheck(app, {
          provider,
          isTokenAutoRefreshEnabled: true,
        })
        initializedApp = app
      }

      const tokenResult = await withTimeout(
        dependencies.getJsToken(appCheck, true),
        dependencies.timeoutMs,
      )
      requireToken(tokenResult.token)
    } catch (error) {
      throw error instanceof AppCheckStartupError
        ? error
        : new AppCheckStartupError(error)
    }
  }
}

export const initializeAppCheckBeforeServices = createAppCheckInitializer()
