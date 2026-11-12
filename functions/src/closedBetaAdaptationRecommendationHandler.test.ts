import { describe, expect, it, vi } from 'vitest'

import {
  CLOSED_BETA_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
  type ClosedBetaAdaptationRecommendationCommand,
} from '../../src/domain/recommendations/closedBetaAdaptationRecommendation.js'
import { createDateOnly } from '../../src/domain/training/dates.js'
import { createPlannedWorkoutId } from '../../src/domain/training/identifiers.js'
import { executeClosedBetaAdaptationRecommendation } from './closedBetaAdaptationRecommendationHandler.js'
import type { ClosedBetaMethodologyEligibilityDecision } from './closedBetaMethodologyEligibility.js'
import type { InternalAdaptationRecommendationStore } from './internalAdaptationRecommendationHandler.js'
import { loadPinnedClosedBetaMethodologyManifest } from './pinnedClosedBetaMethodologyManifest.js'
import { loadPinnedInternalAdaptationArtifacts } from './pinnedInternalAdaptationArtifacts.js'

const manifest = loadPinnedClosedBetaMethodologyManifest()
const artifacts = loadPinnedInternalAdaptationArtifacts()
const adaptationArtifactVersion = manifest.artifacts.find(
  ({ kind }) => kind === 'adaptation',
)!.version

function command(
  overrides: Partial<ClosedBetaAdaptationRecommendationCommand> = {},
): ClosedBetaAdaptationRecommendationCommand {
  return {
    schemaVersion: CLOSED_BETA_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
    commandId: 'closed-beta-adaptation-command-0001',
    manifestVersion: manifest.manifestVersion,
    adaptationArtifactVersion,
    triggerWorkoutId: createPlannedWorkoutId('completed-workout-0001'),
    evaluationDate: createDateOnly('2026-11-09'),
    confirmedRescheduleTargetDate: null,
    ...overrides,
  }
}

function dependencies(options: {
  eligibility?: ClosedBetaMethodologyEligibilityDecision
  store?: InternalAdaptationRecommendationStore
} = {}) {
  const eligibility = {
    evaluate: vi.fn(async () =>
      options.eligibility ?? {
        status: 'allowed' as const,
        code: 'closed-beta-methodology-allowed' as const,
        evidence: {} as never,
      },
    ),
  }
  const store =
    options.store ??
    ({
      execute: vi.fn(async () => ({
        kind: 'completed' as const,
        result: {
          status: 'no_change' as const,
          commandId: command().commandId,
          reasonCode: 'ADAPT-NO-CHANGE',
          explanationKey: 'adaptation.no_change',
        },
      })),
    } satisfies InternalAdaptationRecommendationStore)
  return {
    projectId: 'marathonerapp-beta',
    manifest,
    artifacts,
    eligibility,
    store,
    now: () => new Date('2026-11-11T20:00:00.000Z'),
    log: vi.fn(),
  }
}

describe('closed-beta adaptation recommendation handler', () => {
  it('requires authentication and App Check before reading eligibility', async () => {
    const signedOut = dependencies()
    await expect(
      executeClosedBetaAdaptationRecommendation({
        caller: { ownerId: null, appCheckVerified: true },
        data: command(),
        dependencies: signedOut,
      }),
    ).resolves.toMatchObject({
      status: 'authorization_error',
      code: 'authentication-required',
    })
    expect(signedOut.eligibility.evaluate).not.toHaveBeenCalled()

    const unverified = dependencies()
    await expect(
      executeClosedBetaAdaptationRecommendation({
        caller: { ownerId: 'runner-one', appCheckVerified: false },
        data: command(),
        dependencies: unverified,
      }),
    ).resolves.toMatchObject({
      status: 'authorization_error',
      code: 'app-check-required',
    })
    expect(unverified.eligibility.evaluate).not.toHaveBeenCalled()
  })

  it('rejects a stale client manifest before loading participant state', async () => {
    const boundary = dependencies()
    await expect(
      executeClosedBetaAdaptationRecommendation({
        caller: { ownerId: 'runner-one', appCheckVerified: true },
        data: command({ manifestVersion: 'closed-beta-provisional-methodology@0.0.1' }),
        dependencies: boundary,
      }),
    ).resolves.toMatchObject({
      status: 'stale_version',
      code: 'client-methodology-version-stale',
    })
    expect(boundary.eligibility.evaluate).not.toHaveBeenCalled()
    expect(boundary.store.execute).not.toHaveBeenCalled()
  })

  it('evaluates only after the exact pinned adaptation capability is allowed', async () => {
    const boundary = dependencies()
    await expect(
      executeClosedBetaAdaptationRecommendation({
        caller: { ownerId: 'runner-one', appCheckVerified: true },
        data: command(),
        dependencies: boundary,
      }),
    ).resolves.toMatchObject({ status: 'no_change' })
    expect(boundary.eligibility.evaluate).toHaveBeenCalledWith({
      ownerId: 'runner-one',
      projectId: 'marathonerapp-beta',
      capability: 'adaptation',
      serverArtifactVersion: adaptationArtifactVersion,
      inputDisposition: 'supported',
    })
    expect(boundary.store.execute).toHaveBeenCalledOnce()
  })

  it.each([
    {
      decision: {
        status: 'denied' as const,
        code: 'closed-beta-methodology-disabled' as const,
      },
      status: 'disabled',
    },
    {
      decision: {
        status: 'stale_version' as const,
        code: 'methodology-manifest-version-stale' as const,
      },
      status: 'stale_version',
    },
    {
      decision: {
        status: 'unavailable' as const,
        code: 'methodology-artifact-mismatch' as const,
      },
      status: 'unavailable',
    },
  ])('fails closed for $status eligibility', async ({ decision, status }) => {
    const boundary = dependencies({ eligibility: decision })
    await expect(
      executeClosedBetaAdaptationRecommendation({
        caller: { ownerId: 'runner-one', appCheckVerified: true },
        data: command(),
        dependencies: boundary,
      }),
    ).resolves.toMatchObject({ status })
    expect(boundary.store.execute).not.toHaveBeenCalled()
  })
})
