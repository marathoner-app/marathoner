import { pathToFileURL } from 'node:url'

export function assertMaterialCommandDeployTarget({
  actualProjectId,
  approvedProjectIds,
}) {
  if (!actualProjectId) {
    throw new Error(
      'GCLOUD_PROJECT is missing; material-command deployment is blocked.',
    )
  }
  if (!approvedProjectIds.includes(actualProjectId)) {
    throw new Error(
      `Material-command deployment to "${actualProjectId}" is not approved. Issue #158 is local-emulator-only; a reviewed deployment issue must add the exact project to this guard.`,
    )
  }
}

function run() {
  assertMaterialCommandDeployTarget({
    actualProjectId: process.env.GCLOUD_PROJECT,
    approvedProjectIds: [],
  })
}

const executedFile = process.argv[1]
if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  try {
    run()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
