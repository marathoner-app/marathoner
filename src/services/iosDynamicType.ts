import { Capacitor } from '@capacitor/core'

const maximumRootFontSizePx = 32

type DynamicTypeEnvironment = {
  document: Document
  window: Window
  getComputedStyle: typeof window.getComputedStyle
  isIosNative: boolean
}

const resolveEnvironment = (): DynamicTypeEnvironment => ({
  document,
  window,
  getComputedStyle: window.getComputedStyle.bind(window),
  isIosNative:
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios',
})

export const resolveIosDynamicTypeRootFontSize = (
  preferredBodyFontSizePx: number,
): number | null => {
  if (!Number.isFinite(preferredBodyFontSizePx) || preferredBodyFontSizePx <= 0) {
    return null
  }

  return Math.min(preferredBodyFontSizePx, maximumRootFontSizePx)
}

const readPreferredBodyFontSize = (
  environment: DynamicTypeEnvironment,
): number | null => {
  const probe = environment.document.createElement('span')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = [
    'font: -apple-system-body',
    'position: absolute',
    'visibility: hidden',
    'pointer-events: none',
  ].join(';')
  environment.document.body.append(probe)

  const preferredBodyFontSizePx = Number.parseFloat(
    environment.getComputedStyle(probe).fontSize,
  )
  probe.remove()

  return resolveIosDynamicTypeRootFontSize(preferredBodyFontSizePx)
}

const applyIosDynamicType = (environment: DynamicTypeEnvironment): void => {
  const rootFontSizePx = readPreferredBodyFontSize(environment)
  if (rootFontSizePx === null) return

  environment.document.documentElement.style.fontSize = `${rootFontSizePx}px`
}

export const installIosDynamicType = (
  environment: DynamicTypeEnvironment = resolveEnvironment(),
): (() => void) => {
  if (!environment.isIosNative) return () => undefined

  const refreshWhenVisible = () => {
    if (environment.document.visibilityState === 'visible') {
      applyIosDynamicType(environment)
    }
  }

  applyIosDynamicType(environment)
  environment.document.addEventListener('visibilitychange', refreshWhenVisible)
  environment.window.addEventListener('focus', refreshWhenVisible)

  return () => {
    environment.document.removeEventListener(
      'visibilitychange',
      refreshWhenVisible,
    )
    environment.window.removeEventListener('focus', refreshWhenVisible)
  }
}
