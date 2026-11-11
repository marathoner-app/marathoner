import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { access, readFile, unlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  assertFixtureAccountsDoNotExist,
  assertFixtureDocumentsDoNotExist,
  createFixtureAccount,
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
const betaRules = require(
  '../docs/methodology/artifacts/beta-rules/0.2.0-draft/beta-rules.json',
)

export const DEVELOPMENT_PROJECT_ID = 'marathoner-d9bf9'
export const DEVELOPMENT_OPERATOR_EMAIL = 'kevin-admin@marathonerapp.com'
export const ADAPTATION_PROOF_MANIFEST = '.internal-adaptation-proof.local'
export const ADAPTATION_PROOF_CONFIRMATIONS = Object.freeze({
  cleanup: 'DELETE-INTERNAL-ADAPTATION-PROOF-FIXTURE',
  prepare: 'CREATE-INTERNAL-ADAPTATION-PROOF-FIXTURE',
  refresh: 'REFRESH-INTERNAL-ADAPTATION-PROOF-FIXTURE',
  verify: 'VERIFY-INTERNAL-ADAPTATION-PROOF-FIXTURE',
})

const FIRESTORE_DATABASE_ID = '(default)'
const FIXTURE_EMAIL_SUFFIX = '@marathonerapp.com'
const FIXTURE_PREFIX = 'internal-adaptation-proof-'
const PLAN_ID = 'adaptation-proof-plan'
const PROFILE_DISPLAY_NAME = 'Adaptation Proof Runner'
const TIME_ZONE = 'America/Los_Angeles'
const TRAINING_SCHEMA_VERSION = 1
const ACTIVE_PLAN_REVISION = 3
const DYNAMIC_COLLECTIONS = [
  'adaptationCommandReceipts',
  'recommendationEvidence',
]

function stringValue(value) {
  return { stringValue: value }
}

function integerValue(value) {
  return { integerValue: String(value) }
}

function booleanValue(value) {
  return { booleanValue: value }
}

function timestampValue(value) {
  return { timestampValue: value }
}

function arrayValue(values) {
  return { arrayValue: { values: values.map(stringValue) } }
}

function mapValue(fields) {
  return { mapValue: { fields } }
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10)
}

function shiftDate(date, days) {
  const shifted = new Date(date)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted
}

function mondayOfWeek(date) {
  const monday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return monday
}

function fixtureSchedule(now) {
  const proofWeekStart = shiftDate(mondayOfWeek(now), -7)
  const nextWeekStart = shiftDate(proofWeekStart, 7)
  const planStart = shiftDate(proofWeekStart, -63)
  const targetRaceDate = shiftDate(planStart, 153)
  const workoutOffsets = [0, 1, 3, 5]

  return {
    completedDates: workoutOffsets.map((offset) =>
      dateOnly(shiftDate(proofWeekStart, offset)),
    ),
    planStart: dateOnly(planStart),
    plannedDates: workoutOffsets.map((offset) =>
      dateOnly(shiftDate(nextWeekStart, offset)),
    ),
    targetRaceDate: dateOnly(targetRaceDate),
  }
}

export function parseAdaptationProofArguments(argv) {
  const [action, ...pairs] = argv
  if (!(action in ADAPTATION_PROOF_CONFIRMATIONS)) {
    throw new Error(
      'Use prepare, refresh, verify, or cleanup with the exact development project and confirmation phrase.',
    )
  }

  const values = new Map()
  for (let index = 0; index < pairs.length; index += 2) {
    const name = pairs[index]
    const value = pairs[index + 1]
    if (!name?.startsWith('--') || value === undefined) {
      throw new Error(
        'Use --project marathoner-d9bf9 and the action-specific --confirm phrase.',
      )
    }
    values.set(name, value)
  }

  return {
    action,
    confirmation: values.get('--confirm'),
    projectId: values.get('--project'),
  }
}

export function createAdaptationProofFixture() {
  const sessionId = randomBytes(8).toString('hex')
  return {
    email: `${FIXTURE_PREFIX}${sessionId}${FIXTURE_EMAIL_SUFFIX}`,
    emailVerified: true,
    role: 'adaptation-proof',
    uid: `${FIXTURE_PREFIX}${sessionId}`,
  }
}

function workoutId(period, index) {
  return `${period}-${index + 1}`
}

function runId(index) {
  return `run-${workoutId('current', index)}`
}

export function adaptationProofDocumentPaths(fixture) {
  const ownerPath = `users/${fixture.uid}`
  const planPath = `${ownerPath}/plans/${PLAN_ID}`
  return [
    `betaMemberships/${fixture.uid}`,
    ownerPath,
    `${ownerPath}/planState/active`,
    planPath,
    `${planPath}/metadata/generation`,
    ...Array.from({ length: 4 }, (_, index) =>
      `${planPath}/workouts/${workoutId('current', index)}`,
    ),
    ...Array.from({ length: 4 }, (_, index) =>
      `${planPath}/workouts/${workoutId('next', index)}`,
    ),
    ...Array.from({ length: 4 }, (_, index) =>
      `${ownerPath}/runs/${runId(index)}`,
    ),
  ]
}

function workoutFields({ date, distanceMeters, id, now, status, uid }) {
  const longRun = id.endsWith('-4')
  return {
    createdAt: timestampValue(now),
    kind: stringValue('run'),
    phase: stringValue('marathon_training'),
    planId: stringValue(PLAN_ID),
    purpose: stringValue(longRun ? 'long' : 'easy'),
    scheduledDate: stringValue(date),
    schemaVersion: integerValue(TRAINING_SCHEMA_VERSION),
    status: stringValue(status),
    targetDistanceMeters: integerValue(distanceMeters),
    updatedAt: timestampValue(now),
    userId: stringValue(uid),
  }
}

export function adaptationProofDocuments(
  fixture,
  now = new Date().toISOString(),
) {
  const nowDate = new Date(now)
  if (!Number.isFinite(nowDate.getTime())) {
    throw new Error('The adaptation proof fixture requires a valid timestamp.')
  }
  const schedule = fixtureSchedule(nowDate)
  const ownerPath = `users/${fixture.uid}`
  const planPath = `${ownerPath}/plans/${PLAN_ID}`
  const efforts = [
    'about_right',
    'harder_than_expected',
    'about_right',
    'much_harder_than_expected',
  ]

  return [
    {
      documentPath: `betaMemberships/${fixture.uid}`,
      fields: {
        approvedAt: timestampValue(now),
        approvedBy: stringValue('internal-adaptation-proof'),
        schemaVersion: integerValue(1),
        status: stringValue('approved'),
        userId: stringValue(fixture.uid),
      },
    },
    {
      documentPath: ownerPath,
      fields: {
        availableTrainingDays: arrayValue([
          'monday',
          'tuesday',
          'thursday',
          'saturday',
        ]),
        completionGoal: stringValue('complete_first_marathon'),
        consistentRunningWeeks: integerValue(12),
        createdAt: timestampValue(now),
        currentRunningFrequencyDaysPerWeek: integerValue(4),
        currentWeeklyDistanceMeters: integerValue(23_000),
        displayName: stringValue(PROFILE_DISPLAY_NAME),
        experienceLevel: stringValue('consistent'),
        longestRecentRunDistanceMeters: integerValue(8_000),
        preferredDistanceUnit: stringValue('kilometer'),
        preferredLongRunDay: stringValue('saturday'),
        schemaVersion: integerValue(TRAINING_SCHEMA_VERSION),
        targetRace: mapValue({
          date: stringValue(schedule.targetRaceDate),
          kind: stringValue('date'),
        }),
        timeZone: stringValue(TIME_ZONE),
        updatedAt: timestampValue(now),
        userId: stringValue(fixture.uid),
      },
    },
    {
      documentPath: `${ownerPath}/planState/active`,
      fields: {
        activePlanId: stringValue(PLAN_ID),
        activePlanRevision: integerValue(ACTIVE_PLAN_REVISION),
        approvedAt: timestampValue(now),
        schemaVersion: integerValue(1),
        trainingSchemaVersion: integerValue(TRAINING_SCHEMA_VERSION),
        updatedAt: timestampValue(now),
        userId: stringValue(fixture.uid),
      },
    },
    {
      documentPath: planPath,
      fields: {
        completionGoal: stringValue('complete_first_marathon'),
        createdAt: timestampValue(now),
        endDate: stringValue(schedule.targetRaceDate),
        name: stringValue('Internal adaptation proof plan'),
        schemaVersion: integerValue(TRAINING_SCHEMA_VERSION),
        startDate: stringValue(schedule.planStart),
        status: stringValue('active'),
        targetRaceDate: stringValue(schedule.targetRaceDate),
        updatedAt: timestampValue(now),
        userId: stringValue(fixture.uid),
      },
    },
    {
      documentPath: `${planPath}/metadata/generation`,
      fields: {
        planId: stringValue(PLAN_ID),
        rulesetVersion: stringValue(betaRules.artifactVersion),
        userId: stringValue(fixture.uid),
      },
    },
    ...schedule.completedDates.map((date, index) => ({
      documentPath: `${planPath}/workouts/${workoutId('current', index)}`,
      fields: workoutFields({
        date,
        distanceMeters: index === 3 ? 8_000 : 5_000,
        id: workoutId('current', index),
        now,
        status: 'completed',
        uid: fixture.uid,
      }),
    })),
    ...schedule.plannedDates.map((date, index) => ({
      documentPath: `${planPath}/workouts/${workoutId('next', index)}`,
      fields: workoutFields({
        date,
        distanceMeters: index === 3 ? 10_000 : 6_000,
        id: workoutId('next', index),
        now,
        status: 'planned',
        uid: fixture.uid,
      }),
    })),
    ...schedule.completedDates.map((date, index) => ({
      documentPath: `${ownerPath}/runs/${runId(index)}`,
      fields: {
        createdAt: timestampValue(now),
        distanceMeters: integerValue(index === 3 ? 8_000 : 5_000),
        durationSeconds: integerValue(index === 3 ? 2_880 : 1_800),
        notes: stringValue('Disposable internal adaptation proof fixture'),
        perceivedEffort: stringValue(efforts[index]),
        plannedWorkoutId: stringValue(workoutId('current', index)),
        plannedWorkoutPlanId: stringValue(PLAN_ID),
        schemaVersion: integerValue(TRAINING_SCHEMA_VERSION),
        startedAt: timestampValue(`${date}T18:00:00.000Z`),
        timeZone: stringValue(TIME_ZONE),
        unusualPain: booleanValue(false),
        updatedAt: timestampValue(now),
        userId: stringValue(fixture.uid),
      },
    })),
  ]
}

function isFixtureIdentifier(value) {
  return typeof value === 'string' && value.startsWith(FIXTURE_PREFIX)
}

export function validateAdaptationProofManifest(manifest) {
  const fixture = manifest?.account
  if (
    manifest?.schemaVersion !== 1 ||
    manifest?.projectId !== DEVELOPMENT_PROJECT_ID ||
    !isFixtureIdentifier(fixture?.uid) ||
    !isFixtureIdentifier(fixture?.email) ||
    !fixture.email.endsWith(FIXTURE_EMAIL_SUFFIX) ||
    fixture.role !== 'adaptation-proof' ||
    typeof fixture.password !== 'string' ||
    fixture.password.length < 20
  ) {
    throw new Error('The local internal-adaptation proof manifest is invalid.')
  }
  return manifest
}

export function assertAdaptationProofOptions({
  action,
  confirmation,
  operatorEmail,
  projectId,
}) {
  if (projectId !== DEVELOPMENT_PROJECT_ID) {
    throw new Error(
      `Refusing the adaptation proof fixture for project "${projectId ?? ''}"; expected the development project.`,
    )
  }
  if (operatorEmail !== DEVELOPMENT_OPERATOR_EMAIL) {
    throw new Error(
      `Refusing the adaptation proof fixture as "${operatorEmail ?? ''}"; expected the dedicated operator.`,
    )
  }
  if (confirmation !== ADAPTATION_PROOF_CONFIRMATIONS[action]) {
    throw new Error(
      `${action} requires --confirm ${ADAPTATION_PROOF_CONFIRMATIONS[action]}.`,
    )
  }
}

async function operatorAccessToken(options) {
  const account = getGlobalDefaultAccount()
  assertAdaptationProofOptions({
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

async function manifestMustNotExist(manifestPath) {
  try {
    await access(manifestPath, constants.F_OK)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  throw new Error(
    `Refusing to overwrite ${ADAPTATION_PROOF_MANIFEST}; clean up its fixture first.`,
  )
}

function encodedDocumentPath(documentPath) {
  return documentPath.split('/').map(encodeURIComponent).join('/')
}

async function dynamicDocumentPaths({ accessToken, collectionPath, projectId }) {
  const prefix = `projects/${projectId}/databases/${FIRESTORE_DATABASE_ID}/documents/`
  const paths = []
  let pageToken

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${FIRESTORE_DATABASE_ID}/documents/${encodedDocumentPath(collectionPath)}`,
    )
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!response.ok) {
      throw new Error(
        `List ${collectionPath} failed with HTTP ${response.status}.`,
      )
    }
    const payload = await response.json()
    for (const document of payload.documents ?? []) {
      if (
        typeof document?.name !== 'string' ||
        !document.name.startsWith(prefix)
      ) {
        throw new Error(`List ${collectionPath} returned an invalid document.`)
      }
      const documentPath = document.name.slice(prefix.length)
      if (!documentPath.startsWith(`${collectionPath}/`)) {
        throw new Error(`List ${collectionPath} crossed the fixture boundary.`)
      }
      paths.push(documentPath)
    }
    pageToken = payload.nextPageToken
  } while (pageToken)

  return paths
}

async function adminDocumentFields({ accessToken, documentPath, projectId }) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${FIRESTORE_DATABASE_ID}/documents/${encodedDocumentPath(documentPath)}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )
  if (!response.ok) {
    throw new Error(
      `Read ${documentPath} failed with HTTP ${response.status}.`,
    )
  }
  const payload = await response.json()
  if (!payload?.fields || typeof payload.fields !== 'object') {
    throw new Error(`Read ${documentPath} returned an invalid document.`)
  }
  return payload.fields
}

function requireRemoteField(fields, name, kind, expected) {
  const actual = fields[name]?.[kind]
  if (actual !== expected) {
    throw new Error(
      `The adaptation proof fixture changed unexpectedly at field ${name}.`,
    )
  }
}

async function prepare({ accessToken, manifestPath, projectId }) {
  const fixture = createAdaptationProofFixture()
  const documents = adaptationProofDocuments(fixture)
  const password = randomPassword()
  const createdDocuments = []
  let accountCreated = false

  await manifestMustNotExist(manifestPath)
  await assertFixtureAccountsDoNotExist({
    accessToken,
    fixtures: [fixture],
    projectId,
  })
  await assertFixtureDocumentsDoNotExist({
    accessToken,
    documentPaths: documents.map(({ documentPath }) => documentPath),
    projectId,
  })

  try {
    await createFixtureAccount({ accessToken, fixture, password, projectId })
    accountCreated = true
    for (const document of documents) {
      await writeAdminDocument({ accessToken, ...document, projectId })
      createdDocuments.push(document.documentPath)
    }
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          account: {
            email: fixture.email,
            password,
            role: fixture.role,
            uid: fixture.uid,
          },
          createdAt: new Date().toISOString(),
          projectId,
          schemaVersion: 1,
        },
        null,
        2,
      )}\n`,
      { flag: 'wx', mode: 0o600 },
    )
  } catch (error) {
    const cleanupErrors = []
    for (const documentPath of [...createdDocuments].reverse()) {
      try {
        await deleteAdminDocument({ accessToken, documentPath, projectId })
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
    }
    if (accountCreated) {
      try {
        await deleteFixtureAccount({ accessToken, projectId, uid: fixture.uid })
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
    }
    if (cleanupErrors.length > 0) {
      throw new Error(
        `Adaptation proof fixture preparation failed and cleanup was incomplete: ${cleanupErrors
          .map((cleanupError) =>
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError),
          )
          .join(' ')}`,
        { cause: error },
      )
    }
    throw error
  }

  console.log(
    `Prepared one fictional development adaptation proof account. Credentials are stored only in ${ADAPTATION_PROOF_MANIFEST}.`,
  )
}

async function readManifest(manifestPath) {
  return validateAdaptationProofManifest(
    JSON.parse(await readFile(manifestPath, 'utf8')),
  )
}

async function refresh({ accessToken, manifestPath, projectId }) {
  const manifest = await readManifest(manifestPath)
  for (const document of adaptationProofDocuments(manifest.account)) {
    await writeAdminDocument({ accessToken, ...document, projectId })
  }
  console.log(
    'Refreshed the seeded adaptation proof records without changing the fixture identity or local credentials.',
  )
}

async function verify({ accessToken, manifestPath, projectId }) {
  const manifest = await readManifest(manifestPath)
  const fixture = manifest.account
  const ownerPath = `users/${fixture.uid}`
  const planPath = `${ownerPath}/plans/${PLAN_ID}`
  const activeState = await adminDocumentFields({
    accessToken,
    documentPath: `${ownerPath}/planState/active`,
    projectId,
  })
  requireRemoteField(activeState, 'activePlanId', 'stringValue', PLAN_ID)
  requireRemoteField(
    activeState,
    'activePlanRevision',
    'integerValue',
    String(ACTIVE_PLAN_REVISION),
  )
  const plan = await adminDocumentFields({
    accessToken,
    documentPath: planPath,
    projectId,
  })
  requireRemoteField(plan, 'status', 'stringValue', 'active')

  const completedTargets = [5_000, 5_000, 5_000, 8_000]
  const plannedTargets = [6_000, 6_000, 6_000, 10_000]
  for (const [index, target] of completedTargets.entries()) {
    const fields = await adminDocumentFields({
      accessToken,
      documentPath: `${planPath}/workouts/${workoutId('current', index)}`,
      projectId,
    })
    requireRemoteField(fields, 'status', 'stringValue', 'completed')
    requireRemoteField(
      fields,
      'targetDistanceMeters',
      'integerValue',
      String(target),
    )
  }
  for (const [index, target] of plannedTargets.entries()) {
    const fields = await adminDocumentFields({
      accessToken,
      documentPath: `${planPath}/workouts/${workoutId('next', index)}`,
      projectId,
    })
    requireRemoteField(fields, 'status', 'stringValue', 'planned')
    requireRemoteField(
      fields,
      'targetDistanceMeters',
      'integerValue',
      String(target),
    )
  }
  for (let index = 0; index < 4; index += 1) {
    const fields = await adminDocumentFields({
      accessToken,
      documentPath: `${ownerPath}/runs/${runId(index)}`,
      projectId,
    })
    requireRemoteField(
      fields,
      'plannedWorkoutId',
      'stringValue',
      workoutId('current', index),
    )
    requireRemoteField(
      fields,
      'plannedWorkoutPlanId',
      'stringValue',
      PLAN_ID,
    )
  }

  const recommendations = await dynamicDocumentPaths({
    accessToken,
    collectionPath: `${ownerPath}/recommendationEvidence`,
    projectId,
  })
  if (recommendations.length !== 1) {
    throw new Error(
      `Expected one pending recommendation, found ${recommendations.length}.`,
    )
  }
  const receipts = await dynamicDocumentPaths({
    accessToken,
    collectionPath: `${ownerPath}/adaptationCommandReceipts`,
    projectId,
  })
  if (receipts.length < 1) {
    throw new Error('Expected at least one adaptation command receipt.')
  }
  console.log(
    'PASS one pending recommendation is stored; the active revision, eight workouts, and four completed runs remain unchanged.',
  )
}

async function cleanup({ accessToken, manifestPath, projectId }) {
  const manifest = await readManifest(manifestPath)
  const fixture = manifest.account
  for (const collection of DYNAMIC_COLLECTIONS) {
    const collectionPath = `users/${fixture.uid}/${collection}`
    const paths = await dynamicDocumentPaths({
      accessToken,
      collectionPath,
      projectId,
    })
    for (const documentPath of paths.reverse()) {
      await deleteAdminDocument({ accessToken, documentPath, projectId })
    }
  }
  for (const documentPath of adaptationProofDocumentPaths(fixture).reverse()) {
    await deleteAdminDocument({ accessToken, documentPath, projectId })
  }
  await deleteFixtureAccount({
    accessToken,
    projectId,
    uid: fixture.uid,
  })
  await unlink(manifestPath)
  console.log(
    'Removed the fictional adaptation proof account, all seeded and generated records, and the local credential manifest.',
  )
}

async function run() {
  const options = parseAdaptationProofArguments(process.argv.slice(2))
  const projectDirectory = process.env.PROJECT_DIR ?? process.cwd()
  const manifestPath = path.join(projectDirectory, ADAPTATION_PROOF_MANIFEST)
  const accessToken = await operatorAccessToken(options)

  if (options.action === 'prepare') {
    await prepare({ accessToken, manifestPath, projectId: options.projectId })
  } else if (options.action === 'refresh') {
    await refresh({ accessToken, manifestPath, projectId: options.projectId })
  } else if (options.action === 'verify') {
    await verify({ accessToken, manifestPath, projectId: options.projectId })
  } else {
    await cleanup({ accessToken, manifestPath, projectId: options.projectId })
  }
}

const executedFile = process.argv[1]
if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
