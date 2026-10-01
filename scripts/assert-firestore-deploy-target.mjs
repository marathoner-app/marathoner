import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function assertFirestoreDeployTarget({
  actualProjectId,
  environmentName,
  projectAliases,
}) {
  if (environmentName !== 'development' && environmentName !== 'beta') {
    throw new Error(
      `Unknown Firebase environment "${environmentName ?? ''}". Expected "development" or "beta".`,
    )
  }

  const expectedProjectId = projectAliases[environmentName]
  if (!expectedProjectId) {
    throw new Error(
      `Firebase environment "${environmentName}" is unprovisioned in .firebaserc; deployment is blocked.`,
    )
  }

  if (!actualProjectId) {
    throw new Error(
      'GCLOUD_PROJECT is missing; use Firebase CLI with an explicit reviewed project target.',
    )
  }

  if (actualProjectId !== expectedProjectId) {
    throw new Error(
      `Refusing to deploy ${environmentName} Firestore rules to project "${actualProjectId}"; expected "${expectedProjectId}".`,
    )
  }
}

async function run() {
  const environmentName = process.argv[2]
  const projectDirectory = process.env.PROJECT_DIR ?? process.cwd()
  const firebaseAliases = JSON.parse(
    await readFile(path.join(projectDirectory, '.firebaserc'), 'utf8'),
  )

  assertFirestoreDeployTarget({
    actualProjectId: process.env.GCLOUD_PROJECT,
    environmentName,
    projectAliases: firebaseAliases.projects ?? {},
  })

  console.log(
    `Verified ${environmentName} Firestore deploy target ${process.env.GCLOUD_PROJECT}.`,
  )
}

const executedFile = process.argv[1]
if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
