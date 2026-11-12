import type { ClosedBetaProvisionalMethodologyManifest } from '../../src/domain/methodology/closedBetaProvisionalMethodology.js'
import {
  CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
  type AcceptClosedBetaMethodologyConsentCommand,
  type ClosedBetaMethodologyConsentAcceptance,
  type ClosedBetaMethodologyConsentResult,
} from '../../src/domain/methodology/closedBetaMethodologyConsent.js'
import { CLOSED_BETA_PROJECT_ID } from './closedBetaMethodologyEligibility.js'

export interface ClosedBetaMethodologyConsentStore {
  get(options: {
    readonly ownerId: string
    readonly consentVersion: typeof CLOSED_BETA_METHODOLOGY_CONSENT_VERSION
    readonly manifestVersion: string
  }): Promise<
    | { readonly kind: 'accepted'; readonly acceptance: ClosedBetaMethodologyConsentAcceptance }
    | { readonly kind: 'required'; readonly reason: 'missing' | 'version_changed' }
    | { readonly kind: 'membership-required' }
  >
  accept(options: {
    readonly ownerId: string
    readonly consentVersion: typeof CLOSED_BETA_METHODOLOGY_CONSENT_VERSION
    readonly manifestVersion: string
  }): Promise<
    | { readonly kind: 'accepted'; readonly acceptance: ClosedBetaMethodologyConsentAcceptance }
    | { readonly kind: 'membership-required' }
  >
}

export interface ClosedBetaMethodologyConsentCaller {
  readonly ownerId: string | null
  readonly appCheckVerified: boolean
}

interface ConsentHandlerDependencies {
  readonly projectId: string
  readonly manifest: ClosedBetaProvisionalMethodologyManifest | null
  readonly store: ClosedBetaMethodologyConsentStore
}

function boundaryResult(
  caller: ClosedBetaMethodologyConsentCaller,
  dependencies: ConsentHandlerDependencies,
): ClosedBetaMethodologyConsentResult | null {
  if (caller.ownerId === null || caller.ownerId.trim().length === 0) {
    return { status: 'authentication_error', code: 'sign-in-required' }
  }
  if (!caller.appCheckVerified) {
    return { status: 'authorization_error', code: 'app-check-required' }
  }
  if (
    dependencies.projectId !== CLOSED_BETA_PROJECT_ID ||
    dependencies.manifest === null
  ) {
    return {
      status: 'unavailable',
      code: 'closed-beta-methodology-unavailable',
    }
  }
  return null
}

function resultFromStore(
  result: Awaited<ReturnType<ClosedBetaMethodologyConsentStore['get']>>,
  manifestVersion: string,
): ClosedBetaMethodologyConsentResult {
  if (result.kind === 'accepted') {
    return { status: 'accepted', acceptance: result.acceptance }
  }
  if (result.kind === 'membership-required') {
    return {
      status: 'authorization_error',
      code: 'approved-beta-membership-required',
    }
  }
  return {
    status: 'consent_required',
    consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
    manifestVersion,
    reason: result.reason,
  }
}

export async function getClosedBetaMethodologyConsent(
  caller: ClosedBetaMethodologyConsentCaller,
  dependencies: ConsentHandlerDependencies,
): Promise<ClosedBetaMethodologyConsentResult> {
  const boundary = boundaryResult(caller, dependencies)
  if (boundary !== null) return boundary
  const ownerId = caller.ownerId
  const manifest = dependencies.manifest
  if (ownerId === null || manifest === null) {
    throw new Error('The consent boundary did not narrow its dependencies.')
  }

  return resultFromStore(
    await dependencies.store.get({
      ownerId,
      consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
      manifestVersion: manifest.manifestVersion,
    }),
    manifest.manifestVersion,
  )
}

function parseAcceptCommand(
  value: unknown,
): AcceptClosedBetaMethodologyConsentCommand | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  if (
    keys.length !== 3 ||
    keys[0] !== 'accepted' ||
    keys[1] !== 'consentVersion' ||
    keys[2] !== 'manifestVersion' ||
    record.accepted !== true ||
    record.consentVersion !== CLOSED_BETA_METHODOLOGY_CONSENT_VERSION ||
    typeof record.manifestVersion !== 'string'
  ) {
    return null
  }
  return record as unknown as AcceptClosedBetaMethodologyConsentCommand
}

export async function acceptClosedBetaMethodologyConsent(
  caller: ClosedBetaMethodologyConsentCaller,
  data: unknown,
  dependencies: ConsentHandlerDependencies,
): Promise<ClosedBetaMethodologyConsentResult> {
  const boundary = boundaryResult(caller, dependencies)
  if (boundary !== null) return boundary
  const ownerId = caller.ownerId
  const manifest = dependencies.manifest
  if (ownerId === null || manifest === null) {
    throw new Error('The consent boundary did not narrow its dependencies.')
  }
  const command = parseAcceptCommand(data)
  if (command === null) {
    return { status: 'validation_error', code: 'explicit-consent-required' }
  }
  if (command.manifestVersion !== manifest.manifestVersion) {
    return { status: 'validation_error', code: 'consent-version-mismatch' }
  }

  const result = await dependencies.store.accept({
    ownerId,
    consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
    manifestVersion: manifest.manifestVersion,
  })
  if (result.kind === 'membership-required') {
    return {
      status: 'authorization_error',
      code: 'approved-beta-membership-required',
    }
  }
  return { status: 'accepted', acceptance: result.acceptance }
}
