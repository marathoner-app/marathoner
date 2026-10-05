import { Capacitor, registerPlugin } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'

type StartupOverlayPlugin = {
  hide: () => Promise<void>
}

const StartupOverlay = registerPlugin<StartupOverlayPlugin>('StartupOverlay')

export function releaseNativeStartupOverlayAfterPaint() {
  if (!Capacitor.isNativePlatform()) {
    return () => undefined
  }

  let secondFrame: number | undefined
  const firstFrame = window.requestAnimationFrame(() => {
    secondFrame = window.requestAnimationFrame(() => {
      void Promise.all([
        StartupOverlay.hide(),
        SplashScreen.hide({ fadeOutDuration: 0 }),
      ]).catch((error: unknown) => {
        console.error('Unable to hide the native startup overlays.', error)
      })
    })
  })

  return () => {
    window.cancelAnimationFrame(firstFrame)
    if (secondFrame !== undefined) {
      window.cancelAnimationFrame(secondFrame)
    }
  }
}
