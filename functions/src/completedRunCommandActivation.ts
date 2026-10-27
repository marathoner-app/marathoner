export const BETA_COMPLETED_RUN_COMMAND_PROJECT_ID = 'marathonerapp-beta'
export const DEVELOPMENT_COMPLETED_RUN_COMMAND_PROJECT_ID = 'marathoner-d9bf9'
export const COMPLETED_RUN_COMMANDS_ENABLED_PARAM =
  'MARATHONER_COMPLETED_RUN_COMMANDS_ENABLED'

const REVIEWED_COMPLETED_RUN_COMMAND_PROJECT_IDS = new Set([
  BETA_COMPLETED_RUN_COMMAND_PROJECT_ID,
  DEVELOPMENT_COMPLETED_RUN_COMMAND_PROJECT_ID,
])

export function shouldInstallCompletedRunCommandStores(options: {
  activationEnabled: boolean
  functionsEmulator: boolean
  projectId: string
}): boolean {
  if (options.functionsEmulator) return true

  return (
    REVIEWED_COMPLETED_RUN_COMMAND_PROJECT_IDS.has(options.projectId) &&
    options.activationEnabled
  )
}
