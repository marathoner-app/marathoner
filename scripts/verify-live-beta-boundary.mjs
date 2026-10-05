import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { getAccessToken, getGlobalDefaultAccount } = require(
  'firebase-tools/lib/auth.js',
)

export const LIVE_BETA_PROJECT_ID = 'marathonerapp-beta'
export const LIVE_BETA_OPERATOR_EMAIL = 'kevin-admin@marathonerapp.com'
export const LIVE_BETA_CONFIRMATION = 'CREATE-TEST-AND-DELETE-BETA-FIXTURES'

const FIXTURE_ORIGIN = 'https://marathonerapp.com/'
const FIRESTORE_DATABASE_ID = '(default)'
const FIXTURE_RUN_ID = 'live-boundary-verification'

export function assertLiveVerificationOptions({
  confirmation,
  operatorEmail,
  projectId,
}) {
  if (projectId !== LIVE_BETA_PROJECT_ID) {
    throw new Error(
      `Refusing live verification for project "${projectId ?? ''}"; expected "${LIVE_BETA_PROJECT_ID}".`,
    )
  }

  if (operatorEmail !== LIVE_BETA_OPERATOR_EMAIL) {
    throw new Error(
      `Refusing live verification as "${operatorEmail ?? ''}"; expected the dedicated beta operator.`,
    )
  }

  if (confirmation !== LIVE_BETA_CONFIRMATION) {
    throw new Error(
      `Live verification requires --confirm ${LIVE_BETA_CONFIRMATION}.`,
    )
  }
}

export function parseBetaPublicConfiguration(source) {
  const betaBlock = source.match(/\bbeta:\s*\{([\s\S]*?)\n\s*\},/u)?.[1]
  const apiKey = betaBlock?.match(/\bapiKey:\s*["']([^"']+)["']/u)?.[1]
  const projectId = betaBlock?.match(/\bprojectId:\s*["']([^"']+)["']/u)?.[1]

  if (!apiKey || !projectId) {
    throw new Error(
      'Unable to read the beta public Firebase configuration from src/firebaseConfig.ts.',
    )
  }

  if (projectId !== LIVE_BETA_PROJECT_ID) {
    throw new Error(
      `The beta client configuration targets "${projectId}" instead of "${LIVE_BETA_PROJECT_ID}".`,
    )
  }

  return { apiKey, projectId }
}

export function fixtureAccounts() {
  return [
    {
      email: 'firebase-fixture-approved@marathonerapp.com',
      emailVerified: true,
      membership: true,
      role: 'approved',
      uid: 'beta-fixture-approved',
    },
    {
      email: 'firebase-fixture-unapproved@marathonerapp.com',
      emailVerified: true,
      membership: false,
      role: 'unapproved',
      uid: 'beta-fixture-unapproved',
    },
    {
      email: 'firebase-fixture-unverified@marathonerapp.com',
      emailVerified: false,
      membership: true,
      role: 'unverified',
      uid: 'beta-fixture-unverified',
    },
  ]
}

export function fixtureDocumentPaths(fixtures = fixtureAccounts()) {
  const fixtureByRole = new Map(
    fixtures.map((fixture) => [fixture.role, fixture]),
  )
  const approved = fixtureByRole.get('approved')
  const unapproved = fixtureByRole.get('unapproved')
  const unverified = fixtureByRole.get('unverified')

  if (!approved || !unapproved || !unverified) {
    throw new Error('The live verifier requires approved, unapproved, and unverified fixtures.')
  }

  return [
    `betaMemberships/${approved.uid}`,
    `betaMemberships/${unverified.uid}`,
    `users/${approved.uid}/runs/${FIXTURE_RUN_ID}`,
    `users/${unapproved.uid}/runs/${FIXTURE_RUN_ID}`,
    `users/${unapproved.uid}/runs/cross-owner-verification`,
    `users/${unverified.uid}/runs/${FIXTURE_RUN_ID}`,
  ]
}

export function firebaseCliTokenScopes(tokens) {
  if (Array.isArray(tokens?.scopes) && tokens.scopes.length > 0) {
    return [...tokens.scopes]
  }

  if (typeof tokens?.scope === 'string') {
    const scopes = tokens.scope.split(/\s+/u).filter(Boolean)
    if (scopes.length > 0) {
      return scopes
    }
  }

  throw new Error('Firebase CLI credentials do not include OAuth scopes.')
}

export function assertExpectedDecision({ allowed, label, status }) {
  const matches = allowed
    ? status >= 200 && status < 300
    : status === 401 || status === 403

  if (!matches) {
    const expectation = allowed ? 'an allowed 2xx response' : 'a denied 401/403 response'
    throw new Error(`${label} expected ${expectation}, received HTTP ${status}.`)
  }
}

function parseArguments(argv) {
  const values = new Map()

  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]
    const value = argv[index + 1]

    if (!name?.startsWith('--') || value === undefined) {
      throw new Error(
        'Usage: npm run verify:beta-boundary -- --project marathonerapp-beta --confirm CREATE-TEST-AND-DELETE-BETA-FIXTURES',
      )
    }

    values.set(name, value)
  }

  return {
    confirmation: values.get('--confirm'),
    projectId: values.get('--project'),
  }
}

function encodedDocumentPath(documentPath) {
  return documentPath.split('/').map(encodeURIComponent).join('/')
}

function firestoreDocumentUrl(projectId, documentPath) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${FIRESTORE_DATABASE_ID}/documents/${encodedDocumentPath(documentPath)}`
}

function identityToolkitUrl(pathname, apiKey) {
  const url = new URL(`https://identitytoolkit.googleapis.com/v1/${pathname}`)
  if (apiKey) {
    url.searchParams.set('key', apiKey)
  }
  return url
}

export function randomPassword() {
  return `${randomBytes(24).toString('base64url')}Aa1!`
}

function safeApiError(payload) {
  const message = payload?.error?.message
  return typeof message === 'string' ? message : 'request failed'
}

async function requestJson({
  body,
  headers = {},
  label,
  method = 'POST',
  url,
}) {
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

  return {
    errorMessage: response.ok ? null : safeApiError(payload),
    payload,
    status: response.status,
  }
}

function assertRequestSucceeded(result, label) {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `${label} failed with HTTP ${result.status}: ${result.errorMessage}.`,
    )
  }
}

function bearerHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

export async function assertFixtureAccountsDoNotExist({
  accessToken,
  fixtures,
  projectId,
}) {
  const lookup = await requestJson({
    body: { localId: fixtures.map(({ uid }) => uid) },
    headers: {
      ...bearerHeaders(accessToken),
      Referer: FIXTURE_ORIGIN,
    },
    label: 'Fixture collision check',
    url: identityToolkitUrl(
      `projects/${encodeURIComponent(projectId)}/accounts:lookup`,
    ),
  })

  if (lookup.status === 400 && lookup.errorMessage === 'USER_NOT_FOUND') {
    return
  }

  assertRequestSucceeded(lookup, 'Fixture collision check')

  if (lookup.payload?.users?.length) {
    throw new Error(
      'A fixed live-verification Auth fixture already exists. Remove it through the reviewed operator procedure before retrying.',
    )
  }
}

export async function createFixtureAccount({
  accessToken,
  fixture,
  password,
  projectId,
}) {
  const result = await requestJson({
    body: {
      disabled: false,
      displayName: `Marathoner ${fixture.role} live fixture`,
      email: fixture.email,
      emailVerified: fixture.emailVerified,
      localId: fixture.uid,
      password,
    },
    headers: {
      ...bearerHeaders(accessToken),
      Referer: FIXTURE_ORIGIN,
    },
    label: `Create ${fixture.role} fixture`,
    url: identityToolkitUrl(
      `projects/${encodeURIComponent(projectId)}/accounts`,
    ),
  })

  assertRequestSucceeded(result, `Create ${fixture.role} fixture`)
}

export async function deleteFixtureAccount({
  accessToken,
  projectId,
  uid,
}) {
  const result = await requestJson({
    body: { localId: uid },
    headers: {
      ...bearerHeaders(accessToken),
      Referer: FIXTURE_ORIGIN,
    },
    label: `Delete Auth fixture ${uid}`,
    url: identityToolkitUrl(
      `projects/${encodeURIComponent(projectId)}/accounts:delete`,
    ),
  })

  if (result.status === 400 && result.errorMessage === 'USER_NOT_FOUND') {
    return
  }

  assertRequestSucceeded(result, `Delete Auth fixture ${uid}`)
}

async function signInFixture({ apiKey, email, password }) {
  const result = await requestJson({
    body: { email, password, returnSecureToken: true },
    headers: { Referer: FIXTURE_ORIGIN },
    label: 'Sign in fixture',
    url: identityToolkitUrl('accounts:signInWithPassword', apiKey),
  })

  assertRequestSucceeded(result, 'Sign in fixture')

  if (typeof result.payload?.idToken !== 'string') {
    throw new Error('Sign in fixture succeeded without returning an ID token.')
  }

  return result.payload.idToken
}

export async function writeAdminDocument({
  accessToken,
  documentPath,
  fields,
  projectId,
}) {
  const result = await requestJson({
    body: { fields },
    headers: bearerHeaders(accessToken),
    label: `Write ${documentPath}`,
    method: 'PATCH',
    url: firestoreDocumentUrl(projectId, documentPath),
  })

  assertRequestSucceeded(result, `Write ${documentPath}`)
}

export async function deleteAdminDocument({
  accessToken,
  documentPath,
  projectId,
}) {
  const result = await requestJson({
    headers: bearerHeaders(accessToken),
    label: `Delete ${documentPath}`,
    method: 'DELETE',
    url: firestoreDocumentUrl(projectId, documentPath),
  })

  if (result.status !== 404) {
    assertRequestSucceeded(result, `Delete ${documentPath}`)
  }
}

export async function assertFixtureDocumentsDoNotExist({
  accessToken,
  documentPaths,
  projectId,
}) {
  for (const documentPath of documentPaths) {
    const result = await requestJson({
      headers: bearerHeaders(accessToken),
      label: `Check ${documentPath}`,
      method: 'GET',
      url: firestoreDocumentUrl(projectId, documentPath),
    })

    if (result.status === 404) {
      continue
    }

    assertRequestSucceeded(result, `Check ${documentPath}`)
    throw new Error(
      `A fixed live-verification document already exists at ${documentPath}. Remove it through the reviewed operator procedure before retrying.`,
    )
  }
}

async function clientDocumentRequest({
  documentPath,
  fields,
  idToken,
  method,
  projectId,
}) {
  return requestJson({
    body: fields === undefined ? undefined : { fields },
    headers: idToken ? bearerHeaders(idToken) : {},
    label: `${method} ${documentPath}`,
    method,
    url: firestoreDocumentUrl(projectId, documentPath),
  })
}

export function membershipFields(uid) {
  return {
    approvedAt: { timestampValue: new Date().toISOString() },
    approvedBy: { stringValue: 'live-boundary-verification' },
    schemaVersion: { integerValue: '1' },
    status: { stringValue: 'approved' },
    userId: { stringValue: uid },
  }
}

function runFields(uid) {
  return {
    fixture: { booleanValue: true },
    schemaVersion: { integerValue: '1' },
    userId: { stringValue: uid },
  }
}

async function verifyDecision({
  allowed,
  documentPath,
  fields,
  idToken,
  label,
  method,
  projectId,
}) {
  const result = await clientDocumentRequest({
    documentPath,
    fields,
    idToken,
    method,
    projectId,
  })

  assertExpectedDecision({ allowed, label, status: result.status })
  console.log(`PASS ${label} (HTTP ${result.status})`)
}

async function run() {
  const options = parseArguments(process.argv.slice(2))
  const projectDirectory = process.env.PROJECT_DIR ?? process.cwd()
  const source = await readFile(
    path.join(projectDirectory, 'src/firebaseConfig.ts'),
    'utf8',
  )
  const publicConfiguration = parseBetaPublicConfiguration(source)
  const account = getGlobalDefaultAccount()

  assertLiveVerificationOptions({
    confirmation: options.confirmation,
    operatorEmail: account?.user?.email,
    projectId: options.projectId,
  })

  const token = await getAccessToken(
    account.tokens.refresh_token,
    firebaseCliTokenScopes(account.tokens),
  )
  const accessToken = token.access_token

  if (typeof accessToken !== 'string') {
    throw new Error('Firebase CLI did not provide an operator access token.')
  }

  const fixtures = fixtureAccounts()
  const documentPaths = fixtureDocumentPaths(fixtures)
  const passwords = new Map(
    fixtures.map((fixture) => [fixture.uid, randomPassword()]),
  )
  const fixtureByRole = new Map(
    fixtures.map((fixture) => [fixture.role, fixture]),
  )
  const idTokenByRole = new Map()
  let fixturesClaimed = false
  let verificationError = null

  try {
    await assertFixtureAccountsDoNotExist({
      accessToken,
      fixtures,
      projectId: options.projectId,
    })
    await assertFixtureDocumentsDoNotExist({
      accessToken,
      documentPaths,
      projectId: options.projectId,
    })
    fixturesClaimed = true

    for (const fixture of fixtures) {
      await createFixtureAccount({
        accessToken,
        fixture,
        password: passwords.get(fixture.uid),
        projectId: options.projectId,
      })
    }

    for (const fixture of fixtures.filter(({ membership }) => membership)) {
      const documentPath = `betaMemberships/${fixture.uid}`
      await writeAdminDocument({
        accessToken,
        documentPath,
        fields: membershipFields(fixture.uid),
        projectId: options.projectId,
      })
    }

    for (const fixture of fixtures) {
      idTokenByRole.set(
        fixture.role,
        await signInFixture({
          apiKey: publicConfiguration.apiKey,
          email: fixture.email,
          password: passwords.get(fixture.uid),
        }),
      )
    }

    const approved = fixtureByRole.get('approved')
    const unapproved = fixtureByRole.get('unapproved')
    const unverified = fixtureByRole.get('unverified')
    const approvedRunPath = `users/${approved.uid}/runs/${FIXTURE_RUN_ID}`
    const approvedMembershipPath = `betaMemberships/${approved.uid}`

    await verifyDecision({
      allowed: false,
      documentPath: approvedRunPath,
      fields: runFields(approved.uid),
      label: 'anonymous training write is denied',
      method: 'PATCH',
      projectId: options.projectId,
    })
    await verifyDecision({
      allowed: false,
      documentPath: `users/${unverified.uid}/runs/${FIXTURE_RUN_ID}`,
      fields: runFields(unverified.uid),
      idToken: idTokenByRole.get('unverified'),
      label: 'unverified approved-member training write is denied',
      method: 'PATCH',
      projectId: options.projectId,
    })
    await verifyDecision({
      allowed: false,
      documentPath: `users/${unapproved.uid}/runs/${FIXTURE_RUN_ID}`,
      fields: runFields(unapproved.uid),
      idToken: idTokenByRole.get('unapproved'),
      label: 'verified non-member training write is denied',
      method: 'PATCH',
      projectId: options.projectId,
    })
    await verifyDecision({
      allowed: true,
      documentPath: approvedMembershipPath,
      idToken: idTokenByRole.get('approved'),
      label: 'approved verified member can read own membership',
      method: 'GET',
      projectId: options.projectId,
    })
    await verifyDecision({
      allowed: true,
      documentPath: approvedRunPath,
      fields: runFields(approved.uid),
      idToken: idTokenByRole.get('approved'),
      label: 'approved verified owner can write own training data',
      method: 'PATCH',
      projectId: options.projectId,
    })
    await verifyDecision({
      allowed: true,
      documentPath: approvedRunPath,
      idToken: idTokenByRole.get('approved'),
      label: 'approved verified owner can read own training data',
      method: 'GET',
      projectId: options.projectId,
    })
    await verifyDecision({
      allowed: false,
      documentPath: `users/${unapproved.uid}/runs/cross-owner-verification`,
      idToken: idTokenByRole.get('approved'),
      label: 'approved member cross-owner training read is denied',
      method: 'GET',
      projectId: options.projectId,
    })
    await verifyDecision({
      allowed: false,
      documentPath: `users/${unapproved.uid}/runs/cross-owner-verification`,
      fields: runFields(unapproved.uid),
      idToken: idTokenByRole.get('approved'),
      label: 'approved member cross-owner training write is denied',
      method: 'PATCH',
      projectId: options.projectId,
    })
    await verifyDecision({
      allowed: false,
      documentPath: approvedMembershipPath,
      fields: membershipFields(approved.uid),
      idToken: idTokenByRole.get('approved'),
      label: 'participant membership mutation is denied',
      method: 'PATCH',
      projectId: options.projectId,
    })

    await deleteAdminDocument({
      accessToken,
      documentPath: approvedMembershipPath,
      projectId: options.projectId,
    })
    await verifyDecision({
      allowed: false,
      documentPath: approvedRunPath,
      idToken: idTokenByRole.get('approved'),
      label: 'membership revocation immediately denies training reads',
      method: 'GET',
      projectId: options.projectId,
    })
  } catch (error) {
    verificationError = error
  } finally {
    const cleanupErrors = []

    for (const documentPath of fixturesClaimed ? [...documentPaths].reverse() : []) {
      try {
        await deleteAdminDocument({
          accessToken,
          documentPath,
          projectId: options.projectId,
        })
      } catch (error) {
        cleanupErrors.push(error)
      }
    }

    for (const fixture of fixturesClaimed ? [...fixtures].reverse() : []) {
      try {
        await deleteFixtureAccount({
          accessToken,
          projectId: options.projectId,
          uid: fixture.uid,
        })
      } catch (error) {
        cleanupErrors.push(error)
      }
    }

    if (cleanupErrors.length > 0) {
      const cleanupMessage = cleanupErrors
        .map((error) => (error instanceof Error ? error.message : String(error)))
        .join(' ')
      throw new Error(
        `Live fixture cleanup was incomplete. ${cleanupMessage}`,
        verificationError ? { cause: verificationError } : undefined,
      )
    }
  }

  if (verificationError) {
    throw verificationError
  }

  console.log('PASS all fictional Auth and Firestore fixtures were removed')
}

const executedFile = process.argv[1]
if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
