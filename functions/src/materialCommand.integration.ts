import { deleteApp as deleteAdminApp, initializeApp as initializeAdminApp } from 'firebase-admin/app'
import {
  getFirestore as getAdminFirestore,
  Timestamp,
} from 'firebase-admin/firestore'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from 'firebase/auth'
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  createAccountDeletionRequest,
  createPlanApprovalCommand,
  createProofMaterialCommand,
  createRunCompletionCommand,
  createRunDeletionCommand,
  isMaterialCommandResult,
  type MaterialCommandEnvelope,
  type PlanApprovalReceiptResult,
  type RunCompletionReceiptResult,
  type RunDeletionReceiptResult,
} from '../../src/domain/materialCommands/contract.js'
import {
  createIanaTimeZone,
  createUtcDateTime,
} from '../../src/domain/training/dates.js'
import {
  createCompletedRunId,
  createPlannedWorkoutId,
  createShoeId,
  createTrainingPlanId,
} from '../../src/domain/training/identifiers.js'
import {
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  type GeneratedPlanV1,
} from '../../src/domain/training/planGeneration.js'
import { planGenerationContractFixtures } from '../../src/domain/training/planGenerationFixtures.js'
import {
  createDistanceMeters,
  createDurationSeconds,
} from '../../src/domain/training/units.js'
import {
  createCompletedRunCommandClient,
  type RunCompletionSubmission,
  type RunDeletionSubmission,
} from '../../src/services/completedRunCommandClient.js'
import {
  createMaterialCommandClient,
  type MaterialCommandTransport,
} from '../../src/services/materialCommandClient.js'
import type { PlanApprovalArtifactPolicyRecord } from './planApprovalArtifactPolicy.js'
import { FirestorePlanApprovalStore } from './firestorePlanApprovalStore.js'
import { FirestoreRunCompletionStore } from './firestoreRunCompletionStore.js'
import { FirestoreRunDeletionStore } from './firestoreRunDeletionStore.js'

const projectId = 'demo-marathoner'
const email = 'material-command-owner@example.test'
const password = 'material-command-owner-password'
const otherEmail = 'material-command-other@example.test'
const otherPassword = 'material-command-other-password'

let clientApp: FirebaseApp
let auth: Auth
let otherClientApp: FirebaseApp
let otherAuth: Auth
let ownerId: string
let otherOwnerId: string
let submit: ReturnType<typeof httpsCallable<MaterialCommandEnvelope, unknown>>
let resolve: ReturnType<typeof httpsCallable<{ commandId: string }, unknown>>
let otherSubmit: ReturnType<
  typeof httpsCallable<MaterialCommandEnvelope, unknown>
>
let otherResolve: ReturnType<
  typeof httpsCallable<{ commandId: string }, unknown>
>
let requestDeletion: ReturnType<
  typeof httpsCallable<MaterialCommandEnvelope, unknown>
>
const adminApp = initializeAdminApp({ projectId }, 'material-command-integration')
const database = getAdminFirestore(adminApp)

const matchedGeneratedFixture = planGenerationContractFixtures.find(
  (fixture) => fixture.id === 'generated-exact-date-distance-target',
)
if (matchedGeneratedFixture?.result.kind !== 'generated') {
  throw new Error('Expected the generated plan contract fixture.')
}
const generatedFixture = {
  input: matchedGeneratedFixture.input,
  plan: matchedGeneratedFixture.result.plan,
}
const supportedScopeId = 'synthetic-consistent-runner@1'
const runPlanId = createTrainingPlanId('run-command-plan-0001')
const runWorkoutId = createPlannedWorkoutId('run-command-workout-0001')
const runShoeId = createShoeId('run-command-shoe-0001')
const workoutUpdatedAt = createUtcDateTime('2026-10-08T18:00:00.000Z')

function runCompletionCommand(
  commandId: string,
  options: {
    plannedWorkout?: {
      planId: typeof runPlanId
      workoutId: typeof runWorkoutId
      expectedUpdatedAt: typeof workoutUpdatedAt
    } | null
    shoeId?: typeof runShoeId
  } = {},
) {
  return createRunCompletionCommand(commandId, {
    plannedWorkout: options.plannedWorkout ?? null,
    ...(options.shoeId === undefined ? {} : { shoeId: options.shoeId }),
    startedAt: createUtcDateTime('2026-10-08T17:00:00.000Z'),
    timeZone: createIanaTimeZone('America/Los_Angeles'),
    distance: createDistanceMeters(5_000),
    duration: createDurationSeconds(1_800),
    perceivedEffort: 'about_right',
    unusualPain: false,
    notes: 'Emulator completion fixture',
  })
}

function runDeletionCommand(
  commandId: string,
  completion: RunCompletionReceiptResult,
) {
  return createRunDeletionCommand(commandId, {
    completedRunId: completion.completedRunId,
    expectedCompletedRunUpdatedAt: completion.completedRunUpdatedAt,
    plannedWorkout:
      completion.completedPlannedWorkout === null
        ? null
        : {
            planId: completion.completedPlannedWorkout.planId,
            workoutId: completion.completedPlannedWorkout.workoutId,
            expectedUpdatedAt: completion.completedPlannedWorkout.updatedAt,
          },
  })
}

function workoutPath(
  workoutId: string = runWorkoutId,
  planId: string = runPlanId,
) {
  return `users/${ownerId}/plans/${planId}/workouts/${workoutId}`
}

function guardPath(
  workoutId: string = runWorkoutId,
  planId: string = runPlanId,
) {
  return `${workoutPath(workoutId, planId)}/completionState/current`
}

async function seedWorkout(options: {
  planId?: string
  workoutId?: string
  userId?: string
  kind?: 'rest' | 'run'
  status?: 'planned' | 'completed'
  updatedAt?: string
} = {}) {
  const kind = options.kind ?? 'run'
  const path = workoutPath(options.workoutId, options.planId)
  await database.doc(path).set({
    schemaVersion: 1,
    userId: options.userId ?? ownerId,
    planId: options.planId ?? runPlanId,
    scheduledDate: '2026-10-08',
    phase: 'base_building',
    status: options.status ?? 'planned',
    kind,
    ...(kind === 'run'
      ? { purpose: 'easy', targetDistanceMeters: 5_000 }
      : {}),
    createdAt: Timestamp.fromDate(new Date('2026-10-01T18:00:00.000Z')),
    updatedAt: Timestamp.fromDate(
      new Date(options.updatedAt ?? workoutUpdatedAt),
    ),
  })
  return path
}

async function seedShoe(options: {
  shoeId?: string
  userId?: string
  status?: 'active' | 'retired'
} = {}) {
  const status = options.status ?? 'active'
  const shoeId = options.shoeId ?? runShoeId
  const path = `users/${ownerId}/shoes/${shoeId}`
  await database.doc(path).set({
    schemaVersion: 1,
    userId: options.userId ?? ownerId,
    name: 'Emulator Daily Trainer',
    startingDistanceMeters: 100_000,
    status,
    ...(status === 'retired' ? { retiredOn: '2026-10-07' } : {}),
    createdAt: Timestamp.fromDate(new Date('2026-10-01T18:00:00.000Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-10-07T18:00:00.000Z')),
  })
  return path
}

function approvalCommand(
  commandId: string,
  expectedActivePlanRevision: number | null,
  proposal: GeneratedPlanV1 = generatedFixture.plan,
) {
  return createPlanApprovalCommand(commandId, {
    expectedActivePlanRevision,
    input: generatedFixture.input,
    proposal,
  })
}

function approvedPolicyRecord(): PlanApprovalArtifactPolicyRecord {
  return {
    supportedScopeId,
    inputSchemaVersion: generatedFixture.input.schemaVersion,
    generatorVersion:
      generatedFixture.plan.provenance.generatorVersion,
    rulesetVersion: generatedFixture.input.rulesetVersion,
    generatedPlanSchemaVersion: generatedFixture.plan.schemaVersion,
    resultSchemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
    reviewState: 'approved',
  }
}

function requirePlanApprovalReceipt(value: unknown): PlanApprovalReceiptResult {
  if (!isMaterialCommandResult(value) || value.status !== 'plan_approved') {
    throw new Error('Expected a plan-approval receipt.')
  }
  return value
}

function requireRunCompletionReceipt(value: unknown): RunCompletionReceiptResult {
  if (!isMaterialCommandResult(value) || value.status !== 'run_completed') {
    throw new Error('Expected a run-completion receipt.')
  }
  return value
}

function requireRunDeletionReceipt(value: unknown): RunDeletionReceiptResult {
  if (!isMaterialCommandResult(value) || value.status !== 'run_deleted') {
    throw new Error('Expected a run-deletion receipt.')
  }
  return value
}

async function clearFirestoreEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is required.')
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
  if (!response.ok) {
    throw new Error(`Could not clear Firestore emulator: ${response.status}`)
  }
}

async function signInOwner() {
  await signInWithEmailAndPassword(auth, email, password)
}

async function signInOther() {
  await signInWithEmailAndPassword(otherAuth, otherEmail, otherPassword)
}

async function signInOwnerOnBothClients() {
  await Promise.all([
    signInWithEmailAndPassword(auth, email, password),
    signInWithEmailAndPassword(otherAuth, email, password),
  ])
}

function callableTransport(
  submitCommand: typeof submit,
  resolveCommand: typeof resolve,
): MaterialCommandTransport {
  return {
    async submit(command) {
      return (await submitCommand(command)).data
    },
    async resolve(commandId) {
      return (await resolveCommand({ commandId })).data
    },
  }
}

function completionSubmission(
  commandId: string,
  durationSeconds = 1_800,
): RunCompletionSubmission {
  const envelope = runCompletionCommand(commandId, {
    plannedWorkout: {
      planId: runPlanId,
      workoutId: runWorkoutId,
      expectedUpdatedAt: workoutUpdatedAt,
    },
  })
  return {
    commandId: envelope.commandId,
    input: {
      ...envelope.command.input,
      duration: createDurationSeconds(durationSeconds),
    },
  }
}

function deletionSubmission(
  commandId: string,
  completion: RunCompletionReceiptResult,
): RunDeletionSubmission {
  const envelope = runDeletionCommand(commandId, completion)
  return {
    commandId: envelope.commandId,
    completedRunId: envelope.command.completedRunId,
    expectedCompletedRunUpdatedAt:
      envelope.command.expectedCompletedRunUpdatedAt,
    plannedWorkout: envelope.command.plannedWorkout,
  }
}

async function expectCompletedRunState(
  completion: RunCompletionReceiptResult,
) {
  await expect(
    database.doc(`users/${ownerId}/runs/${completion.completedRunId}`).get(),
  ).resolves.toEqual(expect.objectContaining({ exists: true }))
  expect((await database.doc(workoutPath()).get()).data()).toEqual(
    expect.objectContaining({ status: 'completed' }),
  )
  expect((await database.doc(guardPath()).get()).data()).toEqual(
    expect.objectContaining({ completedRunId: completion.completedRunId }),
  )
  await expect(
    database.collection(`users/${ownerId}/runs`).get(),
  ).resolves.toEqual(expect.objectContaining({ size: 1 }))
  await expect(
    database
      .doc(
        `materialCommandReceipts/${ownerId}/commands/${completion.commandId}`,
      )
      .get(),
  ).resolves.toEqual(expect.objectContaining({ exists: true }))
}

async function expectDeletedRunState(
  completion: RunCompletionReceiptResult,
  deletion: RunDeletionReceiptResult,
) {
  await expect(
    database.doc(`users/${ownerId}/runs/${completion.completedRunId}`).get(),
  ).resolves.toEqual(expect.objectContaining({ exists: false }))
  expect((await database.doc(workoutPath()).get()).data()).toEqual(
    expect.objectContaining({ status: 'planned' }),
  )
  await expect(database.doc(guardPath()).get()).resolves.toEqual(
    expect.objectContaining({ exists: false }),
  )
  await expect(
    database.collection(`users/${ownerId}/runs`).get(),
  ).resolves.toEqual(expect.objectContaining({ empty: true }))
  expect(
    (
      await database
        .doc(
          `materialCommandReceipts/${ownerId}/commands/${deletion.commandId}`,
        )
        .get()
    ).data()?.result,
  ).toEqual(deletion)
}

beforeAll(async () => {
  clientApp = initializeApp(
    { apiKey: 'demo-api-key', projectId },
    'material-command-integration',
  )
  auth = getAuth(clientApp)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  })
  const functions = getFunctions(clientApp, 'us-central1')
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  submit = httpsCallable(functions, 'submitMaterialCommand')
  resolve = httpsCallable(functions, 'resolveMaterialCommand')
  requestDeletion = httpsCallable(functions, 'requestAccountDeletion')

  otherClientApp = initializeApp(
    { apiKey: 'demo-api-key', projectId },
    'material-command-integration-other',
  )
  otherAuth = getAuth(otherClientApp)
  connectAuthEmulator(otherAuth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  })
  const otherFunctions = getFunctions(otherClientApp, 'us-central1')
  connectFunctionsEmulator(otherFunctions, '127.0.0.1', 5001)
  otherSubmit = httpsCallable(otherFunctions, 'submitMaterialCommand')
  otherResolve = httpsCallable(otherFunctions, 'resolveMaterialCommand')

  const credential = await createUserWithEmailAndPassword(auth, email, password)
  ownerId = credential.user.uid
  const otherCredential = await createUserWithEmailAndPassword(
    auth,
    otherEmail,
    otherPassword,
  )
  otherOwnerId = otherCredential.user.uid
  await signOut(auth)
})

beforeEach(async () => {
  await clearFirestoreEmulator()
  await signOut(auth)
  await signOut(otherAuth)
})

afterAll(async () => {
  await Promise.all([deleteApp(clientApp), deleteApp(otherClientApp)])
  await deleteAdminApp(adminApp)
})

describe('material-command emulator boundary', () => {
  it('returns typed authentication and App Check rejections for deletion requests', async () => {
    const command = createAccountDeletionRequest('delete-command-app-check')

    const anonymous = await requestDeletion(command)
    expect(anonymous.data).toEqual(
      expect.objectContaining({
        status: 'authentication_error',
        code: 'authentication-required',
      }),
    )

    await signInOwner()
    const missingAppCheck = await requestDeletion(command)
    expect(missingAppCheck.data).toEqual(
      expect.objectContaining({
        status: 'authorization_error',
        code: 'app-check-required',
      }),
    )
    await expect(
      database.collection('accountDeletionRequests').get(),
    ).resolves.toEqual(expect.objectContaining({ empty: true }))
  })

  it('rejects unauthenticated and payload-supplied foreign ownership', async () => {
    const unauthenticated = await submit(
      createProofMaterialCommand('proof-command-anonymous'),
    )
    expect(unauthenticated.data).toEqual(
      expect.objectContaining({ status: 'authentication_error' }),
    )

    await signInOwner()
    const foreignOwnership = await submit({
      ...createProofMaterialCommand('proof-command-foreign-user'),
      userId: 'another-runner',
    } as unknown as MaterialCommandEnvelope)
    expect(foreignOwnership.data).toEqual(
      expect.objectContaining({
        status: 'validation_error',
        code: 'ownership-field-prohibited',
      }),
    )
    await expect(
      database.doc(`materialCommandProofs/${ownerId}`).get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
  })

  it('commits one effect and returns the original receipt for a duplicate ID', async () => {
    await signInOwner()
    const command = createProofMaterialCommand('proof-command-idempotent')

    const first = await submit(command)
    const second = await submit(command)

    expect(second.data).toEqual(first.data)
    expect(first.data).toEqual(
      expect.objectContaining({ status: 'committed', proofCount: 1 }),
    )
    const proof = await database.doc(`materialCommandProofs/${ownerId}`).get()
    expect(proof.data()?.proofCount).toBe(1)
  })

  it('rejects unsupported app and command-schema versions with typed results', async () => {
    await signInOwner()
    const appVersion = await submit({
      ...createProofMaterialCommand('proof-command-app-version'),
      appProtocolVersion: 2,
    } as unknown as MaterialCommandEnvelope)
    const schemaVersion = await submit({
      ...createProofMaterialCommand('proof-command-schema-version'),
      command: {
        type: 'proof.material-command',
        schemaVersion: 2,
        proofVariant: 'default',
      },
    } as unknown as MaterialCommandEnvelope)

    expect(appVersion.data).toEqual(
      expect.objectContaining({
        status: 'unsupported_version',
        code: 'unsupported-app-protocol-version',
      }),
    )
    expect(schemaVersion.data).toEqual(
      expect.objectContaining({
        status: 'unsupported_version',
        code: 'unsupported-command-schema-version',
      }),
    )
  })

  it('returns a conflict when one ID identifies two valid commands', async () => {
    await signInOwner()
    const commandId = 'proof-command-conflict'
    await submit(createProofMaterialCommand(commandId, 'default'))

    const conflict = await submit(
      createProofMaterialCommand(commandId, 'alternate'),
    )

    expect(conflict.data).toEqual(
      expect.objectContaining({ status: 'conflict', code: 'command-id-reused' }),
    )
    const proof = await database.doc(`materialCommandProofs/${ownerId}`).get()
    expect(proof.data()?.proofCount).toBe(1)
  })

  it('does not resolve another authenticated owner\'s receipt', async () => {
    await signInOwner()
    const command = createProofMaterialCommand('proof-command-owner-isolation')
    await submit(command)
    await signOut(auth)
    await signInWithEmailAndPassword(auth, otherEmail, otherPassword)

    const result = await resolve({ commandId: command.commandId })

    expect(result.data).toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        code: 'resolve-by-command-id',
      }),
    )
  })

  it('resolves an ambiguous committed response by command ID before retrying', async () => {
    await signInOwner()
    const command = createProofMaterialCommand('proof-command-ambiguous')
    const transport: MaterialCommandTransport = {
      async submit(envelope) {
        await submit(envelope)
        throw { code: 'functions/deadline-exceeded' }
      },
      async resolve(commandId) {
        return (await resolve({ commandId })).data
      },
    }
    const client = createMaterialCommandClient({
      isOnline: () => true,
      transport,
    })

    await expect(client.submit(command)).resolves.toEqual(
      expect.objectContaining({ status: 'outcome_unknown', commandId: command.commandId }),
    )
    await expect(client.resolve(command.commandId)).resolves.toEqual(
      expect.objectContaining({ status: 'committed', proofCount: 1 }),
    )
    const proof = await database.doc(`materialCommandProofs/${ownerId}`).get()
    expect(proof.data()?.proofCount).toBe(1)
  })

  it('atomically approves a plan and returns the exact receipt for retry and resolution', async () => {
    await signInOwner()
    const command = approvalCommand('approve-plan-emulator-success', null)

    const first = requirePlanApprovalReceipt((await submit(command)).data)
    const retry = (await submit(command)).data
    const resolved = (await resolve({ commandId: command.commandId })).data

    expect(retry).toEqual(first)
    expect(resolved).toEqual(first)
    expect(first).toEqual(
      expect.objectContaining({
        status: 'plan_approved',
        commandId: command.commandId,
        activePlanRevision: 1,
      }),
    )
    const planPath = `users/${ownerId}/plans/${first.planId}`
    await expect(database.doc(planPath).get()).resolves.toEqual(
      expect.objectContaining({ exists: true }),
    )
    const workouts = await database.collection(`${planPath}/workouts`).get()
    expect(workouts.docs.map(({ id }) => id).sort()).toEqual(
      command.command.proposal.weeks
        .flatMap((week) => week.workouts.map(({ id }) => id))
        .sort(),
    )
    const activeState = (
      await database.doc(`users/${ownerId}/planState/active`).get()
    ).data()
    expect(activeState).toEqual(
      expect.objectContaining({
        userId: ownerId,
        activePlanId: first.planId,
        activePlanRevision: 1,
      }),
    )
    const provenance = (
      await database.doc(`${planPath}/metadata/generation`).get()
    ).data()
    expect(provenance).toEqual(
      expect.objectContaining({
        userId: ownerId,
        planId: first.planId,
        commandId: command.commandId,
        supportedScopeId,
        artifactReviewState: 'approved',
      }),
    )
    await expect(
      database.collection(`users/${ownerId}/plans`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))
  })

  it('returns conflict for changed content without changing the committed plan', async () => {
    await signInOwner()
    const commandId = 'approve-plan-emulator-conflict'
    const first = requirePlanApprovalReceipt(
      (await submit(approvalCommand(commandId, null))).data,
    )
    const changedPlan = {
      ...generatedFixture.plan,
      name: 'Changed but structurally valid plan',
    }

    const conflict = await submit(
      approvalCommand(commandId, null, changedPlan),
    )

    expect(conflict.data).toEqual(
      expect.objectContaining({ status: 'conflict', code: 'command-id-reused' }),
    )
    const activeState = (
      await database.doc(`users/${ownerId}/planState/active`).get()
    ).data()
    expect(activeState).toEqual(
      expect.objectContaining({
        activePlanId: first.planId,
        activePlanRevision: 1,
      }),
    )
    await expect(
      database.collection(`users/${ownerId}/plans`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))
  })

  it('rejects a stale revision without writes and retires one plan on valid replacement', async () => {
    await signInOwner()
    const first = requirePlanApprovalReceipt(
      (await submit(approvalCommand('approve-plan-emulator-first', null))).data,
    )
    const staleCommand = approvalCommand(
      'approve-plan-emulator-stale',
      null,
    )

    const stale = await submit(staleCommand)

    expect(stale.data).toEqual({
      status: 'stale_revision',
      commandId: staleCommand.commandId,
      code: 'active-plan-revision-changed',
      message: 'The active training plan changed before this approval was committed.',
      expectedActivePlanRevision: null,
      actualActivePlanRevision: 1,
    })
    await expect(
      database
        .doc(
          `materialCommandReceipts/${ownerId}/commands/${staleCommand.commandId}`,
        )
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
    await expect(
      database.collection(`users/${ownerId}/plans`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))

    const replacementCommand = approvalCommand(
      'approve-plan-emulator-replacement',
      1,
    )
    const replacement = requirePlanApprovalReceipt(
      (await submit(replacementCommand)).data,
    )
    expect(replacement.activePlanRevision).toBe(2)
    expect((await submit(replacementCommand)).data).toEqual(replacement)
    expect(
      (await database.doc(`users/${ownerId}/plans/${first.planId}`).get()).data()
        ?.status,
    ).toBe('archived')
    expect(
      (
        await database.doc(`users/${ownerId}/plans/${replacement.planId}`).get()
      ).data()?.status,
    ).toBe('active')
    expect(
      (await database.doc(`users/${ownerId}/planState/active`).get()).data(),
    ).toEqual(
      expect.objectContaining({
        activePlanId: replacement.planId,
        activePlanRevision: 2,
      }),
    )
    await expect(
      database.collection(`users/${ownerId}/plans`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 2 }))
  })

  it('isolates plan receipts and records between two authenticated logical clients', async () => {
    await Promise.all([signInOwner(), signInOther()])
    const command = approvalCommand('approve-plan-emulator-isolation', null)
    const ownerReceipt = requirePlanApprovalReceipt(
      (await submit(command)).data,
    )

    const foreignResolution = await otherResolve({ commandId: command.commandId })

    expect(foreignResolution.data).toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        code: 'resolve-by-command-id',
      }),
    )
    await expect(
      database.doc(`users/${otherOwnerId}/plans/${ownerReceipt.planId}`).get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))

    const otherReceipt = requirePlanApprovalReceipt(
      (await otherSubmit(command)).data,
    )
    expect(otherReceipt.planId).not.toBe(ownerReceipt.planId)
    await expect(
      database.doc(`users/${ownerId}/plans/${otherReceipt.planId}`).get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
  })

  it('rolls back every projected write when one workout create fails', async () => {
    const command = approvalCommand('approve-plan-emulator-rollback', null)
    const fixedPlanId = 'plan-partial-failure'
    const collidingWorkoutId = command.command.proposal.weeks[0]?.workouts[0]?.id
    if (!collidingWorkoutId) throw new Error('Expected a generated workout.')
    const collidingWorkoutPath =
      `users/${ownerId}/plans/${fixedPlanId}/workouts/${collidingWorkoutId}`
    await database.doc(collidingWorkoutPath).set({ collision: true })
    const store = new FirestorePlanApprovalStore(database, {
      createPlanId: () => fixedPlanId,
      now: () => new Date('2026-10-08T20:00:00.000Z'),
    })

    await expect(
      store.commit({
        artifactPolicyRecord: approvedPolicyRecord(),
        envelope: command,
        ownerId,
      }),
    ).rejects.toBeDefined()

    for (const path of [
      `users/${ownerId}/plans/${fixedPlanId}`,
      `users/${ownerId}/plans/${fixedPlanId}/metadata/generation`,
      `users/${ownerId}/planState/active`,
      `materialCommandReceipts/${ownerId}/commands/${command.commandId}`,
    ]) {
      await expect(database.doc(path).get()).resolves.toEqual(
        expect.objectContaining({ exists: false }),
      )
    }
    await expect(database.doc(collidingWorkoutPath).get()).resolves.toEqual(
      expect.objectContaining({ exists: true }),
    )
  })

  it('atomically completes a planned run once and replays the exact receipt', async () => {
    await Promise.all([seedWorkout(), seedShoe()])
    await signInOwner()
    const command = runCompletionCommand('complete-run-emulator-planned', {
      plannedWorkout: {
        planId: runPlanId,
        workoutId: runWorkoutId,
        expectedUpdatedAt: workoutUpdatedAt,
      },
      shoeId: runShoeId,
    })

    const first = requireRunCompletionReceipt((await submit(command)).data)
    const retry = (await submit(command)).data
    const resolved = (await resolve({ commandId: command.commandId })).data

    expect(retry).toEqual(first)
    expect(resolved).toEqual(first)
    expect(first.completedPlannedWorkout).toEqual({
      planId: runPlanId,
      workoutId: runWorkoutId,
      updatedAt: first.completedRunUpdatedAt,
    })
    const run = (
      await database
        .doc(`users/${ownerId}/runs/${first.completedRunId}`)
        .get()
    ).data()
    expect(run).toEqual(
      expect.objectContaining({
        userId: ownerId,
        plannedWorkoutPlanId: runPlanId,
        plannedWorkoutId: runWorkoutId,
        shoeId: runShoeId,
        distanceMeters: 5_000,
        durationSeconds: 1_800,
      }),
    )
    expect((await database.doc(workoutPath()).get()).data()).toEqual(
      expect.objectContaining({ status: 'completed' }),
    )
    expect((await database.doc(guardPath()).get()).data()).toEqual(
      expect.objectContaining({
        userId: ownerId,
        planId: runPlanId,
        plannedWorkoutId: runWorkoutId,
        completedRunId: first.completedRunId,
        commandId: command.commandId,
      }),
    )
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))

    const changedCommand = createRunCompletionCommand(command.commandId, {
      ...command.command.input,
      duration: createDurationSeconds(1_801),
    })
    expect((await submit(changedCommand)).data).toEqual(
      expect.objectContaining({
        status: 'conflict',
        code: 'command-id-reused',
      }),
    )

    const duplicateCommand = runCompletionCommand(
      'complete-run-emulator-duplicate-workout',
      {
        plannedWorkout: {
          planId: runPlanId,
          workoutId: runWorkoutId,
          expectedUpdatedAt: first.completedRunUpdatedAt,
        },
      },
    )
    const duplicate = await submit(duplicateCommand)
    expect(duplicate.data).toEqual({
      status: 'conflict',
      commandId: duplicateCommand.commandId,
      code: 'planned-workout-already-completed',
      message: 'This planned workout already has a completed run.',
      planId: runPlanId,
      plannedWorkoutId: runWorkoutId,
      completedRunId: first.completedRunId,
    })
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))
    await expect(
      database
        .doc(
          `materialCommandReceipts/${ownerId}/commands/${duplicateCommand.commandId}`,
        )
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
  })

  it('commits an unplanned run without workout or guard writes', async () => {
    await signInOwner()
    const command = runCompletionCommand('complete-run-emulator-unplanned')

    const receipt = requireRunCompletionReceipt((await submit(command)).data)

    expect(receipt.completedPlannedWorkout).toBeNull()
    expect(
      (
        await database.doc(`users/${ownerId}/runs/${receipt.completedRunId}`).get()
      ).data(),
    ).toEqual(
      expect.objectContaining({
        userId: ownerId,
        distanceMeters: 5_000,
      }),
    )
    await expect(database.doc(guardPath()).get()).resolves.toEqual(
      expect.objectContaining({ exists: false }),
    )
    await expect(
      database
        .doc(`materialCommandReceipts/${ownerId}/commands/${command.commandId}`)
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: true }))
  })

  it('rejects stale, retired-shoe, and cross-owner state without receipts or runs', async () => {
    await seedWorkout()
    await signInOwner()
    const stale = runCompletionCommand('complete-run-emulator-stale', {
      plannedWorkout: {
        planId: runPlanId,
        workoutId: runWorkoutId,
        expectedUpdatedAt: createUtcDateTime('2026-10-08T17:59:59.000Z'),
      },
    })
    expect((await submit(stale)).data).toEqual(
      expect.objectContaining({
        status: 'stale_revision',
        code: 'planned-workout-version-changed',
      }),
    )

    await seedShoe({ status: 'retired' })
    const retiredShoe = runCompletionCommand(
      'complete-run-emulator-retired-shoe',
      { shoeId: runShoeId },
    )
    expect((await submit(retiredShoe)).data).toEqual(
      expect.objectContaining({
        status: 'validation_error',
        code: 'shoe-not-available',
      }),
    )

    await seedWorkout({ userId: otherOwnerId })
    const foreignWorkout = runCompletionCommand(
      'complete-run-emulator-foreign-workout',
      {
        plannedWorkout: {
          planId: runPlanId,
          workoutId: runWorkoutId,
          expectedUpdatedAt: workoutUpdatedAt,
        },
      },
    )
    expect((await submit(foreignWorkout)).data).toEqual(
      expect.objectContaining({
        status: 'authorization_error',
        code: 'training-resource-access-denied',
      }),
    )

    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ empty: true }))
    for (const command of [stale, retiredShoe, foreignWorkout]) {
      await expect(
        database
          .doc(
            `materialCommandReceipts/${ownerId}/commands/${command.commandId}`,
          )
          .get(),
      ).resolves.toEqual(expect.objectContaining({ exists: false }))
    }
  })

  it('rolls back workout, guard, and receipt writes when run creation fails', async () => {
    await seedWorkout()
    const command = runCompletionCommand('complete-run-emulator-rollback', {
      plannedWorkout: {
        planId: runPlanId,
        workoutId: runWorkoutId,
        expectedUpdatedAt: workoutUpdatedAt,
      },
    })
    const fixedRunId = 'run-completion-collision'
    const collisionPath = `users/${ownerId}/runs/${fixedRunId}`
    await database.doc(collisionPath).set({ collision: true })
    const store = new FirestoreRunCompletionStore(database, {
      createRunId: () => fixedRunId,
      now: () => new Date('2026-10-08T20:00:00.000Z'),
    })

    await expect(
      store.commit({ envelope: command, ownerId }),
    ).rejects.toBeDefined()

    expect((await database.doc(workoutPath()).get()).data()).toEqual(
      expect.objectContaining({ status: 'planned' }),
    )
    await expect(database.doc(guardPath()).get()).resolves.toEqual(
      expect.objectContaining({ exists: false }),
    )
    await expect(
      database
        .doc(`materialCommandReceipts/${ownerId}/commands/${command.commandId}`)
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
    await expect(database.doc(collisionPath).get()).resolves.toEqual(
      expect.objectContaining({ exists: true }),
    )
  })

  it('atomically deletes a planned run, reopens its workout, and replays the receipt', async () => {
    await seedWorkout()
    await signInOwner()
    const completion = requireRunCompletionReceipt(
      (
        await submit(
          runCompletionCommand('complete-run-before-delete', {
            plannedWorkout: {
              planId: runPlanId,
              workoutId: runWorkoutId,
              expectedUpdatedAt: workoutUpdatedAt,
            },
          }),
        )
      ).data,
    )
    const command = runDeletionCommand('delete-run-emulator-planned', completion)

    const first = requireRunDeletionReceipt((await submit(command)).data)
    const retry = (await submit(command)).data
    const resolved = (await resolve({ commandId: command.commandId })).data

    expect(retry).toEqual(first)
    expect(resolved).toEqual(first)
    expect(first).toEqual({
      status: 'run_deleted',
      commandId: command.commandId,
      completedRunId: completion.completedRunId,
      deletedAt: first.deletedAt,
      reopenedPlannedWorkout: {
        planId: runPlanId,
        workoutId: runWorkoutId,
        updatedAt: first.deletedAt,
      },
    })
    await expect(
      database.doc(`users/${ownerId}/runs/${completion.completedRunId}`).get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
    expect((await database.doc(workoutPath()).get()).data()).toEqual(
      expect.objectContaining({ status: 'planned' }),
    )
    await expect(database.doc(guardPath()).get()).resolves.toEqual(
      expect.objectContaining({ exists: false }),
    )

    const changedCommand = createRunDeletionCommand(command.commandId, {
      completedRunId: completion.completedRunId,
      expectedCompletedRunUpdatedAt: completion.completedRunUpdatedAt,
      plannedWorkout: null,
    })
    expect((await submit(changedCommand)).data).toEqual(
      expect.objectContaining({
        status: 'conflict',
        code: 'command-id-reused',
      }),
    )
  })

  it('deletes an unplanned run without changing workout state', async () => {
    await signInOwner()
    const completion = requireRunCompletionReceipt(
      (
        await submit(
          runCompletionCommand('complete-unplanned-before-delete'),
        )
      ).data,
    )
    const command = runDeletionCommand(
      'delete-run-emulator-unplanned',
      completion,
    )

    const receipt = requireRunDeletionReceipt((await submit(command)).data)

    expect(receipt.reopenedPlannedWorkout).toBeNull()
    await expect(
      database.doc(`users/${ownerId}/runs/${completion.completedRunId}`).get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
    await expect(database.doc(workoutPath()).get()).resolves.toEqual(
      expect.objectContaining({ exists: false }),
    )
    await expect(database.doc(guardPath()).get()).resolves.toEqual(
      expect.objectContaining({ exists: false }),
    )
  })

  it('rejects stale, missing, cross-owner, mismatched-guard, and malformed deletion without effects', async () => {
    await seedWorkout()
    await signInOwner()
    const completion = requireRunCompletionReceipt(
      (
        await submit(
          runCompletionCommand('complete-run-before-invalid-delete', {
            plannedWorkout: {
              planId: runPlanId,
              workoutId: runWorkoutId,
              expectedUpdatedAt: workoutUpdatedAt,
            },
          }),
        )
      ).data,
    )
    const plannedWorkout = {
      planId: runPlanId,
      workoutId: runWorkoutId,
      expectedUpdatedAt: completion.completedRunUpdatedAt,
    }
    const stale = createRunDeletionCommand('delete-run-emulator-stale', {
      completedRunId: completion.completedRunId,
      expectedCompletedRunUpdatedAt: createUtcDateTime(
        '2026-10-08T17:59:59.000Z',
      ),
      plannedWorkout,
    })
    expect((await submit(stale)).data).toEqual(
      expect.objectContaining({
        status: 'stale_revision',
        code: 'completed-run-version-changed',
      }),
    )

    const missing = createRunDeletionCommand('delete-run-emulator-missing', {
      completedRunId: createCompletedRunId('missing-run-0001'),
      expectedCompletedRunUpdatedAt: completion.completedRunUpdatedAt,
      plannedWorkout: null,
    })
    expect((await submit(missing)).data).toEqual(
      expect.objectContaining({
        status: 'validation_error',
        code: 'invalid-run-deletion',
      }),
    )

    const mismatch = runDeletionCommand(
      'delete-run-emulator-mismatched-guard',
      completion,
    )
    await database.doc(guardPath()).update({
      completedRunId: 'another-completed-run',
    })
    expect((await submit(mismatch)).data).toEqual(
      expect.objectContaining({
        status: 'validation_error',
        code: 'invalid-run-deletion',
      }),
    )
    expect((await database.doc(guardPath()).get()).data()?.completedRunId).toBe(
      'another-completed-run',
    )

    await database.doc(guardPath()).update({
      completedRunId: completion.completedRunId,
    })
    const runPath = `users/${ownerId}/runs/${completion.completedRunId}`
    await database.doc(runPath).update({ userId: otherOwnerId })
    const crossOwner = runDeletionCommand(
      'delete-run-emulator-cross-owner',
      completion,
    )
    expect((await submit(crossOwner)).data).toEqual(
      expect.objectContaining({
        status: 'authorization_error',
        code: 'training-resource-access-denied',
      }),
    )
    expect((await database.doc(runPath).get()).data()?.userId).toBe(otherOwnerId)

    const malformed = {
      ...runDeletionCommand('delete-run-emulator-malformed', completion),
      path: runPath,
    } as unknown as MaterialCommandEnvelope
    expect((await submit(malformed)).data).toEqual(
      expect.objectContaining({
        status: 'validation_error',
        code: 'target-field-prohibited',
      }),
    )

    expect((await database.doc(workoutPath()).get()).data()).toEqual(
      expect.objectContaining({ status: 'completed' }),
    )
    await expect(database.doc(guardPath()).get()).resolves.toEqual(
      expect.objectContaining({ exists: true }),
    )
    for (const rejected of [stale, missing, mismatch, crossOwner, malformed]) {
      await expect(
        database
          .doc(
            `materialCommandReceipts/${ownerId}/commands/${rejected.commandId}`,
          )
          .get(),
      ).resolves.toEqual(expect.objectContaining({ exists: false }))
    }
  })

  it('rolls back run, workout, guard, and receipt when deletion fails', async () => {
    await seedWorkout()
    await signInOwner()
    const completion = requireRunCompletionReceipt(
      (
        await submit(
          runCompletionCommand('complete-run-before-delete-rollback', {
            plannedWorkout: {
              planId: runPlanId,
              workoutId: runWorkoutId,
              expectedUpdatedAt: workoutUpdatedAt,
            },
          }),
        )
      ).data,
    )
    const command = runDeletionCommand(
      'delete-run-emulator-rollback',
      completion,
    )
    const store = new FirestoreRunDeletionStore(database, {
      now: () => new Date(Date.parse(completion.completedRunUpdatedAt) + 1),
      onBeforeCommit: () => {
        throw new Error('Intentional deletion transaction failure.')
      },
    })

    await expect(
      store.commit({ envelope: command, ownerId }),
    ).rejects.toThrow('Intentional deletion transaction failure.')

    await expect(
      database.doc(`users/${ownerId}/runs/${completion.completedRunId}`).get(),
    ).resolves.toEqual(expect.objectContaining({ exists: true }))
    expect((await database.doc(workoutPath()).get()).data()).toEqual(
      expect.objectContaining({ status: 'completed' }),
    )
    await expect(database.doc(guardPath()).get()).resolves.toEqual(
      expect.objectContaining({ exists: true }),
    )
    await expect(
      database
        .doc(`materialCommandReceipts/${ownerId}/commands/${command.commandId}`)
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
  })

  it('allows only one of two authenticated clients to complete a planned workout', async () => {
    await seedWorkout()
    await signInOwnerOnBothClients()
    const firstClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: callableTransport(submit, resolve),
    })
    const secondClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: callableTransport(otherSubmit, otherResolve),
    })
    const attempts = [
      {
        client: firstClient,
        submission: completionSubmission('complete-run-two-client-first'),
      },
      {
        client: secondClient,
        submission: completionSubmission('complete-run-two-client-second'),
      },
    ] as const

    const results = await Promise.all(
      attempts.map(({ client, submission }) =>
        client.submitCompletion(submission),
      ),
    )
    const winnerIndex = results.findIndex(
      (result) => result.status === 'run_completed',
    )
    if (winnerIndex === -1) {
      throw new Error('Expected one logical client to complete the workout.')
    }
    const loserIndex = winnerIndex === 0 ? 1 : 0
    const winner = results[winnerIndex]
    if (winner?.status !== 'run_completed') {
      throw new Error('Expected a run-completion receipt.')
    }
    const winnerAttempt = attempts[winnerIndex]
    const loserAttempt = attempts[loserIndex]
    const replayClient = loserAttempt.client

    expect(results.filter((result) => result.status === 'run_completed')).toHaveLength(
      1,
    )
    expect(results[loserIndex]).toEqual({
      status: 'conflict',
      commandId: loserAttempt.submission.commandId,
      code: 'planned-workout-already-completed',
      message: 'This planned workout already has a completed run.',
      planId: runPlanId,
      plannedWorkoutId: runWorkoutId,
      completedRunId: winner.completedRunId,
    })
    await expect(
      replayClient.submitCompletion(winnerAttempt.submission),
    ).resolves.toEqual(winner)
    await expect(
      replayClient.resolveCompletion(winnerAttempt.submission.commandId),
    ).resolves.toEqual(winner)

    const changedSignature = {
      ...winnerAttempt.submission,
      input: {
        ...winnerAttempt.submission.input,
        duration: createDurationSeconds(1_801),
      },
    }
    await expect(
      replayClient.submitCompletion(changedSignature),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'conflict',
        code: 'command-id-reused',
      }),
    )

    await expectCompletedRunState(winner)
    expect((await database.doc(guardPath()).get()).data()).toEqual(
      expect.objectContaining({ commandId: winnerAttempt.submission.commandId }),
    )
    await expect(
      database
        .doc(
          `materialCommandReceipts/${ownerId}/commands/${loserAttempt.submission.commandId}`,
        )
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
    await expect(
      database.collection(`users/${otherOwnerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ empty: true }))
  })

  it('preserves completed state through rejected two-client deletions and recovers a lost response', async () => {
    await seedWorkout()
    await signInOwner()
    const ownerClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: callableTransport(submit, resolve),
    })
    const completion = await ownerClient.submitCompletion(
      completionSubmission('complete-run-before-two-client-delete'),
    )
    if (completion.status !== 'run_completed') {
      throw new Error('Expected the setup run to complete.')
    }
    await expectCompletedRunState(completion)

    await signInOther()
    const foreignClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: callableTransport(otherSubmit, otherResolve),
    })
    const foreignDeletion = deletionSubmission(
      'delete-run-two-client-cross-owner',
      completion,
    )
    await expect(foreignClient.submitDeletion(foreignDeletion)).resolves.toEqual(
      expect.objectContaining({
        status: 'validation_error',
        code: 'invalid-run-deletion',
      }),
    )
    await expect(
      database
        .doc(
          `materialCommandReceipts/${otherOwnerId}/commands/${foreignDeletion.commandId}`,
        )
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
    await expectCompletedRunState(completion)

    const malformedEnvelope = {
      ...runDeletionCommand(
        'delete-run-two-client-malformed',
        completion,
      ),
      ownerId: otherOwnerId,
    } as unknown as MaterialCommandEnvelope
    expect((await submit(malformedEnvelope)).data).toEqual(
      expect.objectContaining({
        status: 'validation_error',
        code: 'ownership-field-prohibited',
      }),
    )
    await expectCompletedRunState(completion)

    let online = false
    let offlineTransportCalls = 0
    const offlineClient = createCompletedRunCommandClient({
      isOnline: () => online,
      transport: {
        async submit(command) {
          offlineTransportCalls += 1
          return (await submit(command)).data
        },
        async resolve(commandId) {
          offlineTransportCalls += 1
          return (await resolve({ commandId })).data
        },
      },
    })
    const offlineDeletion = deletionSubmission(
      'delete-run-two-client-offline',
      completion,
    )
    await expect(offlineClient.submitDeletion(offlineDeletion)).resolves.toEqual(
      expect.objectContaining({
        status: 'retryable_error',
        code: 'temporarily-unavailable',
      }),
    )
    online = true
    await Promise.resolve()
    expect(offlineTransportCalls).toBe(0)
    await expectCompletedRunState(completion)

    await signOut(otherAuth)
    await signInWithEmailAndPassword(otherAuth, email, password)
    const secondOwnerClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: callableTransport(otherSubmit, otherResolve),
    })
    const staleDeletion = {
      ...deletionSubmission('delete-run-two-client-stale', completion),
      expectedCompletedRunUpdatedAt: createUtcDateTime(
        '2026-10-08T16:59:59.000Z',
      ),
    }
    await expect(
      secondOwnerClient.submitDeletion(staleDeletion),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'stale_revision',
        code: 'completed-run-version-changed',
      }),
    )
    await expect(
      database
        .doc(
          `materialCommandReceipts/${ownerId}/commands/${staleDeletion.commandId}`,
        )
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
    await expectCompletedRunState(completion)

    const committedDeletion = deletionSubmission(
      'delete-run-two-client-lost-response',
      completion,
    )
    const lostResponseClient = createCompletedRunCommandClient({
      isOnline: () => true,
      transport: {
        async submit(command) {
          await otherSubmit(command)
          throw { code: 'functions/deadline-exceeded' }
        },
        async resolve(commandId) {
          return (await otherResolve({ commandId })).data
        },
      },
    })
    await expect(
      lostResponseClient.submitDeletion(committedDeletion),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        commandId: committedDeletion.commandId,
        code: 'resolve-by-command-id',
      }),
    )
    const storedDeletion = requireRunDeletionReceipt(
      (
        await database
          .doc(
            `materialCommandReceipts/${ownerId}/commands/${committedDeletion.commandId}`,
          )
          .get()
      ).data()?.result,
    )
    await expectDeletedRunState(completion, storedDeletion)
    await expect(
      lostResponseClient.resolveDeletion(committedDeletion.commandId),
    ).resolves.toEqual(storedDeletion)
    await expect(
      ownerClient.submitDeletion(committedDeletion),
    ).resolves.toEqual(storedDeletion)

    await expect(
      ownerClient.submitDeletion({
        ...committedDeletion,
        plannedWorkout: null,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'conflict',
        code: 'command-id-reused',
      }),
    )
    await expectDeletedRunState(completion, storedDeletion)

    await signOut(otherAuth)
    await signInOther()
    await expect(
      foreignClient.resolveDeletion(committedDeletion.commandId),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        code: 'resolve-by-command-id',
      }),
    )
    await expect(
      database.collection(`users/${otherOwnerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ empty: true }))
  })
})
