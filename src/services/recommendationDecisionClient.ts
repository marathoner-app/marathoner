import {
  createRecommendationDecisionCommand,
  isRunCommandStaleRevisionResult,
  isRunCompletionDuplicateResult,
  type AccountDeletionRequestAcceptedResult,
  type MaterialCommandCommittedResult,
  type MaterialCommandOutcomeUnknownResult,
  type MaterialCommandResult,
  type PlanApprovalReceiptResult,
  type RecommendationCommandDecision,
  type RecommendationDecisionReceiptResult,
  type RunCommandStaleRevisionResult,
  type RunCompletionDuplicateResult,
  type RunCompletionReceiptResult,
  type RunDeletionReceiptResult,
  type RunUpdateReceiptResult,
} from '../domain/materialCommands/contract'
import type { RecommendationId } from '../domain/recommendations/recommendationEvidence'
import {
  createMaterialCommandClient,
  type MaterialCommandClientOptions,
} from './materialCommandClient'

export interface RecommendationDecisionSubmission {
  commandId: string
  recommendationId: RecommendationId
  decision: RecommendationCommandDecision
  expectedEvaluatedPlanRevision: number
}

type UnrelatedMaterialCommandResult =
  | MaterialCommandCommittedResult
  | AccountDeletionRequestAcceptedResult
  | PlanApprovalReceiptResult
  | RunCompletionReceiptResult
  | RunUpdateReceiptResult
  | RunDeletionReceiptResult
  | RunCompletionDuplicateResult
  | RunCommandStaleRevisionResult

export type RecommendationDecisionClientFailureResult = Exclude<
  MaterialCommandResult,
  UnrelatedMaterialCommandResult | RecommendationDecisionReceiptResult
>

export type RecommendationDecisionClientResult =
  | RecommendationDecisionReceiptResult
  | RecommendationDecisionClientFailureResult

export interface RecommendationDecisionClient {
  submit(
    submission: RecommendationDecisionSubmission,
  ): Promise<RecommendationDecisionClientResult>
  resolve(commandId: string): Promise<RecommendationDecisionClientResult>
}

function unknownOutcome(commandId: string): MaterialCommandOutcomeUnknownResult {
  return {
    status: 'outcome_unknown',
    commandId,
    code: 'resolve-by-command-id',
    message:
      'The recommendation decision outcome is unknown. Resolve its command ID before retrying.',
  }
}

function mapRecommendationDecisionResult(
  result: MaterialCommandResult,
  commandId: string,
): RecommendationDecisionClientResult {
  if (
    result.status === 'committed' ||
    result.status === 'accepted' ||
    result.status === 'plan_approved' ||
    result.status === 'run_completed' ||
    result.status === 'run_updated' ||
    result.status === 'run_deleted' ||
    isRunCompletionDuplicateResult(result) ||
    isRunCommandStaleRevisionResult(result)
  ) {
    return unknownOutcome(commandId)
  }
  return result
}

export function createRecommendationDecisionClient(
  options: MaterialCommandClientOptions,
): RecommendationDecisionClient {
  const materialCommandClient = createMaterialCommandClient(options)

  return {
    async submit(submission) {
      const command = createRecommendationDecisionCommand(
        submission.commandId,
        {
          recommendationId: submission.recommendationId,
          decision: submission.decision,
          expectedEvaluatedPlanRevision:
            submission.expectedEvaluatedPlanRevision,
        },
      )
      return mapRecommendationDecisionResult(
        await materialCommandClient.submit(command),
        submission.commandId,
      )
    },

    async resolve(commandId) {
      return mapRecommendationDecisionResult(
        await materialCommandClient.resolve(commandId),
        commandId,
      )
    },
  }
}
