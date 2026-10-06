import { pathToFileURL } from 'node:url'

export const ACCOUNT_DELETION_EMULATOR_PROJECT = 'demo-marathoner'
export const ACCOUNT_DELETION_RUNNER_ENVIRONMENT = 'emulator'
export const ACCOUNT_DELETION_APPROVED_LIVE_PROJECTS = Object.freeze([])

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const actions = new Set(['run', 'purge-receipt'])
const optionNames = new Set([
  '--confirm',
  '--environment',
  '--project',
  '--request',
])

export function accountDeletionConfirmation(action, projectId, requestId) {
  const verb = action === 'run' ? 'DELETE' : 'PURGE'
  return `${verb} ${projectId} ${requestId}`
}

export function parseAccountDeletionArguments(argv) {
  const [action, ...pairs] = argv
  if (!actions.has(action)) {
    throw new Error('Use run or purge-receipt with the exact required options.')
  }
  if (pairs.length !== optionNames.size * 2) {
    throw new Error(
      'Provide --environment, --project, --request, and --confirm exactly once.',
    )
  }

  const values = new Map()
  for (let index = 0; index < pairs.length; index += 2) {
    const name = pairs[index]
    const value = pairs[index + 1]
    if (!optionNames.has(name) || value === undefined || values.has(name)) {
      throw new Error(
        'Only --environment, --project, --request, and --confirm are accepted.',
      )
    }
    values.set(name, value)
  }

  return {
    action,
    confirmation: values.get('--confirm'),
    environment: values.get('--environment'),
    projectId: values.get('--project'),
    requestId: values.get('--request'),
  }
}

export function assertAccountDeletionOptions(options) {
  if (options.environment !== ACCOUNT_DELETION_RUNNER_ENVIRONMENT) {
    throw new Error(
      'The account-deletion runner is approved only for the local emulator.',
    )
  }
  if (options.projectId !== ACCOUNT_DELETION_EMULATOR_PROJECT) {
    throw new Error(
      `Refusing project "${options.projectId ?? ''}"; expected "${ACCOUNT_DELETION_EMULATOR_PROJECT}".`,
    )
  }
  if (!requestIdPattern.test(options.requestId ?? '')) {
    throw new Error('The deletion request must be one exact random request ID.')
  }
  const expected = accountDeletionConfirmation(
    options.action,
    options.projectId,
    options.requestId,
  )
  if (options.confirmation !== expected) {
    throw new Error(`This action requires --confirm "${expected}".`)
  }
}

export function assertAccountDeletionEmulators(environment = process.env) {
  if (
    environment.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
    environment.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
  ) {
    throw new Error(
      'Refusing deletion because the exact local Firestore and Auth emulators are not active.',
    )
  }
}

async function run() {
  const options = parseAccountDeletionArguments(process.argv.slice(2))
  assertAccountDeletionOptions(options)
  assertAccountDeletionEmulators()

  const [
    { deleteApp, initializeApp },
    { getAuth },
    { getFirestore },
    runnerModule,
    accountAccessModule,
  ] = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/auth'),
      import('firebase-admin/firestore'),
      import('../functions/lib/functions/src/accountDeletionRunner.js'),
      import('../functions/lib/functions/src/firebaseAccountAccessManager.js'),
    ])
  const app = initializeApp(
    { projectId: options.projectId },
    `account-deletion-operator-${Date.now()}`,
  )
  const privateRecords = {
    deleteDeclaredRecords: async () => undefined,
    verifyDeclaredRecordsAbsent: async () => undefined,
  }
  const runner = new runnerModule.AccountDeletionRunner({
    accountAccess: new accountAccessModule.FirebaseAccountAccessManager(
      getAuth(app),
    ),
    store: new runnerModule.FirestoreAccountDeletionWorkflowStore(
      getFirestore(app),
    ),
    privateRecords,
    now: () => new Date(),
    log: (entry) => console.log(JSON.stringify(entry)),
  })

  try {
    if (options.action === 'run') {
      const result = await runner.run(options.requestId)
      console.log(JSON.stringify(result))
    } else {
      await runner.purgeExpiredReceipt(options.requestId)
      console.log(
        JSON.stringify({
          status: 'purged',
          requestId: options.requestId,
        }),
      )
    }
  } finally {
    await deleteApp(app)
  }
}

const executedFile = process.argv[1]
if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Deletion failed.')
    process.exitCode = 1
  })
}
