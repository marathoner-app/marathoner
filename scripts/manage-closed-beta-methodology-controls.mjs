import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  LIVE_BETA_OPERATOR_EMAIL,
  LIVE_BETA_PROJECT_ID,
  firebaseCliTokenScopes,
} from './verify-live-beta-boundary.mjs'

const require = createRequire(import.meta.url)
const { getAccessToken, getGlobalDefaultAccount } = require(
  'firebase-tools/lib/auth.js',
)

export const METHODOLOGY_CONTROL_PATH =
  'operatorControls/closedBetaMethodology'
export const GUIDANCE_CONTROL_PATH = 'operatorControls/closedBetaGuidance'
export const CONTROL_CONFIRMATIONS = Object.freeze({
  prepare: 'CREATE-DISABLED-CLOSED-BETA-METHODOLOGY-CONTROLS',
  enable: 'ENABLE-CLOSED-BETA-METHODOLOGY',
  disable: 'DISABLE-CLOSED-BETA-METHODOLOGY',
  restore: 'RESTORE-CLOSED-BETA-METHODOLOGY',
  'retire-guidance': 'RETIRE-CLOSED-BETA-GUIDANCE-ITEM',
  'restore-guidance': 'RESTORE-CLOSED-BETA-GUIDANCE-ITEM',
})

const ACTIONS = ['status', ...Object.keys(CONTROL_CONFIRMATIONS)]
const FIRESTORE_DATABASE_ID = '(default)'
const repositoryRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
)
const manifestPath = path.join(
  repositoryRoot,
  'docs/methodology/artifacts/closed-beta-provisional-methodology/0.2.0/manifest.json',
)

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false
  const actual = Object.keys(value).sort()
  const required = [...expected].sort()
  return (
    actual.length === required.length &&
    actual.every((key, index) => key === required[index])
  )
}

function isUtcTimestamp(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u.test(
      value,
    ) &&
    !Number.isNaN(Date.parse(value))
  )
}

function isExactUtcDateTime(value) {
  return (
    isUtcTimestamp(value) && new Date(value).toISOString() === value
  )
}

function exactArtifactVersions(manifest) {
  return Object.fromEntries(
    manifest.artifacts.map(({ kind, version }) => [kind, version]),
  )
}

function exactGuidanceVersions(manifest) {
  return manifest.artifacts
    .filter(({ kind }) => kind === 'guidance' || kind === 'safety')
    .map(({ version }) => version)
}

export function createInitialControlDocuments(manifest, updatedAt) {
  if (!isExactUtcDateTime(updatedAt)) {
    throw new Error('Control updatedAt must be an exact UTC timestamp.')
  }
  return {
    [METHODOLOGY_CONTROL_PATH]: {
      schemaVersion: 'closed-beta-methodology-control@1',
      revision: 1,
      enabled: false,
      manifestVersion: manifest.manifestVersion,
      artifactVersions: exactArtifactVersions(manifest),
      updatedAt,
    },
    [GUIDANCE_CONTROL_PATH]: {
      schemaVersion: 'closed-beta-guidance-control@1',
      revision: 1,
      enabled: false,
      artifactVersions: exactGuidanceVersions(manifest),
      disabledGuidanceIds: [],
      updatedAt,
    },
  }
}

export function assertMethodologyControl(value, manifest) {
  const expectedVersions = exactArtifactVersions(manifest)
  if (
    !hasExactKeys(value, [
      'schemaVersion',
      'revision',
      'enabled',
      'manifestVersion',
      'artifactVersions',
      'updatedAt',
    ]) ||
    value.schemaVersion !== 'closed-beta-methodology-control@1' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    typeof value.enabled !== 'boolean' ||
    value.manifestVersion !== manifest.manifestVersion ||
    !hasExactKeys(value.artifactVersions, Object.keys(expectedVersions)) ||
    !Object.entries(expectedVersions).every(
      ([kind, version]) => value.artifactVersions[kind] === version,
    ) ||
    !isExactUtcDateTime(value.updatedAt)
  ) {
    throw new Error(
      'The live methodology control does not match the pinned manifest.',
    )
  }
  return value
}

export function assertGuidanceControl(value, manifest) {
  const expectedVersions = exactGuidanceVersions(manifest)
  if (
    !hasExactKeys(value, [
      'schemaVersion',
      'revision',
      'enabled',
      'artifactVersions',
      'disabledGuidanceIds',
      'updatedAt',
    ]) ||
    value.schemaVersion !== 'closed-beta-guidance-control@1' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    typeof value.enabled !== 'boolean' ||
    !Array.isArray(value.artifactVersions) ||
    value.artifactVersions.length !== expectedVersions.length ||
    !expectedVersions.every(
      (version, index) => value.artifactVersions[index] === version,
    ) ||
    !Array.isArray(value.disabledGuidanceIds) ||
    !value.disabledGuidanceIds.every(
      (guidanceId) =>
        typeof guidanceId === 'string' && guidanceId.trim().length > 0,
    ) ||
    new Set(value.disabledGuidanceIds).size !==
      value.disabledGuidanceIds.length ||
    !isUtcTimestamp(value.updatedAt)
  ) {
    throw new Error(
      'The live guidance control does not match the pinned manifest.',
    )
  }
  return value
}

export function transitionControlDocuments(
  action,
  controls,
  manifest,
  { guidanceId, updatedAt },
) {
  const methodology = assertMethodologyControl(
    controls[METHODOLOGY_CONTROL_PATH],
    manifest,
  )
  const guidance = assertGuidanceControl(
    controls[GUIDANCE_CONTROL_PATH],
    manifest,
  )
  if (!isExactUtcDateTime(updatedAt)) {
    throw new Error('Control updatedAt must be an exact UTC timestamp.')
  }

  if (action === 'enable') {
    if (methodology.enabled || guidance.enabled) {
      throw new Error('Both controls must be disabled before first enablement.')
    }
    return {
      [METHODOLOGY_CONTROL_PATH]: {
        ...methodology,
        enabled: true,
        revision: methodology.revision + 1,
        updatedAt,
      },
      [GUIDANCE_CONTROL_PATH]: {
        ...guidance,
        enabled: true,
        revision: guidance.revision + 1,
        updatedAt,
      },
    }
  }

  if (action === 'disable' || action === 'restore') {
    const enabled = action === 'restore'
    if (methodology.enabled === enabled) {
      throw new Error(
        `The methodology control is already ${enabled ? 'enabled' : 'disabled'}.`,
      )
    }
    return {
      [METHODOLOGY_CONTROL_PATH]: {
        ...methodology,
        enabled,
        revision: methodology.revision + 1,
        updatedAt,
      },
    }
  }

  if (action !== 'retire-guidance' && action !== 'restore-guidance') {
    throw new Error(`Unsupported control transition: ${action}.`)
  }
  if (!methodology.enabled || !guidance.enabled) {
    throw new Error(
      'Both controls must be enabled before changing one guidance item.',
    )
  }
  if (typeof guidanceId !== 'string' || guidanceId.trim().length === 0) {
    throw new Error(`${action} requires a non-empty --guidance-id.`)
  }
  const normalizedGuidanceId = guidanceId.trim()
  const isRetired = guidance.disabledGuidanceIds.includes(normalizedGuidanceId)
  if (action === 'retire-guidance' && isRetired) {
    throw new Error(`${normalizedGuidanceId} is already retired.`)
  }
  if (action === 'restore-guidance' && !isRetired) {
    throw new Error(`${normalizedGuidanceId} is not retired.`)
  }
  const disabledGuidanceIds =
    action === 'retire-guidance'
      ? [...guidance.disabledGuidanceIds, normalizedGuidanceId].sort()
      : guidance.disabledGuidanceIds.filter(
          (candidate) => candidate !== normalizedGuidanceId,
        )
  return {
    [GUIDANCE_CONTROL_PATH]: {
      ...guidance,
      disabledGuidanceIds,
      revision: guidance.revision + 1,
      updatedAt,
    },
  }
}

export function parseControlArguments(argv) {
  const [action, ...pairs] = argv
  if (!ACTIONS.includes(action)) {
    throw new Error(
      `Use one of: ${ACTIONS.join(', ')} with --project ${LIVE_BETA_PROJECT_ID}.`,
    )
  }
  if (pairs.length % 2 !== 0) {
    throw new Error('Every control option requires a value.')
  }
  const values = new Map()
  for (let index = 0; index < pairs.length; index += 2) {
    const name = pairs[index]
    const value = pairs[index + 1]
    if (!name?.startsWith('--') || value === undefined || values.has(name)) {
      throw new Error('Control options must be unique --name value pairs.')
    }
    values.set(name, value)
  }
  const allowedNames = new Set([
    '--project',
    ...(action === 'status' ? [] : ['--confirm']),
    ...(action === 'retire-guidance' || action === 'restore-guidance'
      ? ['--guidance-id']
      : []),
  ])
  for (const name of values.keys()) {
    if (!allowedNames.has(name)) {
      throw new Error(`Unexpected option ${name} for ${action}.`)
    }
  }
  const projectId = values.get('--project')
  if (projectId !== LIVE_BETA_PROJECT_ID) {
    throw new Error(
      `Refusing controls for project "${projectId ?? ''}"; expected "${LIVE_BETA_PROJECT_ID}".`,
    )
  }
  if (
    action !== 'status' &&
    values.get('--confirm') !== CONTROL_CONFIRMATIONS[action]
  ) {
    throw new Error(
      `${action} requires --confirm ${CONTROL_CONFIRMATIONS[action]}.`,
    )
  }
  return {
    action,
    confirmation: values.get('--confirm'),
    guidanceId: values.get('--guidance-id'),
    projectId,
  }
}

function encodeFirestoreValue(value, timestamp = false) {
  if (timestamp) return { timestampValue: value }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (Number.isSafeInteger(value)) return { integerValue: String(value) }
  if (Array.isArray(value)) {
    return {
      arrayValue: { values: value.map((entry) => encodeFirestoreValue(entry)) },
    }
  }
  if (isRecord(value)) {
    return { mapValue: { fields: encodeFirestoreFields(value) } }
  }
  throw new Error('The control contains an unsupported Firestore value.')
}

function encodeFirestoreFields(value, documentPath = '') {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      encodeFirestoreValue(
        entry,
        documentPath === GUIDANCE_CONTROL_PATH && key === 'updatedAt',
      ),
    ]),
  )
}

function decodeFirestoreValue(value) {
  if (typeof value?.stringValue === 'string') return value.stringValue
  if (typeof value?.timestampValue === 'string') return value.timestampValue
  if (typeof value?.booleanValue === 'boolean') return value.booleanValue
  if (typeof value?.integerValue === 'string') {
    const parsed = Number(value.integerValue)
    if (Number.isSafeInteger(parsed)) return parsed
  }
  if (isRecord(value?.mapValue)) {
    return decodeFirestoreFields(value.mapValue.fields ?? {})
  }
  if (isRecord(value?.arrayValue)) {
    return (value.arrayValue.values ?? []).map(decodeFirestoreValue)
  }
  throw new Error('Firestore returned an unsupported control field.')
}

function decodeFirestoreFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      decodeFirestoreValue(value),
    ]),
  )
}

function documentName(projectId, documentPath) {
  return `projects/${projectId}/databases/${FIRESTORE_DATABASE_ID}/documents/${documentPath}`
}

function documentUrl(projectId, documentPath) {
  return `https://firestore.googleapis.com/v1/${documentName(
    projectId,
    documentPath,
  )}`
}

async function requestJson({ accessToken, body, label, method, url }) {
  const response = await fetch(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    method,
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(
      `${label} failed with HTTP ${response.status}: ${String(
        payload?.error?.message ?? 'request failed',
      )}.`,
    )
  }
  return payload
}

async function readControl({ accessToken, documentPath, projectId }) {
  const response = await fetch(documentUrl(projectId, documentPath), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (response.status === 404) return null
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(
      `Read ${documentPath} failed with HTTP ${response.status}: ${String(
        payload?.error?.message ?? 'request failed',
      )}.`,
    )
  }
  if (!isRecord(payload.fields) || !isUtcTimestamp(payload.updateTime)) {
    throw new Error(`Read ${documentPath} returned an invalid document.`)
  }
  return {
    data: decodeFirestoreFields(payload.fields),
    updateTime: payload.updateTime,
  }
}

export function createControlCommitWrites({ controls, existing, projectId }) {
  if (projectId !== LIVE_BETA_PROJECT_ID) {
    throw new Error('Control writes require the exact live beta project.')
  }
  return Object.entries(controls).map(([documentPath, data]) => ({
    update: {
      name: documentName(projectId, documentPath),
      fields: encodeFirestoreFields(data, documentPath),
    },
    currentDocument:
      existing[documentPath] === null
        ? { exists: false }
        : { updateTime: existing[documentPath].updateTime },
  }))
}

async function commitControls({ accessToken, controls, existing, projectId }) {
  const writes = createControlCommitWrites({ controls, existing, projectId })
  await requestJson({
    accessToken,
    body: { writes },
    label: 'Commit closed-beta methodology controls',
    method: 'POST',
    url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${FIRESTORE_DATABASE_ID}/documents:commit`,
  })
}

async function operatorAccessToken(projectId) {
  const account = getGlobalDefaultAccount()
  if (account?.user?.email !== LIVE_BETA_OPERATOR_EMAIL) {
    throw new Error(
      `Refusing controls as "${account?.user?.email ?? ''}"; expected "${LIVE_BETA_OPERATOR_EMAIL}".`,
    )
  }
  const token = await getAccessToken(
    account.tokens.refresh_token,
    firebaseCliTokenScopes(account.tokens),
  )
  if (typeof token.access_token !== 'string') {
    throw new Error('Firebase CLI did not provide an operator access token.')
  }
  if (projectId !== LIVE_BETA_PROJECT_ID) {
    throw new Error('The live beta project changed during authorization.')
  }
  return token.access_token
}

async function run() {
  const options = parseControlArguments(process.argv.slice(2))
  const [manifest, accessToken] = await Promise.all([
    readFile(manifestPath, 'utf8').then(JSON.parse),
    operatorAccessToken(options.projectId),
  ])
  const existing = Object.fromEntries(
    await Promise.all(
      [METHODOLOGY_CONTROL_PATH, GUIDANCE_CONTROL_PATH].map(
        async (documentPath) => [
          documentPath,
          await readControl({
            accessToken,
            documentPath,
            projectId: options.projectId,
          }),
        ],
      ),
    ),
  )

  if (options.action === 'status') {
    for (const documentPath of [METHODOLOGY_CONTROL_PATH, GUIDANCE_CONTROL_PATH]) {
      const snapshot = existing[documentPath]
      if (snapshot === null) {
        console.log(`${documentPath}: missing`)
        continue
      }
      const control =
        documentPath === METHODOLOGY_CONTROL_PATH
          ? assertMethodologyControl(snapshot.data, manifest)
          : assertGuidanceControl(snapshot.data, manifest)
      console.log(
        `${documentPath}: revision ${control.revision}, ${
          control.enabled ? 'enabled' : 'disabled'
        }`,
      )
    }
    return
  }

  const updatedAt = new Date().toISOString()
  let nextControls
  if (options.action === 'prepare') {
    if (Object.values(existing).some((snapshot) => snapshot !== null)) {
      throw new Error(
        'Refusing to prepare controls because at least one control already exists.',
      )
    }
    nextControls = createInitialControlDocuments(manifest, updatedAt)
  } else {
    if (Object.values(existing).some((snapshot) => snapshot === null)) {
      throw new Error('Both controls must exist before a transition.')
    }
    nextControls = transitionControlDocuments(
      options.action,
      Object.fromEntries(
        Object.entries(existing).map(([documentPath, snapshot]) => [
          documentPath,
          snapshot.data,
        ]),
      ),
      manifest,
      { guidanceId: options.guidanceId, updatedAt },
    )
  }

  await commitControls({
    accessToken,
    controls: nextControls,
    existing,
    projectId: options.projectId,
  })
  console.log(
    `${options.action} committed atomically to ${options.projectId}; run status before the next step.`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await run()
}
