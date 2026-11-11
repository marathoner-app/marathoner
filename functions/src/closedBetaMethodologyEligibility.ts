import {
  closedBetaProvisionalArtifactKinds,
  type ClosedBetaProvisionalArtifactKind,
  type ClosedBetaProvisionalMethodologyManifest,
} from '../../src/domain/methodology/closedBetaProvisionalMethodology.js'

export const CLOSED_BETA_PROJECT_ID = 'marathonerapp-beta'
export const CLOSED_BETA_METHODOLOGY_CONTROL_PATH =
  'operatorControls/closedBetaMethodology'
export const CLOSED_BETA_METHODOLOGY_CONTROL_SCHEMA_VERSION =
  'closed-beta-methodology-control@1' as const
export const CLOSED_BETA_METHODOLOGY_ELIGIBILITY_EVIDENCE_SCHEMA_VERSION =
  'closed-beta-methodology-eligibility@1' as const

export interface ClosedBetaMethodologyControl {
  readonly schemaVersion: typeof CLOSED_BETA_METHODOLOGY_CONTROL_SCHEMA_VERSION
  readonly revision: number
  readonly enabled: boolean
  readonly manifestVersion: string
  readonly artifactVersions: Readonly<
    Record<ClosedBetaProvisionalArtifactKind, string>
  >
  readonly updatedAt: string
}

export type ClosedBetaMethodologyInputDisposition =
  | 'supported'
  | 'unsupported'
  | 'symptom_escalation'

export interface ClosedBetaMethodologyEligibilityRequest {
  readonly ownerId: string | null
  readonly projectId: string
  readonly capability: ClosedBetaProvisionalArtifactKind
  readonly serverArtifactVersion: string
  readonly inputDisposition: ClosedBetaMethodologyInputDisposition
}

export interface ClosedBetaMethodologyEligibilityEvidence {
  readonly schemaVersion: typeof CLOSED_BETA_METHODOLOGY_ELIGIBILITY_EVIDENCE_SCHEMA_VERSION
  readonly projectId: typeof CLOSED_BETA_PROJECT_ID
  readonly manifestVersion: string
  readonly controlSchemaVersion: typeof CLOSED_BETA_METHODOLOGY_CONTROL_SCHEMA_VERSION
  readonly controlRevision: number
  readonly controlUpdatedAt: string
  readonly artifactVersions: Readonly<
    Record<ClosedBetaProvisionalArtifactKind, string>
  >
  readonly capability: ClosedBetaProvisionalArtifactKind
  readonly artifactVersion: string
}

export type ClosedBetaMethodologyEligibilityDecision =
  | {
      readonly status: 'allowed'
      readonly code: 'closed-beta-methodology-allowed'
      readonly evidence: ClosedBetaMethodologyEligibilityEvidence
    }
  | {
      readonly status: 'denied'
      readonly code:
        | 'authentication-required'
        | 'closed-beta-access-required'
        | 'closed-beta-methodology-disabled'
        | 'unsupported-methodology-input'
        | 'symptom-escalation-required'
    }
  | {
      readonly status: 'unavailable'
      readonly code:
        | 'closed-beta-environment-required'
        | 'methodology-control-unavailable'
        | 'methodology-artifact-unavailable'
        | 'methodology-artifact-mismatch'
    }
  | {
      readonly status: 'stale_version'
      readonly code: 'methodology-manifest-version-stale'
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  )
}

function isUtcDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parsed = new Date(value)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value
}

export function parseClosedBetaMethodologyControl(
  value: unknown,
): ClosedBetaMethodologyControl | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'schemaVersion',
      'revision',
      'enabled',
      'manifestVersion',
      'artifactVersions',
      'updatedAt',
    ]) ||
    value.schemaVersion !== CLOSED_BETA_METHODOLOGY_CONTROL_SCHEMA_VERSION ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 1 ||
    typeof value.enabled !== 'boolean' ||
    typeof value.manifestVersion !== 'string' ||
    !isRecord(value.artifactVersions) ||
    !hasExactKeys(value.artifactVersions, closedBetaProvisionalArtifactKinds) ||
    !isUtcDateTime(value.updatedAt)
  ) {
    return null
  }

  for (const kind of closedBetaProvisionalArtifactKinds) {
    if (
      typeof value.artifactVersions[kind] !== 'string' ||
      value.artifactVersions[kind].length === 0
    ) {
      return null
    }
  }

  return value as unknown as ClosedBetaMethodologyControl
}

export function artifactVersionsFromManifest(
  manifest: ClosedBetaProvisionalMethodologyManifest,
): Readonly<Record<ClosedBetaProvisionalArtifactKind, string>> {
  return Object.freeze(
    Object.fromEntries(
      manifest.artifacts.map(({ kind, version }) => [kind, version]),
    ) as Record<ClosedBetaProvisionalArtifactKind, string>,
  )
}

export function evaluateClosedBetaMethodologyEligibility(options: {
  readonly request: ClosedBetaMethodologyEligibilityRequest
  readonly membershipApproved: boolean
  readonly control: unknown
  readonly manifest: ClosedBetaProvisionalMethodologyManifest | null
}): ClosedBetaMethodologyEligibilityDecision {
  const { request } = options
  if (request.ownerId === null || request.ownerId.trim().length === 0) {
    return { status: 'denied', code: 'authentication-required' }
  }
  if (request.projectId !== CLOSED_BETA_PROJECT_ID) {
    return { status: 'unavailable', code: 'closed-beta-environment-required' }
  }
  if (!options.membershipApproved) {
    return { status: 'denied', code: 'closed-beta-access-required' }
  }
  const control = parseClosedBetaMethodologyControl(options.control)
  if (control === null) {
    return { status: 'unavailable', code: 'methodology-control-unavailable' }
  }
  if (!control.enabled) {
    return { status: 'denied', code: 'closed-beta-methodology-disabled' }
  }
  const manifest = options.manifest
  if (manifest === null) {
    return { status: 'unavailable', code: 'methodology-artifact-unavailable' }
  }
  if (control.manifestVersion !== manifest.manifestVersion) {
    return { status: 'stale_version', code: 'methodology-manifest-version-stale' }
  }

  const artifactVersions = artifactVersionsFromManifest(manifest)
  if (
    closedBetaProvisionalArtifactKinds.some(
      (kind) => control.artifactVersions[kind] !== artifactVersions[kind],
    ) ||
    request.serverArtifactVersion !== artifactVersions[request.capability]
  ) {
    return { status: 'unavailable', code: 'methodology-artifact-mismatch' }
  }
  if (request.inputDisposition === 'unsupported') {
    return { status: 'denied', code: 'unsupported-methodology-input' }
  }
  if (
    request.inputDisposition === 'symptom_escalation' &&
    request.capability !== 'safety'
  ) {
    return { status: 'denied', code: 'symptom-escalation-required' }
  }

  return {
    status: 'allowed',
    code: 'closed-beta-methodology-allowed',
    evidence: {
      schemaVersion:
        CLOSED_BETA_METHODOLOGY_ELIGIBILITY_EVIDENCE_SCHEMA_VERSION,
      projectId: CLOSED_BETA_PROJECT_ID,
      manifestVersion: manifest.manifestVersion,
      controlSchemaVersion: control.schemaVersion,
      controlRevision: control.revision,
      controlUpdatedAt: control.updatedAt,
      artifactVersions,
      capability: request.capability,
      artifactVersion: request.serverArtifactVersion,
    },
  }
}
