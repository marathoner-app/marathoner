import { afterEach, describe, expect, it, vi } from 'vitest'

const { browserOpen, isNativePlatform } = vi.hoisted(() => ({
  browserOpen: vi.fn(),
  isNativePlatform: vi.fn(),
}))

vi.mock('@capacitor/browser', () => ({
  Browser: { open: browserOpen },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform },
}))

import { systemExternalAuthorizationLauncher } from './externalAuthorizationLauncher'

afterEach(() => {
  vi.restoreAllMocks()
  browserOpen.mockReset()
  isNativePlatform.mockReset()
})

describe('systemExternalAuthorizationLauncher', () => {
  it('opens authorization in the native browser without preparing a web popup', async () => {
    isNativePlatform.mockReturnValue(true)
    const windowOpen = vi.spyOn(window, 'open')

    const target = systemExternalAuthorizationLauncher.prepare()

    expect(target).not.toBeNull()
    await target?.open('https://provider.invalid/authorize')
    expect(browserOpen).toHaveBeenCalledWith({
      url: 'https://provider.invalid/authorize',
    })
    expect(windowOpen).not.toHaveBeenCalled()
  })

  it('prepares and navigates a web popup before asynchronous authorization work', async () => {
    isNativePlatform.mockReturnValue(false)
    const replace = vi.fn()
    const close = vi.fn()
    const authorizationWindow = {
      close,
      location: { replace },
      opener: window,
    } as unknown as Window
    vi.spyOn(window, 'open').mockReturnValue(authorizationWindow)

    const target = systemExternalAuthorizationLauncher.prepare()

    expect(window.open).toHaveBeenCalledWith('', '_blank')
    expect(authorizationWindow.opener).toBeNull()
    await target?.open('https://provider.invalid/authorize')
    expect(replace).toHaveBeenCalledWith('https://provider.invalid/authorize')
    target?.cancel()
    expect(close).toHaveBeenCalledOnce()
  })

  it('reports a blocked web popup without creating a target', () => {
    isNativePlatform.mockReturnValue(false)
    vi.spyOn(window, 'open').mockReturnValue(null)

    expect(systemExternalAuthorizationLauncher.prepare()).toBeNull()
  })
})
