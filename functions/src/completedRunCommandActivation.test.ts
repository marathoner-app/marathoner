import { describe, expect, it } from 'vitest'

import {
  BETA_COMPLETED_RUN_COMMAND_PROJECT_ID,
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

  it('requires the exact beta project and explicit live activation together', () => {
    expect(
      shouldInstallCompletedRunCommandStores({
        activationEnabled: true,
        functionsEmulator: false,
        projectId: BETA_COMPLETED_RUN_COMMAND_PROJECT_ID,
      }),
    ).toBe(true)

    for (const scenario of [
      { activationEnabled: false, projectId: BETA_COMPLETED_RUN_COMMAND_PROJECT_ID },
      { activationEnabled: true, projectId: 'marathoner-d9bf9' },
      { activationEnabled: true, projectId: '' },
      { activationEnabled: true, projectId: 'unknown-project' },
    ]) {
      expect(
        shouldInstallCompletedRunCommandStores({
          ...scenario,
          functionsEmulator: false,
        }),
      ).toBe(false)
    }
  })
})
