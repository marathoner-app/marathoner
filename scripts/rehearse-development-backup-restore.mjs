import { createHash } from 'node:crypto'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import {
  bearerHeaders,
  documentPathFromName,
  getDocument,
  listCollectionDocuments,
  lookupAuthAccount,
  requestJson,
} from './migrate-founding-beta-member.mjs'
import { firebaseCliTokenScopes } from './verify-live-beta-boundary.mjs'

const require = createRequire(import.meta.url)
const { getAccessToken, getGlobalDefaultAccount } = require(
  'firebase-tools/lib/auth.js',
)

export const DEVELOPMENT_BACKUP_PROJECT_ID = 'marathoner-d9bf9'
export const DEVELOPMENT_BACKUP_OPERATOR_EMAIL =
  'kevin-admin@marathonerapp.com'
export const DEVELOPMENT_BACKUP_SCHEMA_VERSION = 1

const FIRESTORE_DATABASE_ID = '(default)'
const ALLOWED_TOP_LEVEL_COLLECTIONS = new Set([
  'activityImports',
  'guidanceHistory',
  'planRevisionSnapshots',
  'planState',
  'plans',
  'recommendationEvidence',
  'runs',
  'shoes',
])
const ALLOWED_NESTED_COLLECTIONS = new Set([
  'completionState',
  'metadata',
  'records',
  'workouts',
])
export const EXCLUDED_OWNER_COLLECTIONS = Object.freeze([
  'adaptationCommandReceipts',
  'methodologyConsents',
  'mobileSpikeProofs',
  'providerConnections',
])
const excludedOwnerCollectionSet = new Set(EXCLUDED_OWNER_COLLECTIONS)
const restoreTargetEmailPattern =
  /^backup-restore-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?@marathonerapp\.com$/u

function normalizedEmail(email) {
  return email.trim().toLowerCase()
}

function validUid(uid) {
  return typeof uid === 'string' && /^[A-Za-z0-9_-]{8,128}$/u.test(uid)
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

function artifactIdentifier(email) {
  return normalizedEmail(email)
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
}

export function developmentRestoreManifestName(targetEmail) {
  return `.development-backup-restore-${artifactIdentifier(targetEmail)}.local`
}

export function restoreConfirmation(sourceUid, targetUid) {
  return `RESTORE-DEVELOPMENT-BACKUP:${sourceUid}:${targetUid}`
}

export function cleanupConfirmation(targetUid) {
  return `REMOVE-DEVELOPMENT-RESTORE:${targetUid}`
}

export function resolveLocalArtifactPath(projectDirectory, value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    path.isAbsolute(value) ||
    !value.endsWith('.local')
  ) {
    throw new Error(`${label} must be a relative ignored *.local file.`)
  }
  const resolvedProject = path.resolve(projectDirectory)
  const resolvedArtifact = path.resolve(resolvedProject, value)
  if (!resolvedArtifact.startsWith(`${resolvedProject}${path.sep}`)) {
    throw new Error(`${label} must remain inside the repository.`)
  }
  return resolvedArtifact
}

export function parseDevelopmentBackupArguments(argv) {
  const [action, ...pairs] = argv
  if (!['cleanup', 'export', 'inspect', 'restore', 'verify'].includes(action)) {
    throw new Error('Use inspect, export, restore, verify, or cleanup.')
  }
  if (pairs.length % 2 !== 0) {
    throw new Error('Every backup/restore option requires a value.')
  }

  const values = new Map()
  for (let index = 0; index < pairs.length; index += 2) {
    const name = pairs[index]
    const value = pairs[index + 1]
    if (!name?.startsWith('--') || value === undefined || values.has(name)) {
      throw new Error('Backup/restore options must be unique --name value pairs.')
    }
    values.set(name, value)
  }

  const sourceEmail = normalizedEmail(values.get('--source-email') ?? '')
  const targetEmail = normalizedEmail(values.get('--target-email') ?? '')
  return {
    action,
    confirmation: values.get('--confirm'),
    input: values.get('--input'),
    output: values.get('--output'),
    projectId: values.get('--project'),
    sourceEmail,
    sourceUid: values.get('--source-uid'),
    targetEmail,
    targetUid: values.get('--target-uid'),
  }
}

export function assertDevelopmentBackupOptions(options) {
  if (options.projectId !== DEVELOPMENT_BACKUP_PROJECT_ID) {
    throw new Error('Refusing backup/restore outside the development project.')
  }
  if (options.operatorEmail !== DEVELOPMENT_BACKUP_OPERATOR_EMAIL) {
    throw new Error('The dedicated development operator login is required.')
  }
  if (!options.sourceEmail.includes('@') || !validUid(options.sourceUid)) {
    throw new Error('An explicit valid source email and UID are required.')
  }

  if (['restore', 'verify', 'cleanup'].includes(options.action)) {
    if (
      !restoreTargetEmailPattern.test(options.targetEmail) ||
      !validUid(options.targetUid) ||
      options.sourceUid === options.targetUid ||
      options.sourceEmail === options.targetEmail
    ) {
      throw new Error(
        'Restore requires a distinct backup-restore-* fictional Marathoner account.',
      )
    }
    if (!options.input) {
      throw new Error('Restore, verify, and cleanup require --input.')
    }
  }
  if (options.action === 'export' && !options.output) {
    throw new Error('Export requires --output.')
  }
  if (
    options.action === 'restore' &&
    options.confirmation !==
      restoreConfirmation(options.sourceUid, options.targetUid)
  ) {
    throw new Error(
      `Restore requires --confirm ${restoreConfirmation(options.sourceUid, options.targetUid)}.`,
    )
  }
  if (
    options.action === 'cleanup' &&
    options.confirmation !== cleanupConfirmation(options.targetUid)
  ) {
    throw new Error(
      `Cleanup requires --confirm ${cleanupConfirmation(options.targetUid)}.`,
    )
  }
}

function snapshotContent(snapshot) {
  return {
    documents: snapshot.documents,
    excludedCollections: snapshot.excludedCollections,
    exportedAt: snapshot.exportedAt,
    projectId: snapshot.projectId,
    schemaVersion: snapshot.schemaVersion,
    sourceEmail: snapshot.sourceEmail,
    sourceUid: snapshot.sourceUid,
  }
}

export function snapshotDigest(snapshot) {
  return createHash('sha256')
    .update(JSON.stringify(snapshotContent(snapshot)))
    .digest('hex')
}

function isFirestoreFields(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function isAllowedSnapshotDocumentPath(documentPath, sourceUid) {
  const segments = documentPath.split('/')
  if (segments[0] !== 'users' || segments[1] !== sourceUid) return false
  if (segments.length === 2) return true
  if (segments.length < 4 || segments.length % 2 !== 0) return false
  if (!ALLOWED_TOP_LEVEL_COLLECTIONS.has(segments[2])) return false
  for (let index = 4; index < segments.length; index += 2) {
    if (!ALLOWED_NESTED_COLLECTIONS.has(segments[index])) return false
  }
  return true
}

export function validateDevelopmentSnapshot(
  snapshot,
  { projectId, sourceEmail, sourceUid },
) {
  const rootPath = `users/${sourceUid}`
  const prefix = `${rootPath}/`
  if (
    snapshot?.schemaVersion !== DEVELOPMENT_BACKUP_SCHEMA_VERSION ||
    snapshot.projectId !== projectId ||
    snapshot.sourceEmail !== normalizedEmail(sourceEmail) ||
    snapshot.sourceUid !== sourceUid ||
    typeof snapshot.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(snapshot.exportedAt)) ||
    !Array.isArray(snapshot.documents) ||
    snapshot.documents.length === 0 ||
    !Array.isArray(snapshot.excludedCollections) ||
    snapshot.excludedCollections.some(
      (collectionId) => !excludedOwnerCollectionSet.has(collectionId),
    ) ||
    new Set(snapshot.excludedCollections).size !==
      snapshot.excludedCollections.length ||
    new Set(snapshot.documents.map(({ documentPath }) => documentPath)).size !==
      snapshot.documents.length ||
    snapshot.documents.some(
      ({ documentPath, fields }) =>
        typeof documentPath !== 'string' ||
        (documentPath !== rootPath && !documentPath.startsWith(prefix)) ||
        !isAllowedSnapshotDocumentPath(documentPath, sourceUid) ||
        !isFirestoreFields(fields),
    ) ||
    !snapshot.documents.some(({ documentPath }) => documentPath === rootPath) ||
    !/^[a-f0-9]{64}$/u.test(snapshot.digest ?? '') ||
    snapshot.digest !== snapshotDigest(snapshot)
  ) {
    throw new Error('The development backup snapshot is invalid.')
  }
  return snapshot
}

function rewriteCrossProviderFingerprint(value, sourceUid, targetUid) {
  const parts = value.split('|')
  if (
    parts.length !== 7 ||
    parts[0] !== 'cross-provider-duplicate-fingerprint@1' ||
    decodeURIComponent(parts[1] ?? '') !== sourceUid
  ) {
    throw new Error('A source UID appears in an unsupported string field.')
  }
  parts[1] = encodeURIComponent(targetUid)
  return parts.join('|')
}

function rewriteFirestoreValue(value, sourceUid, targetUid, fieldPath = []) {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      rewriteFirestoreValue(item, sourceUid, targetUid, [
        ...fieldPath,
        String(index),
      ]),
    )
  }
  if (!value || typeof value !== 'object') return value

  const result = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'stringValue' && typeof child === 'string') {
      if (child === sourceUid) {
        result[key] = targetUid
      } else if (child === `users/${sourceUid}` || child.startsWith(`users/${sourceUid}/`)) {
        result[key] = `users/${targetUid}${child.slice(`users/${sourceUid}`.length)}`
      } else if (fieldPath.at(-1) === 'crossProviderFingerprint') {
        result[key] = rewriteCrossProviderFingerprint(
          child,
          sourceUid,
          targetUid,
        )
      } else {
        if (child.includes(sourceUid)) {
          throw new Error('A source UID appears in an unsupported string field.')
        }
        result[key] = child
      }
      continue
    }
    if (key === 'referenceValue' && typeof child === 'string') {
      const marker = `/documents/users/${sourceUid}`
      if (child.includes(sourceUid) && !child.includes(marker)) {
        throw new Error('A source UID appears in an unsupported reference field.')
      }
      result[key] = child.replace(marker, `/documents/users/${targetUid}`)
      continue
    }
    result[key] = rewriteFirestoreValue(child, sourceUid, targetUid, [
      ...fieldPath,
      key,
    ])
  }
  return result
}

export function rewriteSnapshotForTarget(snapshot, targetUid) {
  if (!validUid(targetUid) || targetUid === snapshot.sourceUid) {
    throw new Error('A distinct valid target UID is required.')
  }
  const sourceRoot = `users/${snapshot.sourceUid}`
  const targetRoot = `users/${targetUid}`
  return snapshot.documents
    .map(({ documentPath, fields }) => ({
      documentPath: `${targetRoot}${documentPath.slice(sourceRoot.length)}`,
      fields: rewriteFirestoreValue(fields, snapshot.sourceUid, targetUid),
    }))
    .sort((left, right) => {
      const depth = left.documentPath.split('/').length - right.documentPath.split('/').length
      return depth || left.documentPath.localeCompare(right.documentPath)
    })
}

async function listCollectionIds({ accessToken, documentPath, projectId }) {
  const collectionIds = []
  let pageToken
  do {
    const payload = await requestJson({
      body: { pageSize: 100, ...(pageToken ? { pageToken } : {}) },
      headers: bearerHeaders(accessToken),
      label: `List child collections for ${documentPath}`,
      url: `${firestoreDocumentUrl(projectId, documentPath)}:listCollectionIds`,
    })
    collectionIds.push(...(payload?.collectionIds ?? []))
    pageToken = payload?.nextPageToken
  } while (pageToken)
  return collectionIds.sort()
}

function assertKnownCollection(collectionId, depth) {
  const allowed = depth === 0
    ? ALLOWED_TOP_LEVEL_COLLECTIONS
    : ALLOWED_NESTED_COLLECTIONS
  if (!allowed.has(collectionId)) {
    throw new Error(
      `Unknown owner collection "${collectionId}"; update the recovery inventory before exporting.`,
    )
  }
}

export async function collectRecoverableOwnerTree({
  accessToken,
  projectId,
  uid,
}) {
  const rootPath = `users/${uid}`
  const root = await getDocument({ accessToken, documentPath: rootPath, projectId })
  if (!root?.fields) throw new Error('The source runner profile does not exist.')

  const documents = [{ documentPath: rootPath, fields: root.fields }]
  const excludedCollections = new Set()

  async function visit(parentPath, depth) {
    for (const collectionId of await listCollectionIds({
      accessToken,
      documentPath: parentPath,
      projectId,
    })) {
      if (depth === 0 && excludedOwnerCollectionSet.has(collectionId)) {
        excludedCollections.add(collectionId)
        continue
      }
      assertKnownCollection(collectionId, depth)
      const children = await listCollectionDocuments({
        accessToken,
        collectionId,
        parentPath,
        projectId,
      })
      for (const child of children) {
        const childPath = documentPathFromName(child.name)
        if (child.fields) {
          documents.push({ documentPath: childPath, fields: child.fields })
        }
        await visit(childPath, depth + 1)
      }
    }
  }

  await visit(rootPath, 0)
  documents.sort((left, right) => left.documentPath.localeCompare(right.documentPath))
  return {
    documents,
    excludedCollections: [...excludedCollections].sort(),
  }
}

function assertEligibleAuthAccount(account, expectedEmail, expectedUid, label) {
  if (
    !account ||
    account.localId !== expectedUid ||
    normalizedEmail(account.email ?? '') !== normalizedEmail(expectedEmail) ||
    account.disabled ||
    !account.emailVerified
  ) {
    throw new Error(`The ${label} Auth account is missing, mismatched, disabled, or unverified.`)
  }
}

async function assertAccount({ accessToken, email, label, projectId, uid }) {
  const account = await lookupAuthAccount({
    accessToken,
    projectId,
    property: 'email',
    value: email,
  })
  assertEligibleAuthAccount(account, email, uid, label)
}

async function assertEmptyRestoreTarget({ accessToken, projectId, targetUid }) {
  const targetPath = `users/${targetUid}`
  const [root, childCollections] = await Promise.all([
    getDocument({ accessToken, documentPath: targetPath, projectId }),
    listCollectionIds({ accessToken, documentPath: targetPath, projectId }),
  ])
  if (root || childCollections.length > 0) {
    throw new Error('The fictional restore target is not empty.')
  }
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

export function validateRestoreManifest(manifest, options) {
  const targetRoot = `users/${options.targetUid}`
  const prefix = `${targetRoot}/`
  if (
    manifest?.schemaVersion !== DEVELOPMENT_BACKUP_SCHEMA_VERSION ||
    manifest.projectId !== DEVELOPMENT_BACKUP_PROJECT_ID ||
    manifest.snapshotDigest !== options.snapshotDigest ||
    manifest.sourceUid !== options.sourceUid ||
    manifest.targetUid !== options.targetUid ||
    typeof manifest.restoredAt !== 'string' ||
    Number.isNaN(Date.parse(manifest.restoredAt)) ||
    !Array.isArray(manifest.createdDocuments) ||
    manifest.createdDocuments.length === 0 ||
    new Set(manifest.createdDocuments.map(({ documentPath }) => documentPath)).size !==
      manifest.createdDocuments.length ||
    manifest.createdDocuments.some(
      ({ documentPath, updateTime }) =>
        typeof documentPath !== 'string' ||
        (documentPath !== targetRoot && !documentPath.startsWith(prefix)) ||
        typeof updateTime !== 'string' ||
        Number.isNaN(Date.parse(updateTime)),
    )
  ) {
    throw new Error('The development restore manifest is invalid.')
  }
  return manifest
}

async function verifyRestoredDocuments({
  accessToken,
  expectedDocuments,
  projectId,
}) {
  for (const expected of expectedDocuments) {
    const actual = await getDocument({
      accessToken,
      documentPath: expected.documentPath,
      projectId,
    })
    if (!actual?.fields || !isDeepStrictEqual(actual.fields, expected.fields)) {
      throw new Error('Restored development data does not match the snapshot.')
    }
  }
}

async function operatorAccessToken(options) {
  const account = getGlobalDefaultAccount()
  assertDevelopmentBackupOptions({
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

async function loadSnapshot(snapshotPath, options) {
  return validateDevelopmentSnapshot(
    JSON.parse(await readFile(snapshotPath, 'utf8')),
    options,
  )
}

async function run() {
  const options = parseDevelopmentBackupArguments(process.argv.slice(2))
  const projectDirectory = process.env.PROJECT_DIR ?? process.cwd()
  const inputPath = options.input
    ? resolveLocalArtifactPath(projectDirectory, options.input, '--input')
    : null
  const outputPath = options.output
    ? resolveLocalArtifactPath(projectDirectory, options.output, '--output')
    : null
  const manifestPath = resolveLocalArtifactPath(
    projectDirectory,
    developmentRestoreManifestName(options.targetEmail || 'unused@marathonerapp.com'),
    'restore manifest',
  )
  const accessToken = await operatorAccessToken(options)

  await assertAccount({
    accessToken,
    email: options.sourceEmail,
    label: 'source',
    projectId: options.projectId,
    uid: options.sourceUid,
  })

  if (options.action === 'inspect' || options.action === 'export') {
    const tree = await collectRecoverableOwnerTree({
      accessToken,
      projectId: options.projectId,
      uid: options.sourceUid,
    })
    if (options.action === 'inspect') {
      console.log(JSON.stringify({
        documentCount: tree.documents.length,
        excludedCollections: tree.excludedCollections,
        projectId: options.projectId,
      }, null, 2))
      return
    }
    const snapshot = {
      ...tree,
      exportedAt: new Date().toISOString(),
      projectId: options.projectId,
      schemaVersion: DEVELOPMENT_BACKUP_SCHEMA_VERSION,
      sourceEmail: options.sourceEmail,
      sourceUid: options.sourceUid,
    }
    snapshot.digest = snapshotDigest(snapshot)
    await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    })
    console.log(`Exported ${snapshot.documents.length} development documents.`)
    return
  }

  const snapshot = await loadSnapshot(inputPath, options)
  const expectedDocuments = rewriteSnapshotForTarget(snapshot, options.targetUid)
  await assertAccount({
    accessToken,
    email: options.targetEmail,
    label: 'fictional target',
    projectId: options.projectId,
    uid: options.targetUid,
  })

  if (options.action === 'restore') {
    await assertEmptyRestoreTarget({
      accessToken,
      projectId: options.projectId,
      targetUid: options.targetUid,
    })
    const createdDocuments = []
    try {
      for (const expected of expectedDocuments) {
        const created = await createDocument({
          accessToken,
          fields: expected.fields,
          documentPath: expected.documentPath,
          projectId: options.projectId,
        })
        if (typeof created?.updateTime !== 'string') {
          throw new Error('Firestore created a document without an update time.')
        }
        createdDocuments.push({
          documentPath: expected.documentPath,
          updateTime: created.updateTime,
        })
      }
      await verifyRestoredDocuments({
        accessToken,
        expectedDocuments,
        projectId: options.projectId,
      })
      await writeFile(manifestPath, `${JSON.stringify({
        createdDocuments,
        projectId: options.projectId,
        restoredAt: new Date().toISOString(),
        schemaVersion: DEVELOPMENT_BACKUP_SCHEMA_VERSION,
        snapshotDigest: snapshot.digest,
        sourceUid: options.sourceUid,
        targetUid: options.targetUid,
      }, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    } catch (error) {
      for (const created of [...createdDocuments].reverse()) {
        await deleteDocumentAtVersion({
          accessToken,
          projectId: options.projectId,
          ...created,
        })
      }
      throw error
    }
    console.log(`Restored and verified ${createdDocuments.length} development documents.`)
    return
  }

  const manifest = validateRestoreManifest(
    JSON.parse(await readFile(manifestPath, 'utf8')),
    {
      snapshotDigest: snapshot.digest,
      sourceUid: options.sourceUid,
      targetUid: options.targetUid,
    },
  )
  if (options.action === 'verify') {
    await verifyRestoredDocuments({
      accessToken,
      expectedDocuments,
      projectId: options.projectId,
    })
    console.log(`Verified ${expectedDocuments.length} restored development documents.`)
    return
  }

  const current = await Promise.all(manifest.createdDocuments.map(async (created) => ({
    ...created,
    document: await getDocument({
      accessToken,
      documentPath: created.documentPath,
      projectId: options.projectId,
    }),
  })))
  if (current.some(({ document, updateTime }) => document?.updateTime !== updateTime)) {
    throw new Error('Restored data is missing or changed; refusing cleanup.')
  }
  for (const created of [...manifest.createdDocuments].reverse()) {
    await deleteDocumentAtVersion({
      accessToken,
      projectId: options.projectId,
      ...created,
    })
  }
  await unlink(manifestPath)
  console.log(`Removed ${manifest.createdDocuments.length} restored development documents.`)
}

const executedFile = process.argv[1]
if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  await run()
}
