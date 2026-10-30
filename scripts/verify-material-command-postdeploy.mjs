import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const targets = Object.freeze({
  development: Object.freeze({
    projectId: 'marathoner-d9bf9',
    expectedReceiptStatuses: Object.freeze([
      'plan_approved',
      'run_completed',
      'run_updated',
      'run_deleted',
    ]),
  }),
  beta: Object.freeze({
    projectId: 'marathonerapp-beta',
    expectedReceiptStatuses: Object.freeze([
      'plan_approved',
      'run_completed',
      'run_updated',
      'run_deleted',
    ]),
  }),
})

const region = 'us-central1'
const services = Object.freeze([
  Object.freeze({
    exportName: 'submitMaterialCommand',
    cloudRunName: 'submitmaterialcommand',
  }),
  Object.freeze({
    exportName: 'resolveMaterialCommand',
    cloudRunName: 'resolvematerialcommand',
  }),
])

export function parsePostdeployArguments(argv) {
  const [environmentName, ...options] = argv
  const target = targets[environmentName]
  if (!target) {
    throw new Error('Choose exactly one post-deploy environment: development or beta.')
  }

  const receiptOptionIndex = options.indexOf('--receipt-status')
  const receiptStatus =
    receiptOptionIndex === -1 ? null : options[receiptOptionIndex + 1] ?? null
  if (
    receiptStatus === null ||
    !target.expectedReceiptStatuses.includes(receiptStatus)
  ) {
    throw new Error(
      'Confirm one real authenticated Firestore receipt with --receipt-status and its fixed committed status.',
    )
  }
  if (options.length !== 2 || receiptOptionIndex !== 0) {
    throw new Error('Only --receipt-status <fixed-status> is accepted.')
  }

  return { environmentName, receiptStatus, ...target }
}

export function assertServicePrerequisites(description) {
  const annotation =
    description?.metadata?.annotations?.['run.googleapis.com/invoker-iam-disabled']
  const runtimeServiceAccount =
    description?.spec?.template?.spec?.serviceAccountName

  if (annotation !== 'true') {
    throw new Error(
      'Callable transport is not configured for Domain Restricted Sharing recovery.',
    )
  }
  if (
    typeof runtimeServiceAccount !== 'string' ||
    runtimeServiceAccount.length === 0
  ) {
    throw new Error('The Cloud Run runtime service identity could not be confirmed.')
  }

  return runtimeServiceAccount
}

export function assertRuntimeFirestoreRole(policy, runtimeServiceAccount) {
  const expectedMember = `serviceAccount:${runtimeServiceAccount}`
  const hasRole = Array.isArray(policy?.bindings) && policy.bindings.some(
    (binding) =>
      binding?.role === 'roles/datastore.user' &&
      Array.isArray(binding.members) &&
      binding.members.includes(expectedMember),
  )

  if (!hasRole) {
    throw new Error(
      'The Functions runtime service identity is missing roles/datastore.user.',
    )
  }
}

export function assertTransportResponse(response) {
  const result = response?.result ?? response?.data
  if (
    result?.status !== 'authentication_error' ||
    result?.code !== 'authentication-required'
  ) {
    throw new Error(
      'Callable transport did not reach the Marathoner authentication boundary.',
    )
  }
}

function readGcloudJson(args, failureMessage) {
  const command = spawnSync('gcloud', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (command.error?.code === 'ENOENT') {
    throw new Error(
      'Google Cloud CLI is required; run this verifier from an authenticated Cloud Shell or install gcloud locally.',
    )
  }
  if (command.status !== 0) throw new Error(failureMessage)

  try {
    return JSON.parse(command.stdout)
  } catch {
    throw new Error(failureMessage)
  }
}

async function verifyTransport(projectId, exportName) {
  const url = `https://${region}-${projectId}.cloudfunctions.net/${exportName}`
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
    })
  } catch {
    throw new Error('Callable transport could not be reached.')
  }
  if (!response.ok) {
    throw new Error('Callable transport was rejected before Marathoner authentication.')
  }

  let body
  try {
    body = await response.json()
  } catch {
    throw new Error('Callable transport returned a non-JSON response.')
  }
  assertTransportResponse(body)
}

export async function verifyMaterialCommandPostdeploy(argv) {
  const target = parsePostdeployArguments(argv)
  const runtimeServiceAccounts = new Set()

  for (const service of services) {
    const description = readGcloudJson(
      [
        'run',
        'services',
        'describe',
        service.cloudRunName,
        '--project',
        target.projectId,
        '--region',
        region,
        '--format=json',
      ],
      'A reviewed Cloud Run service could not be described.',
    )
    runtimeServiceAccounts.add(assertServicePrerequisites(description))
    await verifyTransport(target.projectId, service.exportName)
  }

  const policy = readGcloudJson(
    ['projects', 'get-iam-policy', target.projectId, '--format=json'],
    'The target project IAM policy could not be read.',
  )
  for (const runtimeServiceAccount of runtimeServiceAccounts) {
    assertRuntimeFirestoreRole(policy, runtimeServiceAccount)
  }

  console.log(
    `Verified ${target.environmentName} callable transport and runtime Firestore access prerequisites.`,
  )
  console.log(
    `Operator confirmed one authenticated Firestore receipt with status ${target.receiptStatus}.`,
  )
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  import.meta.url === pathToFileURL(invokedPath).href
) {
  verifyMaterialCommandPostdeploy(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Post-deploy verification failed.')
    process.exitCode = 1
  })
}
