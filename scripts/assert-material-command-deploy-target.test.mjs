import { describe, expect, it } from 'vitest'

import { assertMaterialCommandDeployTarget } from './assert-material-command-deploy-target.mjs'

describe('material-command deployment guard', () => {
  it('blocks missing, development, and beta projects while issue #158 is emulator-only', () => {
    expect(() =>
      assertMaterialCommandDeployTarget({
        actualProjectId: undefined,
        approvedProjectIds: [],
      }),
    ).toThrow('GCLOUD_PROJECT is missing')

    for (const actualProjectId of ['marathoner-d9bf9', 'marathonerapp-beta']) {
      expect(() =>
        assertMaterialCommandDeployTarget({
          actualProjectId,
          approvedProjectIds: [],
        }),
      ).toThrow('Issue #158 is local-emulator-only')
    }
  })

  it('requires a later reviewed change to name an exact approved project', () => {
    expect(() =>
      assertMaterialCommandDeployTarget({
        actualProjectId: 'reviewed-project',
        approvedProjectIds: ['reviewed-project'],
      }),
    ).not.toThrow()
  })
})
