import { describe, expect, it, vi } from 'vitest'

import type { ClosedBetaMethodologyEligibilityDecision } from './closedBetaMethodologyEligibility.js'
import {
  dismissClosedBetaGuidance,
  getClosedBetaGuidance,
  type ClosedBetaGuidanceStore,
} from './closedBetaGuidanceHandler.js'
import { loadPinnedClosedBetaSafetyArtifact } from './pinnedClosedBetaSafetyArtifact.js'

const caller = { ownerId: 'beta-runner', appCheckVerified: true }
const safetyArtifact = loadPinnedClosedBetaSafetyArtifact()

function allowed(): ClosedBetaMethodologyEligibilityDecision {
  return {
    status: 'allowed',
    code: 'closed-beta-methodology-allowed',
    evidence: {} as never,
  }
}

function store(
  overrides: Partial<ClosedBetaGuidanceStore> = {},
): ClosedBetaGuidanceStore {
  return {
    async present(options) {
      const item = options.candidates.find((candidate) =>
        candidate.triggers.some(({ code }) =>
          options.activeTriggerCodes.includes(code),
        ),
      )
      return item === undefined
        ? { kind: 'none' as const }
        : { kind: 'available' as const, item, presentationId: 'presentation-1' }
    },
    async dismiss() {
      return 'dismissed'
    },
    ...overrides,
  }
}

function dependencies(options: {
  readonly eligibility?: ClosedBetaMethodologyEligibilityDecision
  readonly store?: ClosedBetaGuidanceStore
} = {}) {
  return {
    projectId: 'marathonerapp-beta',
    guidanceArtifactVersion: 'beta-guidance@0.1.0-draft',
    safetyArtifact,
    eligibility: {
      evaluate: vi.fn(async () => options.eligibility ?? allowed()),
    },
    store: options.store ?? store(),
    now: () => new Date('2026-11-11T18:00:00.000Z'),
  }
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    activeTriggerCodes: ['EASY-WORKOUT-UPCOMING'],
    safetyState: 'none_reported',
    emergencySignals: [],
    otherConcerningOrPersistentSymptoms: false,
    ...overrides,
  }
}

describe('closed-beta guidance handler', () => {
  it('requires authentication, App Check, and exact request fields', async () => {
    await expect(
      getClosedBetaGuidance(
        { ownerId: null, appCheckVerified: true },
        request(),
        dependencies(),
      ),
    ).resolves.toMatchObject({ status: 'authorization_error', code: 'sign-in-required' })
    await expect(
      getClosedBetaGuidance(
        { ownerId: 'beta-runner', appCheckVerified: false },
        request(),
        dependencies(),
      ),
    ).resolves.toMatchObject({ status: 'authorization_error', code: 'app-check-required' })
    await expect(
      getClosedBetaGuidance(caller, request({ unknown: true }), dependencies()),
    ).resolves.toMatchObject({ status: 'validation_error' })
  })

  it('returns the exact pinned provisional item for a deterministic trigger', async () => {
    const deps = dependencies()
    const result = await getClosedBetaGuidance(caller, request(), deps)

    expect(result).toMatchObject({
      status: 'available',
      presentation: {
        presentationId: 'presentation-1',
        artifactVersion: 'beta-guidance@0.1.0-draft',
        title: 'Keep easy running conversational',
        kind: 'guidance',
        dismissible: true,
      },
    })
    expect(deps.eligibility.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ capability: 'guidance', inputDisposition: 'supported' }),
    )
  })

  it('suppresses ordinary guidance and returns the pinned conservative safety outcome', async () => {
    const deps = dependencies()
    const result = await getClosedBetaGuidance(
      caller,
      request({
        safetyState: 'reported',
        emergencySignals: ['chest_pressure_or_pain'],
        otherConcerningOrPersistentSymptoms: true,
      }),
      deps,
    )

    expect(result).toMatchObject({
      status: 'available',
      presentation: {
        artifactVersion: 'beta-safety@0.1.0-draft',
        title: 'Stop and call 911 now',
        kind: 'safety',
        dismissible: false,
      },
    })
    expect(JSON.stringify(result)).not.toContain('Keep easy running conversational')
    expect(deps.eligibility.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ capability: 'safety', inputDisposition: 'symptom_escalation' }),
    )
  })

  it('fails closed for stale eligibility and remote disable results', async () => {
    await expect(
      getClosedBetaGuidance(
        caller,
        request(),
        dependencies({
          eligibility: {
            status: 'stale_version',
            code: 'methodology-manifest-version-stale',
          },
        }),
      ),
    ).resolves.toMatchObject({ status: 'stale_version' })

    await expect(
      getClosedBetaGuidance(
        caller,
        request(),
        dependencies({
          store: store({ present: async () => ({ kind: 'disabled' }) }),
        }),
      ),
    ).resolves.toMatchObject({ status: 'none', reason: 'guidance_disabled' })
  })

  it('dismisses only the exact eligible presentation version', async () => {
    const guidanceStore = store()
    await expect(
      dismissClosedBetaGuidance(
        caller,
        {
          presentationId: 'presentation-1',
          artifactVersion: 'beta-guidance@0.1.0-draft',
        },
        dependencies({ store: guidanceStore }),
      ),
    ).resolves.toMatchObject({
      status: 'dismissed',
      presentationId: 'presentation-1',
    })
  })
})
