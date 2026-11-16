import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  FOUNDING_BETA_OPERATOR_EMAIL,
  FOUNDING_BETA_TARGET_PROJECT_ID,
  lookupAuthAccount,
} from './migrate-founding-beta-member.mjs'
import { firebaseCliTokenScopes } from './verify-live-beta-boundary.mjs'

const require = createRequire(import.meta.url)
const { getAccessToken, getGlobalDefaultAccount } = require(
  'firebase-tools/lib/auth.js',
)
const { clientId, clientSecret } = require('firebase-tools/lib/api.js')

const ACTIONS = new Set([
  'inspect',
  'apply',
  'inspect-orphan',
  'apply-orphan',
  'inspect-legacy',
  'apply-legacy',
])
const BASE_OPTIONS = new Set(['--owner-email', '--owner-uid', '--project'])

function normalizedEmail(email) {
  return email.trim().toLowerCase()
}

function validUid(uid) {
  return typeof uid === 'string' && /^[A-Za-z0-9_-]{8,128}$/u.test(uid)
}

export function parseActivityImportReconciliationArguments(argv) {
  const [action, ...pairs] = argv
  if (!ACTIONS.has(action)) {
    throw new Error(
      'Use inspect, apply, inspect-orphan, apply-orphan, inspect-legacy, or apply-legacy with the exact owner and beta project boundary.',
    )
  }
  if (pairs.length % 2 !== 0) {
    throw new Error('Every duplicate-reconciliation option requires a value.')
  }
  const allowedOptions = action.startsWith('apply')
    ? new Set([...BASE_OPTIONS, '--confirm'])
    : BASE_OPTIONS
  const values = new Map()
  for (let index = 0; index < pairs.length; index += 2) {
    const name = pairs[index]
    const value = pairs[index + 1]
    if (
      !allowedOptions.has(name) ||
      value === undefined ||
      values.has(name)
    ) {
      throw new Error('Duplicate-reconciliation options must be exact and unique.')
    }
    values.set(name, value)
  }
  if (values.size !== allowedOptions.size) {
    throw new Error('All duplicate-reconciliation options are required exactly once.')
  }

  const ownerEmail = normalizedEmail(values.get('--owner-email') ?? '')
  const ownerUid = values.get('--owner-uid')
  if (!ownerEmail.includes('@')) throw new Error('A valid --owner-email is required.')
  if (!validUid(ownerUid)) throw new Error('A valid --owner-uid is required.')

  return {
    action,
    confirmation: values.get('--confirm'),
    ownerEmail,
    ownerUid,
    projectId: values.get('--project'),
  }
}

export function assertActivityImportReconciliationBoundary(options) {
  if (options.projectId !== FOUNDING_BETA_TARGET_PROJECT_ID) {
    throw new Error('Duplicate reconciliation is approved only for the beta project.')
  }
  if (options.operatorEmail !== FOUNDING_BETA_OPERATOR_EMAIL) {
    throw new Error('The dedicated beta operator login is required.')
  }
  if (!validUid(options.ownerUid)) {
    throw new Error('A valid explicit owner UID is required.')
  }
  if (
    !options.ownerAccount ||
    options.ownerAccount.localId !== options.ownerUid ||
    normalizedEmail(options.ownerAccount.email ?? '') !== options.ownerEmail ||
    options.ownerAccount.disabled ||
    !options.ownerAccount.emailVerified
  ) {
    throw new Error('The explicit owner account boundary could not be verified.')
  }
  if (
    options.action === 'apply' &&
    !/^RECONCILE-ACTIVITY-IMPORT-DUPLICATES:[a-f0-9]{24}$/u.test(
      options.confirmation ?? '',
    )
  ) {
    throw new Error('Apply requires the exact confirmation from the current dry run.')
  }
  if (
    options.action === 'apply-orphan' &&
    !/^NORMALIZE-ORPHAN-ACTIVITY-IMPORT:[a-f0-9]{24}$/u.test(
      options.confirmation ?? '',
    )
  ) {
    throw new Error(
      'Apply-orphan requires the exact confirmation from the current orphan dry run.',
    )
  }
  if (
    options.action === 'apply-legacy' &&
    !/^RECONCILE-LEGACY-IMPORTED-RUN-DUPLICATES:[a-f0-9]{24}$/u.test(
      options.confirmation ?? '',
    )
  ) {
    throw new Error(
      'Apply-legacy requires the exact confirmation from the current legacy dry run.',
    )
  }
}

export async function withFirebaseCliApplicationDefaultCredential(
  account,
  task,
  dependencies = {},
) {
  const refreshToken = account?.tokens?.refresh_token
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    throw new Error('Firebase CLI did not provide an operator refresh token.')
  }

  const environment = dependencies.environment ?? process.env
  const makeTempDirectory = dependencies.makeTempDirectory ?? mkdtemp
  const removeDirectory = dependencies.removeDirectory ?? rm
  const writeCredentialFile = dependencies.writeCredentialFile ?? writeFile
  const resolveClientId = dependencies.clientId ?? clientId
  const resolveClientSecret = dependencies.clientSecret ?? clientSecret
  const previousCredentialPath = environment.GOOGLE_APPLICATION_CREDENTIALS
  let tempDirectory

  try {
    tempDirectory = await makeTempDirectory(
      join(tmpdir(), 'marathoner-duplicate-reconciliation-'),
    )
    const credentialPath = join(
      tempDirectory,
      'application-default-credentials.json',
    )
    await writeCredentialFile(
      credentialPath,
      `${JSON.stringify({
        type: 'authorized_user',
        client_id: resolveClientId(),
        client_secret: resolveClientSecret(),
        refresh_token: refreshToken,
      })}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    )
    environment.GOOGLE_APPLICATION_CREDENTIALS = credentialPath
    return await task()
  } finally {
    if (previousCredentialPath === undefined) {
      delete environment.GOOGLE_APPLICATION_CREDENTIALS
    } else {
      environment.GOOGLE_APPLICATION_CREDENTIALS = previousCredentialPath
    }
    if (tempDirectory !== undefined) {
      await removeDirectory(tempDirectory, { force: true, recursive: true })
    }
  }
}

async function operatorAccessToken() {
  const account = getGlobalDefaultAccount()
  if (account?.user?.email !== FOUNDING_BETA_OPERATOR_EMAIL) {
    throw new Error('The dedicated beta operator login is required.')
  }
  const token = await getAccessToken(
    account.tokens.refresh_token,
    firebaseCliTokenScopes(account.tokens),
  )
  if (typeof token.access_token !== 'string') {
    throw new Error('Firebase CLI did not provide an operator access token.')
  }
  return {
    account,
    accessToken: token.access_token,
    operatorEmail: account.user.email,
  }
}

async function run() {
  const options = parseActivityImportReconciliationArguments(
    process.argv.slice(2),
  )
  const { account, accessToken, operatorEmail } = await operatorAccessToken()
  const ownerAccount = await lookupAuthAccount({
    accessToken,
    projectId: options.projectId,
    property: 'email',
    value: options.ownerEmail,
  })
  assertActivityImportReconciliationBoundary({
    ...options,
    operatorEmail,
    ownerAccount,
  })

  await withFirebaseCliApplicationDefaultCredential(account, async () => {
    const moduleUrl = new URL(
      '../functions/lib/functions/src/firestoreActivityImportDuplicateReconciliation.js',
      import.meta.url,
    ).href
    const legacyModuleUrl = new URL(
      '../functions/lib/functions/src/firestoreLegacyImportedRunDuplicateReconciliation.js',
      import.meta.url,
    ).href
    const [
      { applicationDefault, deleteApp, initializeApp },
      { getFirestore },
      reconciliationModule,
      legacyReconciliationModule,
    ] = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/firestore'),
      import(/* @vite-ignore */ moduleUrl),
      import(/* @vite-ignore */ legacyModuleUrl),
    ])
    const app = initializeApp(
      { credential: applicationDefault(), projectId: options.projectId },
      `activity-import-duplicate-reconciliation-${Date.now()}`,
    )
    const reconciliation =
      new reconciliationModule.FirestoreActivityImportDuplicateReconciliation(
        getFirestore(app),
        { projectId: options.projectId },
      )
    const legacyReconciliation =
      new legacyReconciliationModule.FirestoreLegacyImportedRunDuplicateReconciliation(
        getFirestore(app),
        { projectId: options.projectId },
      )

    try {
      let result
      if (options.action === 'inspect') {
        result = await reconciliation.inspect(options.ownerUid)
      } else if (options.action === 'apply') {
        result = await reconciliation.reconcile({
          confirmation: options.confirmation,
          ownerId: options.ownerUid,
        })
      } else if (options.action === 'inspect-orphan') {
        result = await reconciliation.inspectOrphanImportNormalization(
          options.ownerUid,
        )
      } else if (options.action === 'apply-orphan') {
        result = await reconciliation.normalizeOrphanImport({
          confirmation: options.confirmation,
          ownerId: options.ownerUid,
        })
      } else if (options.action === 'inspect-legacy') {
        result = await legacyReconciliation.inspect(options.ownerUid)
      } else {
        result = await legacyReconciliation.reconcile({
          confirmation: options.confirmation,
          ownerId: options.ownerUid,
        })
      }
      console.log(JSON.stringify(result, null, 2))
    } finally {
      await deleteApp(app)
    }
  })
}

const executedFile = process.argv[1]
if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  run().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'Activity-import duplicate reconciliation failed.',
    )
    process.exitCode = 1
  })
}
