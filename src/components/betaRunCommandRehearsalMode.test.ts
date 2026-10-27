import { describe, expect, it } from 'vitest'

import { isBetaRunCommandRehearsalMode } from './betaRunCommandRehearsalMode'

describe('beta run-command rehearsal mode', () => {
  it('is available only to explicit owner iOS builds', () => {
    expect(isBetaRunCommandRehearsalMode('ios-development')).toBe(true)
    expect(isBetaRunCommandRehearsalMode('ios-beta')).toBe(true)
    expect(isBetaRunCommandRehearsalMode('production')).toBe(false)
    expect(isBetaRunCommandRehearsalMode('development')).toBe(false)
    expect(isBetaRunCommandRehearsalMode('test')).toBe(false)
  })
})
