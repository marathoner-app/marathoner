import { describe, expect, it, vi } from 'vitest'

import {
  CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION,
  CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
} from '../../src/domain/methodology/closedBetaMethodologyConsent.js'
import {
  acceptClosedBetaMethodologyConsent,
  getClosedBetaMethodologyConsent,
  type ClosedBetaMethodologyConsentStore,
} from './closedBetaMethodologyConsentHandler.js'
import { CLOSED_BETA_PROJECT_ID } from './closedBetaMethodologyEligibility.js'
import { loadPinnedClosedBetaMethodologyManifest } from './pinnedClosedBetaMethodologyManifest.js'

const ownerId = 'consenting-runner'
const manifest = loadPinnedClosedBetaMethodologyManifest()
const acceptance = {
  schemaVersion: CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION,
  userId: ownerId,
  consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
  manifestVersion: manifest.manifestVersion,
  acceptedAt: '2026-11-11T22:00:00.000Z',
} as const

function store(
  getResult: Awaited<ReturnType<ClosedBetaMethodologyConsentStore['get']>> = {
    kind: 'required',
    reason: 'missing',
  },
): ClosedBetaMethodologyConsentStore {
  return {
    get: vi.fn(async () => getResult),
    accept: vi.fn(async () => ({ kind: 'accepted', acceptance })),
  }
}

function dependencies(consentStore = store()) {
  return { projectId: CLOSED_BETA_PROJECT_ID, manifest, store: consentStore }
}

const caller = { ownerId, appCheckVerified: true }

describe('closed-beta methodology consent handler', () => {
  it('fails closed before reading storage when identity, App Check, or environment is wrong', async () => {
    const consentStore = store()
    await expect(
      getClosedBetaMethodologyConsent(
        { ownerId: null, appCheckVerified: true },
        dependencies(consentStore),
      ),
    ).resolves.toEqual({ status: 'authentication_error', code: 'sign-in-required' })
    await expect(
      getClosedBetaMethodologyConsent(
        { ownerId, appCheckVerified: false },
        dependencies(consentStore),
      ),
    ).resolves.toEqual({ status: 'authorization_error', code: 'app-check-required' })
    await expect(
      getClosedBetaMethodologyConsent(caller, {
        ...dependencies(consentStore),
        projectId: 'marathoner-d9bf9',
      }),
    ).resolves.toEqual({
      status: 'unavailable',
      code: 'closed-beta-methodology-unavailable',
    })
    expect(consentStore.get).not.toHaveBeenCalled()
  })

  it('requires missing or changed consent and returns an accepted record', async () => {
    await expect(
      getClosedBetaMethodologyConsent(caller, dependencies()),
    ).resolves.toEqual({
      status: 'consent_required',
      consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
      manifestVersion: manifest.manifestVersion,
      reason: 'missing',
    })
    await expect(
      getClosedBetaMethodologyConsent(
        caller,
        dependencies(store({ kind: 'accepted', acceptance })),
      ),
    ).resolves.toEqual({ status: 'accepted', acceptance })
  })

  it('accepts only an explicit request for the exact current versions', async () => {
    await expect(
      acceptClosedBetaMethodologyConsent(caller, {}, dependencies()),
    ).resolves.toEqual({
      status: 'validation_error',
      code: 'explicit-consent-required',
    })
    await expect(
      acceptClosedBetaMethodologyConsent(
        caller,
        {
          accepted: true,
          consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
          manifestVersion: 'closed-beta-provisional-methodology@0.0.9',
        },
        dependencies(),
      ),
    ).resolves.toEqual({
      status: 'validation_error',
      code: 'consent-version-mismatch',
    })
    await expect(
      acceptClosedBetaMethodologyConsent(
        caller,
        {
          accepted: true,
          consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
          manifestVersion: manifest.manifestVersion,
        },
        dependencies(),
      ),
    ).resolves.toEqual({ status: 'accepted', acceptance })
  })
})
