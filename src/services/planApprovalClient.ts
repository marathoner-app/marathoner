import {
  createPlanApprovalCommand,
  type AccountDeletionRequestAcceptedResult,
  type MaterialCommandCommittedResult,
  type MaterialCommandOutcomeUnknownResult,
  type MaterialCommandResult,
} from '../domain/materialCommands/contract'
import type {
  GeneratedPlanV1,
  PlanGenerationInputV1,
} from '../domain/training/planGeneration'
import {
  createMaterialCommandClient,
  type MaterialCommandClientOptions,
} from './materialCommandClient'

export interface PlanApprovalSubmission {
  commandId: string
  expectedActivePlanRevision: number | null
  input: PlanGenerationInputV1
  proposal: GeneratedPlanV1
}

type UnrelatedMaterialCommandSuccess =
  | MaterialCommandCommittedResult
  | AccountDeletionRequestAcceptedResult

export type PlanApprovalClientResult = Exclude<
  MaterialCommandResult,
  UnrelatedMaterialCommandSuccess
>

export interface PlanApprovalClient {
  submit(submission: PlanApprovalSubmission): Promise<PlanApprovalClientResult>
  resolve(commandId: string): Promise<PlanApprovalClientResult>
}

function unknownOutcome(commandId: string): MaterialCommandOutcomeUnknownResult {
  return {
    status: 'outcome_unknown',
    commandId,
    code: 'resolve-by-command-id',
    message:
      'The plan approval outcome is unknown. Resolve its command ID before retrying.',
  }
}

function mapPlanApprovalResult(
  result: MaterialCommandResult,
  commandId: string,
): PlanApprovalClientResult {
  if (result.status === 'committed' || result.status === 'accepted') {
    return unknownOutcome(commandId)
  }
  return result
}

export function createPlanApprovalClient(
  options: MaterialCommandClientOptions,
): PlanApprovalClient {
  const materialCommandClient = createMaterialCommandClient(options)

  return {
    async submit(
      submission: PlanApprovalSubmission,
    ): Promise<PlanApprovalClientResult> {
      const command = createPlanApprovalCommand(submission.commandId, {
        expectedActivePlanRevision: submission.expectedActivePlanRevision,
        input: submission.input,
        proposal: submission.proposal,
      })
      return mapPlanApprovalResult(
        await materialCommandClient.submit(command),
        submission.commandId,
      )
    },

    async resolve(commandId: string): Promise<PlanApprovalClientResult> {
      return mapPlanApprovalResult(
        await materialCommandClient.resolve(commandId),
        commandId,
      )
    },
  }
}
