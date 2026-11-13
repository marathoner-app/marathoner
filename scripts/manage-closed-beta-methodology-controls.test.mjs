import { describe, expect, it } from 'vitest'

import {
  CONTROL_CONFIRMATIONS,
  GUIDANCE_CONTROL_PATH,
  METHODOLOGY_CONTROL_PATH,
  assertGuidanceControl,
  assertMethodologyControl,
  createControlCommitWrites,
  createInitialControlDocuments,
  parseControlArguments,
  transitionControlDocuments,
  upgradeControlDocuments,
} from './manage-closed-beta-methodology-controls.mjs'

const manifest = {
  manifestVersion: 'closed-beta-provisional-methodology@0.2.0',
  artifacts: [
    { kind: 'plan', version: 'plan@1' },
    { kind: 'adaptation', version: 'adaptation@1' },
    { kind: 'guidance', version: 'guidance@1' },
    { kind: 'safety', version: 'safety@1' },
  ],
}
const previousManifest = {
  manifestVersion: 'closed-beta-provisional-methodology@0.1.0',
  artifacts: [
    { kind: 'plan', version: 'plan@0' },
    { kind: 'adaptation', version: 'adaptation@0' },
    { kind: 'guidance', version: 'guidance@1' },
    { kind: 'safety', version: 'safety@1' },
  ],
}
const firstTimestamp = '2026-11-12T18:00:00.000Z'
const nextTimestamp = '2026-11-12T18:10:00.000Z'

function controls() {
  return createInitialControlDocuments(manifest, firstTimestamp)
}

describe('closed-beta methodology control manager', () => {
  it('creates exact disabled controls from the pinned manifest', () => {
    const initial = controls()
    expect(assertMethodologyControl(initial[METHODOLOGY_CONTROL_PATH], manifest)).toEqual(
      expect.objectContaining({
        enabled: false,
        revision: 1,
        artifactVersions: {
          plan: 'plan@1',
          adaptation: 'adaptation@1',
          guidance: 'guidance@1',
          safety: 'safety@1',
        },
      }),
    )
    expect(assertGuidanceControl(initial[GUIDANCE_CONTROL_PATH], manifest)).toEqual(
      expect.objectContaining({
        enabled: false,
        revision: 1,
        artifactVersions: ['guidance@1', 'safety@1'],
        disabledGuidanceIds: [],
      }),
    )
  })

  it('creates one atomic commit with absent-document preconditions and exact field types', () => {
    const initial = controls()
    const writes = createControlCommitWrites({
      controls: initial,
      existing: {
        [METHODOLOGY_CONTROL_PATH]: null,
        [GUIDANCE_CONTROL_PATH]: null,
      },
      projectId: 'marathonerapp-beta',
    })
    expect(writes).toHaveLength(2)
    expect(writes[0]).toMatchObject({
      currentDocument: { exists: false },
      update: {
        fields: { updatedAt: { stringValue: firstTimestamp } },
      },
    })
    expect(writes[1]).toMatchObject({
      currentDocument: { exists: false },
      update: {
        fields: { updatedAt: { timestampValue: firstTimestamp } },
      },
    })
    expect(() =>
      createControlCommitWrites({
        controls: initial,
        existing: {},
        projectId: 'marathoner-d9bf9',
      }),
    ).toThrow('exact live beta project')
  })

  it('requires the exact beta project and mutation confirmation', () => {
    expect(
      parseControlArguments(['status', '--project', 'marathonerapp-beta']),
    ).toEqual({
      action: 'status',
      confirmation: undefined,
      guidanceId: undefined,
      projectId: 'marathonerapp-beta',
    })
    expect(() =>
      parseControlArguments([
        'prepare',
        '--project',
        'marathonerapp-beta',
        '--confirm',
        'yes',
      ]),
    ).toThrow(CONTROL_CONFIRMATIONS.prepare)
    expect(() =>
      parseControlArguments([
        'upgrade',
        '--project',
        'marathonerapp-beta',
        '--confirm',
        'yes',
      ]),
    ).toThrow(CONTROL_CONFIRMATIONS.upgrade)
    expect(() =>
      parseControlArguments(['status', '--project', 'marathoner-d9bf9']),
    ).toThrow('Refusing controls')
  })

  it('upgrades only the exact predecessor while preserving live state', () => {
    const previousControls = createInitialControlDocuments(
      previousManifest,
      firstTimestamp,
    )
    previousControls[METHODOLOGY_CONTROL_PATH].enabled = true
    previousControls[METHODOLOGY_CONTROL_PATH].revision = 8
    previousControls[GUIDANCE_CONTROL_PATH].enabled = true
    previousControls[GUIDANCE_CONTROL_PATH].revision = 6
    previousControls[GUIDANCE_CONTROL_PATH].disabledGuidanceIds = [
      'guidance.long-run',
    ]

    const upgraded = upgradeControlDocuments(
      previousControls,
      previousManifest,
      manifest,
      nextTimestamp,
    )

    expect(upgraded[METHODOLOGY_CONTROL_PATH]).toEqual({
      ...previousControls[METHODOLOGY_CONTROL_PATH],
      revision: 9,
      manifestVersion: manifest.manifestVersion,
      artifactVersions: {
        plan: 'plan@1',
        adaptation: 'adaptation@1',
        guidance: 'guidance@1',
        safety: 'safety@1',
      },
      updatedAt: nextTimestamp,
    })
    expect(upgraded[GUIDANCE_CONTROL_PATH]).toEqual({
      ...previousControls[GUIDANCE_CONTROL_PATH],
      revision: 7,
      artifactVersions: ['guidance@1', 'safety@1'],
      updatedAt: nextTimestamp,
    })

    const writes = createControlCommitWrites({
      controls: upgraded,
      existing: {
        [METHODOLOGY_CONTROL_PATH]: {
          updateTime: '2026-11-12T18:01:00.000Z',
        },
        [GUIDANCE_CONTROL_PATH]: {
          updateTime: '2026-11-12T18:02:00.000Z',
        },
      },
      projectId: 'marathonerapp-beta',
    })
    expect(writes).toHaveLength(2)
    expect(writes.map(({ currentDocument }) => currentDocument)).toEqual([
      { updateTime: '2026-11-12T18:01:00.000Z' },
      { updateTime: '2026-11-12T18:02:00.000Z' },
    ])
  })

  it('refuses unknown drift and repeated manifest upgrades', () => {
    const previousControls = createInitialControlDocuments(
      previousManifest,
      firstTimestamp,
    )
    previousControls[METHODOLOGY_CONTROL_PATH].artifactVersions.plan =
      'plan@unknown'
    expect(() =>
      upgradeControlDocuments(
        previousControls,
        previousManifest,
        manifest,
        nextTimestamp,
      ),
    ).toThrow('does not match the pinned manifest')

    expect(() =>
      upgradeControlDocuments(
        controls(),
        previousManifest,
        manifest,
        nextTimestamp,
      ),
    ).toThrow('does not match the pinned manifest')
  })

  it('enables both controls together and disables only the shared kill switch', () => {
    const enabled = transitionControlDocuments(
      'enable',
      controls(),
      manifest,
      { updatedAt: nextTimestamp },
    )
    expect(enabled[METHODOLOGY_CONTROL_PATH]).toMatchObject({
      enabled: true,
      revision: 2,
    })
    expect(enabled[GUIDANCE_CONTROL_PATH]).toMatchObject({
      enabled: true,
      revision: 2,
    })

    const disabled = transitionControlDocuments(
      'disable',
      enabled,
      manifest,
      { updatedAt: '2026-11-12T18:20:00.000Z' },
    )
    expect(Object.keys(disabled)).toEqual([METHODOLOGY_CONTROL_PATH])
    expect(disabled[METHODOLOGY_CONTROL_PATH]).toMatchObject({
      enabled: false,
      revision: 3,
    })
  })

  it('retires and restores one exact guidance item with monotonic revisions', () => {
    const enabled = transitionControlDocuments(
      'enable',
      controls(),
      manifest,
      { updatedAt: '2026-11-12T18:05:00.000Z' },
    )
    const retired = transitionControlDocuments(
      'retire-guidance',
      enabled,
      manifest,
      { guidanceId: 'guidance.long-run', updatedAt: nextTimestamp },
    )
    expect(retired[GUIDANCE_CONTROL_PATH]).toMatchObject({
      revision: 3,
      disabledGuidanceIds: ['guidance.long-run'],
    })
    const restored = transitionControlDocuments(
      'restore-guidance',
      {
        ...enabled,
        [GUIDANCE_CONTROL_PATH]: retired[GUIDANCE_CONTROL_PATH],
      },
      manifest,
      {
        guidanceId: 'guidance.long-run',
        updatedAt: '2026-11-12T18:20:00.000Z',
      },
    )
    expect(restored[GUIDANCE_CONTROL_PATH]).toMatchObject({
      revision: 4,
      disabledGuidanceIds: [],
    })
  })

  it('fails closed on version drift and repeated transitions', () => {
    const changed = controls()
    changed[METHODOLOGY_CONTROL_PATH].artifactVersions.plan = 'plan@2'
    expect(() =>
      transitionControlDocuments('enable', changed, manifest, {
        updatedAt: nextTimestamp,
      }),
    ).toThrow('does not match the pinned manifest')
    expect(() =>
      transitionControlDocuments('disable', controls(), manifest, {
        updatedAt: nextTimestamp,
      }),
    ).toThrow('already disabled')
    expect(() =>
      transitionControlDocuments('restore-guidance', controls(), manifest, {
        guidanceId: 'guidance.long-run',
        updatedAt: nextTimestamp,
      }),
    ).toThrow('Both controls must be enabled')
  })
})
