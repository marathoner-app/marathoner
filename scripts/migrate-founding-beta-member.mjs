import { constants } from 'node:fs'
import { access, readFile, unlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  deleteAdminDocument,
  deleteFixtureAccount,
  firebaseCliTokenScopes,
  randomPassword,
  writeAdminDocument,
} from './verify-live-beta-boundary.mjs'

const require = createRequire(import.meta.url)
const { getAccessToken, getGlobalDefaultAccount } = require(
  'firebase-tools/lib/auth.js',
)

export const FOUNDING_BETA_SOURCE_PROJECT_ID = 'marathoner-d9bf9'
export const FOUNDING_BETA_TARGET_PROJECT_ID = 'marathonerapp-beta'
export const FOUNDING_BETA_OPERATOR_EMAIL = 'kevin-admin@marathonerapp.com'

const FIRESTORE_DATABASE_ID = '(default)'
const OPERATOR_ORIGIN = 'https://marathonerapp.com/'
const MIGRATED_TOP_LEVEL_COLLECTIONS = Object.freeze([
  'planState',
  'plans',
  'runs',
  'shoes',
])

export function migrationConfirmation(email) {
  return `MIGRATE-FOUNDING-BETA-MEMBER:${email.trim().toLowerCase()}`
}

export function rollbackConfirmation(email) {
  return `ROLLBACK-FOUNDING-BETA-MEMBER:${email.trim().toLowerCase()}`
}

export function foundingBetaMigrationManifestName(email) {
  const identifier = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
  return `.founding-beta-migration-${identifier}.local`
}

export function parseFoundingBetaMigrationArguments(argv) {
  const [action, ...pairs] = argv
  if (!['inspect', 'migrate', 'rollback'].includes(action)) {
    throw new Error(
      'Use inspect, migrate, or rollback with --email and the exact project boundary.',
    )
  }

  const values = new Map()
  for (let index = 0; index < pairs.length; index += 2) {
    const name = pairs[index]
    const value = pairs[index + 1]
    if (!name?.startsWith('--') || value === undefined) {
      throw new Error(
        'Use --email, --source-project, --target-project, and an action-specific --confirm value.',
      )
    }
    values.set(name, value)
  }

  const email = values.get('--email')?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    throw new Error('A valid --email value is required.')
  }

  return {
    action,
    confirmation: values.get('--confirm'),
    email,
    sourceProjectId: values.get('--source-project'),
    targetProjectId: values.get('--target-project'),
  }
}

export function assertFoundingBetaMigrationOptions({
  action,
  confirmation,
  email,
  operatorEmail,
  sourceProjectId,
  targetProjectId,
}) {
  if (sourceProjectId !== FOUNDING_BETA_SOURCE_PROJECT_ID) {
    throw new Error(
      `Refusing migration from "${sourceProjectId ?? ''}"; expected the development project.`,
    )
  }
  if (targetProjectId !== FOUNDING_BETA_TARGET_PROJECT_ID) {
    throw new Error(
      `Refusing migration to "${targetProjectId ?? ''}"; expected the beta project.`,
    )
  }
  if (operatorEmail !== FOUNDING_BETA_OPERATOR_EMAIL) {
    throw new Error(
      `Refusing migration as "${operatorEmail ?? ''}"; expected the dedicated beta operator.`,
    )
  }

  if (action === 'migrate' && confirmation !== migrationConfirmation(email)) {
    throw new Error(
      `Migration requires --confirm ${migrationConfirmation(email)}.`,
    )
  }
  if (action === 'rollback' && confirmation !== rollbackConfirmation(email)) {
    throw new Error(
      `Rollback requires --confirm ${rollbackConfirmation(email)}.`,
    )
  }
}

function encodedDocumentPath(documentPath) {
  return documentPath.split('/').map(encodeURIComponent).join('/')
}

function firestoreDocumentsRoot(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${FIRESTORE_DATABASE_ID}/documents`
}

function firestoreDocumentUrl(projectId, documentPath) {
  return `${firestoreDocumentsRoot(projectId)}/${encodedDocumentPath(documentPath)}`
}

function identityToolkitUrl(projectId, action) {
  return `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts${action}`
}

function safeApiError(payload) {
  const message = payload?.error?.message
  return typeof message === 'string' ? message : 'request failed'
}

async function requestJson({ body, headers = {}, label, method = 'POST', url }) {
  const response = await fetch(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    method,
  })
  const text = await response.text()
  let payload = null

  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      throw new Error(`${label} returned a non-JSON HTTP ${response.status} response.`)
    }
  }

  if (!response.ok) {
    const error = new Error(
      `${label} failed with HTTP ${response.status}: ${safeApiError(payload)}.`,
    )
    error.status = response.status
    error.apiMessage = safeApiError(payload)
    throw error
  }

  return payload
}

function bearerHeaders(accessToken, includeOrigin = false) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(includeOrigin ? { Referer: OPERATOR_ORIGIN } : {}),
  }
}

async function lookupAuthAccount({ accessToken, projectId, property, value }) {
  try {
    const payload = await requestJson({
      body: { [property]: [value] },
      headers: bearerHeaders(accessToken, true),
      label: `Look up ${property} in ${projectId}`,
      url: identityToolkitUrl(projectId, ':lookup'),
    })
    return payload?.users?.[0] ?? null
  } catch (error) {
    if (error?.status === 400 && error?.apiMessage === 'USER_NOT_FOUND') {
      return null
    }
    throw error
  }
}

async function createTargetAuthAccount({ accessToken, account, projectId }) {
  await requestJson({
    body: {
      disabled: false,
      displayName: account.displayName,
      email: account.email,
      emailVerified: true,
      localId: account.localId,
      password: randomPassword(),
    },
    headers: bearerHeaders(accessToken, true),
    label: `Create beta Auth account ${account.localId}`,
    url: identityToolkitUrl(projectId, ''),
  })
}

async function getDocument({ accessToken, documentPath, projectId }) {
  try {
    return await requestJson({
      headers: bearerHeaders(accessToken),
      label: `Read ${projectId}/${documentPath}`,
      method: 'GET',
      url: firestoreDocumentUrl(projectId, documentPath),
    })
  } catch (error) {
    if (error?.status === 404) return null
    throw error
  }
}

async function listCollectionDocuments({
  accessToken,
  collectionId,
  parentPath,
  projectId,
}) {
  const documents = []
  let pageToken

  do {
    const base = parentPath
      ? `${firestoreDocumentsRoot(projectId)}/${encodedDocumentPath(parentPath)}/${encodeURIComponent(collectionId)}`
      : `${firestoreDocumentsRoot(projectId)}/${encodeURIComponent(collectionId)}`
    const url = new URL(base)
    url.searchParams.set('pageSize', '300')
    url.searchParams.set('showMissing', 'true')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const payload = await requestJson({
      headers: bearerHeaders(accessToken),
      label: `List ${projectId}/${parentPath}/${collectionId}`,
      method: 'GET',
      url,
    })
    documents.push(...(payload?.documents ?? []))
    pageToken = payload?.nextPageToken
  } while (pageToken)

  return documents
}

function documentPathFromName(name) {
  const marker = '/documents/'
  const index = typeof name === 'string' ? name.indexOf(marker) : -1
  if (index < 0) throw new Error('Firestore returned an invalid document name.')
  return name.slice(index + marker.length)
}

async function collectDocumentsAt({
  accessToken,
  collectionId,
  parentPath,
  projectId,
}) {
  const documents = await listCollectionDocuments({
    accessToken,
    collectionId,
    parentPath,
    projectId,
  })
  return documents
    .filter(({ fields }) => fields)
    .map((document) => ({
      documentPath: documentPathFromName(document.name),
      fields: document.fields,
    }))
}

export async function collectFoundingBetaTrainingDocuments({
  accessToken,
  projectId,
  uid,
}) {
  const rootPath = `users/${uid}`
  const root = await getDocument({ accessToken, documentPath: rootPath, projectId })
  if (!root?.fields) {
    throw new Error(`The source runner profile ${rootPath} does not exist.`)
  }

  const documents = [{ documentPath: rootPath, fields: root.fields }]
  for (const collectionId of MIGRATED_TOP_LEVEL_COLLECTIONS) {
    const collectionDocuments = await collectDocumentsAt({
      accessToken,
      collectionId,
      parentPath: rootPath,
      projectId,
    })
    documents.push(...collectionDocuments)

    if (collectionId !== 'plans') continue
    for (const plan of collectionDocuments) {
      documents.push(
        ...(await collectDocumentsAt({
          accessToken,
          collectionId: 'metadata',
          parentPath: plan.documentPath,
          projectId,
        })),
      )
      const workouts = await collectDocumentsAt({
        accessToken,
        collectionId: 'workouts',
        parentPath: plan.documentPath,
        projectId,
      })
      documents.push(...workouts)
      for (const workout of workouts) {
        documents.push(
          ...(await collectDocumentsAt({
            accessToken,
            collectionId: 'completionState',
            parentPath: workout.documentPath,
            projectId,
          })),
        )
      }
    }
  }

  const allowedPrefix = `${rootPath}/`
  if (
    documents.some(
      ({ documentPath }) =>
        documentPath !== rootPath && !documentPath.startsWith(allowedPrefix),
    )
  ) {
    throw new Error('The source query crossed the selected runner boundary.')
  }

  return documents
}

async function assertTargetFirestoreEmpty({ accessToken, projectId, uid }) {
  const rootPath = `users/${uid}`
  if (await getDocument({ accessToken, documentPath: rootPath, projectId })) {
    throw new Error(`The target runner profile ${rootPath} already exists.`)
  }
  if (
    await getDocument({
      accessToken,
      documentPath: `betaMemberships/${uid}`,
      projectId,
    })
  ) {
    throw new Error(`The target beta membership for ${uid} already exists.`)
  }

  for (const collectionId of MIGRATED_TOP_LEVEL_COLLECTIONS) {
    const documents = await listCollectionDocuments({
      accessToken,
      collectionId,
      parentPath: rootPath,
      projectId,
    })
    if (documents.length > 0) {
      throw new Error(
        `The target already contains ${collectionId} data for ${uid}.`,
      )
    }
  }
}

function membershipFields(uid, now = new Date().toISOString()) {
  return {
    approvedAt: { timestampValue: now },
    approvedBy: { stringValue: 'founding-beta-member-migration' },
    schemaVersion: { integerValue: '1' },
    status: { stringValue: 'approved' },
    userId: { stringValue: uid },
  }
}

async function preflight({ accessToken, email, sourceProjectId, targetProjectId }) {
  const sourceAccount = await lookupAuthAccount({
    accessToken,
    projectId: sourceProjectId,
    property: 'email',
    value: email,
  })
  if (!sourceAccount) {
    throw new Error(`No source Auth account exists for ${email}.`)
  }
  if (sourceAccount.disabled) {
    throw new Error(`The source Auth account for ${email} is disabled.`)
  }
  if (!sourceAccount.emailVerified) {
    throw new Error(`The source Auth account for ${email} is not verified.`)
  }

  const [targetByEmail, targetByUid] = await Promise.all([
    lookupAuthAccount({
      accessToken,
      projectId: targetProjectId,
      property: 'email',
      value: email,
    }),
    lookupAuthAccount({
      accessToken,
      projectId: targetProjectId,
      property: 'localId',
      value: sourceAccount.localId,
    }),
  ])
  if (targetByEmail || targetByUid) {
    throw new Error(
      'The target Auth project already contains this email or UID; refusing to merge accounts.',
    )
  }

  await assertTargetFirestoreEmpty({
    accessToken,
    projectId: targetProjectId,
    uid: sourceAccount.localId,
  })
  const documents = await collectFoundingBetaTrainingDocuments({
    accessToken,
    projectId: sourceProjectId,
    uid: sourceAccount.localId,
  })

  return { documents, sourceAccount }
}

async function manifestMustNotExist(manifestPath) {
  try {
    await access(manifestPath, constants.F_OK)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  throw new Error(`Refusing to overwrite migration manifest ${manifestPath}.`)
}

export function validateFoundingBetaMigrationManifest(manifest, email) {
  const expectedMembershipPath = `betaMemberships/${manifest?.uid}`
  const expectedUserPath = `users/${manifest?.uid}`
  if (
    manifest?.schemaVersion !== 1 ||
    manifest?.email !== email ||
    manifest?.sourceProjectId !== FOUNDING_BETA_SOURCE_PROJECT_ID ||
    manifest?.targetProjectId !== FOUNDING_BETA_TARGET_PROJECT_ID ||
    typeof manifest?.uid !== 'string' ||
    !Array.isArray(manifest?.createdDocumentPaths) ||
    !manifest.createdDocumentPaths.includes(expectedMembershipPath) ||
    !manifest.createdDocumentPaths.includes(expectedUserPath) ||
    new Set(manifest.createdDocumentPaths).size !==
      manifest.createdDocumentPaths.length ||
    manifest.createdDocumentPaths.some(
      (documentPath) =>
        typeof documentPath !== 'string' ||
        (documentPath !== expectedMembershipPath &&
          documentPath !== expectedUserPath &&
          !documentPath.startsWith(`${expectedUserPath}/`)),
    )
  ) {
    throw new Error('The local founding-beta migration manifest is invalid.')
  }
  return manifest
}

async function migrate({
  accessToken,
  email,
  manifestPath,
  sourceProjectId,
  targetProjectId,
}) {
  await manifestMustNotExist(manifestPath)
  const { documents, sourceAccount } = await preflight({
    accessToken,
    email,
    sourceProjectId,
    targetProjectId,
  })
  const createdDocumentPaths = []
  let accountCreated = false

  try {
    await createTargetAuthAccount({
      accessToken,
      account: sourceAccount,
      projectId: targetProjectId,
    })
    accountCreated = true

    for (const { documentPath, fields } of documents) {
      await writeAdminDocument({
        accessToken,
        documentPath,
        fields,
        projectId: targetProjectId,
      })
      createdDocumentPaths.push(documentPath)
    }

    const membershipPath = `betaMemberships/${sourceAccount.localId}`
    await writeAdminDocument({
      accessToken,
      documentPath: membershipPath,
      fields: membershipFields(sourceAccount.localId),
      projectId: targetProjectId,
    })
    createdDocumentPaths.push(membershipPath)

    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          createdDocumentPaths,
          email,
          schemaVersion: 1,
          sourceProjectId,
          targetProjectId,
          uid: sourceAccount.localId,
        },
        null,
        2,
      )}\n`,
      { flag: 'wx', mode: 0o600 },
    )
  } catch (error) {
    const cleanupErrors = []
    for (const documentPath of [...createdDocumentPaths].reverse()) {
      try {
        await deleteAdminDocument({
          accessToken,
          documentPath,
          projectId: targetProjectId,
        })
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
    }
    if (accountCreated) {
      try {
        await deleteFixtureAccount({
          accessToken,
          projectId: targetProjectId,
          uid: sourceAccount.localId,
        })
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
    }
    if (cleanupErrors.length > 0) {
      throw new Error(
        `Migration failed and automatic rollback was incomplete: ${cleanupErrors
          .map((cleanupError) =>
            cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          )
          .join(' ')}`,
        { cause: error },
      )
    }
    throw error
  }

  console.log(
    `Migrated ${email} with UID ${sourceAccount.localId} and ${documents.length} training documents. Use Marathoner's password-reset flow before the first beta sign-in.`,
  )
}

async function rollback({ accessToken, email, manifestPath, targetProjectId }) {
  const manifest = validateFoundingBetaMigrationManifest(
    JSON.parse(await readFile(manifestPath, 'utf8')),
    email,
  )
  for (const documentPath of [...manifest.createdDocumentPaths].reverse()) {
    await deleteAdminDocument({ accessToken, documentPath, projectId: targetProjectId })
  }
  await deleteFixtureAccount({
    accessToken,
    projectId: targetProjectId,
    uid: manifest.uid,
  })
  await unlink(manifestPath)
  console.log(`Rolled back the founding-beta migration for ${email}.`)
}

async function operatorAccessToken(options) {
  const account = getGlobalDefaultAccount()
  assertFoundingBetaMigrationOptions({
    ...options,
    operatorEmail: account?.user?.email,
  })
  const token = await getAccessToken(
    account.tokens.refresh_token,
    firebaseCliTokenScopes(account.tokens),
  )
  if (typeof token.access_token !== 'string') {
    throw new Error('Firebase CLI did not provide an operator access token.')
  }
  return token.access_token
}

async function run() {
  const options = parseFoundingBetaMigrationArguments(process.argv.slice(2))
  const accessToken = await operatorAccessToken(options)
  const projectDirectory = process.env.PROJECT_DIR ?? process.cwd()
  const manifestPath = path.join(
    projectDirectory,
    foundingBetaMigrationManifestName(options.email),
  )

  if (options.action === 'inspect') {
    const { documents, sourceAccount } = await preflight({
      accessToken,
      ...options,
    })
    console.log(
      JSON.stringify(
        {
          documentCount: documents.length,
          email: options.email,
          sourceProjectId: options.sourceProjectId,
          targetIsEmpty: true,
          targetProjectId: options.targetProjectId,
          uid: sourceAccount.localId,
        },
        null,
        2,
      ),
    )
    return
  }
  if (options.action === 'migrate') {
    await migrate({ accessToken, manifestPath, ...options })
    return
  }
  await rollback({ accessToken, manifestPath, ...options })
}

const executedFile = process.argv[1]
if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  await run()
}
