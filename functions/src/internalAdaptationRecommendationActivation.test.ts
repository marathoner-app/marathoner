import { describe, expect, it } from 'vitest'

import {
  DEVELOPMENT_INTERNAL_ADAPTATION_PROJECT_ID,
  shouldEnableInternalAdaptationRecommendations,
} from './internalAdaptationRecommendationActivation.js'

describe('internal adaptation recommendation activation', () => {
  it('keeps deterministic emulator exercise available without live activation', () => {
    expect(
      shouldEnableInternalAdaptationRecommendations({
        activationEnabled: false,
        functionsEmulator: true,
        projectId: 'demo-marathoner',
      }),
    ).toBe(true)
  })

  it('requires explicit activation in the development dogfood project', () => {
    expect(
      shouldEnableInternalAdaptationRecommendations({
        activationEnabled: true,
        functionsEmulator: false,
        projectId: DEVELOPMENT_INTERNAL_ADAPTATION_PROJECT_ID,
      }),
    ).toBe(true)

    expect(
      shouldEnableInternalAdaptationRecommendations({
        activationEnabled: false,
        functionsEmulator: false,
        projectId: DEVELOPMENT_INTERNAL_ADAPTATION_PROJECT_ID,
      }),
    ).toBe(false)
  })

  it.each(['marathonerapp-beta', '', 'unknown-project'])(
    'rejects non-development live project %s even when activated',
    (projectId) => {
      expect(
        shouldEnableInternalAdaptationRecommendations({
          activationEnabled: true,
          functionsEmulator: false,
          projectId,
        }),
      ).toBe(false)
    },
  )
})
