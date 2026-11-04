import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'

export interface ExternalAuthorizationTarget {
  cancel: () => void
  open: (url: string) => Promise<void>
}

export interface ExternalAuthorizationLauncher {
  prepare: () => ExternalAuthorizationTarget | null
}

export const systemExternalAuthorizationLauncher: ExternalAuthorizationLauncher = {
  prepare: () => {
    if (Capacitor.isNativePlatform()) {
      return {
        cancel: () => undefined,
        open: async (url) => {
          await Browser.open({ url })
        },
      }
    }

    const authorizationWindow = window.open('', '_blank')
    if (authorizationWindow === null) return null

    authorizationWindow.opener = null
    return {
      cancel: () => authorizationWindow.close(),
      open: async (url) => {
        authorizationWindow.location.replace(url)
      },
    }
  },
}
