import { describe, expect, it } from 'vitest'

import {
  artifactVersionsFromManifest,
  CLOSED_BETA_METHODOLOGY_CONTROL_SCHEMA_VERSION,
  CLOSED_BETA_METHODOLOGY_ELIGIBILITY_EVIDENCE_SCHEMA_VERSION,
  CLOSED_BETA_PROJECT_ID,
  evaluateClosedBetaMethodologyEligibility,
  parseClosedBetaMethodologyControl,
  type ClosedBetaMethodologyControl,
  type ClosedBetaMethodologyEligibilityRequest,
} from './closedBetaMethodologyEligibility.js'
import { loadPinnedClosedBetaMethodologyManifest } from './pinnedClosedBetaMethodologyManifest.js'

const manifest = loadPinnedClosedBetaMethodologyManifest()
const artifactVersions = artifactVersionsFromManifest(manifest)
const currentConsent = {
  status: 'current' as const,
  acceptedAt: '2026-11-11T21:00:00.000Z',
}

function control(
  overrides: Partial<ClosedBetaMethodologyControl> = {},
): ClosedBetaMethodologyControl {
  return {
    schemaVersion: CLOSED_BETA_METHODOLOGY_CONTROL_SCHEMA_VERSION,
    revision: 3,
    enabled: true,
    manifestVersion: manifest.manifestVersion,
    artifactVersions,
    updatedAt: '2026-11-11T20:00:00.000Z',
    ...overrides,
  }
}

function request(
  overrides: Partial<ClosedBetaMethodologyEligibilityRequest> = {},
): ClosedBetaMethodologyEligibilityRequest {
  return {
    ownerId: 'closed-beta-runner',
    projectId: CLOSED_BETA_PROJECT_ID,
    capability: 'plan',
    serverArtifactVersion: artifactVersions.plan,
    inputDisposition: 'supported',
    ...overrides,
  }
}

function evaluate(options: {
  request?: ClosedBetaMethodologyEligibilityRequest
  membershipApproved?: boolean
  control?: unknown
  manifestOverride?: typeof manifest | null
  consent?: Parameters<typeof evaluateClosedBetaMethodologyEligibility>[0]['consent']
} = {}) {
  return evaluateClosedBetaMethodologyEligibility({
    request: options.request ?? request(),
    membershipApproved: options.membershipApproved ?? true,
    control: 'control' in options ? options.control : control(),
    manifest:
      options.manifestOverride === undefined
        ? manifest
        : options.manifestOverride,
    consent: options.consent ?? currentConsent,
  })
}

describe('closed-beta methodology eligibility', () => {
  it('allows the exact beta member, manifest, artifact, and control tuple', () => {
    expect(evaluate()).toEqual({
      status: 'allowed',
      code: 'closed-beta-methodology-allowed',
      evidence: {
        schemaVersion:
          CLOSED_BETA_METHODOLOGY_ELIGIBILITY_EVIDENCE_SCHEMA_VERSION,
        projectId: CLOSED_BETA_PROJECT_ID,
        manifestVersion: manifest.manifestVersion,
        controlSchemaVersion:
          CLOSED_BETA_METHODOLOGY_CONTROL_SCHEMA_VERSION,
        controlRevision: 3,
        controlUpdatedAt: '2026-11-11T20:00:00.000Z',
        artifactVersions,
        capability: 'plan',
        artifactVersion: artifactVersions.plan,
        consentVersion: 'closed-beta-methodology-consent@1.0.0',
        consentAcceptedAt: currentConsent.acceptedAt,
      },
    })
  })

  it.each([
    ['missing identity', request({ ownerId: null }), true],
    ['missing membership', request(), false],
    ['non-member', request(), false],
  ] as const)('denies %s without exposing membership details', (_, value, approved) => {
    expect(evaluate({ request: value, membershipApproved: approved })).toEqual({
      status: 'denied',
      code:
        value.ownerId === null
          ? 'authentication-required'
          : 'closed-beta-access-required',
    })
  })

  it('fails closed in the wrong Firebase environment', () => {
    expect(
      evaluate({ request: request({ projectId: 'marathoner-d9bf9' }) }),
    ).toEqual({
      status: 'unavailable',
      code: 'closed-beta-environment-required',
    })
  })

  it('fails closed when the server control is missing or malformed', () => {
    for (const value of [
      undefined,
      {},
      { ...control(), revision: 0 },
      { ...control(), extra: true },
      {
        ...control(),
        artifactVersions: { ...artifactVersions, nutrition: 'unknown@1.0.0' },
      },
    ]) {
      expect(evaluate({ control: value })).toEqual({
        status: 'unavailable',
        code: 'methodology-control-unavailable',
      })
      expect(parseClosedBetaMethodologyControl(value)).toBeNull()
    }
  })

  it('returns a typed disabled decision', () => {
    expect(evaluate({ control: control({ enabled: false }) })).toEqual({
      status: 'denied',
      code: 'closed-beta-methodology-disabled',
    })
  })

  it('returns stale-version before using an obsolete control', () => {
    expect(
      evaluate({
        control: control({
          manifestVersion: 'closed-beta-provisional-methodology@0.0.9',
        }),
      }),
    ).toEqual({
      status: 'stale_version',
      code: 'methodology-manifest-version-stale',
    })
  })

  it('requires current consent for the exact pinned methodology version', () => {
    expect(evaluate({ consent: { status: 'missing' } })).toEqual({
      status: 'denied',
      code: 'closed-beta-methodology-consent-required',
    })
    expect(evaluate({ consent: { status: 'stale' } })).toEqual({
      status: 'stale_version',
      code: 'methodology-consent-version-stale',
    })
  })

  it('rejects a missing or mismatched server artifact', () => {
    expect(evaluate({ manifestOverride: null })).toEqual({
      status: 'unavailable',
      code: 'methodology-artifact-unavailable',
    })
    expect(
      evaluate({
        control: control({
          artifactVersions: {
            ...artifactVersions,
            plan: 'beta-rules@0.1.0-draft',
          },
        }),
      }),
    ).toEqual({
      status: 'unavailable',
      code: 'methodology-artifact-mismatch',
    })
    expect(
      evaluate({
        request: request({ serverArtifactVersion: 'beta-rules@0.1.0-draft' }),
      }),
    ).toEqual({
      status: 'unavailable',
      code: 'methodology-artifact-mismatch',
    })
  })

  it('never turns unsupported or symptom-escalation input into ordinary advice', () => {
    expect(
      evaluate({ request: request({ inputDisposition: 'unsupported' }) }),
    ).toEqual({
      status: 'denied',
      code: 'unsupported-methodology-input',
    })
    expect(
      evaluate({
        request: request({
          capability: 'adaptation',
          serverArtifactVersion: artifactVersions.adaptation,
          inputDisposition: 'symptom_escalation',
        }),
      }),
    ).toEqual({
      status: 'denied',
      code: 'symptom-escalation-required',
    })
  })

  it('allows the pinned safety artifact to handle symptom escalation', () => {
    expect(
      evaluate({
        request: request({
          capability: 'safety',
          serverArtifactVersion: artifactVersions.safety,
          inputDisposition: 'symptom_escalation',
        }),
      }),
    ).toMatchObject({
      status: 'allowed',
      evidence: {
        capability: 'safety',
        artifactVersion: artifactVersions.safety,
      },
    })
  })
})
