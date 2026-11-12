import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  createDateOnly,
  createIanaTimeZone,
  createUtcDateTime,
} from '../../src/domain/training/dates.js'
import {
  createCompletedRunId,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
} from '../../src/domain/training/identifiers.js'
import type {
  CompletedRun,
  PlannedWorkout,
} from '../../src/domain/training/types.js'
import {
  createDistanceMeters,
  createDurationSeconds,
} from '../../src/domain/training/units.js'
import { TRAINING_SCHEMA_VERSION } from '../../src/persistence/trainingSchema.js'
import {
  completedRunAdminDocument,
  plannedWorkoutAdminDocument,
} from './firestoreCompletedRunDocuments.js'
import { FirestoreInternalAdaptationRecommendationStore } from './firestoreInternalAdaptationRecommendationStore.js'
import {
  INTERNAL_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
  type InternalAdaptationRecommendationCommand,
} from './internalAdaptationRecommendationContract.js'
import { evaluateInternalAdaptationRecommendation } from './internalAdaptationRecommendationHandler.js'
import { loadPinnedInternalAdaptationArtifacts } from './pinnedInternalAdaptationArtifacts.js'

const projectId = 'demo-marathoner'
const ownerId = createUserId('internal-adaptation-owner')
const planId = createTrainingPlanId('internal-adaptation-plan')
const createdAt = createUtcDateTime('2026-08-01T12:00:00.000Z')
const artifacts = loadPinnedInternalAdaptationArtifacts()
const adminApp = initializeApp({ projectId }, 'internal-adaptation-persistence')
const database = getFirestore(adminApp)
const store = new FirestoreInternalAdaptationRecommendationStore(
  database,
  () => new Date('2026-10-31T20:00:00.000Z'),
)

async function clearFirestoreEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is required.')
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
  if (!response.ok) throw new Error(`Could not clear Firestore: ${response.status}`)
}

function workout(
  id: string,
  date: string,
  status: 'planned' | 'completed',
  distance: number,
): PlannedWorkout {
  return {
    id: createPlannedWorkoutId(id),
    userId: ownerId,
    planId,
    scheduledDate: createDateOnly(date),
    phase: 'marathon_training',
    status,
    kind: 'run',
    purpose: id.endsWith('4') ? 'long' : 'easy',
    targetDistance: createDistanceMeters(distance),
    createdAt,
    updatedAt: createdAt,
  }
}

function run(
  workoutValue: PlannedWorkout,
  effort: NonNullable<CompletedRun['perceivedEffort']>,
): CompletedRun {
  return {
    id: createCompletedRunId(`run-${workoutValue.id}`),
    userId: ownerId,
    plannedWorkoutPlanId: planId,
    plannedWorkoutId: workoutValue.id,
    startedAt: createUtcDateTime(`${workoutValue.scheduledDate}T18:00:00.000Z`),
    timeZone: createIanaTimeZone('UTC'),
    distance: createDistanceMeters(5_000),
    duration: createDurationSeconds(1_800),
    perceivedEffort: effort,
    unusualPain: false,
    createdAt,
    updatedAt: createdAt,
  }
}

const current = [
  workout('current-1', '2026-10-26', 'completed', 5_000),
  workout('current-2', '2026-10-27', 'completed', 5_000),
  workout('current-3', '2026-10-29', 'completed', 5_000),
  workout('current-4', '2026-10-31', 'completed', 8_000),
]
const next = [
  workout('next-1', '2026-11-02', 'planned', 6_000),
  workout('next-2', '2026-11-03', 'planned', 6_000),
  workout('next-3', '2026-11-05', 'planned', 6_000),
  workout('next-4', '2026-11-07', 'planned', 10_000),
]
const runs = current.map((item, index) =>
  run(
    item,
    [
      'about_right',
      'harder_than_expected',
      'about_right',
      'much_harder_than_expected',
    ][index] as NonNullable<CompletedRun['perceivedEffort']>,
  ),
)

function command(
  overrides: Partial<InternalAdaptationRecommendationCommand> = {},
): InternalAdaptationRecommendationCommand {
  return {
    schemaVersion: INTERNAL_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
    commandId: 'internal-adaptation-emulator-0001',
    triggerWorkoutId: createPlannedWorkoutId('current-4'),
    evaluationDate: createDateOnly('2026-10-31'),
    confirmedRescheduleTargetDate: null,
    ...overrides,
  }
}

async function seedState() {
  const timestamp = Timestamp.fromDate(new Date(createdAt))
  const writes: Promise<unknown>[] = [
    database.doc(`betaMemberships/${ownerId}`).set({
      schemaVersion: 1,
      userId: ownerId,
      status: 'approved',
      approvedAt: timestamp,
      approvedBy: 'internal-adaptation-emulator',
    }),
    database.doc(`users/${ownerId}/planState/active`).set({
      schemaVersion: 1,
      trainingSchemaVersion: TRAINING_SCHEMA_VERSION,
      userId: ownerId,
      activePlanId: planId,
      activePlanRevision: 3,
      approvedAt: timestamp,
      updatedAt: timestamp,
    }),
    database.doc(`users/${ownerId}/plans/${planId}`).set({
      schemaVersion: TRAINING_SCHEMA_VERSION,
      userId: ownerId,
      name: 'Founding beta completion plan',
      startDate: '2026-08-24',
      targetRaceDate: '2027-01-31',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    database.doc(`users/${ownerId}/plans/${planId}/metadata/generation`).set({
      userId: ownerId,
      planId,
      rulesetVersion: artifacts.basePlan.rules.rulesetVersion,
    }),
    ...[...current, ...next].map((item) =>
      database
        .doc(`users/${ownerId}/plans/${planId}/workouts/${item.id}`)
        .set(plannedWorkoutAdminDocument(item)),
    ),
    ...runs.map((item) =>
      database
        .doc(`users/${ownerId}/runs/${item.id}`)
        .set(completedRunAdminDocument(item)),
    ),
  ]
  await Promise.all(writes)
}

beforeEach(clearFirestoreEmulator)
afterAll(async () => deleteApp(adminApp))

describe('Firestore internal adaptation recommendation command', () => {
  it('creates one pending recommendation and replays the exact command', async () => {
    await seedState()
    const request = command()
    let evaluations = 0
    const execute = () =>
      store.execute({
        command: request,
        ownerId,
        evaluate: (snapshot) => {
          evaluations += 1
          return evaluateInternalAdaptationRecommendation(
            request,
            snapshot,
            artifacts,
            createUtcDateTime('2026-10-31T20:00:00.000Z'),
          )
        },
      })

    const first = await execute()
    const replay = await execute()
    expect(first).toEqual(replay)
    expect(first).toMatchObject({
      kind: 'completed',
      result: { status: 'pending_recommendation_created' },
    })
    expect(evaluations).toBe(1)
    const recommendations = await database
      .collection(`users/${ownerId}/recommendationEvidence`)
      .get()
    expect(recommendations.size).toBe(1)
    expect(recommendations.docs[0]?.data()).toMatchObject({
      decision: 'pending',
      evaluatedPlanId: planId,
      evaluationResult: { action: 'hold_progression' },
    })
    expect(
      (
        await database
          .doc(`users/${ownerId}/planState/active`)
          .get()
      ).data()?.activePlanRevision,
    ).toBe(3)
  })

  it('reuses one matching pending recommendation for a fresh command on the same plan revision', async () => {
    await seedState()
    const firstCommand = command()
    const secondCommand = command({
      commandId: 'internal-adaptation-emulator-0002',
    })
    const execute = (request: InternalAdaptationRecommendationCommand) =>
      store.execute({
        command: request,
        ownerId,
        evaluate: (snapshot) =>
          evaluateInternalAdaptationRecommendation(
            request,
            snapshot,
            artifacts,
            createUtcDateTime('2026-10-31T20:00:00.000Z'),
          ),
      })

    const first = await execute(firstCommand)
    const second = await execute(secondCommand)
    expect(first).toMatchObject({
      kind: 'completed',
      result: { status: 'pending_recommendation_created' },
    })
    expect(second).toMatchObject({
      kind: 'completed',
      result: {
        status: 'pending_recommendation_created',
        commandId: secondCommand.commandId,
        recommendationId:
          first.kind === 'completed' &&
          first.result.status === 'pending_recommendation_created'
            ? first.result.recommendationId
            : '',
      },
    })
    expect(
      (
        await database.collection(`users/${ownerId}/recommendationEvidence`).get()
      ).size,
    ).toBe(1)
  })

  it('refuses missing membership before loading or writing owner outcomes', async () => {
    await seedState()
    await database.doc(`betaMemberships/${ownerId}`).delete()
    await expect(
      store.execute({
        command: command(),
        ownerId,
        evaluate: () => {
          throw new Error('Evaluation must not run.')
        },
      }),
    ).resolves.toEqual({ kind: 'membership-required' })
    expect(
      (
        await database
          .collection(`users/${ownerId}/recommendationEvidence`)
          .get()
      ).empty,
    ).toBe(true)
  })

  it('rejects reuse of one command ID with different trigger facts', async () => {
    await seedState()
    const first = command()
    await store.execute({
      command: first,
      ownerId,
      evaluate: (snapshot) =>
        evaluateInternalAdaptationRecommendation(
          first,
          snapshot,
          artifacts,
          createUtcDateTime('2026-10-31T20:00:00.000Z'),
        ),
    })
    await expect(
      store.execute({
        command: command({ evaluationDate: createDateOnly('2026-10-30') }),
        ownerId,
        evaluate: () => {
          throw new Error('A conflicting command must not be evaluated.')
        },
      }),
    ).resolves.toEqual({ kind: 'conflict' })
  })
})
