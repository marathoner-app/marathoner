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
  setFixtureAccountDisabled,
  writeAdminDocument,
} from './verify-live-beta-boundary.mjs'

const require = createRequire(import.meta.url)
const { getAccessToken, getGlobalDefaultAccount } = require(
  'firebase-tools/lib/auth.js',
)

export const DEVELOPMENT_PROJECT_ID = 'marathoner-d9bf9'
export const DEVELOPMENT_OPERATOR_EMAIL = 'kevin-admin@marathonerapp.com'
export const ACCOUNT_ISOLATION_MANIFEST = '.ios-account-isolation.local'
export const ACCOUNT_ISOLATION_CONFIRMATIONS = Object.freeze({
  cleanup: 'DELETE-IOS-ACCOUNT-ISOLATION-FIXTURES',
  'disable-b': 'DISABLE-IOS-ACCOUNT-ISOLATION-B',
  'enable-b': 'ENABLE-IOS-ACCOUNT-ISOLATION-B',
  prepare: 'CREATE-IOS-ACCOUNT-ISOLATION-FIXTURES',
})

const FIXTURE_EMAIL_SUFFIX = '@marathonerapp.com'
const FIXTURE_PREFIX = 'ios-isolation-'
const FIXTURE_RUN_ID = 'isolation-sample-run'
const FIXTURE_SHOE_ID = 'isolation-shoe'
const FIXTURE_ROLES = ['account-a', 'account-b']

export function parseAccountIsolationArguments(argv) {
  const [action, ...pairs] = argv
  if (!(action in ACCOUNT_ISOLATION_CONFIRMATIONS)) {
    throw new Error(
      'Use prepare, disable-b, enable-b, or cleanup with the exact development project and confirmation phrase.',
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

export function createAccountIsolationFixtures() {
  const sessionId = randomBytes(8).toString('hex')

  return FIXTURE_ROLES.map((role) => ({
    email: `${FIXTURE_PREFIX}${sessionId}-${role}${FIXTURE_EMAIL_SUFFIX}`,
    emailVerified: true,
    role,
    uid: `${FIXTURE_PREFIX}${sessionId}-${role}`,
  }))
}

export function accountIsolationDocumentPaths(accounts) {
  return accounts.flatMap(({ uid }) => [
    `users/${uid}`,
    `users/${uid}/shoes/${FIXTURE_SHOE_ID}`,
    `users/${uid}/runs/${FIXTURE_RUN_ID}`,
  ])
}

function isFixtureIdentifier(value) {
  return typeof value === 'string' && value.startsWith(FIXTURE_PREFIX)
}

export function validateAccountIsolationManifest(manifest) {
  if (
    manifest?.schemaVersion !== 1 ||
    manifest?.projectId !== DEVELOPMENT_PROJECT_ID ||
    !Array.isArray(manifest?.accounts) ||
    manifest.accounts.length !== FIXTURE_ROLES.length
  ) {
    throw new Error('The local iOS account-isolation manifest is invalid.')
  }

  for (const role of FIXTURE_ROLES) {
    const account = manifest.accounts.find((candidate) => candidate?.role === role)
    if (
      !isFixtureIdentifier(account?.uid) ||
      !isFixtureIdentifier(account?.email) ||
      !account.email.endsWith(FIXTURE_EMAIL_SUFFIX) ||
      typeof account?.password !== 'string' ||
      account.password.length < 20
    ) {
      throw new Error(
        `The local iOS account-isolation manifest has an invalid ${role} fixture.`,
      )
    }
  }

  return manifest
}

function stringValue(value) {
  return { stringValue: value }
}

function integerValue(value) {
  return { integerValue: String(value) }
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

export function accountIsolationDocuments(account, now = new Date().toISOString()) {
  const isAccountA = account.role === 'account-a'
  const displayName = isAccountA ? 'Isolation Runner A' : 'Isolation Runner B'
  const distanceMeters = isAccountA ? 5_000 : 8_000
  const durationSeconds = isAccountA ? 1_620 : 2_700

  return [
    {
      documentPath: `users/${account.uid}`,
      fields: {
        availableTrainingDays: arrayValue([
          'monday',
          'wednesday',
          'friday',
          'sunday',
        ]),
        completionGoal: stringValue('complete_first_marathon'),
        createdAt: timestampValue(now),
        currentRunningFrequencyDaysPerWeek: integerValue(4),
        currentWeeklyDistanceMeters: integerValue(isAccountA ? 24_000 : 32_000),
        displayName: stringValue(displayName),
        experienceLevel: stringValue('consistent'),
        longestRecentRunDistanceMeters: integerValue(
          isAccountA ? 12_000 : 16_000,
        ),
        preferredDistanceUnit: stringValue('kilometer'),
        preferredLongRunDay: stringValue('sunday'),
        schemaVersion: integerValue(1),
        targetRace: mapValue({
          date: stringValue('2027-05-02'),
          kind: stringValue('date'),
        }),
        timeZone: stringValue('America/Los_Angeles'),
        updatedAt: timestampValue(now),
        userId: stringValue(account.uid),
      },
    },
    {
      documentPath: `users/${account.uid}/shoes/${FIXTURE_SHOE_ID}`,
      fields: {
        createdAt: timestampValue(now),
        name: stringValue(`${displayName} shoes`),
        schemaVersion: integerValue(1),
        startingDistanceMeters: integerValue(isAccountA ? 100_000 : 200_000),
        status: stringValue('active'),
        updatedAt: timestampValue(now),
        userId: stringValue(account.uid),
      },
    },
    {
      documentPath: `users/${account.uid}/runs/${FIXTURE_RUN_ID}`,
      fields: {
        createdAt: timestampValue(now),
        distanceMeters: integerValue(distanceMeters),
        durationSeconds: integerValue(durationSeconds),
        notes: stringValue(`${displayName} isolation fixture`),
        perceivedEffort: stringValue('about_right'),
        schemaVersion: integerValue(1),
        shoeId: stringValue(FIXTURE_SHOE_ID),
        startedAt: timestampValue(
          isAccountA ? '2026-10-20T14:00:00.000Z' : '2026-10-21T14:00:00.000Z',
        ),
        timeZone: stringValue('America/Los_Angeles'),
        updatedAt: timestampValue(now),
        userId: stringValue(account.uid),
      },
    },
  ]
}

export function assertAccountIsolationOptions({
  action,
  confirmation,
  operatorEmail,
  projectId,
}) {
  if (projectId !== DEVELOPMENT_PROJECT_ID) {
    throw new Error(
      `Refusing account-isolation fixtures for project "${projectId ?? ''}"; expected the development project.`,
    )
  }
  if (operatorEmail !== DEVELOPMENT_OPERATOR_EMAIL) {
    throw new Error(
      `Refusing account-isolation fixtures as "${operatorEmail ?? ''}"; expected the dedicated operator.`,
    )
  }
  if (confirmation !== ACCOUNT_ISOLATION_CONFIRMATIONS[action]) {
    throw new Error(
      `${action} requires --confirm ${ACCOUNT_ISOLATION_CONFIRMATIONS[action]}.`,
    )
  }
}

async function operatorAccessToken(options) {
  const account = getGlobalDefaultAccount()
  assertAccountIsolationOptions({
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
    `Refusing to overwrite ${ACCOUNT_ISOLATION_MANIFEST}; clean up its fixtures first.`,
  )
}

async function prepare({ accessToken, manifestPath, projectId }) {
  const fixtures = createAccountIsolationFixtures()
  const documents = fixtures.flatMap((fixture) =>
    accountIsolationDocuments(fixture),
  )
  const createdAccounts = []
  const createdDocuments = []
  const passwords = new Map(
    fixtures.map(({ uid }) => [uid, randomPassword()]),
  )

  await manifestMustNotExist(manifestPath)
  await assertFixtureAccountsDoNotExist({
    accessToken,
    fixtures,
    projectId,
  })
  await assertFixtureDocumentsDoNotExist({
    accessToken,
    documentPaths: documents.map(({ documentPath }) => documentPath),
    projectId,
  })

  try {
    for (const fixture of fixtures) {
      await createFixtureAccount({
        accessToken,
        fixture,
        password: passwords.get(fixture.uid),
        projectId,
      })
      createdAccounts.push(fixture.uid)
    }
    for (const document of documents) {
      await writeAdminDocument({ accessToken, ...document, projectId })
      createdDocuments.push(document.documentPath)
    }

    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          accounts: fixtures.map(({ email, role, uid }) => ({
            email,
            password: passwords.get(uid),
            role,
            uid,
          })),
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
    for (const uid of [...createdAccounts].reverse()) {
      try {
        await deleteFixtureAccount({ accessToken, projectId, uid })
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
    }
    if (cleanupErrors.length > 0) {
      throw new Error(
        `Account-isolation fixture preparation failed and cleanup was incomplete: ${cleanupErrors
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
    `Prepared two fictional development accounts. Credentials are stored only in ${ACCOUNT_ISOLATION_MANIFEST}.`,
  )
}

async function readManifest(manifestPath) {
  return validateAccountIsolationManifest(
    JSON.parse(await readFile(manifestPath, 'utf8')),
  )
}

async function setAccountBDisabled({
  accessToken,
  disabled,
  manifestPath,
  projectId,
}) {
  const manifest = await readManifest(manifestPath)
  const account = manifest.accounts.find(({ role }) => role === 'account-b')
  await setFixtureAccountDisabled({
    accessToken,
    disabled,
    projectId,
    uid: account.uid,
  })
  console.log(
    `The fictional account B is now ${disabled ? 'disabled with prior tokens revoked' : 'enabled for a new sign-in'}.`,
  )
}

async function cleanup({ accessToken, manifestPath, projectId }) {
  const manifest = await readManifest(manifestPath)
  for (const documentPath of accountIsolationDocumentPaths(
    manifest.accounts,
  ).reverse()) {
    await deleteAdminDocument({ accessToken, documentPath, projectId })
  }
  for (const { uid } of [...manifest.accounts].reverse()) {
    await deleteFixtureAccount({ accessToken, projectId, uid })
  }
  await unlink(manifestPath)
  console.log(
    'Removed both fictional account-isolation fixtures, their training documents, and the local credential manifest.',
  )
}

async function run() {
  const options = parseAccountIsolationArguments(process.argv.slice(2))
  const projectDirectory = process.env.PROJECT_DIR ?? process.cwd()
  const manifestPath = path.join(projectDirectory, ACCOUNT_ISOLATION_MANIFEST)
  const accessToken = await operatorAccessToken(options)

  if (options.action === 'prepare') {
    await prepare({ accessToken, manifestPath, projectId: options.projectId })
  } else if (options.action === 'cleanup') {
    await cleanup({ accessToken, manifestPath, projectId: options.projectId })
  } else {
    await setAccountBDisabled({
      accessToken,
      disabled: options.action === 'disable-b',
      manifestPath,
      projectId: options.projectId,
    })
  }
}

const executedFile = process.argv[1]
if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
