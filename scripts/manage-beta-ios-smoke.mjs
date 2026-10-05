import { constants } from 'node:fs'
import { access, readFile, unlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  LIVE_BETA_CONFIRMATION,
  LIVE_BETA_PROJECT_ID,
  assertFixtureAccountsDoNotExist,
  assertFixtureDocumentsDoNotExist,
  assertLiveVerificationOptions,
  createFixtureAccount,
  deleteAdminDocument,
  deleteFixtureAccount,
  firebaseCliTokenScopes,
  fixtureAccounts,
  membershipFields,
  randomPassword,
  writeAdminDocument,
} from './verify-live-beta-boundary.mjs'

const require = createRequire(import.meta.url)
const { getAccessToken, getGlobalDefaultAccount } = require(
  'firebase-tools/lib/auth.js',
)

export const PHYSICAL_SMOKE_MANIFEST = '.beta-ios-smoke.local'
export const PHYSICAL_SMOKE_CREATE_CONFIRMATION =
  'CREATE-BETA-IOS-SMOKE-FIXTURES'
export const PHYSICAL_SMOKE_DELETE_CONFIRMATION =
  'DELETE-BETA-IOS-SMOKE-FIXTURES'

export function physicalSmokeFixtures() {
  return fixtureAccounts().filter(({ role }) =>
    role === 'approved' || role === 'unapproved',
  )
}

export function physicalSmokeDocumentPaths(fixtures = physicalSmokeFixtures()) {
  return fixtures.map(({ uid }) => `betaMemberships/${uid}`)
}

export function parsePhysicalSmokeArguments(argv) {
  const [action, ...pairs] = argv
  if (action !== 'prepare' && action !== 'cleanup') {
    throw new Error(
      'Use prepare or cleanup with the exact beta project and confirmation phrase.',
    )
  }

  const values = new Map()
  for (let index = 0; index < pairs.length; index += 2) {
    const name = pairs[index]
    const value = pairs[index + 1]
    if (!name?.startsWith('--') || value === undefined) {
      throw new Error(
        'Use --project marathonerapp-beta and the action-specific --confirm phrase.',
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

export function validatePhysicalSmokeManifest(manifest) {
  const expectedFixtures = physicalSmokeFixtures()
  if (
    manifest?.schemaVersion !== 1 ||
    manifest?.projectId !== LIVE_BETA_PROJECT_ID ||
    !Array.isArray(manifest?.accounts) ||
    manifest.accounts.length !== expectedFixtures.length
  ) {
    throw new Error('The local beta iOS smoke manifest is invalid.')
  }

  for (const expected of expectedFixtures) {
    const account = manifest.accounts.find(
      (candidate) => candidate?.role === expected.role,
    )
    if (
      account?.email !== expected.email ||
      account?.uid !== expected.uid ||
      typeof account?.password !== 'string' ||
      account.password.length < 20
    ) {
      throw new Error(
        `The local beta iOS smoke manifest has an invalid ${expected.role} fixture.`,
      )
    }
  }

  return manifest
}

function expectedConfirmation(action) {
  return action === 'prepare'
    ? PHYSICAL_SMOKE_CREATE_CONFIRMATION
    : PHYSICAL_SMOKE_DELETE_CONFIRMATION
}

async function operatorAccessToken({ projectId }) {
  const account = getGlobalDefaultAccount()
  assertLiveVerificationOptions({
    confirmation: LIVE_BETA_CONFIRMATION,
    operatorEmail: account?.user?.email,
    projectId,
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
    `Refusing to overwrite ${PHYSICAL_SMOKE_MANIFEST}; clean up its fixtures first.`,
  )
}

async function prepare({ accessToken, manifestPath, projectId }) {
  const fixtures = physicalSmokeFixtures()
  const documentPaths = physicalSmokeDocumentPaths(fixtures)
  const createdAccounts = []
  const createdDocuments = []
  const passwords = new Map(
    fixtures.map((fixture) => [fixture.uid, randomPassword()]),
  )

  await manifestMustNotExist(manifestPath)
  await assertFixtureAccountsDoNotExist({ accessToken, fixtures, projectId })
  await assertFixtureDocumentsDoNotExist({
    accessToken,
    documentPaths,
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

    const approved = fixtures.find(({ role }) => role === 'approved')
    if (!approved) {
      throw new Error('The approved beta iOS smoke fixture is missing.')
    }
    const approvedMembershipPath = `betaMemberships/${approved.uid}`
    await writeAdminDocument({
      accessToken,
      documentPath: approvedMembershipPath,
      fields: membershipFields(approved.uid),
      projectId,
    })
    createdDocuments.push(approvedMembershipPath)

    const manifest = {
      accounts: fixtures.map(({ email, role, uid }) => ({
        email,
        password: passwords.get(uid),
        role,
        uid,
      })),
      createdAt: new Date().toISOString(),
      projectId,
      schemaVersion: 1,
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    })
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
        `Beta iOS smoke fixture preparation failed and cleanup was incomplete: ${cleanupErrors
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
    `Prepared approved and unapproved fictional beta iOS fixtures. Credentials are stored only in ${PHYSICAL_SMOKE_MANIFEST}.`,
  )
}

async function cleanup({ accessToken, manifestPath, projectId }) {
  const manifest = validatePhysicalSmokeManifest(
    JSON.parse(await readFile(manifestPath, 'utf8')),
  )

  for (const documentPath of physicalSmokeDocumentPaths().reverse()) {
    await deleteAdminDocument({ accessToken, documentPath, projectId })
  }
  for (const { uid } of [...manifest.accounts].reverse()) {
    await deleteFixtureAccount({ accessToken, projectId, uid })
  }
  await unlink(manifestPath)

  console.log(
    'Removed the fictional beta iOS fixtures and their local credential manifest.',
  )
}

async function run() {
  const options = parsePhysicalSmokeArguments(process.argv.slice(2))
  if (options.confirmation !== expectedConfirmation(options.action)) {
    throw new Error(
      `${options.action} requires --confirm ${expectedConfirmation(options.action)}.`,
    )
  }

  const projectDirectory = process.env.PROJECT_DIR ?? process.cwd()
  const manifestPath = path.join(projectDirectory, PHYSICAL_SMOKE_MANIFEST)
  const accessToken = await operatorAccessToken(options)

  if (options.action === 'prepare') {
    await prepare({
      accessToken,
      manifestPath,
      projectId: options.projectId,
    })
  } else {
    await cleanup({
      accessToken,
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
