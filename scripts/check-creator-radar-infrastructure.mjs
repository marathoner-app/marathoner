import { readFile } from 'node:fs/promises'

const main = await readFile(
  new URL('../infrastructure/creator-radar-events-development/main.tf', import.meta.url),
  'utf8',
)
const versions = await readFile(
  new URL('../infrastructure/creator-radar-events-development/versions.tf', import.meta.url),
  'utf8',
)

const resources = [...main.matchAll(/resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g)]
if (resources.length !== 1 || resources[0]?.[1] !== 'google_service_account') {
  throw new Error('The development caller stack must declare exactly one service-account resource.')
}
if (!main.includes('project_id        = "marathoner-d9bf9"')
  || !main.includes('caller_account_id = "creator-radar-events-dev"')) {
  throw new Error('The development caller identity literals changed.')
}

const forbidden = [
  /google_project_iam/,
  /google_service_account_key/,
  /google_secret_manager/,
  /google_project_service/,
  /marathoner-creator-radar-prod/,
  /roles\//,
]
if (forbidden.some((pattern) => pattern.test(main))) {
  throw new Error('The source stack contains a forbidden role, credential, API, secret, or production declaration.')
}
if (!/backend\s+"gcs"\s*\{\s*\}/.test(versions)) {
  throw new Error('The development caller stack must require an externally supplied GCS backend.')
}

console.log('Creator Radar caller infrastructure remains one unapplied identity with no source-project role.')
