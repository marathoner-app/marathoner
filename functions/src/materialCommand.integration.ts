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
  createProofMaterialCommand,
  type MaterialCommandEnvelope,
} from '../../src/domain/materialCommands/contract.js'
import {
  createMaterialCommandClient,
  type MaterialCommandTransport,
} from '../../src/services/materialCommandClient.js'

const projectId = 'demo-marathoner'
const email = 'material-command-owner@example.test'
const password = 'material-command-owner-password'
const otherEmail = 'material-command-other@example.test'
const otherPassword = 'material-command-other-password'

let clientApp: FirebaseApp
let auth: Auth
let ownerId: string
let submit: ReturnType<typeof httpsCallable<MaterialCommandEnvelope, unknown>>
let resolve: ReturnType<typeof httpsCallable<{ commandId: string }, unknown>>
const adminApp = initializeAdminApp({ projectId }, 'material-command-integration')
const database = getAdminFirestore(adminApp)

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

  const credential = await createUserWithEmailAndPassword(auth, email, password)
  ownerId = credential.user.uid
  await createUserWithEmailAndPassword(auth, otherEmail, otherPassword)
  await signOut(auth)
})

beforeEach(async () => {
  await clearFirestoreEmulator()
  await signOut(auth)
})

afterAll(async () => {
  await deleteApp(clientApp)
  await deleteAdminApp(adminApp)
})

describe('material-command emulator boundary', () => {
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
    } as MaterialCommandEnvelope)
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
    } as MaterialCommandEnvelope)
    const schemaVersion = await submit({
      ...createProofMaterialCommand('proof-command-schema-version'),
      command: {
        type: 'proof.material-command',
        schemaVersion: 2,
        proofVariant: 'default',
      },
    } as MaterialCommandEnvelope)

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
})
