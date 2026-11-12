import {
  closedBetaAdaptationCommandIdFrom,
  parseClosedBetaAdaptationRecommendationCommand,
  type ClosedBetaAdaptationRecommendationResult,
} from '../../src/domain/recommendations/closedBetaAdaptationRecommendation.js'
import type { ClosedBetaProvisionalMethodologyManifest } from '../../src/domain/methodology/closedBetaProvisionalMethodology.js'
import type { ClosedBetaMethodologyEligibilityDecision } from './closedBetaMethodologyEligibility.js'
import { createUtcDateTime } from '../../src/domain/training/dates.js'
import {
  evaluateInternalAdaptationRecommendation,
  type InternalAdaptationRecommendationStore,
} from './internalAdaptationRecommendationHandler.js'
import type { PinnedInternalAdaptationArtifacts } from './pinnedInternalAdaptationArtifacts.js'

export interface ClosedBetaAdaptationRecommendationCaller {
  readonly ownerId: string | null
  readonly appCheckVerified: boolean
}

interface Dependencies {
  readonly projectId: string
  readonly manifest: ClosedBetaProvisionalMethodologyManifest | null
  readonly artifacts: PinnedInternalAdaptationArtifacts
  readonly eligibility: {
    evaluate(request: {
      readonly ownerId: string | null
      readonly projectId: string
      readonly capability: 'adaptation'
      readonly serverArtifactVersion: string
      readonly inputDisposition: 'supported'
    }): Promise<ClosedBetaMethodologyEligibilityDecision>
  }
  readonly store: InternalAdaptationRecommendationStore
  readonly now?: () => Date
  readonly log: (entry: {
    readonly event: 'internal-adaptation-recommendation-result'
    readonly status: ClosedBetaAdaptationRecommendationResult['status']
  }) => void
}

function unavailable(
  commandId: string | null,
  status: 'disabled' | 'stale_version' | 'unavailable',
  code: string,
  message: string,
): ClosedBetaAdaptationRecommendationResult {
  return { status, commandId, code, message }
}

function eligibilityResult(
  commandId: string,
  decision: ClosedBetaMethodologyEligibilityDecision,
): ClosedBetaAdaptationRecommendationResult | null {
  if (decision.status === 'allowed') return null
  if (decision.status === 'stale_version') {
    return unavailable(
      commandId,
      'stale_version',
      decision.code,
      'This Marathoner build does not match the current closed-beta methodology.',
    )
  }
  if (decision.status === 'unavailable') {
    return unavailable(
      commandId,
      'unavailable',
      decision.code,
      'Plan recommendations are temporarily unavailable. Your active plan is unchanged.',
    )
  }
  if (decision.code === 'closed-beta-methodology-disabled') {
    return unavailable(
      commandId,
      'disabled',
      decision.code,
      'Plan recommendations are paused. Your active plan is unchanged.',
    )
  }
  if (decision.code === 'closed-beta-access-required') {
    return {
      status: 'authorization_error',
      commandId,
      code: 'approved-beta-membership-required',
      message: 'Approved beta access is required for plan recommendations.',
    }
  }
  if (decision.code === 'closed-beta-methodology-consent-required') {
    return {
      status: 'authorization_error',
      commandId,
      code: 'methodology-consent-required',
      message: 'Review the current beta methodology notice before requesting a plan recommendation.',
    }
  }
  return {
    status: 'refused',
    commandId,
    code: decision.code,
    message: 'Marathoner did not create a plan recommendation from this training state.',
  }
}

export async function executeClosedBetaAdaptationRecommendation(options: {
  readonly caller: ClosedBetaAdaptationRecommendationCaller
  readonly data: unknown
  readonly dependencies: Dependencies
}): Promise<ClosedBetaAdaptationRecommendationResult> {
  const commandId = closedBetaAdaptationCommandIdFrom(options.data)
  const finish = (result: ClosedBetaAdaptationRecommendationResult) => {
    options.dependencies.log({
      event: 'internal-adaptation-recommendation-result',
      status: result.status,
    })
    return result
  }
  if (options.caller.ownerId === null) {
    return finish({
      status: 'authorization_error',
      commandId,
      code: 'authentication-required',
      message: 'Sign in before checking recent training.',
    })
  }
  if (!options.caller.appCheckVerified) {
    return finish({
      status: 'authorization_error',
      commandId,
      code: 'app-check-required',
      message: 'Open the supported Marathoner app before checking recent training.',
    })
  }
  const command = parseClosedBetaAdaptationRecommendationCommand(options.data)
  if (command === null) {
    return finish({
      status: 'validation_error',
      commandId,
      code: 'invalid-adaptation-request',
      message: 'The plan-recommendation request is invalid.',
    })
  }
  const manifest = options.dependencies.manifest
  const adaptationReference = manifest?.artifacts.find(
    ({ kind }) => kind === 'adaptation',
  )
  if (
    manifest === null ||
    adaptationReference === undefined ||
    command.manifestVersion !== manifest.manifestVersion ||
    command.adaptationArtifactVersion !== adaptationReference.version
  ) {
    return finish(
      unavailable(
        command.commandId,
        'stale_version',
        'client-methodology-version-stale',
        'Update Marathoner before checking recent training. Your active plan is unchanged.',
      ),
    )
  }
  const eligibility = eligibilityResult(
    command.commandId,
    await options.dependencies.eligibility.evaluate({
      ownerId: options.caller.ownerId,
      projectId: options.dependencies.projectId,
      capability: 'adaptation',
      serverArtifactVersion: adaptationReference.version,
      inputDisposition: 'supported',
    }),
  )
  if (eligibility !== null) return finish(eligibility)

  const internalCommand = {
    schemaVersion: 1 as const,
    commandId: command.commandId,
    triggerWorkoutId: command.triggerWorkoutId,
    evaluationDate: command.evaluationDate,
    confirmedRescheduleTargetDate: command.confirmedRescheduleTargetDate,
  }
  try {
    const stored = await options.dependencies.store.execute({
      command: internalCommand,
      ownerId: options.caller.ownerId,
      evaluate: (snapshot) =>
        evaluateInternalAdaptationRecommendation(
          internalCommand,
          snapshot,
          options.dependencies.artifacts,
          createUtcDateTime(
            (options.dependencies.now ?? (() => new Date()))().toISOString(),
          ),
        ),
    })
    if (stored.kind === 'conflict') {
      return finish({
        status: 'conflict',
        commandId: command.commandId,
        code: 'command-id-reused',
        message: 'This request identifier was already used for a different training check.',
      })
    }
    if (stored.kind === 'membership-required') {
      return finish({
        status: 'authorization_error',
        commandId: command.commandId,
        code: 'approved-beta-membership-required',
        message: 'Approved beta access is required for plan recommendations.',
      })
    }
    return finish(stored.result)
  } catch {
    return finish({
      status: 'retryable_error',
      commandId: command.commandId,
      code: 'temporarily-unavailable',
      message: 'Marathoner could not complete the training check right now.',
    })
  }
}
