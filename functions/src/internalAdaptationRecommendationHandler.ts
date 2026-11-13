import { createHash } from 'node:crypto'

import { assembleAdaptationEvaluationInput } from '../../src/domain/training/adaptationInputAssembly.js'
import { deriveAdaptationPlanContext } from '../../src/domain/training/adaptationPlanContext.js'
import { deriveAdaptationRescheduleCandidates } from '../../src/domain/training/adaptationRescheduleCandidates.js'
import {
  createAdaptationArtifactVersion,
  evaluateAdaptation,
} from '../../src/domain/training/adaptationEvaluation.js'
import { normalizeAdaptationHistory } from '../../src/domain/training/adaptationHistoryNormalization.js'
import { projectAdaptationFromTrainingSnapshot } from '../../src/domain/training/adaptationTrainingProjection.js'
import {
  createDateOnly,
  createUtcDateTime,
} from '../../src/domain/training/dates.js'
import type {
  ActivePlanState,
  CompletedRun,
  PlannedWorkout,
  TrainingPlan,
} from '../../src/domain/training/types.js'
import { assembleAdaptationRecommendationEvidence } from '../../src/domain/recommendations/adaptationRecommendationEvidence.js'
import {
  createRecommendationId,
  type RecommendationEvidenceV2,
} from '../../src/domain/recommendations/recommendationEvidence.js'
import type { PinnedInternalAdaptationArtifacts } from './pinnedInternalAdaptationArtifacts.js'
import {
  internalAdaptationCommandIdFrom,
  parseInternalAdaptationRecommendationCommand,
  type InternalAdaptationRecommendationCommand,
  type InternalAdaptationRecommendationResult,
} from './internalAdaptationRecommendationContract.js'

export interface InternalAdaptationSnapshot {
  readonly activePlanState: ActivePlanState
  readonly plan: TrainingPlan
  readonly planRulesetVersion: string
  readonly workouts: readonly PlannedWorkout[]
  readonly runs: readonly CompletedRun[]
}

export type InternalAdaptationEvaluationOutcome = Readonly<{
  result: InternalAdaptationRecommendationResult
  evidence: RecommendationEvidenceV2 | null
}>

export interface InternalAdaptationRecommendationStore {
  execute(options: {
    command: InternalAdaptationRecommendationCommand
    ownerId: string
    evaluate: (
      snapshot: InternalAdaptationSnapshot,
    ) => InternalAdaptationEvaluationOutcome
  }): Promise<
    | { readonly kind: 'completed'; readonly result: InternalAdaptationRecommendationResult }
    | { readonly kind: 'membership-required' }
    | { readonly kind: 'conflict' }
  >
}

export interface InternalAdaptationRecommendationHandlerDependencies {
  readonly enabled: boolean
  readonly artifacts: PinnedInternalAdaptationArtifacts
  readonly store: InternalAdaptationRecommendationStore
  readonly now?: () => Date
  readonly log: (entry: {
    readonly event: 'internal-adaptation-recommendation-result'
    readonly status: InternalAdaptationRecommendationResult['status']
  }) => void
}

export interface InternalAdaptationRecommendationCaller {
  readonly ownerId: string | null
  readonly appCheckVerified: boolean
}

function refusal(
  commandId: string,
  code: string,
  message: string,
): InternalAdaptationEvaluationOutcome {
  return {
    evidence: null,
    result: { status: 'refused', commandId, code, message },
  }
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return createDateOnly(date.toISOString().slice(0, 10))
}

function evidenceWeek(date: ReturnType<typeof createDateOnly>) {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay()
  const startDate = shiftDate(date, -((weekday + 6) % 7))
  return { startDate, endDate: shiftDate(startDate, 6) }
}

function recommendationIdFor(command: InternalAdaptationRecommendationCommand) {
  const digest = createHash('sha256')
    .update(command.commandId)
    .digest('hex')
    .slice(0, 32)
  return createRecommendationId(`adaptation-${digest}`)
}

export function evaluateInternalAdaptationRecommendation(
  command: InternalAdaptationRecommendationCommand,
  snapshot: InternalAdaptationSnapshot,
  artifacts: PinnedInternalAdaptationArtifacts,
  recommendedAt: ReturnType<typeof createUtcDateTime>,
): InternalAdaptationEvaluationOutcome {
  const basePlan = artifacts.compatibleBasePlans.find(
    ({ rules }) =>
      String(rules.rulesetVersion) === snapshot.planRulesetVersion,
  )
  if (basePlan === undefined) {
    return refusal(
      command.commandId,
      'base-plan-artifact-mismatch',
      'The active plan was not created from the pinned internal base-plan artifact.',
    )
  }
  const adaptationRules = {
    ...artifacts.adaptation.rules,
    basePlanArtifactVersion: createAdaptationArtifactVersion(
      snapshot.planRulesetVersion,
    ),
  }
  const week = evidenceWeek(command.evaluationDate)
  const history = normalizeAdaptationHistory({
    ownerId: snapshot.activePlanState.userId,
    activePlanState: snapshot.activePlanState,
    plans: [snapshot.plan],
    workouts: snapshot.workouts,
    runs: snapshot.runs,
    evaluationDate: command.evaluationDate,
    currentWeekStartDate: week.startDate,
    currentWeekEndDate: week.endDate,
    triggerWorkoutId: command.triggerWorkoutId,
    recentRunWindowSize: adaptationRules.maximumRecentEfforts,
  })
  if (history.kind !== 'ready') {
    const issue = history.issues[0]
    return refusal(
      command.commandId,
      issue?.code ?? 'history-not-ready',
      issue?.message ?? 'The synchronized training history is not ready.',
    )
  }
  const planContext = deriveAdaptationPlanContext({
    plan: snapshot.plan,
    evaluationDate: command.evaluationDate,
    basePlanRules: basePlan,
    adaptationRules,
  })
  if (planContext.kind !== 'ready') {
    return refusal(command.commandId, planContext.code, planContext.message)
  }
  const candidates = deriveAdaptationRescheduleCandidates({
    plan: snapshot.plan,
    workouts: snapshot.workouts,
    evidence: history.evidence,
    rules: adaptationRules,
  })
  const selectedCandidate =
    command.confirmedRescheduleTargetDate === null
      ? undefined
      : candidates.find(
          ({ targetDate }) =>
            targetDate === command.confirmedRescheduleTargetDate,
        )
  if (
    command.confirmedRescheduleTargetDate !== null &&
    selectedCandidate === undefined
  ) {
    return refusal(
      command.commandId,
      'reschedule-target-not-eligible',
      'The confirmed reschedule date is not an eligible empty date in the trigger week.',
    )
  }
  const rescheduleCandidate = selectedCandidate
    ? { ...selectedCandidate.candidate, runnerConfirmedAvailable: true }
    : {
        present: false as const,
        workoutPurpose: null,
        delayCalendarDays: null,
        samePlanWeek: false,
        runnerConfirmedAvailable: false,
        targetDateEmpty: false,
        consecutiveRunDatesAfterMove: 0,
      }
  const input = assembleAdaptationEvaluationInput(
    history.evidence,
    adaptationRules,
    {
      ...planContext.context,
      rescheduleCandidate,
      inputCompletenessConfirmed: true,
    },
  )
  const evaluation = evaluateAdaptation({
    input,
    evaluatorVersion: artifacts.adaptation.evaluatorVersion,
    rules: adaptationRules,
  })
  if (evaluation.kind === 'invalid_input') {
    const issue = evaluation.issues[0]
    return refusal(
      command.commandId,
      issue?.code ?? 'evaluation-invalid',
      issue?.message ?? 'The adaptation input is invalid.',
    )
  }
  if (evaluation.kind === 'refused') {
    return refusal(
      command.commandId,
      evaluation.reasonCode,
      evaluation.explanationKey,
    )
  }
  if (evaluation.kind === 'no_change') {
    return {
      evidence: null,
      result: {
        status: 'no_change',
        commandId: command.commandId,
        reasonCode: evaluation.reasonCode,
        explanationKey: evaluation.explanationKey,
      },
    }
  }
  if (
    evaluation.kind !== 'recommendation' ||
    evaluation.action === null ||
    evaluation.action === 'no_change' ||
    !evaluation.runnerApprovalRequired
  ) {
    return refusal(
      command.commandId,
      'unsupported-recommendation',
      'The evaluator did not produce a supported material recommendation.',
    )
  }
  const projection = projectAdaptationFromTrainingSnapshot({
    evidence: history.evidence,
    activePlan: snapshot.plan,
    workouts: snapshot.workouts,
    action: evaluation.action,
    rescheduleCandidate,
  })
  if (projection.kind !== 'ready') {
    return refusal(command.commandId, projection.code, projection.message)
  }
  const evidence = assembleAdaptationRecommendationEvidence({
    recommendationId: recommendationIdFor(command),
    recommendedAt,
    activePlan: snapshot.plan,
    evaluationInput: input,
    evaluationResult: evaluation,
    adjustment: projection.adjustment,
    projection: projection.projection,
  })
  if (evidence.kind !== 'ready') {
    return refusal(command.commandId, evidence.code, evidence.message)
  }
  return {
    evidence: evidence.evidence,
    result: {
      status: 'pending_recommendation_created',
      commandId: command.commandId,
      recommendationId: evidence.evidence.recommendationId,
    },
  }
}

export async function executeInternalAdaptationRecommendation(options: {
  readonly caller: InternalAdaptationRecommendationCaller
  readonly data: unknown
  readonly dependencies: InternalAdaptationRecommendationHandlerDependencies
}): Promise<InternalAdaptationRecommendationResult> {
  const commandId = internalAdaptationCommandIdFrom(options.data)
  const finish = (result: InternalAdaptationRecommendationResult) => {
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
      message: 'Sign in before requesting an internal adaptation evaluation.',
    })
  }
  if (!options.caller.appCheckVerified) {
    return finish({
      status: 'authorization_error',
      commandId,
      code: 'app-check-required',
      message: 'A verified Marathoner client is required.',
    })
  }
  if (!options.dependencies.enabled) {
    return finish({
      status: 'disabled',
      commandId,
      code: 'internal-adaptation-disabled',
      message: 'Internal adaptation recommendation generation is disabled.',
    })
  }
  const command = parseInternalAdaptationRecommendationCommand(options.data)
  if (command === null) {
    return finish({
      status: 'validation_error',
      commandId,
      code: 'invalid-internal-adaptation-command',
      message: 'The internal adaptation command is invalid.',
    })
  }
  try {
    const now = options.dependencies.now?.() ?? new Date()
    const outcome = await options.dependencies.store.execute({
      command,
      ownerId: options.caller.ownerId,
      evaluate: (snapshot) =>
        evaluateInternalAdaptationRecommendation(
          command,
          snapshot,
          options.dependencies.artifacts,
          createUtcDateTime(now.toISOString()),
        ),
    })
    if (outcome.kind === 'membership-required') {
      return finish({
        status: 'authorization_error',
        commandId: command.commandId,
        code: 'approved-beta-membership-required',
        message: 'An approved beta membership is required.',
      })
    }
    if (outcome.kind === 'conflict') {
      return finish({
        status: 'conflict',
        commandId: command.commandId,
        code: 'internal-adaptation-command-conflict',
        message: 'This command ID was already used with different inputs.',
      })
    }
    return finish(outcome.result)
  } catch {
    return finish({
      status: 'retryable_error',
      commandId: command.commandId,
      code: 'internal-adaptation-unavailable',
      message: 'Marathoner could not evaluate adaptation right now.',
    })
  }
}
