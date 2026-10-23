import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installIosDynamicType,
  resolveIosDynamicTypeRootFontSize,
} from './iosDynamicType'

afterEach(() => {
  document.documentElement.style.removeProperty('font-size')
})

describe('iOS Dynamic Type', () => {
  it('preserves supported body sizes and caps the root at the tested 200% boundary', () => {
    expect(resolveIosDynamicTypeRootFontSize(17)).toBe(17)
    expect(resolveIosDynamicTypeRootFontSize(53)).toBe(32)
    expect(resolveIosDynamicTypeRootFontSize(Number.NaN)).toBeNull()
  })

  it('applies the measured iOS body size and refreshes after returning to the app', () => {
    let preferredBodyFontSize = '17px'
    const getComputedStyle = vi.fn(
      () => ({ fontSize: preferredBodyFontSize }) as CSSStyleDeclaration,
    )
    const cleanup = installIosDynamicType({
      document,
      window,
      getComputedStyle,
      isIosNative: true,
    })

    expect(document.documentElement.style.fontSize).toBe('17px')
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull()

    preferredBodyFontSize = '53px'
    window.dispatchEvent(new FocusEvent('focus'))

    expect(document.documentElement.style.fontSize).toBe('32px')
    cleanup()
  })

  it('leaves the browser root unchanged', () => {
    const getComputedStyle = vi.fn()

    installIosDynamicType({
      document,
      window,
      getComputedStyle,
      isIosNative: false,
    })()

    expect(document.documentElement.style.fontSize).toBe('')
    expect(getComputedStyle).not.toHaveBeenCalled()
  })
})
