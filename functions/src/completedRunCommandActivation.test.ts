import { describe, expect, it } from 'vitest'

import {
  BETA_COMPLETED_RUN_COMMAND_PROJECT_ID,
  DEVELOPMENT_COMPLETED_RUN_COMMAND_PROJECT_ID,
  shouldInstallCompletedRunCommandStores,
} from './completedRunCommandActivation.js'

describe('completed-run command activation', () => {
  it('keeps the existing emulator path enabled without live configuration', () => {
    expect(
      shouldInstallCompletedRunCommandStores({
        activationEnabled: false,
        functionsEmulator: true,
        projectId: 'demo-marathoner',
      }),
    ).toBe(true)
  })

  it.each([
    BETA_COMPLETED_RUN_COMMAND_PROJECT_ID,
    DEVELOPMENT_COMPLETED_RUN_COMMAND_PROJECT_ID,
  ])(
    'requires explicit live activation in reviewed project %s',
    (projectId) => {
      expect(
        shouldInstallCompletedRunCommandStores({
          activationEnabled: true,
          functionsEmulator: false,
          projectId,
        }),
      ).toBe(true)

      expect(
        shouldInstallCompletedRunCommandStores({
          activationEnabled: false,
          functionsEmulator: false,
          projectId,
        }),
      ).toBe(false)
    },
  )

  it.each(['', 'unknown-project', 'marathoner-preview'])(
    'rejects unreviewed live project %s even with activation enabled',
    (projectId) => {
      expect(
        shouldInstallCompletedRunCommandStores({
          activationEnabled: true,
          functionsEmulator: false,
          projectId,
        }),
      ).toBe(false)
    },
  )
})
