import { pathToFileURL } from 'node:url'

export const BETA_FUNCTIONS_PROJECT_ID = 'marathonerapp-beta'
export const BETA_FUNCTIONS_DEPLOY_CONFIRMATION =
  'DEPLOY-BETA-FUNCTIONS-AFTER-ISSUES-143-AND-204'

export function assertBetaFunctionsDeployTarget({
  actualProjectId,
  environmentName,
  operatorConfirmation,
}) {
  if (environmentName !== 'beta') {
    throw new Error(
      'Beta Functions deployment is blocked outside firebase.beta.json.',
    )
  }

  if (!actualProjectId) {
    throw new Error(
      'GCLOUD_PROJECT is missing; beta Functions deployment is blocked.',
    )
  }

  if (actualProjectId !== BETA_FUNCTIONS_PROJECT_ID) {
    throw new Error(
      `Beta Functions deployment to "${actualProjectId}" is not approved; expected "${BETA_FUNCTIONS_PROJECT_ID}".`,
    )
  }

  if (operatorConfirmation !== BETA_FUNCTIONS_DEPLOY_CONFIRMATION) {
    throw new Error(
      `Set MARATHONER_BETA_FUNCTIONS_DEPLOY_CONFIRMATION=${BETA_FUNCTIONS_DEPLOY_CONFIRMATION} only after issues #143 and #204 are complete and issue #205 authorizes the deployment.`,
    )
  }
}

function run() {
  assertBetaFunctionsDeployTarget({
    actualProjectId: process.env.GCLOUD_PROJECT,
    environmentName: process.argv[2],
    operatorConfirmation:
      process.env.MARATHONER_BETA_FUNCTIONS_DEPLOY_CONFIRMATION,
  })

  console.log(
    `Verified explicit beta Functions deployment intent for ${BETA_FUNCTIONS_PROJECT_ID}.`,
  )
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
