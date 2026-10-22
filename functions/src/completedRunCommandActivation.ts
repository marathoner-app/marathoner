export const BETA_COMPLETED_RUN_COMMAND_PROJECT_ID = 'marathonerapp-beta'
export const COMPLETED_RUN_COMMANDS_ENABLED_PARAM =
  'MARATHONER_COMPLETED_RUN_COMMANDS_ENABLED'

export function shouldInstallCompletedRunCommandStores(options: {
  activationEnabled: boolean
  functionsEmulator: boolean
  projectId: string
}): boolean {
  if (options.functionsEmulator) return true

  return (
    options.projectId === BETA_COMPLETED_RUN_COMMAND_PROJECT_ID &&
    options.activationEnabled
  )
}
