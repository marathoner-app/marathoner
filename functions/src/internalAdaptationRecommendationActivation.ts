export const DEVELOPMENT_INTERNAL_ADAPTATION_PROJECT_ID =
  'marathoner-d9bf9'
export const INTERNAL_ADAPTATION_RECOMMENDATIONS_ENABLED_PARAM =
  'MARATHONER_INTERNAL_ADAPTATION_RECOMMENDATIONS_ENABLED'

export function shouldEnableInternalAdaptationRecommendations(options: {
  activationEnabled: boolean
  functionsEmulator: boolean
  projectId: string
}): boolean {
  if (options.functionsEmulator) return true

  return (
    options.projectId === DEVELOPMENT_INTERNAL_ADAPTATION_PROJECT_ID &&
    options.activationEnabled
  )
}
