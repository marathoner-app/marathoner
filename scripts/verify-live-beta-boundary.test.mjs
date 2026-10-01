import { describe, expect, it } from 'vitest'
import {
  LIVE_BETA_CONFIRMATION,
  LIVE_BETA_OPERATOR_EMAIL,
  LIVE_BETA_PROJECT_ID,
  assertExpectedDecision,
  assertLiveVerificationOptions,
  firebaseCliTokenScopes,
  fixtureAccounts,
  fixtureDocumentPaths,
  parseBetaPublicConfiguration,
} from './verify-live-beta-boundary.mjs'

describe('live beta boundary verifier', () => {
  it('requires the exact project, operator, and destructive-action phrase', () => {
    expect(() =>
      assertLiveVerificationOptions({
        confirmation: LIVE_BETA_CONFIRMATION,
        operatorEmail: LIVE_BETA_OPERATOR_EMAIL,
        projectId: LIVE_BETA_PROJECT_ID,
      }),
    ).not.toThrow()

    expect(() =>
      assertLiveVerificationOptions({
        confirmation: LIVE_BETA_CONFIRMATION,
        operatorEmail: LIVE_BETA_OPERATOR_EMAIL,
        projectId: 'marathoner-creator-radar-dev',
      }),
    ).toThrow('Refusing live verification for project')
    expect(() =>
      assertLiveVerificationOptions({
        confirmation: LIVE_BETA_CONFIRMATION,
        operatorEmail: 'personal@example.com',
        projectId: LIVE_BETA_PROJECT_ID,
      }),
    ).toThrow('expected the dedicated beta operator')
    expect(() =>
      assertLiveVerificationOptions({
        confirmation: 'yes',
        operatorEmail: LIVE_BETA_OPERATOR_EMAIL,
        projectId: LIVE_BETA_PROJECT_ID,
      }),
    ).toThrow(`--confirm ${LIVE_BETA_CONFIRMATION}`)
  })

  it('extracts only the provisioned beta public configuration', () => {
    expect(
      parseBetaPublicConfiguration(`
        development: { projectId: "development" },
        beta: {
          apiKey: "public-browser-key",
          projectId: "marathonerapp-beta",
        },
      `),
    ).toEqual({
      apiKey: 'public-browser-key',
      projectId: LIVE_BETA_PROJECT_ID,
    })

    expect(() =>
      parseBetaPublicConfiguration(`
        beta: {
          apiKey: "public-browser-key",
          projectId: "wrong-project",
        },
      `),
    ).toThrow('instead of "marathonerapp-beta"')
  })

  it('uses three fixed fictional identities without participant data', () => {
    expect(fixtureAccounts()).toEqual([
      expect.objectContaining({
        emailVerified: true,
        membership: true,
        role: 'approved',
        uid: 'beta-fixture-approved',
      }),
      expect.objectContaining({
        emailVerified: true,
        membership: false,
        role: 'unapproved',
        uid: 'beta-fixture-unapproved',
      }),
      expect.objectContaining({
        emailVerified: false,
        membership: true,
        role: 'unverified',
        uid: 'beta-fixture-unverified',
      }),
    ])
    expect(
      fixtureAccounts().every(({ email }) =>
        email.endsWith('@marathonerapp.com'),
      ),
    ).toBe(true)
  })

  it('accepts both persisted Firebase CLI scope formats', () => {
    expect(firebaseCliTokenScopes({ scopes: ['scope-a', 'scope-b'] })).toEqual([
      'scope-a',
      'scope-b',
    ])
    expect(firebaseCliTokenScopes({ scope: 'scope-a scope-b' })).toEqual([
      'scope-a',
      'scope-b',
    ])
    expect(() => firebaseCliTokenScopes({})).toThrow(
      'do not include OAuth scopes',
    )
  })

  it('preflights every document path that a failed live check could create', () => {
    expect(fixtureDocumentPaths()).toEqual([
      'betaMemberships/beta-fixture-approved',
      'betaMemberships/beta-fixture-unverified',
      'users/beta-fixture-approved/runs/live-boundary-verification',
      'users/beta-fixture-unapproved/runs/live-boundary-verification',
      'users/beta-fixture-unapproved/runs/cross-owner-verification',
      'users/beta-fixture-unverified/runs/live-boundary-verification',
    ])
  })

  it('accepts only 2xx allows and authentication or rules denials', () => {
    expect(() =>
      assertExpectedDecision({ allowed: true, label: 'allow', status: 200 }),
    ).not.toThrow()
    expect(() =>
      assertExpectedDecision({ allowed: false, label: 'deny', status: 401 }),
    ).not.toThrow()
    expect(() =>
      assertExpectedDecision({ allowed: false, label: 'deny', status: 403 }),
    ).not.toThrow()
    expect(() =>
      assertExpectedDecision({ allowed: true, label: 'allow', status: 403 }),
    ).toThrow('expected an allowed 2xx response')
    expect(() =>
      assertExpectedDecision({ allowed: false, label: 'deny', status: 400 }),
    ).toThrow('expected a denied 401/403 response')
  })
})
