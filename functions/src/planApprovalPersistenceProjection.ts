import {
  isPlanApprovalCommandEnvelope,
  parseMaterialCommand,
  type PlanApprovalCommandEnvelope,
} from '../../src/domain/materialCommands/contract.js'
import {
  createUtcDateTime,
  type DateOnly,
  type UtcDateTime,
} from '../../src/domain/training/dates.js'
import {
  createTrainingPlanId,
  createUserId,
  type PlannedWorkoutId,
  type TrainingPlanId,
  type UserId,
} from '../../src/domain/training/identifiers.js'
import {
  GeneratedPlanEntityProjectionError,
  projectGeneratedPlanEntities,
  type GeneratedPlanEntityProjection,
} from '../../src/domain/training/generatedPlanEntityProjection.js'
import {
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  validatePlanGenerationContract,
  type GeneratedPlanV1,
  type PlanGenerationReasonCode,
} from '../../src/domain/training/planGeneration.js'
import type {
  PlannedWorkout,
  TrainingPhase,
  TrainingPlan,
} from '../../src/domain/training/types.js'
import {
  activePlanStateDocumentPath,
  planDocumentPath,
  planGenerationProvenanceDocumentPath,
  workoutDocumentPath,
} from '../../src/persistence/firestore/paths.js'
import { TRAINING_SCHEMA_VERSION } from '../../src/persistence/trainingSchema.js'
import {
  evaluatePlanApprovalArtifactPolicy,
  type PlanApprovalArtifactPolicyRecord,
} from './planApprovalArtifactPolicy.js'

export const ACTIVE_PLAN_STATE_SCHEMA_VERSION = 1 as const
export const PLAN_GENERATION_PROVENANCE_SCHEMA_VERSION = 1 as const

export interface ActivePlanStateRecordV1 {
  readonly schemaVersion: typeof ACTIVE_PLAN_STATE_SCHEMA_VERSION
  readonly trainingSchemaVersion: typeof TRAINING_SCHEMA_VERSION
  readonly userId: UserId
  readonly activePlanId: TrainingPlanId
  readonly activePlanRevision: number
  readonly approvedAt: UtcDateTime
  readonly updatedAt: UtcDateTime
}

export interface PersistedPhaseReasonCodesV1 {
  readonly phase: TrainingPhase
  readonly startWeek: number
  readonly endWeek: number
  readonly reasonCodes: readonly PlanGenerationReasonCode[]
}

export interface PersistedWeekReasonCodesV1 {
  readonly weekNumber: number
  readonly startDate: DateOnly
  readonly endDate: DateOnly
  readonly phase: TrainingPhase
  readonly reasonCodes: readonly PlanGenerationReasonCode[]
}

export interface PersistedWorkoutReasonCodesV1 {
  readonly workoutId: PlannedWorkoutId
  readonly reasonCodes: readonly PlanGenerationReasonCode[]
}

export interface PlanGenerationProvenanceRecordV1 {
  readonly schemaVersion: typeof PLAN_GENERATION_PROVENANCE_SCHEMA_VERSION
  readonly trainingSchemaVersion: typeof TRAINING_SCHEMA_VERSION
  readonly userId: UserId
  readonly planId: TrainingPlanId
  readonly commandId: string
  readonly envelopeVersion: number
  readonly appProtocolVersion: number
  readonly commandSchemaVersion: number
  readonly inputSchemaVersion: string
  readonly generatorVersion: string
  readonly rulesetVersion: string
  readonly generatedPlanSchemaVersion: string
  readonly resultSchemaVersion: string
  readonly supportedScopeId: string
  readonly artifactReviewState: 'approved' | 'provisional_dogfood'
  readonly expectedActivePlanRevision: number | null
  readonly planReasonCodes: readonly PlanGenerationReasonCode[]
  readonly phases: readonly PersistedPhaseReasonCodesV1[]
  readonly weeks: readonly PersistedWeekReasonCodesV1[]
  readonly workouts: readonly PersistedWorkoutReasonCodesV1[]
  readonly approvedAt: UtcDateTime
}

export interface PlanApprovalPersistenceProjection {
  readonly plan: {
    readonly path: string
    readonly entity: TrainingPlan
  }
  readonly workouts: readonly {
    readonly path: string
    readonly entity: PlannedWorkout
  }[]
  readonly activePlanState: {
    readonly path: string
    readonly record: ActivePlanStateRecordV1
  }
  readonly provenance: {
    readonly path: string
    readonly record: PlanGenerationProvenanceRecordV1
  }
}

export interface PlanApprovalPersistenceProjectionOptions {
  readonly authenticatedOwnerId: string
  readonly serverPlanId: string
  readonly activePlanRevision: number
  readonly approvedAt: string
  readonly envelope: unknown
  readonly artifactPolicyRecord: PlanApprovalArtifactPolicyRecord
}

export class PlanApprovalProjectionError extends Error {
  readonly code = 'invalid_projection' as const

  constructor(message: string) {
    super(message)
    this.name = 'PlanApprovalProjectionError'
  }
}

function invalidProjection(message: string): never {
  throw new PlanApprovalProjectionError(message)
}

function requireEnvelope(value: unknown): PlanApprovalCommandEnvelope {
  const parsed = parseMaterialCommand(value)
  if (!parsed.ok || !isPlanApprovalCommandEnvelope(parsed.envelope)) {
    return invalidProjection('A valid plan-approval envelope is required.')
  }
  return parsed.envelope
}

function requireOwnerId(value: string): UserId {
  try {
    return createUserId(value)
  } catch {
    return invalidProjection('A valid authenticated owner is required.')
  }
}

function requirePlanId(value: string): TrainingPlanId {
  try {
    return createTrainingPlanId(value)
  } catch {
    return invalidProjection('A valid server-generated plan ID is required.')
  }
}

function requireApprovedAt(value: string): UtcDateTime {
  try {
    return createUtcDateTime(value)
  } catch {
    return invalidProjection('A valid server approval timestamp is required.')
  }
}

function projectProvenance(
  envelope: PlanApprovalCommandEnvelope,
  proposal: GeneratedPlanV1,
  policyRecord: PlanApprovalArtifactPolicyRecord,
  ownerId: UserId,
  planId: TrainingPlanId,
  approvedAt: UtcDateTime,
): PlanGenerationProvenanceRecordV1 {
  return {
    schemaVersion: PLAN_GENERATION_PROVENANCE_SCHEMA_VERSION,
    trainingSchemaVersion: TRAINING_SCHEMA_VERSION,
    userId: ownerId,
    planId,
    commandId: envelope.commandId,
    envelopeVersion: envelope.envelopeVersion,
    appProtocolVersion: envelope.appProtocolVersion,
    commandSchemaVersion: envelope.command.schemaVersion,
    inputSchemaVersion: envelope.command.input.schemaVersion,
    generatorVersion: proposal.provenance.generatorVersion,
    rulesetVersion: proposal.provenance.rulesetVersion,
    generatedPlanSchemaVersion: proposal.schemaVersion,
    resultSchemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
    supportedScopeId: policyRecord.supportedScopeId,
    artifactReviewState:
      policyRecord.reviewState === 'provisional_dogfood'
        ? 'provisional_dogfood'
        : 'approved',
    expectedActivePlanRevision: envelope.command.expectedActivePlanRevision,
    planReasonCodes: [...proposal.reasonCodes],
    phases: proposal.phases.map((phase) => ({
      phase: phase.phase,
      startWeek: phase.startWeek,
      endWeek: phase.endWeek,
      reasonCodes: [...phase.reasonCodes],
    })),
    weeks: proposal.weeks.map((week) => ({
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate,
      phase: week.phase,
      reasonCodes: [...week.reasonCodes],
    })),
    workouts: proposal.weeks.flatMap((week) =>
      week.workouts.map((workout) => ({
        workoutId: workout.id,
        reasonCodes: [...workout.reasonCodes],
      })),
    ),
    approvedAt,
  }
}

export function projectApprovedPlan(
  options: PlanApprovalPersistenceProjectionOptions,
): PlanApprovalPersistenceProjection {
  const envelope = requireEnvelope(options.envelope)
  const ownerId = requireOwnerId(options.authenticatedOwnerId)
  const planId = requirePlanId(options.serverPlanId)
  const approvedAt = requireApprovedAt(options.approvedAt)
  if (
    !Number.isSafeInteger(options.activePlanRevision) ||
    options.activePlanRevision < 1
  ) {
    invalidProjection('The active-plan revision must be a positive whole number.')
  }

  const policyDecision = evaluatePlanApprovalArtifactPolicy(envelope, {
    allowProvisionalDogfood:
      options.artifactPolicyRecord.reviewState === 'provisional_dogfood',
    records: [options.artifactPolicyRecord],
    supportedScopeId: options.artifactPolicyRecord.supportedScopeId,
  })
  if (!policyDecision.allowed) {
    invalidProjection('The plan-approval artifact tuple is not approved.')
  }

  const generatedResult = {
    schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
    kind: 'generated' as const,
    plan: envelope.command.proposal,
  }
  if (
    validatePlanGenerationContract(envelope.command.input, generatedResult)
      .length > 0
  ) {
    invalidProjection('The plan-generation contract is invalid.')
  }

  const proposal = envelope.command.proposal
  let entities: GeneratedPlanEntityProjection
  try {
    entities = projectGeneratedPlanEntities({
      proposal,
      ownerId,
      planId,
      projectedAt: approvedAt,
      status: 'active',
    })
  } catch (error) {
    if (error instanceof GeneratedPlanEntityProjectionError) {
      return invalidProjection('The projected plan or workout records are invalid.')
    }
    throw error
  }
  const { plan, workouts } = entities

  return {
    plan: {
      path: planDocumentPath(ownerId, planId),
      entity: plan,
    },
    workouts: workouts.map((workout) => ({
      path: workoutDocumentPath(ownerId, planId, workout.id),
      entity: workout,
    })),
    activePlanState: {
      path: activePlanStateDocumentPath(ownerId),
      record: {
        schemaVersion: ACTIVE_PLAN_STATE_SCHEMA_VERSION,
        trainingSchemaVersion: TRAINING_SCHEMA_VERSION,
        userId: ownerId,
        activePlanId: planId,
        activePlanRevision: options.activePlanRevision,
        approvedAt,
        updatedAt: approvedAt,
      },
    },
    provenance: {
      path: planGenerationProvenanceDocumentPath(ownerId, planId),
      record: projectProvenance(
        envelope,
        proposal,
        policyDecision.record,
        ownerId,
        planId,
        approvedAt,
      ),
    },
  }
}
