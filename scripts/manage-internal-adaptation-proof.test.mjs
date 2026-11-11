import { describe, expect, it } from 'vitest'

import {
  ADAPTATION_PROOF_CONFIRMATIONS,
  DEVELOPMENT_PROJECT_ID,
  adaptationProofDocumentPaths,
  adaptationProofDocuments,
  assertAdaptationProofOptions,
  createAdaptationProofFixture,
  parseAdaptationProofArguments,
  validateAdaptationProofManifest,
} from './manage-internal-adaptation-proof.mjs'

function validManifest() {
  const fixture = createAdaptationProofFixture()
  return {
    account: {
      email: fixture.email,
      password: 'fixture-password-longer-than-20-characters',
      role: fixture.role,
      uid: fixture.uid,
    },
    createdAt: '2026-11-11T00:00:00.000Z',
    projectId: DEVELOPMENT_PROJECT_ID,
    schemaVersion: 1,
  }
}

describe('internal adaptation proof fixture manager', () => {
  it.each(Object.entries(ADAPTATION_PROOF_CONFIRMATIONS))(
    'accepts the explicit %s action and confirmation',
    (action, confirmation) => {
      expect(
        parseAdaptationProofArguments([
          action,
          '--project',
          DEVELOPMENT_PROJECT_ID,
          '--confirm',
          confirmation,
        ]),
      ).toEqual({ action, confirmation, projectId: DEVELOPMENT_PROJECT_ID })
    },
  )

  it('rejects unsupported actions', () => {
    expect(() => parseAdaptationProofArguments(['inspect'])).toThrow(
      'Use prepare, refresh, verify, or cleanup',
    )
  })

  it('requires the exact development project, operator, and action phrase', () => {
    const options = {
      action: 'prepare',
      confirmation: ADAPTATION_PROOF_CONFIRMATIONS.prepare,
      operatorEmail: 'kevin-admin@marathonerapp.com',
      projectId: DEVELOPMENT_PROJECT_ID,
    }
    expect(() => assertAdaptationProofOptions(options)).not.toThrow()
    expect(() =>
      assertAdaptationProofOptions({
        ...options,
        projectId: 'marathonerapp-beta',
      }),
    ).toThrow('expected the development project')
    expect(() =>
      assertAdaptationProofOptions({
        ...options,
        operatorEmail: 'personal@example.com',
      }),
    ).toThrow('expected the dedicated operator')
    expect(() =>
      assertAdaptationProofOptions({ ...options, confirmation: 'yes' }),
    ).toThrow(ADAPTATION_PROOF_CONFIRMATIONS.prepare)
  })

  it('creates a random, verified, fictional identity', () => {
    const first = createAdaptationProofFixture()
    const second = createAdaptationProofFixture()

    expect(first).toMatchObject({
      emailVerified: true,
      role: 'adaptation-proof',
    })
    expect(first.email).toMatch(
      /^internal-adaptation-proof-[a-f0-9]+@marathonerapp\.com$/u,
    )
    expect(first.uid).toMatch(/^internal-adaptation-proof-[a-f0-9]+$/u)
    expect(first.uid).not.toBe(second.uid)
  })

  it('accepts only a safe local development manifest', () => {
    const manifest = validManifest()
    expect(validateAdaptationProofManifest(manifest)).toEqual(manifest)
    expect(() =>
      validateAdaptationProofManifest({
        ...manifest,
        projectId: 'marathonerapp-beta',
      }),
    ).toThrow('manifest is invalid')

    manifest.account.email = 'participant@example.com'
    expect(() => validateAdaptationProofManifest(manifest)).toThrow(
      'manifest is invalid',
    )
  })

  it('creates one coherent active plan with completed and upcoming training', () => {
    const fixture = createAdaptationProofFixture()
    const documents = adaptationProofDocuments(
      fixture,
      '2026-11-11T12:00:00.000Z',
    )
    const paths = adaptationProofDocumentPaths(fixture)

    expect(documents.map(({ documentPath }) => documentPath)).toEqual(paths)
    expect(documents).toHaveLength(17)
    expect(
      documents.find(({ documentPath }) =>
        documentPath.endsWith('/planState/active'),
      )?.fields.activePlanRevision,
    ).toEqual({ integerValue: '3' })
    expect(
      documents.find(({ documentPath }) =>
        documentPath === `users/${fixture.uid}`,
      )?.fields.consistentRunningWeeks,
    ).toEqual({ integerValue: '12' })

    const completed = documents.filter(({ documentPath, fields }) =>
      documentPath.includes('/workouts/') &&
      fields.status?.stringValue === 'completed',
    )
    const planned = documents.filter(({ documentPath, fields }) =>
      documentPath.includes('/workouts/') &&
      fields.status?.stringValue === 'planned',
    )
    const runs = documents.filter(({ documentPath }) =>
      documentPath.includes('/runs/'),
    )

    expect(completed).toHaveLength(4)
    expect(planned).toHaveLength(4)
    expect(runs).toHaveLength(4)
    expect(completed.map(({ fields }) => fields.scheduledDate.stringValue)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-05',
      '2026-11-07',
    ])
    expect(planned.map(({ fields }) => fields.scheduledDate.stringValue)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-12',
      '2026-11-14',
    ])
    expect(
      completed.map(({ fields }) => fields.targetDistanceMeters.integerValue),
    ).toEqual(['5000', '5000', '5000', '8000'])
    expect(
      planned.map(({ fields }) => fields.targetDistanceMeters.integerValue),
    ).toEqual(['6000', '6000', '6000', '10000'])
    expect(runs.map(({ fields }) => fields.perceivedEffort.stringValue)).toEqual([
      'about_right',
      'harder_than_expected',
      'about_right',
      'much_harder_than_expected',
    ])
    expect(
      runs.every(
        ({ fields }) =>
          fields.plannedWorkoutPlanId.stringValue === 'adaptation-proof-plan' &&
          fields.unusualPain.booleanValue === false,
      ),
    ).toBe(true)
  })

  it('rejects an invalid preparation timestamp', () => {
    expect(() =>
      adaptationProofDocuments(createAdaptationProofFixture(), 'not-a-date'),
    ).toThrow('valid timestamp')
  })
})
