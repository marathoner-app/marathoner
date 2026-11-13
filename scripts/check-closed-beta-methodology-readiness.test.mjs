import { describe, expect, it } from 'vitest'

import {
  READINESS_SCHEMA_VERSION,
  REQUIRED_CLIENT_STATES,
  REQUIRED_CONTROL_PROOFS,
  REQUIRED_OPERATIONAL_PROOFS,
  evaluateClosedBetaMethodologyReadiness,
} from './check-closed-beta-methodology-readiness.mjs'

const manifest = {
  manifestVersion: 'closed-beta-provisional-methodology@0.2.0',
  artifacts: [
    { kind: 'plan', version: 'beta-rules@0.3.0-draft' },
    { kind: 'adaptation', version: 'beta-adaptation@0.3.0-draft' },
    { kind: 'guidance', version: 'beta-guidance@0.1.0-draft' },
    { kind: 'safety', version: 'beta-safety@0.1.0-draft' },
  ],
}

function passedProofs(keys) {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      { status: 'pass', evidence: `evidence/${key}` },
    ]),
  )
}

function readyRecord() {
  return {
    schemaVersion: READINESS_SCHEMA_VERSION,
    recordedOn: '2026-11-12',
    candidate: {
      releaseIdentifier: 'ios-build-1-web-commit-abc123',
      manifestVersion: manifest.manifestVersion,
      artifactVersions: Object.fromEntries(
        manifest.artifacts.map(({ kind, version }) => [kind, version]),
      ),
    },
    clients: {
      responsiveWeb: {
        candidate: 'https://marathonerapp.com/?proof=abc123',
        releaseIdentifier: 'ios-build-1-web-commit-abc123',
        recordedAt: '2026-11-12T18:00:00.000Z',
        tester: 'owner',
        states: passedProofs(REQUIRED_CLIENT_STATES),
      },
      physicalIos: {
        candidate: 'TestFlight 1 (1)',
        releaseIdentifier: 'ios-build-1-web-commit-abc123',
        physicalDevice: true,
        recordedAt: '2026-11-12T19:00:00.000Z',
        tester: 'non-owner',
        states: passedProofs(REQUIRED_CLIENT_STATES),
      },
    },
    controls: passedProofs(REQUIRED_CONTROL_PROOFS),
    operations: passedProofs(REQUIRED_OPERATIONAL_PROOFS),
    invitationDecision: 'ready',
    decisionOwner: 'product owner',
  }
}

describe('closed-beta methodology readiness gate', () => {
  it('accepts one exact, dated, cross-client readiness record', () => {
    expect(
      evaluateClosedBetaMethodologyReadiness(readyRecord(), manifest),
    ).toEqual([])
  })

  it('blocks a missing physical-iOS state and non-device proof', () => {
    const record = readyRecord()
    record.clients.physicalIos.physicalDevice = false
    delete record.clients.physicalIos.states.symptom_escalation

    expect(
      evaluateClosedBetaMethodologyReadiness(record, manifest),
    ).toEqual(
      expect.arrayContaining([
        'physicalIos must be recorded on a physical device.',
        'physicalIos.states.symptom_escalation evidence is missing.',
      ]),
    )
  })

  it('blocks a stale manifest or artifact even when every row says pass', () => {
    const record = readyRecord()
    record.candidate.manifestVersion =
      'closed-beta-provisional-methodology@0.0.9'
    record.candidate.artifactVersions.adaptation =
      'beta-adaptation@0.1.0-draft'

    expect(
      evaluateClosedBetaMethodologyReadiness(record, manifest),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('candidate manifest'),
        expect.stringContaining('candidate adaptation artifact'),
      ]),
    )
  })

  it('blocks clients built from different release identifiers', () => {
    const record = readyRecord()
    record.clients.physicalIos.releaseIdentifier = 'different-source-revision'

    expect(
      evaluateClosedBetaMethodologyReadiness(record, manifest),
    ).toContain(
      'physicalIos releaseIdentifier does not match the locked candidate.',
    )
  })

  it('blocks pending control, operational, and invitation decisions', () => {
    const record = readyRecord()
    record.controls.rollback = { status: 'pending', evidence: '' }
    record.operations.incident = { status: 'pending', evidence: '' }
    record.invitationDecision = 'not_ready'

    expect(
      evaluateClosedBetaMethodologyReadiness(record, manifest),
    ).toEqual(
      expect.arrayContaining([
        'controls.rollback is pending.',
        'controls.rollback has no evidence reference.',
        'operations.incident is pending.',
        'operations.incident has no evidence reference.',
        'invitationDecision is not ready.',
      ]),
    )
  })

  it('blocks placeholder dates, candidates, testers, and owner decisions', () => {
    const record = readyRecord()
    record.recordedOn = 'PENDING'
    record.candidate.releaseIdentifier = 'PENDING'
    record.clients.responsiveWeb.recordedAt = 'PENDING'
    record.clients.physicalIos.tester = 'PENDING'
    record.decisionOwner = 'PENDING'

    expect(
      evaluateClosedBetaMethodologyReadiness(record, manifest),
    ).toEqual(
      expect.arrayContaining([
        'recordedOn is missing.',
        'candidate.releaseIdentifier is missing.',
        'responsiveWeb has no recorded timestamp.',
        'physicalIos has no tester role.',
        'decisionOwner is missing.',
      ]),
    )
  })

  it('blocks normalized or non-UTC evidence dates', () => {
    const record = readyRecord()
    record.recordedOn = '2026-02-31'
    record.clients.responsiveWeb.recordedAt = '11/12/2026'

    expect(
      evaluateClosedBetaMethodologyReadiness(record, manifest),
    ).toEqual(
      expect.arrayContaining([
        'recordedOn is missing.',
        'responsiveWeb has no recorded timestamp.',
      ]),
    )
  })
})
