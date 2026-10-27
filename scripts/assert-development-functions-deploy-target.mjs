import { pathToFileURL } from 'node:url'

export const DEVELOPMENT_FUNCTIONS_PROJECT_ID = 'marathoner-d9bf9'
export const DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION =
  'DEPLOY-DEVELOPMENT-FUNCTIONS-FOR-OWNER-DOGFOOD'

export function assertDevelopmentFunctionsDeployTarget({
  actualProjectId,
  environmentName,
  operatorConfirmation,
}) {
  if (environmentName !== 'development') {
    throw new Error(
      'Development Functions deployment is blocked outside firebase.json.',
    )
  }

  if (!actualProjectId) {
    throw new Error(
      'GCLOUD_PROJECT is missing; development Functions deployment is blocked.',
    )
  }

  if (actualProjectId !== DEVELOPMENT_FUNCTIONS_PROJECT_ID) {
    throw new Error(
      `Development Functions deployment to "${actualProjectId}" is not approved; expected "${DEVELOPMENT_FUNCTIONS_PROJECT_ID}".`,
    )
  }

  if (operatorConfirmation !== DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION) {
    throw new Error(
      `Set MARATHONER_DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION=${DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION} only after the owner approves the development billing boundary and issue #347 authorizes the deployment.`,
    )
  }
}

function run() {
  assertDevelopmentFunctionsDeployTarget({
    actualProjectId: process.env.GCLOUD_PROJECT,
    environmentName: process.argv[2],
    operatorConfirmation:
      process.env.MARATHONER_DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION,
  })

  console.log(
    `Verified explicit development Functions deployment intent for ${DEVELOPMENT_FUNCTIONS_PROJECT_ID}.`,
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
