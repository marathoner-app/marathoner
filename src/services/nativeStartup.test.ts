import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
}))
const splashScreen = vi.hoisted(() => ({
  hide: vi.fn(),
}))
const startupOverlay = vi.hoisted(() => ({
  hide: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: () => startupOverlay,
}))
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: splashScreen }))

import { releaseNativeStartupOverlayAfterPaint } from './nativeStartup'

describe('native startup overlay', () => {
  beforeEach(() => {
    capacitor.isNativePlatform.mockReturnValue(false)
    splashScreen.hide.mockResolvedValue(undefined)
    startupOverlay.hide.mockResolvedValue(undefined)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does nothing in a browser build', () => {
    releaseNativeStartupOverlayAfterPaint()
    vi.runAllTimers()

    expect(splashScreen.hide).not.toHaveBeenCalled()
    expect(startupOverlay.hide).not.toHaveBeenCalled()
  })

  it('keeps the native overlay through the first React paint', async () => {
    capacitor.isNativePlatform.mockReturnValue(true)

    releaseNativeStartupOverlayAfterPaint()
    expect(splashScreen.hide).not.toHaveBeenCalled()
    expect(startupOverlay.hide).not.toHaveBeenCalled()

    vi.advanceTimersToNextFrame()
    expect(splashScreen.hide).not.toHaveBeenCalled()
    expect(startupOverlay.hide).not.toHaveBeenCalled()

    vi.advanceTimersToNextFrame()
    await Promise.resolve()

    expect(splashScreen.hide).toHaveBeenCalledWith({ fadeOutDuration: 0 })
    expect(startupOverlay.hide).toHaveBeenCalledOnce()
  })
})
