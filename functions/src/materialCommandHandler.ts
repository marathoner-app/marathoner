import {
  isProofMaterialCommandEnvelope,
  isPlanApprovalCommandEnvelope,
  isRecommendationDecisionCommandEnvelope,
  isRunCompletionCommandEnvelope,
  isRunDeletionCommandEnvelope,
  isRunUpdateCommandEnvelope,
  isMaterialCommandResult,
  materialCommandIdFrom,
  parseMaterialCommand,
  type AccountDeletionRequestAcceptedResult,
  type MaterialCommandCommittedResult,
  type MaterialCommandResult,
  type PlanApprovalCommandEnvelope,
  type PlanApprovalReceiptResult,
  type PlanApprovalStaleRevisionResult,
  type ProofMaterialCommandEnvelope,
  type RecommendationDecisionCommandEnvelope,
  type RecommendationDecisionReceiptResult,
  type RunCompletionCommandEnvelope,
  type RunCompletionReceiptResult,
  type RunDeletionCommandEnvelope,
  type RunDeletionReceiptResult,
  type RunUpdateCommandEnvelope,
  type RunUpdateReceiptResult,
} from '../../src/domain/materialCommands/contract.js'
import type {
  RecommendationEvidenceV2,
  RecommendationId,
} from '../../src/domain/recommendations/recommendationEvidence.js'
import type { RunCommandProjectionFailureResult } from './completedRunCommandProjection.js'
import {
  evaluatePlanApprovalArtifactPolicy,
  PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY,
  type PlanApprovalArtifactPolicyRecord,
} from './planApprovalArtifactPolicy.js'
import type { OperatorActivationGate } from './operatorActivationGate.js'

export type MaterialCommandFailureClass =
  | 'persistence-permission-denied'
  | 'persistence-transient'
  | 'persistence-unclassified'

export type MaterialCommandLogEntry = Readonly<{
  event: 'material-command-result' | 'material-command-resolution'
  commandType:
    | 'proof.material-command'
    | 'account.request-deletion'
    | 'plan.approve-generated'
    | 'recommendation.decide'
    | 'run.complete'
    | 'run.update'
    | 'run.delete'
    | 'unknown'
  status: MaterialCommandResult['status']
  failureClass?: MaterialCommandFailureClass
}>

export interface MaterialCommandStore {
  commitProof(options: {
    envelope: ProofMaterialCommandEnvelope
    ownerId: string
  }): Promise<
    | { kind: 'committed'; result: MaterialCommandCommittedResult }
    | { kind: 'conflict' }
  >
  resolve(options: {
    commandId: string
    ownerId: string
  }): Promise<
    | MaterialCommandCommittedResult
    | AccountDeletionRequestAcceptedResult
    | PlanApprovalReceiptResult
    | RecommendationDecisionReceiptResult
    | RunCompletionReceiptResult
    | RunUpdateReceiptResult
    | RunDeletionReceiptResult
    | null
  >
}

export interface RunCompletionStore {
  commit(options: {
    envelope: RunCompletionCommandEnvelope
    ownerId: string
  }): Promise<
    | { kind: 'completed'; result: RunCompletionReceiptResult }
    | { kind: 'rejected'; result: RunCommandProjectionFailureResult }
    | { kind: 'conflict' }
    | { kind: 'membership-required' }
  >
}

export interface RunDeletionStore {
  commit(options: {
    envelope: RunDeletionCommandEnvelope
    ownerId: string
  }): Promise<
    | { kind: 'deleted'; result: RunDeletionReceiptResult }
    | { kind: 'rejected'; result: RunCommandProjectionFailureResult }
    | { kind: 'conflict' }
    | { kind: 'membership-required' }
  >
}

export interface RunUpdateStore {
  commit(options: {
    envelope: RunUpdateCommandEnvelope
    ownerId: string
  }): Promise<
    | { kind: 'updated'; result: RunUpdateReceiptResult }
    | { kind: 'rejected'; result: RunCommandProjectionFailureResult }
    | { kind: 'conflict' }
    | { kind: 'membership-required' }
  >
}

export interface PlanApprovalStore {
  commit(options: {
    artifactPolicyRecord: PlanApprovalArtifactPolicyRecord
    envelope: PlanApprovalCommandEnvelope
    ownerId: string
  }): Promise<
    | { kind: 'approved'; result: PlanApprovalReceiptResult }
    | { kind: 'stale'; result: PlanApprovalStaleRevisionResult }
    | { kind: 'conflict' }
  >
}

export interface PlanApprovalHandlerDependencies {
  activationGate: Pick<OperatorActivationGate, 'evaluate'>
  allowProvisionalDogfood?: boolean
  policyRecords: readonly PlanApprovalArtifactPolicyRecord[]
  store: PlanApprovalStore
  supportedScopeId: string | null
}

export interface RecommendationEvidenceReader {
  read(options: {
    ownerId: string
    recommendationId: RecommendationId
  }): Promise<RecommendationEvidenceV2>
}

export interface RecommendationDecisionStore {
  resolveExisting(options: {
    envelope: RecommendationDecisionCommandEnvelope
    ownerId: string
  }): Promise<
    | { kind: 'decided'; result: RecommendationDecisionReceiptResult }
    | { kind: 'conflict' }
    | { kind: 'missing' }
  >
  commit(options: {
    authorizedAdaptationArtifactVersion: string
    envelope: RecommendationDecisionCommandEnvelope
    ownerId: string
  }): Promise<
    | { kind: 'decided'; result: RecommendationDecisionReceiptResult }
    | { kind: 'stale'; result: PlanApprovalStaleRevisionResult }
    | { kind: 'conflict' }
  >
}

export interface RecommendationDecisionHandlerDependencies {
  activationGate: Pick<OperatorActivationGate, 'evaluate'>
  evidence: RecommendationEvidenceReader
  store: RecommendationDecisionStore
}

export interface HandlerDependencies {
  log: (entry: MaterialCommandLogEntry) => void
  planApproval?: PlanApprovalHandlerDependencies
  recommendationDecision?: RecommendationDecisionHandlerDependencies
  runCompletion?: { store: RunCompletionStore }
  runDeletion?: { store: RunDeletionStore }
  runUpdate?: { store: RunUpdateStore }
  store: MaterialCommandStore
}

function authenticationResult(commandId: string | null): MaterialCommandResult {
  return {
    status: 'authentication_error',
    commandId,
    code: 'authentication-required',
    message: 'Sign in before submitting this command.',
  }
}

function conflictResult(commandId: string): MaterialCommandResult {
  return {
    status: 'conflict',
    commandId,
    code: 'command-id-reused',
    message: 'This command ID was already used for a different command.',
  }
}

function artifactNotApprovedResult(commandId: string): MaterialCommandResult {
  return {
    status: 'authorization_error',
    commandId,
    code: 'plan-artifact-not-approved',
    message: 'This generated plan is not approved for the active participant scope.',
  }
}

function planActivationNotAvailableResult(
  commandId: string,
): MaterialCommandResult {
  return {
    status: 'authorization_error',
    commandId,
    code: 'plan-activation-not-available',
    message:
      'Plan activation is currently unavailable. No training plan was changed.',
  }
}

function runCommandNotEnabledResult(commandId: string): MaterialCommandResult {
  return {
    status: 'authorization_error',
    commandId,
    code: 'approved-beta-membership-required',
    message: 'Completed-run commands are not enabled in this environment.',
  }
}

function recommendationDecisionNotEnabledResult(
  commandId: string,
): MaterialCommandResult {
  return {
    status: 'authorization_error',
    commandId,
    code: 'recommendation-decisions-not-enabled',
    message:
      'Recommendation decisions are not enabled in this environment. No training plan was changed.',
  }
}

function runCommandAppCheckRequiredResult(
  commandId: string,
): MaterialCommandResult {
  return {
    status: 'authorization_error',
    commandId,
    code: 'app-check-required',
    message: 'Open the supported Marathoner app before retrying this command.',
  }
}

function runCommandMembershipRequiredResult(
  commandId: string,
): MaterialCommandResult {
  return {
    status: 'authorization_error',
    commandId,
    code: 'approved-beta-membership-required',
    message: 'An approved beta membership is required for completed-run commands.',
  }
}

function retryableResult(commandId: string | null): MaterialCommandResult {
  return {
    status: 'retryable_error',
    commandId,
    code: 'temporarily-unavailable',
    message: 'The command service is temporarily unavailable. Retry shortly.',
  }
}

function outcomeUnknownResult(commandId: string | null): MaterialCommandResult {
  return {
    status: 'outcome_unknown',
    commandId,
    code: 'resolve-by-command-id',
    message: 'The command outcome is unknown. Resolve its command ID before retrying.',
  }
}

function errorCode(error: unknown): string | number | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null
  }
  return typeof error.code === 'string' || typeof error.code === 'number'
    ? error.code
    : null
}

function failureFor(
  error: unknown,
  commandId: string | null,
): Readonly<{
  result: MaterialCommandResult
  failureClass: MaterialCommandFailureClass
}> {
  const code = errorCode(error)
  if (code === 'permission-denied' || code === 7) {
    return {
      result: outcomeUnknownResult(commandId),
      failureClass: 'persistence-permission-denied',
    }
  }
  if (
    code === 'aborted' ||
    code === 10 ||
    code === 'unavailable' ||
    code === 14 ||
    code === 'resource-exhausted' ||
    code === 8
  ) {
    return {
      result: retryableResult(commandId),
      failureClass: 'persistence-transient',
    }
  }
  return {
    result: outcomeUnknownResult(commandId),
    failureClass: 'persistence-unclassified',
  }
}

function logResult(
  dependencies: HandlerDependencies,
  event: MaterialCommandLogEntry['event'],
  result: MaterialCommandResult,
  commandType: MaterialCommandLogEntry['commandType'],
  failureClass?: MaterialCommandFailureClass,
) {
  dependencies.log({
    event,
    commandType,
    status: result.status,
    ...(failureClass === undefined ? {} : { failureClass }),
  })
}

function logFailureResult(
  dependencies: HandlerDependencies,
  event: MaterialCommandLogEntry['event'],
  failure: ReturnType<typeof failureFor>,
  commandType: MaterialCommandLogEntry['commandType'],
) {
  logResult(
    dependencies,
    event,
    failure.result,
    commandType,
    failure.failureClass,
  )
}

export async function executeMaterialCommand(
  options: {
    appCheckVerified?: boolean
    authenticatedUserId: string | null
    data: unknown
  },
  dependencies: HandlerDependencies,
): Promise<MaterialCommandResult> {
  const commandId = materialCommandIdFrom(options.data)
  if (!options.authenticatedUserId) {
    const result = authenticationResult(commandId)
    logResult(dependencies, 'material-command-result', result, 'unknown')
    return result
  }

  const parsed = parseMaterialCommand(options.data)
  if (!parsed.ok) {
    logResult(dependencies, 'material-command-result', parsed.result, 'unknown')
    return parsed.result
  }
  if (isPlanApprovalCommandEnvelope(parsed.envelope)) {
    const planApproval = dependencies.planApproval
    const policyDecision = evaluatePlanApprovalArtifactPolicy(parsed.envelope, {
      allowProvisionalDogfood:
        planApproval?.allowProvisionalDogfood ?? false,
      supportedScopeId: planApproval?.supportedScopeId ?? null,
      records:
        planApproval?.policyRecords ??
        PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY,
    })
    if (!policyDecision.allowed || !planApproval) {
      const result = artifactNotApprovedResult(parsed.envelope.commandId)
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }

    if (policyDecision.record.reviewState === 'approved') {
      try {
        const activationDecision = await planApproval.activationGate.evaluate({
          capability: 'generation',
          artifactVersion: parsed.envelope.command.input.rulesetVersion,
          appProtocolVersion: parsed.envelope.appProtocolVersion,
          commandProtocolVersion: parsed.envelope.envelopeVersion,
        })
        if (!activationDecision.allowed) {
          const result = planActivationNotAvailableResult(
            parsed.envelope.commandId,
          )
          logResult(
            dependencies,
            'material-command-result',
            result,
            parsed.envelope.command.type,
          )
          return result
        }
      } catch {
        const result = planActivationNotAvailableResult(
          parsed.envelope.commandId,
        )
        logResult(
          dependencies,
          'material-command-result',
          result,
          parsed.envelope.command.type,
        )
        return result
      }
    }

    try {
      const stored = await planApproval.store.commit({
        artifactPolicyRecord: policyDecision.record,
        envelope: parsed.envelope,
        ownerId: options.authenticatedUserId,
      })
      const result =
        stored.kind === 'conflict'
          ? conflictResult(parsed.envelope.commandId)
          : stored.result
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    } catch (error) {
      const failure = failureFor(error, parsed.envelope.commandId)
      logFailureResult(
        dependencies,
        'material-command-result',
        failure,
        parsed.envelope.command.type,
      )
      return failure.result
    }
  }
  if (isRunCompletionCommandEnvelope(parsed.envelope)) {
    const runCompletion = dependencies.runCompletion
    if (!runCompletion) {
      const result = runCommandNotEnabledResult(parsed.envelope.commandId)
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }
    if (options.appCheckVerified !== true) {
      const result = runCommandAppCheckRequiredResult(
        parsed.envelope.commandId,
      )
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }

    try {
      const stored = await runCompletion.store.commit({
        envelope: parsed.envelope,
        ownerId: options.authenticatedUserId,
      })
      const result =
        stored.kind === 'membership-required'
          ? runCommandMembershipRequiredResult(parsed.envelope.commandId)
          : stored.kind === 'conflict'
            ? conflictResult(parsed.envelope.commandId)
            : stored.result
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    } catch (error) {
      const failure = failureFor(error, parsed.envelope.commandId)
      logFailureResult(
        dependencies,
        'material-command-result',
        failure,
        parsed.envelope.command.type,
      )
      return failure.result
    }
  }
  if (isRunDeletionCommandEnvelope(parsed.envelope)) {
    const runDeletion = dependencies.runDeletion
    if (!runDeletion) {
      const result = runCommandNotEnabledResult(parsed.envelope.commandId)
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }
    if (options.appCheckVerified !== true) {
      const result = runCommandAppCheckRequiredResult(
        parsed.envelope.commandId,
      )
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }

    try {
      const stored = await runDeletion.store.commit({
        envelope: parsed.envelope,
        ownerId: options.authenticatedUserId,
      })
      const result =
        stored.kind === 'membership-required'
          ? runCommandMembershipRequiredResult(parsed.envelope.commandId)
          : stored.kind === 'conflict'
            ? conflictResult(parsed.envelope.commandId)
            : stored.result
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    } catch (error) {
      const failure = failureFor(error, parsed.envelope.commandId)
      logFailureResult(
        dependencies,
        'material-command-result',
        failure,
        parsed.envelope.command.type,
      )
      return failure.result
    }
  }
  if (isRunUpdateCommandEnvelope(parsed.envelope)) {
    const runUpdate = dependencies.runUpdate
    if (!runUpdate) {
      const result = runCommandNotEnabledResult(parsed.envelope.commandId)
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }
    if (options.appCheckVerified !== true) {
      const result = runCommandAppCheckRequiredResult(
        parsed.envelope.commandId,
      )
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }

    try {
      const stored = await runUpdate.store.commit({
        envelope: parsed.envelope,
        ownerId: options.authenticatedUserId,
      })
      const result =
        stored.kind === 'membership-required'
          ? runCommandMembershipRequiredResult(parsed.envelope.commandId)
          : stored.kind === 'conflict'
            ? conflictResult(parsed.envelope.commandId)
            : stored.result
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    } catch (error) {
      const failure = failureFor(error, parsed.envelope.commandId)
      logFailureResult(
        dependencies,
        'material-command-result',
        failure,
        parsed.envelope.command.type,
      )
      return failure.result
    }
  }
  if (isRecommendationDecisionCommandEnvelope(parsed.envelope)) {
    const recommendationDecision = dependencies.recommendationDecision
    if (!recommendationDecision) {
      const result = recommendationDecisionNotEnabledResult(
        parsed.envelope.commandId,
      )
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }
    if (options.appCheckVerified !== true) {
      const result = runCommandAppCheckRequiredResult(
        parsed.envelope.commandId,
      )
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }

    try {
      const existing = await recommendationDecision.store.resolveExisting({
        envelope: parsed.envelope,
        ownerId: options.authenticatedUserId,
      })
      if (existing.kind !== 'missing') {
        const result =
          existing.kind === 'conflict'
            ? conflictResult(parsed.envelope.commandId)
            : existing.result
        logResult(
          dependencies,
          'material-command-result',
          result,
          parsed.envelope.command.type,
        )
        return result
      }
    } catch (error) {
      const failure = failureFor(error, parsed.envelope.commandId)
      logFailureResult(
        dependencies,
        'material-command-result',
        failure,
        parsed.envelope.command.type,
      )
      return failure.result
    }

    let authorizedAdaptationArtifactVersion: string
    try {
      const evidence = await recommendationDecision.evidence.read({
        ownerId: options.authenticatedUserId,
        recommendationId: parsed.envelope.command.recommendationId,
      })
      authorizedAdaptationArtifactVersion =
        evidence.evaluationInput.adaptationArtifactVersion
      const activationDecision = await recommendationDecision.activationGate.evaluate({
        capability: 'adaptation',
        artifactVersion: authorizedAdaptationArtifactVersion,
        appProtocolVersion: parsed.envelope.appProtocolVersion,
        commandProtocolVersion: parsed.envelope.envelopeVersion,
      })
      if (!activationDecision.allowed) {
        const result = recommendationDecisionNotEnabledResult(
          parsed.envelope.commandId,
        )
        logResult(
          dependencies,
          'material-command-result',
          result,
          parsed.envelope.command.type,
        )
        return result
      }
    } catch {
      const result = recommendationDecisionNotEnabledResult(
        parsed.envelope.commandId,
      )
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }

    try {
      const stored = await recommendationDecision.store.commit({
        authorizedAdaptationArtifactVersion,
        envelope: parsed.envelope,
        ownerId: options.authenticatedUserId,
      })
      const result =
        stored.kind === 'conflict'
          ? conflictResult(parsed.envelope.commandId)
          : stored.result
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    } catch (error) {
      const failure = failureFor(error, parsed.envelope.commandId)
      logFailureResult(
        dependencies,
        'material-command-result',
        failure,
        parsed.envelope.command.type,
      )
      return failure.result
    }
  }
  if (!isProofMaterialCommandEnvelope(parsed.envelope)) {
    const result: MaterialCommandResult = {
      status: 'validation_error',
      commandId: parsed.envelope.commandId,
      code: 'invalid-envelope',
      message: 'Use the account-deletion endpoint for this command.',
    }
    logResult(dependencies, 'material-command-result', result, 'unknown')
    return result
  }

  try {
    const stored = await dependencies.store.commitProof({
      envelope: parsed.envelope,
      ownerId: options.authenticatedUserId,
    })
    const result =
      stored.kind === 'committed'
        ? stored.result
        : conflictResult(parsed.envelope.commandId)
    logResult(
      dependencies,
      'material-command-result',
      result,
      parsed.envelope.command.type,
    )
    return result
  } catch (error) {
    const failure = failureFor(error, parsed.envelope.commandId)
    logFailureResult(
      dependencies,
      'material-command-result',
      failure,
      parsed.envelope.command.type,
    )
    return failure.result
  }
}

export async function resolveMaterialCommand(
  options: {
    authenticatedUserId: string | null
    data: unknown
  },
  dependencies: HandlerDependencies,
): Promise<MaterialCommandResult> {
  const commandId = materialCommandIdFrom(options.data)
  if (!options.authenticatedUserId) {
    const result = authenticationResult(commandId)
    logResult(dependencies, 'material-command-resolution', result, 'unknown')
    return result
  }
  if (commandId === null) {
    const result: MaterialCommandResult = {
      status: 'validation_error',
      commandId: null,
      code: 'invalid-envelope',
      message: 'A valid command ID is required for resolution.',
    }
    logResult(dependencies, 'material-command-resolution', result, 'unknown')
    return result
  }

  try {
    const stored = await dependencies.store.resolve({
      commandId,
      ownerId: options.authenticatedUserId,
    })
    const result =
      stored && isMaterialCommandResult(stored)
        ? stored
        : outcomeUnknownResult(commandId)
    logResult(
      dependencies,
      'material-command-resolution',
      result,
      stored?.status === 'accepted'
        ? 'account.request-deletion'
        : stored?.status === 'plan_approved'
          ? 'plan.approve-generated'
          : stored?.status === 'recommendation_decided'
            ? 'recommendation.decide'
          : stored?.status === 'run_completed'
            ? 'run.complete'
            : stored?.status === 'run_updated'
              ? 'run.update'
            : stored?.status === 'run_deleted'
              ? 'run.delete'
              : stored
                ? 'proof.material-command'
                : 'unknown',
    )
    return result
  } catch (error) {
    const failure = failureFor(error, commandId)
    logFailureResult(
      dependencies,
      'material-command-resolution',
      failure,
      'unknown',
    )
    return failure.result
  }
}
