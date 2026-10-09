import { deleteApp as deleteAdminApp, initializeApp as initializeAdminApp } from 'firebase-admin/app'
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore'
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
  isMaterialCommandResult,
  type MaterialCommandEnvelope,
  type PlanApprovalReceiptResult,
} from '../../src/domain/materialCommands/contract.js'
import {
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  type GeneratedPlanV1,
} from '../../src/domain/training/planGeneration.js'
import { planGenerationContractFixtures } from '../../src/domain/training/planGenerationFixtures.js'
import {
  createMaterialCommandClient,
  type MaterialCommandTransport,
} from '../../src/services/materialCommandClient.js'
import type { PlanApprovalArtifactPolicyRecord } from './planApprovalArtifactPolicy.js'
import { FirestorePlanApprovalStore } from './firestorePlanApprovalStore.js'

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
})
