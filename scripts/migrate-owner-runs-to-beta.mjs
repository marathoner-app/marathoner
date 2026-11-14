import { readFile, unlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import {
  FOUNDING_BETA_OPERATOR_EMAIL,
  FOUNDING_BETA_SOURCE_PROJECT_ID,
  FOUNDING_BETA_TARGET_PROJECT_ID,
  bearerHeaders,
  documentPathFromName,
  getDocument,
  listCollectionDocuments,
  lookupAuthAccount,
  manifestMustNotExist,
  requestJson,
} from './migrate-founding-beta-member.mjs'
import {
  firebaseCliTokenScopes,
} from './verify-live-beta-boundary.mjs'

const require = createRequire(import.meta.url)
const { getAccessToken, getGlobalDefaultAccount } = require(
  'firebase-tools/lib/auth.js',
)

const FIRESTORE_DATABASE_ID = '(default)'
const REQUIRED_RUN_FIELDS = Object.freeze([
  ['schemaVersion', 'integerValue'],
  ['userId', 'stringValue'],
  ['startedAt', 'timestampValue'],
  ['timeZone', 'stringValue'],
  ['distanceMeters', 'integerValue'],
  ['durationSeconds', 'integerValue'],
  ['createdAt', 'timestampValue'],
  ['updatedAt', 'timestampValue'],
])

function normalizedEmail(email) {
  return email.trim().toLowerCase()
}

function validUid(uid) {
  return typeof uid === 'string' && /^[A-Za-z0-9_-]{8,128}$/u.test(uid)
}

function confirmationSuffix(email, sourceUid, targetUid) {
  return `${normalizedEmail(email)}:${sourceUid}:${targetUid}`
}

export function migrationConfirmation(email, sourceUid, targetUid) {
  return `MIGRATE-OWNER-RUNS:${confirmationSuffix(email, sourceUid, targetUid)}`
}

export function rollbackConfirmation(email, sourceUid, targetUid) {
  return `ROLLBACK-OWNER-RUNS:${confirmationSuffix(email, sourceUid, targetUid)}`
}

export function ownerRunMigrationManifestName(email) {
  const identifier = normalizedEmail(email)
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
  return `.owner-run-migration-${identifier}.local`
}

export function parseOwnerRunMigrationArguments(argv) {
  const [action, ...pairs] = argv
  if (!['inspect', 'migrate', 'rollback'].includes(action)) {
    throw new Error(
      'Use inspect, migrate, or rollback with the exact email, UID, and project boundary.',
    )
  }
  if (pairs.length % 2 !== 0) {
    throw new Error('Every owner-run migration option requires a value.')
  }

  const values = new Map()
  for (let index = 0; index < pairs.length; index += 2) {
    const name = pairs[index]
    const value = pairs[index + 1]
    if (!name?.startsWith('--') || value === undefined || values.has(name)) {
      throw new Error('Owner-run migration options must be unique --name value pairs.')
    }
    values.set(name, value)
  }

  const email = normalizedEmail(values.get('--email') ?? '')
  const sourceUid = values.get('--source-uid')
  const targetUid = values.get('--target-uid')
  if (!email.includes('@')) throw new Error('A valid --email value is required.')
  if (!validUid(sourceUid)) throw new Error('A valid --source-uid value is required.')
  if (!validUid(targetUid)) throw new Error('A valid --target-uid value is required.')

  return {
    action,
    confirmation: values.get('--confirm'),
    email,
    sourceProjectId: values.get('--source-project'),
    sourceUid,
    targetProjectId: values.get('--target-project'),
    targetUid,
  }
}

export function assertOwnerRunMigrationOptions({
  action,
  confirmation,
  email,
  operatorEmail,
  sourceProjectId,
  sourceUid,
  targetProjectId,
  targetUid,
}) {
  if (sourceProjectId !== FOUNDING_BETA_SOURCE_PROJECT_ID) {
    throw new Error('Refusing owner-run migration from a non-development project.')
  }
  if (targetProjectId !== FOUNDING_BETA_TARGET_PROJECT_ID) {
    throw new Error('Refusing owner-run migration to a non-beta project.')
  }
  if (operatorEmail !== FOUNDING_BETA_OPERATOR_EMAIL) {
    throw new Error('The dedicated beta operator login is required.')
  }
  if (!validUid(sourceUid) || !validUid(targetUid) || sourceUid === targetUid) {
    throw new Error('Distinct valid source and target UIDs are required.')
  }
  if (action === 'migrate') {
    const expected = migrationConfirmation(email, sourceUid, targetUid)
    if (confirmation !== expected) {
      throw new Error(`Migration requires --confirm ${expected}.`)
    }
  }
  if (action === 'rollback') {
    const expected = rollbackConfirmation(email, sourceUid, targetUid)
    if (confirmation !== expected) {
      throw new Error(`Rollback requires --confirm ${expected}.`)
    }
  }
}

function firestoreDocumentsRoot(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${FIRESTORE_DATABASE_ID}/documents`
}

function encodedDocumentPath(documentPath) {
  return documentPath.split('/').map(encodeURIComponent).join('/')
}

function firestoreDocumentUrl(projectId, documentPath) {
  return `${firestoreDocumentsRoot(projectId)}/${encodedDocumentPath(documentPath)}`
}

function runDocumentId(documentPath, uid) {
  const match = documentPath.match(
    new RegExp(`^users/${uid.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}/runs/([^/]+)$`, 'u'),
  )
  if (!match?.[1]) throw new Error('A source run crossed the selected owner boundary.')
  return match[1]
}

function requiredField(fields, fieldName, valueType) {
  const value = fields?.[fieldName]?.[valueType]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`A source run has an invalid ${fieldName} field.`)
  }
  return value
}

export function rewriteRunForTarget(document, sourceUid, targetUid) {
  if (!document?.fields || typeof document.fields !== 'object') {
    throw new Error('A source run document is missing fields.')
  }
  const documentPath = documentPathFromName(document.name)
  const runId = runDocumentId(documentPath, sourceUid)
  for (const [fieldName, valueType] of REQUIRED_RUN_FIELDS) {
    requiredField(document.fields, fieldName, valueType)
  }
  if (document.fields.userId.stringValue !== sourceUid) {
    throw new Error('A source run contains a mismatched userId.')
  }
  if (
    document.fields.plannedWorkoutId !== undefined ||
    document.fields.plannedWorkoutPlanId !== undefined
  ) {
    throw new Error('A source run is linked to a plan and requires a wider migration.')
  }

  return {
    documentPath: `users/${targetUid}/runs/${runId}`,
    fields: {
      ...structuredClone(document.fields),
      userId: { stringValue: targetUid },
    },
    runId,
  }
}

function authAccountIsEligible(account, expectedUid, label) {
  if (!account) throw new Error(`No ${label} Auth account exists for the email.`)
  if (account.localId !== expectedUid) {
    throw new Error(`The ${label} Auth UID does not match the explicit UID.`)
  }
  if (account.disabled) throw new Error(`The ${label} Auth account is disabled.`)
  if (!account.emailVerified) throw new Error(`The ${label} Auth account is unverified.`)
}

function approvedMembership(document, targetUid) {
  return (
    document?.fields?.status?.stringValue === 'approved' &&
    document.fields.userId?.stringValue === targetUid
  )
}

async function preflight({
  accessToken,
  email,
  sourceProjectId,
  sourceUid,
  targetProjectId,
  targetUid,
}) {
  const [sourceAccount, targetAccount, targetProfile, membership, sourceRuns, targetRuns] =
    await Promise.all([
      lookupAuthAccount({
        accessToken,
        projectId: sourceProjectId,
        property: 'email',
        value: email,
      }),
      lookupAuthAccount({
        accessToken,
        projectId: targetProjectId,
        property: 'email',
        value: email,
      }),
      getDocument({
        accessToken,
        documentPath: `users/${targetUid}`,
        projectId: targetProjectId,
      }),
      getDocument({
        accessToken,
        documentPath: `betaMemberships/${targetUid}`,
        projectId: targetProjectId,
      }),
      listCollectionDocuments({
        accessToken,
        collectionId: 'runs',
        parentPath: `users/${sourceUid}`,
        projectId: sourceProjectId,
      }),
      listCollectionDocuments({
        accessToken,
        collectionId: 'runs',
        parentPath: `users/${targetUid}`,
        projectId: targetProjectId,
      }),
    ])

  return assertOwnerRunMigrationPreflight({
    membership,
    sourceAccount,
    sourceRuns,
    sourceUid,
    targetAccount,
    targetProfile,
    targetRuns,
    targetUid,
  })
}

export function assertOwnerRunMigrationPreflight({
  membership,
  sourceAccount,
  sourceRuns,
  sourceUid,
  targetAccount,
  targetProfile,
  targetRuns,
  targetUid,
}) {
  authAccountIsEligible(sourceAccount, sourceUid, 'source')
  authAccountIsEligible(targetAccount, targetUid, 'target')
  if (!targetProfile?.fields) throw new Error('The target runner profile does not exist.')
  if (!approvedMembership(membership, targetUid)) {
    throw new Error('The target beta membership is not approved for the target UID.')
  }
  if (targetRuns.length > 0) {
    throw new Error('The target run collection is not empty; refusing to merge.')
  }
  if (sourceRuns.length === 0) throw new Error('The source run collection is empty.')

  const rewrittenRuns = sourceRuns.map((document) =>
    rewriteRunForTarget(document, sourceUid, targetUid),
  )
  if (new Set(rewrittenRuns.map(({ runId }) => runId)).size !== rewrittenRuns.length) {
    throw new Error('The source run collection contains duplicate document IDs.')
  }
  return { rewrittenRuns }
}

async function createDocument({ accessToken, documentPath, fields, projectId }) {
  const url = new URL(firestoreDocumentUrl(projectId, documentPath))
  url.searchParams.set('currentDocument.exists', 'false')
  return requestJson({
    body: { fields },
    headers: bearerHeaders(accessToken),
    label: `Create ${documentPath}`,
    method: 'PATCH',
    url,
  })
}

async function deleteDocumentAtVersion({
  accessToken,
  documentPath,
  projectId,
  updateTime,
}) {
  const url = new URL(firestoreDocumentUrl(projectId, documentPath))
  url.searchParams.set('currentDocument.updateTime', updateTime)
  await requestJson({
    headers: bearerHeaders(accessToken),
    label: `Delete ${documentPath}`,
    method: 'DELETE',
    url,
  })
}

export function validateOwnerRunMigrationManifest(
  manifest,
  { email, sourceUid, targetUid },
) {
  const targetPrefix = `users/${targetUid}/runs/`
  if (
    manifest?.schemaVersion !== 1 ||
    manifest.email !== normalizedEmail(email) ||
    manifest.sourceProjectId !== FOUNDING_BETA_SOURCE_PROJECT_ID ||
    manifest.targetProjectId !== FOUNDING_BETA_TARGET_PROJECT_ID ||
    manifest.sourceUid !== sourceUid ||
    manifest.targetUid !== targetUid ||
    !Array.isArray(manifest.createdDocuments) ||
    manifest.createdDocuments.length === 0 ||
    new Set(manifest.createdDocuments.map(({ documentPath }) => documentPath)).size !==
      manifest.createdDocuments.length ||
    manifest.createdDocuments.some(
      ({ documentPath, updateTime }) =>
        typeof documentPath !== 'string' ||
        !documentPath.startsWith(targetPrefix) ||
        documentPath.slice(targetPrefix.length).includes('/') ||
        typeof updateTime !== 'string' ||
        Number.isNaN(Date.parse(updateTime)),
    )
  ) {
    throw new Error('The local owner-run migration manifest is invalid.')
  }
  return manifest
}

async function migrate(options, accessToken, manifestPath) {
  await manifestMustNotExist(manifestPath)
  const { rewrittenRuns } = await preflight({ accessToken, ...options })
  const createdDocuments = []

  try {
    for (const run of rewrittenRuns) {
      const created = await createDocument({
        accessToken,
        documentPath: run.documentPath,
        fields: run.fields,
        projectId: options.targetProjectId,
      })
      if (typeof created?.updateTime !== 'string') {
        throw new Error('Firestore created a run without an update time.')
      }
      createdDocuments.push({
        documentPath: run.documentPath,
        updateTime: created.updateTime,
      })
    }

    const targetRuns = await listCollectionDocuments({
      accessToken,
      collectionId: 'runs',
      parentPath: `users/${options.targetUid}`,
      projectId: options.targetProjectId,
    })
    const expectedFields = new Map(
      rewrittenRuns.map(({ documentPath, fields }) => [documentPath, fields]),
    )
    if (targetRuns.length !== rewrittenRuns.length) {
      throw new Error('Post-migration verification did not match the expected beta runs.')
    }
    for (const document of targetRuns) {
      const documentPath = documentPathFromName(document.name)
      if (!isDeepStrictEqual(document.fields, expectedFields.get(documentPath))) {
        throw new Error('Post-migration verification did not match the expected beta runs.')
      }
    }

    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          createdDocuments,
          email: options.email,
          schemaVersion: 1,
          sourceProjectId: options.sourceProjectId,
          sourceUid: options.sourceUid,
          targetProjectId: options.targetProjectId,
          targetUid: options.targetUid,
        },
        null,
        2,
      )}\n`,
      { flag: 'wx', mode: 0o600 },
    )
  } catch (error) {
    const cleanupErrors = []
    for (const created of [...createdDocuments].reverse()) {
      try {
        await deleteDocumentAtVersion({
          accessToken,
          projectId: options.targetProjectId,
          ...created,
        })
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
    }
    if (cleanupErrors.length > 0) {
      throw new Error('Migration failed and automatic rollback was incomplete.', {
        cause: error,
      })
    }
    throw error
  }

  console.log(`Migrated ${rewrittenRuns.length} owner-scoped runs into beta.`)
}

async function rollback(options, accessToken, manifestPath) {
  const manifest = validateOwnerRunMigrationManifest(
    JSON.parse(await readFile(manifestPath, 'utf8')),
    options,
  )
  const snapshots = await Promise.all(
    manifest.createdDocuments.map(async (created) => ({
      ...created,
      snapshot: await getDocument({
        accessToken,
        documentPath: created.documentPath,
        projectId: options.targetProjectId,
      }),
    })),
  )
  if (
    snapshots.some(
      ({ snapshot, updateTime }) => snapshot?.updateTime !== updateTime,
    )
  ) {
    throw new Error(
      'A migrated beta run is missing or changed; refusing destructive rollback.',
    )
  }
  for (const created of [...manifest.createdDocuments].reverse()) {
    await deleteDocumentAtVersion({
      accessToken,
      projectId: options.targetProjectId,
      ...created,
    })
  }
  await unlink(manifestPath)
  console.log(`Rolled back ${manifest.createdDocuments.length} migrated beta runs.`)
}

async function operatorAccessToken(options) {
  const account = getGlobalDefaultAccount()
  assertOwnerRunMigrationOptions({
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
  const options = parseOwnerRunMigrationArguments(process.argv.slice(2))
  const accessToken = await operatorAccessToken(options)
  const projectDirectory = process.env.PROJECT_DIR ?? process.cwd()
  const manifestPath = path.join(
    projectDirectory,
    ownerRunMigrationManifestName(options.email),
  )

  if (options.action === 'inspect') {
    const { rewrittenRuns } = await preflight({ accessToken, ...options })
    console.log(
      JSON.stringify(
        {
          runCount: rewrittenRuns.length,
          sourceProjectId: options.sourceProjectId,
          sourceUid: options.sourceUid,
          targetIsEmpty: true,
          targetProjectId: options.targetProjectId,
          targetUid: options.targetUid,
        },
        null,
        2,
      ),
    )
    return
  }
  if (options.action === 'migrate') {
    await migrate(options, accessToken, manifestPath)
    return
  }
  await rollback(options, accessToken, manifestPath)
}

const executedFile = process.argv[1]
if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  await run()
}
