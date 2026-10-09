import {
  isIanaTimeZone,
  isUtcDateTime,
  type IanaTimeZone,
  type UtcDateTime,
} from '../training/dates.js'
import {
  isCompletedRunIdValue,
  isIdentifierValue,
  type CompletedRunId,
  type PlannedWorkoutId,
  type ShoeId,
  type TrainingPlanId,
} from '../training/identifiers.js'
import {
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  validatePlanGenerationContract,
  type GeneratedPlanV1,
  type PlanGenerationInputV1,
  type PlanGenerationResultV1,
} from '../training/planGeneration.js'
import type { PerceivedEffort } from '../training/types.js'
import type {
  DistanceMeters,
  DurationSeconds,
} from '../training/units.js'
import { COMPLETED_RUN_NOTES_MAX_LENGTH } from '../training/validation.js'

export const MATERIAL_COMMAND_ENVELOPE_VERSION = 1 as const
export const MATERIAL_COMMAND_APP_PROTOCOL_VERSION = 1 as const
export const MATERIAL_COMMAND_PROOF_SCHEMA_VERSION = 1 as const
export const MATERIAL_COMMAND_PROOF_TYPE = 'proof.material-command' as const
export const MATERIAL_COMMAND_PROOF_VARIANTS = ['default', 'alternate'] as const
export const ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION = 1 as const
export const ACCOUNT_DELETION_REQUEST_TYPE = 'account.request-deletion' as const
export const PLAN_APPROVAL_COMMAND_SCHEMA_VERSION = 1 as const
export const PLAN_APPROVAL_COMMAND_TYPE = 'plan.approve-generated' as const
export const RUN_COMPLETION_COMMAND_SCHEMA_VERSION = 1 as const
export const RUN_COMPLETION_COMMAND_TYPE = 'run.complete' as const
export const RUN_DELETION_COMMAND_SCHEMA_VERSION = 1 as const
export const RUN_DELETION_COMMAND_TYPE = 'run.delete' as const

export const RUN_PERCEIVED_EFFORTS = [
  'much_easier_than_expected',
  'easier_than_expected',
  'about_right',
  'harder_than_expected',
  'much_harder_than_expected',
] as const satisfies readonly PerceivedEffort[]

const commandIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

interface MaterialCommandEnvelopeBase {
  envelopeVersion: typeof MATERIAL_COMMAND_ENVELOPE_VERSION
  appProtocolVersion: typeof MATERIAL_COMMAND_APP_PROTOCOL_VERSION
  commandId: string
}

export interface ProofMaterialCommandEnvelope
  extends MaterialCommandEnvelopeBase {
  command: {
    type: typeof MATERIAL_COMMAND_PROOF_TYPE
    schemaVersion: typeof MATERIAL_COMMAND_PROOF_SCHEMA_VERSION
    proofVariant: (typeof MATERIAL_COMMAND_PROOF_VARIANTS)[number]
  }
}

export interface AccountDeletionRequestEnvelope
  extends MaterialCommandEnvelopeBase {
  command: {
    type: typeof ACCOUNT_DELETION_REQUEST_TYPE
    schemaVersion: typeof ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION
  }
}

export interface PlanApprovalCommandEnvelope
  extends MaterialCommandEnvelopeBase {
  command: {
    type: typeof PLAN_APPROVAL_COMMAND_TYPE
    schemaVersion: typeof PLAN_APPROVAL_COMMAND_SCHEMA_VERSION
    expectedActivePlanRevision: number | null
    input: PlanGenerationInputV1
    proposal: GeneratedPlanV1
  }
}

export interface PlannedWorkoutCommandReferenceV1 {
  planId: TrainingPlanId
  workoutId: PlannedWorkoutId
  expectedUpdatedAt: UtcDateTime
}

export interface CompletedRunCommandInputV1 {
  plannedWorkout: PlannedWorkoutCommandReferenceV1 | null
  shoeId?: ShoeId
  startedAt: UtcDateTime
  timeZone: IanaTimeZone
  distance: DistanceMeters
  duration: DurationSeconds
  perceivedEffort?: PerceivedEffort
  unusualPain?: boolean
  notes?: string
}

export interface RunCompletionCommandEnvelope
  extends MaterialCommandEnvelopeBase {
  command: {
    type: typeof RUN_COMPLETION_COMMAND_TYPE
    schemaVersion: typeof RUN_COMPLETION_COMMAND_SCHEMA_VERSION
    input: CompletedRunCommandInputV1
  }
}

export interface RunDeletionCommandEnvelope
  extends MaterialCommandEnvelopeBase {
  command: {
    type: typeof RUN_DELETION_COMMAND_TYPE
    schemaVersion: typeof RUN_DELETION_COMMAND_SCHEMA_VERSION
    completedRunId: CompletedRunId
    expectedCompletedRunUpdatedAt: UtcDateTime
    plannedWorkout: PlannedWorkoutCommandReferenceV1 | null
  }
}

export type MaterialCommandEnvelope =
  | ProofMaterialCommandEnvelope
  | AccountDeletionRequestEnvelope
  | PlanApprovalCommandEnvelope
  | RunCompletionCommandEnvelope
  | RunDeletionCommandEnvelope

export function isProofMaterialCommandEnvelope(
  envelope: MaterialCommandEnvelope,
): envelope is ProofMaterialCommandEnvelope {
  return envelope.command.type === MATERIAL_COMMAND_PROOF_TYPE
}

export function isAccountDeletionRequestEnvelope(
  envelope: MaterialCommandEnvelope,
): envelope is AccountDeletionRequestEnvelope {
  return envelope.command.type === ACCOUNT_DELETION_REQUEST_TYPE
}

export function isPlanApprovalCommandEnvelope(
  envelope: MaterialCommandEnvelope,
): envelope is PlanApprovalCommandEnvelope {
  return envelope.command.type === PLAN_APPROVAL_COMMAND_TYPE
}

export function isRunCompletionCommandEnvelope(
  envelope: MaterialCommandEnvelope,
): envelope is RunCompletionCommandEnvelope {
  return envelope.command.type === RUN_COMPLETION_COMMAND_TYPE
}

export function isRunDeletionCommandEnvelope(
  envelope: MaterialCommandEnvelope,
): envelope is RunDeletionCommandEnvelope {
  return envelope.command.type === RUN_DELETION_COMMAND_TYPE
}

interface MaterialCommandFailure {
  commandId: string | null
  message: string
}

export interface MaterialCommandCommittedResult {
  status: 'committed'
  commandId: string
  committedAt: string
  proofCount: number
}

export interface AccountDeletionRequestAcceptedResult {
  status: 'accepted'
  commandId: string
  requestId: string
  requestedAt: string
  completionDueAt: string
  accessLocked: true
}

/** The server returns this exact receipt for both the first commit and a same-command retry. */
export interface PlanApprovalReceiptResult {
  status: 'plan_approved'
  commandId: string
  planId: string
  activePlanRevision: number
  approvedAt: string
}

export interface PlannedWorkoutCommandReceiptV1 {
  planId: TrainingPlanId
  workoutId: PlannedWorkoutId
  updatedAt: UtcDateTime
}

/** The same command ID and signature always resolve to this exact receipt. */
export interface RunCompletionReceiptResult {
  status: 'run_completed'
  commandId: string
  completedRunId: CompletedRunId
  completedRunUpdatedAt: UtcDateTime
  completedPlannedWorkout: PlannedWorkoutCommandReceiptV1 | null
}

/** A replay confirms both run absence and any associated workout reopening. */
export interface RunDeletionReceiptResult {
  status: 'run_deleted'
  commandId: string
  completedRunId: CompletedRunId
  deletedAt: UtcDateTime
  reopenedPlannedWorkout: PlannedWorkoutCommandReceiptV1 | null
}

export interface PlanApprovalStaleRevisionResult
  extends MaterialCommandFailure {
  status: 'stale_revision'
  code: 'active-plan-revision-changed'
  expectedActivePlanRevision: number | null
  actualActivePlanRevision: number | null
}

export interface CompletedRunStaleRevisionResult
  extends MaterialCommandFailure {
  status: 'stale_revision'
  code: 'completed-run-version-changed'
  completedRunId: CompletedRunId
  expectedUpdatedAt: UtcDateTime
  actualUpdatedAt: UtcDateTime | null
}

export interface PlannedWorkoutStaleRevisionResult
  extends MaterialCommandFailure {
  status: 'stale_revision'
  code: 'planned-workout-version-changed'
  planId: TrainingPlanId
  plannedWorkoutId: PlannedWorkoutId
  expectedUpdatedAt: UtcDateTime
  actualUpdatedAt: UtcDateTime | null
}

export type RunCommandStaleRevisionResult =
  | CompletedRunStaleRevisionResult
  | PlannedWorkoutStaleRevisionResult

export interface MaterialCommandValidationResult
  extends MaterialCommandFailure {
  status: 'validation_error'
  code:
    | 'invalid-envelope'
    | 'invalid-active-plan-revision'
    | 'invalid-plan-proposal'
    | 'invalid-run-completion'
    | 'invalid-run-deletion'
    | 'planned-workout-not-completable'
    | 'shoe-not-available'
    | 'ownership-field-prohibited'
    | 'target-field-prohibited'
}

export interface MaterialCommandAuthenticationResult
  extends MaterialCommandFailure {
  status: 'authentication_error'
  code:
    | 'authentication-required'
    | 'verified-email-required'
    | 'recent-authentication-required'
}

export interface MaterialCommandAuthorizationResult
  extends MaterialCommandFailure {
  status: 'authorization_error'
  code:
    | 'app-check-required'
    | 'app-check-token-replayed'
    | 'approved-beta-membership-required'
    | 'plan-artifact-not-approved'
    | 'training-resource-access-denied'
}

export interface MaterialCommandUnsupportedVersionResult
  extends MaterialCommandFailure {
  status: 'unsupported_version'
  code:
    | 'unsupported-envelope-version'
    | 'unsupported-app-protocol-version'
    | 'unsupported-command-schema-version'
  supportedVersion: number
}

export interface MaterialCommandIdConflictResult
  extends MaterialCommandFailure {
  status: 'conflict'
  code: 'command-id-reused'
}

export interface RunCompletionDuplicateResult
  extends MaterialCommandFailure {
  status: 'conflict'
  code: 'planned-workout-already-completed'
  planId: TrainingPlanId
  plannedWorkoutId: PlannedWorkoutId
  completedRunId: CompletedRunId
}

export type MaterialCommandConflictResult =
  | MaterialCommandIdConflictResult
  | RunCompletionDuplicateResult

export interface MaterialCommandRetryableResult extends MaterialCommandFailure {
  status: 'retryable_error'
  code: 'temporarily-unavailable'
}

export interface MaterialCommandOutcomeUnknownResult
  extends MaterialCommandFailure {
  status: 'outcome_unknown'
  code: 'resolve-by-command-id'
}

export type MaterialCommandResult =
  | MaterialCommandCommittedResult
  | AccountDeletionRequestAcceptedResult
  | PlanApprovalReceiptResult
  | RunCompletionReceiptResult
  | RunDeletionReceiptResult
  | PlanApprovalStaleRevisionResult
  | RunCommandStaleRevisionResult
  | MaterialCommandValidationResult
  | MaterialCommandAuthenticationResult
  | MaterialCommandAuthorizationResult
  | MaterialCommandUnsupportedVersionResult
  | MaterialCommandConflictResult
  | MaterialCommandRetryableResult
  | MaterialCommandOutcomeUnknownResult

export type ParsedMaterialCommand =
  | { ok: true; envelope: MaterialCommandEnvelope }
  | {
      ok: false
      result: MaterialCommandValidationResult | MaterialCommandUnsupportedVersionResult
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  )
}

function hasExactOptionalKeys(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const allowedKeys = new Set([...requiredKeys, ...optionalKeys])
  return (
    requiredKeys.every((key) => key in value) &&
    Object.keys(value).every((key) => allowedKeys.has(key))
  )
}

function containsKey(
  value: unknown,
  prohibitedKeys: ReadonlySet<string>,
  visited: WeakSet<object> = new WeakSet(),
): boolean {
  if (typeof value !== 'object' || value === null) return false
  if (visited.has(value)) return false
  visited.add(value)
  if (Array.isArray(value)) {
    return value.some((entry) => containsKey(entry, prohibitedKeys, visited))
  }
  const record = value as Record<string, unknown>
  return (
    Object.keys(record).some((key) => prohibitedKeys.has(key)) ||
    Object.values(record).some((entry) =>
      containsKey(entry, prohibitedKeys, visited),
    )
  )
}

function hasOwnershipField(value: Record<string, unknown>): boolean {
  return containsKey(value, new Set(['userId', 'ownerId', 'uid']))
}

function hasProhibitedTargetField(value: Record<string, unknown>): boolean {
  return containsKey(value, new Set(['email', 'path', 'projectId']))
}

function hasExactTargetRaceKeys(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.kind === 'date') return hasExactKeys(value, ['kind', 'date'])
  if (value.kind === 'window') {
    return hasExactKeys(value, ['kind', 'startDate', 'endDate'])
  }
  return false
}

function hasExactRunnerContextKeys(value: unknown): boolean {
  if (
    !hasExactOptionalKeys(
      value,
      [
        'experienceLevel',
        'targetRace',
        'currentWeeklyDistance',
        'currentRunningFrequencyDaysPerWeek',
        'longestRecentRunDistance',
        'availableTrainingDays',
        'preferredLongRunDay',
        'completionGoal',
        'safetySignal',
      ],
      ['recentPerformance', 'scheduleConstraints'],
    ) ||
    !hasExactTargetRaceKeys(value.targetRace) ||
    !Array.isArray(value.availableTrainingDays)
  ) {
    return false
  }
  return (
    value.recentPerformance === undefined ||
    (isRecord(value.recentPerformance) &&
      hasExactKeys(value.recentPerformance, [
        'completedOn',
        'distance',
        'duration',
      ]))
  )
}

function hasExactPlanGenerationInputKeys(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'schemaVersion',
      'rulesetVersion',
      'planStartDate',
      'runner',
    ]) &&
    hasExactRunnerContextKeys(value.runner)
  )
}

function hasExactWorkoutTargetKeys(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.kind === 'distance') {
    return hasExactKeys(value, ['kind', 'distance'])
  }
  if (value.kind === 'duration') {
    return hasExactKeys(value, ['kind', 'duration'])
  }
  return false
}

function hasExactGeneratedWorkoutKeys(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.reasonCodes)) return false
  if (value.kind === 'rest') {
    return hasExactKeys(value, [
      'id',
      'kind',
      'scheduledDate',
      'reasonCodes',
    ])
  }
  if (value.kind === 'run') {
    return (
      hasExactKeys(value, [
        'id',
        'kind',
        'purpose',
        'scheduledDate',
        'target',
        'reasonCodes',
      ]) && hasExactWorkoutTargetKeys(value.target)
    )
  }
  if (value.kind === 'walk_run') {
    return (
      hasExactKeys(value, [
        'id',
        'kind',
        'scheduledDate',
        'target',
        'reasonCodes',
      ]) && hasExactWorkoutTargetKeys(value.target)
    )
  }
  return false
}

function hasExactGeneratedPlanKeys(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'schemaVersion',
      'name',
      'startDate',
      'targetRaceDate',
      'endDate',
      'completionGoal',
      'provenance',
      'reasonCodes',
      'phases',
      'weeks',
    ]) ||
    !isRecord(value.provenance) ||
    !hasExactKeys(value.provenance, [
      'inputSchemaVersion',
      'generatorVersion',
      'rulesetVersion',
    ]) ||
    !Array.isArray(value.reasonCodes) ||
    !Array.isArray(value.phases) ||
    !Array.isArray(value.weeks)
  ) {
    return false
  }
  return (
    value.phases.every(
      (phase) =>
        isRecord(phase) &&
        hasExactKeys(phase, [
          'phase',
          'startWeek',
          'endWeek',
          'reasonCodes',
        ]) &&
        Array.isArray(phase.reasonCodes),
    ) &&
    value.weeks.every(
      (week) =>
        isRecord(week) &&
        hasExactKeys(week, [
          'weekNumber',
          'startDate',
          'endDate',
          'phase',
          'reasonCodes',
          'workouts',
        ]) &&
        Array.isArray(week.reasonCodes) &&
        Array.isArray(week.workouts) &&
        week.workouts.every(hasExactGeneratedWorkoutKeys),
    )
  )
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function isPlannedWorkoutCommandReference(
  value: unknown,
): value is PlannedWorkoutCommandReferenceV1 {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['planId', 'workoutId', 'expectedUpdatedAt']) &&
    isIdentifierValue(value.planId) &&
    isIdentifierValue(value.workoutId) &&
    isUtcDateTime(value.expectedUpdatedAt)
  )
}

function isOptionalFieldValid(
  value: Record<string, unknown>,
  key: string,
  predicate: (candidate: unknown) => boolean,
): boolean {
  return !(key in value) || predicate(value[key])
}

function isCompletedRunCommandInput(
  value: unknown,
): value is CompletedRunCommandInputV1 {
  if (
    !hasExactOptionalKeys(
      value,
      [
        'plannedWorkout',
        'startedAt',
        'timeZone',
        'distance',
        'duration',
      ],
      ['shoeId', 'perceivedEffort', 'unusualPain', 'notes'],
    ) ||
    (value.plannedWorkout !== null &&
      !isPlannedWorkoutCommandReference(value.plannedWorkout)) ||
    !isUtcDateTime(value.startedAt) ||
    !isIanaTimeZone(value.timeZone) ||
    !isPositiveSafeInteger(value.distance) ||
    !isPositiveSafeInteger(value.duration)
  ) {
    return false
  }

  return (
    isOptionalFieldValid(value, 'shoeId', isIdentifierValue) &&
    isOptionalFieldValid(value, 'perceivedEffort', (candidate) =>
      RUN_PERCEIVED_EFFORTS.includes(
        candidate as (typeof RUN_PERCEIVED_EFFORTS)[number],
      ),
    ) &&
    isOptionalFieldValid(
      value,
      'unusualPain',
      (candidate) => typeof candidate === 'boolean',
    ) &&
    isOptionalFieldValid(
      value,
      'notes',
      (candidate) =>
        typeof candidate === 'string' &&
        candidate.trim().length > 0 &&
        candidate.length <= COMPLETED_RUN_NOTES_MAX_LENGTH,
    )
  )
}

function isExpectedActivePlanRevision(value: unknown): value is number | null {
  return value === null || (Number.isSafeInteger(value) && Number(value) >= 0)
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) {
      throw new Error('A material-command signature value is not serializable.')
    }
    return serialized
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
  return `{${entries.join(',')}}`
}

export function materialCommandIdFrom(value: unknown): string | null {
  if (!isRecord(value)) return null
  const commandId = value.commandId
  return typeof commandId === 'string' && commandIdPattern.test(commandId)
    ? commandId
    : null
}

function validationResult(
  commandId: string | null,
  code: MaterialCommandValidationResult['code'],
  message: string,
): MaterialCommandValidationResult {
  return { status: 'validation_error', commandId, code, message }
}

function unsupportedVersionResult(
  commandId: string | null,
  code: MaterialCommandUnsupportedVersionResult['code'],
  supportedVersion: number,
): MaterialCommandUnsupportedVersionResult {
  return {
    status: 'unsupported_version',
    commandId,
    code,
    message: 'Update Marathoner before retrying this command.',
    supportedVersion,
  }
}

export function parseMaterialCommand(value: unknown): ParsedMaterialCommand {
  const commandId = materialCommandIdFrom(value)
  if (!isRecord(value)) {
    return {
      ok: false,
      result: validationResult(
        null,
        'invalid-envelope',
        'The command envelope is invalid.',
      ),
    }
  }

  if (hasOwnershipField(value)) {
    return {
      ok: false,
      result: validationResult(
        commandId,
        'ownership-field-prohibited',
        'User ownership must come from the authenticated session.',
      ),
    }
  }

  if (hasProhibitedTargetField(value)) {
    return {
      ok: false,
      result: validationResult(
        commandId,
        'target-field-prohibited',
        'Command targets must come from authenticated server context.',
      ),
    }
  }

  if (!hasExactKeys(value, [
    'appProtocolVersion',
    'command',
    'commandId',
    'envelopeVersion',
  ]) || commandId === null) {
    return {
      ok: false,
      result: validationResult(
        commandId,
        'invalid-envelope',
        'The command envelope is invalid.',
      ),
    }
  }

  if (value.envelopeVersion !== MATERIAL_COMMAND_ENVELOPE_VERSION) {
    return {
      ok: false,
      result: unsupportedVersionResult(
        commandId,
        'unsupported-envelope-version',
        MATERIAL_COMMAND_ENVELOPE_VERSION,
      ),
    }
  }

  if (value.appProtocolVersion !== MATERIAL_COMMAND_APP_PROTOCOL_VERSION) {
    return {
      ok: false,
      result: unsupportedVersionResult(
        commandId,
        'unsupported-app-protocol-version',
        MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
      ),
    }
  }

  const command = value.command
  if (!isRecord(command) || typeof command.type !== 'string') {
    return {
      ok: false,
      result: validationResult(
        commandId,
        'invalid-envelope',
        'The command type is not supported.',
      ),
    }
  }

  if (command.type === MATERIAL_COMMAND_PROOF_TYPE) {
    if (
      !hasExactKeys(command, ['proofVariant', 'schemaVersion', 'type']) ||
      !MATERIAL_COMMAND_PROOF_VARIANTS.includes(
        command.proofVariant as (typeof MATERIAL_COMMAND_PROOF_VARIANTS)[number],
      )
    ) {
      return {
        ok: false,
        result: validationResult(
          commandId,
          'invalid-envelope',
          'The command type is not supported.',
        ),
      }
    }
    if (command.schemaVersion !== MATERIAL_COMMAND_PROOF_SCHEMA_VERSION) {
      return {
        ok: false,
        result: unsupportedVersionResult(
          commandId,
          'unsupported-command-schema-version',
          MATERIAL_COMMAND_PROOF_SCHEMA_VERSION,
        ),
      }
    }
    return {
      ok: true,
      envelope: {
        envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
        appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
        commandId,
        command: {
          type: MATERIAL_COMMAND_PROOF_TYPE,
          schemaVersion: MATERIAL_COMMAND_PROOF_SCHEMA_VERSION,
          proofVariant:
            command.proofVariant as ProofMaterialCommandEnvelope['command']['proofVariant'],
        },
      },
    }
  }

  if (command.type === ACCOUNT_DELETION_REQUEST_TYPE) {
    if (!hasExactKeys(command, ['schemaVersion', 'type'])) {
      return {
        ok: false,
        result: validationResult(
          commandId,
          'invalid-envelope',
          'The command type is not supported.',
        ),
      }
    }
    if (command.schemaVersion !== ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION) {
      return {
        ok: false,
        result: unsupportedVersionResult(
          commandId,
          'unsupported-command-schema-version',
          ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION,
        ),
      }
    }
    return {
      ok: true,
      envelope: {
        envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
        appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
        commandId,
        command: {
          type: ACCOUNT_DELETION_REQUEST_TYPE,
          schemaVersion: ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION,
        },
      },
    }
  }

  if (command.type === PLAN_APPROVAL_COMMAND_TYPE) {
    if (
      !hasExactKeys(command, [
        'type',
        'schemaVersion',
        'expectedActivePlanRevision',
        'input',
        'proposal',
      ])
    ) {
      return {
        ok: false,
        result: validationResult(
          commandId,
          'invalid-envelope',
          'The plan-approval command fields are invalid.',
        ),
      }
    }
    if (command.schemaVersion !== PLAN_APPROVAL_COMMAND_SCHEMA_VERSION) {
      return {
        ok: false,
        result: unsupportedVersionResult(
          commandId,
          'unsupported-command-schema-version',
          PLAN_APPROVAL_COMMAND_SCHEMA_VERSION,
        ),
      }
    }
    if (!isExpectedActivePlanRevision(command.expectedActivePlanRevision)) {
      return {
        ok: false,
        result: validationResult(
          commandId,
          'invalid-active-plan-revision',
          'Expected active-plan revision must be null or a non-negative whole number.',
        ),
      }
    }
    if (
      !hasExactPlanGenerationInputKeys(command.input) ||
      !hasExactGeneratedPlanKeys(command.proposal)
    ) {
      return {
        ok: false,
        result: validationResult(
          commandId,
          'invalid-plan-proposal',
          'The generated plan proposal is invalid.',
        ),
      }
    }

    const input = command.input as unknown as PlanGenerationInputV1
    const proposal = command.proposal as unknown as GeneratedPlanV1
    const generatedResult: PlanGenerationResultV1 = {
      schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
      kind: 'generated',
      plan: proposal,
    }
    if (validatePlanGenerationContract(input, generatedResult).length > 0) {
      return {
        ok: false,
        result: validationResult(
          commandId,
          'invalid-plan-proposal',
          'The generated plan proposal is invalid.',
        ),
      }
    }

    return {
      ok: true,
      envelope: {
        envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
        appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
        commandId,
        command: {
          type: PLAN_APPROVAL_COMMAND_TYPE,
          schemaVersion: PLAN_APPROVAL_COMMAND_SCHEMA_VERSION,
          expectedActivePlanRevision: command.expectedActivePlanRevision,
          input,
          proposal,
        },
      },
    }
  }

  if (command.type === RUN_COMPLETION_COMMAND_TYPE) {
    if (!hasExactKeys(command, ['type', 'schemaVersion', 'input'])) {
      return {
        ok: false,
        result: validationResult(
          commandId,
          'invalid-run-completion',
          'The completed-run input is invalid.',
        ),
      }
    }
    if (command.schemaVersion !== RUN_COMPLETION_COMMAND_SCHEMA_VERSION) {
      return {
        ok: false,
        result: unsupportedVersionResult(
          commandId,
          'unsupported-command-schema-version',
          RUN_COMPLETION_COMMAND_SCHEMA_VERSION,
        ),
      }
    }
    if (!isCompletedRunCommandInput(command.input)) {
      return {
        ok: false,
        result: validationResult(
          commandId,
          'invalid-run-completion',
          'The completed-run input is invalid.',
        ),
      }
    }
    return {
      ok: true,
      envelope: {
        envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
        appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
        commandId,
        command: {
          type: RUN_COMPLETION_COMMAND_TYPE,
          schemaVersion: RUN_COMPLETION_COMMAND_SCHEMA_VERSION,
          input: command.input,
        },
      },
    }
  }

  if (command.type === RUN_DELETION_COMMAND_TYPE) {
    if (
      !hasExactKeys(command, [
        'type',
        'schemaVersion',
        'completedRunId',
        'expectedCompletedRunUpdatedAt',
        'plannedWorkout',
      ])
    ) {
      return {
        ok: false,
        result: validationResult(
          commandId,
          'invalid-run-deletion',
          'The completed-run deletion input is invalid.',
        ),
      }
    }
    if (command.schemaVersion !== RUN_DELETION_COMMAND_SCHEMA_VERSION) {
      return {
        ok: false,
        result: unsupportedVersionResult(
          commandId,
          'unsupported-command-schema-version',
          RUN_DELETION_COMMAND_SCHEMA_VERSION,
        ),
      }
    }
    if (
      !isCompletedRunIdValue(command.completedRunId) ||
      !isUtcDateTime(command.expectedCompletedRunUpdatedAt) ||
      (command.plannedWorkout !== null &&
        !isPlannedWorkoutCommandReference(command.plannedWorkout))
    ) {
      return {
        ok: false,
        result: validationResult(
          commandId,
          'invalid-run-deletion',
          'The completed-run deletion input is invalid.',
        ),
      }
    }
    return {
      ok: true,
      envelope: {
        envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
        appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
        commandId,
        command: {
          type: RUN_DELETION_COMMAND_TYPE,
          schemaVersion: RUN_DELETION_COMMAND_SCHEMA_VERSION,
          completedRunId: command.completedRunId,
          expectedCompletedRunUpdatedAt:
            command.expectedCompletedRunUpdatedAt,
          plannedWorkout: command.plannedWorkout,
        },
      },
    }
  }

  return {
    ok: false,
    result: validationResult(
      commandId,
      'invalid-envelope',
      'The command type is not supported.',
    ),
  }
}

export function materialCommandSignature(
  envelope: MaterialCommandEnvelope,
): string {
  const signature: Array<string | number> = [
    envelope.envelopeVersion,
    envelope.appProtocolVersion,
    envelope.command.type,
    envelope.command.schemaVersion,
  ]
  if (isProofMaterialCommandEnvelope(envelope)) {
    signature.push(envelope.command.proofVariant)
  }
  if (isPlanApprovalCommandEnvelope(envelope)) {
    signature.push(
      canonicalJson({
        expectedActivePlanRevision:
          envelope.command.expectedActivePlanRevision,
        input: envelope.command.input,
        proposal: envelope.command.proposal,
      }),
    )
  }
  if (isRunCompletionCommandEnvelope(envelope)) {
    signature.push(canonicalJson(envelope.command.input))
  }
  if (isRunDeletionCommandEnvelope(envelope)) {
    signature.push(
      canonicalJson({
        completedRunId: envelope.command.completedRunId,
        expectedCompletedRunUpdatedAt:
          envelope.command.expectedCompletedRunUpdatedAt,
        plannedWorkout: envelope.command.plannedWorkout,
      }),
    )
  }
  return signature.join(':')
}

function isPlannedWorkoutCommandReceipt(
  value: unknown,
): value is PlannedWorkoutCommandReceiptV1 {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['planId', 'workoutId', 'updatedAt']) &&
    isIdentifierValue(value.planId) &&
    isIdentifierValue(value.workoutId) &&
    isUtcDateTime(value.updatedAt)
  )
}

export function isRunCompletionReceiptResult(
  value: unknown,
): value is RunCompletionReceiptResult {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'status',
      'commandId',
      'completedRunId',
      'completedRunUpdatedAt',
      'completedPlannedWorkout',
    ]) &&
    value.status === 'run_completed' &&
    typeof value.commandId === 'string' &&
    commandIdPattern.test(value.commandId) &&
    isCompletedRunIdValue(value.completedRunId) &&
    isUtcDateTime(value.completedRunUpdatedAt) &&
    (value.completedPlannedWorkout === null ||
      isPlannedWorkoutCommandReceipt(value.completedPlannedWorkout))
  )
}

export function isRunDeletionReceiptResult(
  value: unknown,
): value is RunDeletionReceiptResult {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'status',
      'commandId',
      'completedRunId',
      'deletedAt',
      'reopenedPlannedWorkout',
    ]) &&
    value.status === 'run_deleted' &&
    typeof value.commandId === 'string' &&
    commandIdPattern.test(value.commandId) &&
    isCompletedRunIdValue(value.completedRunId) &&
    isUtcDateTime(value.deletedAt) &&
    (value.reopenedPlannedWorkout === null ||
      isPlannedWorkoutCommandReceipt(value.reopenedPlannedWorkout))
  )
}

export function isRunCompletionDuplicateResult(
  value: unknown,
): value is RunCompletionDuplicateResult {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'status',
      'commandId',
      'code',
      'message',
      'planId',
      'plannedWorkoutId',
      'completedRunId',
    ]) &&
    value.status === 'conflict' &&
    value.code === 'planned-workout-already-completed' &&
    typeof value.message === 'string' &&
    typeof value.commandId === 'string' &&
    commandIdPattern.test(value.commandId) &&
    isIdentifierValue(value.planId) &&
    isIdentifierValue(value.plannedWorkoutId) &&
    isCompletedRunIdValue(value.completedRunId)
  )
}

export function isRunCommandStaleRevisionResult(
  value: unknown,
): value is RunCommandStaleRevisionResult {
  if (
    !isRecord(value) ||
    value.status !== 'stale_revision' ||
    typeof value.message !== 'string' ||
    typeof value.commandId !== 'string' ||
    !commandIdPattern.test(value.commandId) ||
    !isUtcDateTime(value.expectedUpdatedAt) ||
    (value.actualUpdatedAt !== null && !isUtcDateTime(value.actualUpdatedAt))
  ) {
    return false
  }
  if (value.code === 'completed-run-version-changed') {
    return (
      hasExactKeys(value, [
        'status',
        'commandId',
        'code',
        'message',
        'completedRunId',
        'expectedUpdatedAt',
        'actualUpdatedAt',
      ]) && isCompletedRunIdValue(value.completedRunId)
    )
  }
  if (value.code === 'planned-workout-version-changed') {
    return (
      hasExactKeys(value, [
        'status',
        'commandId',
        'code',
        'message',
        'planId',
        'plannedWorkoutId',
        'expectedUpdatedAt',
        'actualUpdatedAt',
      ]) &&
      isIdentifierValue(value.planId) &&
      isIdentifierValue(value.plannedWorkoutId)
    )
  }
  return false
}

export function isMaterialCommandResult(
  value: unknown,
): value is MaterialCommandResult {
  if (!isRecord(value) || typeof value.status !== 'string') return false
  if (
    value.commandId !== null &&
    (typeof value.commandId !== 'string' || !commandIdPattern.test(value.commandId))
  ) {
    return false
  }

  if (value.status === 'committed') {
    return (
      typeof value.commandId === 'string' &&
      typeof value.committedAt === 'string' &&
      Number.isInteger(value.proofCount) &&
      Number(value.proofCount) >= 1
    )
  }

  if (value.status === 'accepted') {
    return (
      typeof value.commandId === 'string' &&
      typeof value.requestId === 'string' &&
      value.requestId.length >= 16 &&
      value.requestId.length <= 128 &&
      typeof value.requestedAt === 'string' &&
      typeof value.completionDueAt === 'string' &&
      value.accessLocked === true
    )
  }

  if (value.status === 'plan_approved') {
    return (
      hasExactKeys(value, [
        'status',
        'commandId',
        'planId',
        'activePlanRevision',
        'approvedAt',
      ]) &&
      typeof value.commandId === 'string' &&
      isIdentifierValue(value.planId) &&
      Number.isSafeInteger(value.activePlanRevision) &&
      Number(value.activePlanRevision) > 0 &&
      typeof value.approvedAt === 'string' &&
      value.approvedAt.length > 0
    )
  }

  if (value.status === 'run_completed') {
    return isRunCompletionReceiptResult(value)
  }

  if (value.status === 'run_deleted') {
    return isRunDeletionReceiptResult(value)
  }

  if (typeof value.message !== 'string' || typeof value.code !== 'string') {
    return false
  }

  switch (value.status) {
    case 'validation_error':
      return (
        value.code === 'invalid-envelope' ||
        value.code === 'invalid-active-plan-revision' ||
        value.code === 'invalid-plan-proposal' ||
        value.code === 'invalid-run-completion' ||
        value.code === 'invalid-run-deletion' ||
        value.code === 'planned-workout-not-completable' ||
        value.code === 'shoe-not-available' ||
        value.code === 'ownership-field-prohibited' ||
        value.code === 'target-field-prohibited'
      )
    case 'authentication_error':
      return [
        'authentication-required',
        'verified-email-required',
        'recent-authentication-required',
      ].includes(value.code)
    case 'authorization_error':
      return [
        'app-check-required',
        'app-check-token-replayed',
        'approved-beta-membership-required',
        'plan-artifact-not-approved',
        'training-resource-access-denied',
      ].includes(value.code)
    case 'unsupported_version':
      return (
        [
          'unsupported-envelope-version',
          'unsupported-app-protocol-version',
          'unsupported-command-schema-version',
        ].includes(value.code) && Number.isInteger(value.supportedVersion)
      )
    case 'conflict':
      return (
        value.code === 'command-id-reused' ||
        isRunCompletionDuplicateResult(value)
      )
    case 'retryable_error':
      return value.code === 'temporarily-unavailable'
    case 'outcome_unknown':
      return value.code === 'resolve-by-command-id'
    case 'stale_revision':
      return isRunCommandStaleRevisionResult(value) || (
        hasExactKeys(value, [
          'status',
          'commandId',
          'code',
          'message',
          'expectedActivePlanRevision',
          'actualActivePlanRevision',
        ]) &&
        typeof value.commandId === 'string' &&
        value.code === 'active-plan-revision-changed' &&
        isExpectedActivePlanRevision(value.expectedActivePlanRevision) &&
        isExpectedActivePlanRevision(value.actualActivePlanRevision)
      )
    default:
      return false
  }
}

export function createProofMaterialCommand(
  commandId: string,
  proofVariant: ProofMaterialCommandEnvelope['command']['proofVariant'] = 'default',
): ProofMaterialCommandEnvelope {
  const parsed = parseMaterialCommand({
    envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
    appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
    commandId,
    command: {
      type: MATERIAL_COMMAND_PROOF_TYPE,
      schemaVersion: MATERIAL_COMMAND_PROOF_SCHEMA_VERSION,
      proofVariant,
    },
  })
  if (!parsed.ok) throw new Error(parsed.result.message)
  if (!isProofMaterialCommandEnvelope(parsed.envelope)) {
    throw new Error('The proof command parsed as the wrong command type.')
  }
  return parsed.envelope
}

export function createAccountDeletionRequest(
  commandId: string,
): AccountDeletionRequestEnvelope {
  const parsed = parseMaterialCommand({
    envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
    appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
    commandId,
    command: {
      type: ACCOUNT_DELETION_REQUEST_TYPE,
      schemaVersion: ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION,
    },
  })
  if (!parsed.ok) throw new Error(parsed.result.message)
  if (!isAccountDeletionRequestEnvelope(parsed.envelope)) {
    throw new Error('The deletion request parsed as the wrong command type.')
  }
  return parsed.envelope
}

export function createPlanApprovalCommand(
  commandId: string,
  options: {
    expectedActivePlanRevision: number | null
    input: PlanGenerationInputV1
    proposal: GeneratedPlanV1
  },
): PlanApprovalCommandEnvelope {
  const parsed = parseMaterialCommand({
    envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
    appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
    commandId,
    command: {
      type: PLAN_APPROVAL_COMMAND_TYPE,
      schemaVersion: PLAN_APPROVAL_COMMAND_SCHEMA_VERSION,
      expectedActivePlanRevision: options.expectedActivePlanRevision,
      input: options.input,
      proposal: options.proposal,
    },
  })
  if (!parsed.ok) throw new Error(parsed.result.message)
  if (!isPlanApprovalCommandEnvelope(parsed.envelope)) {
    throw new Error('The plan-approval command parsed as the wrong command type.')
  }
  return parsed.envelope
}

export function createRunCompletionCommand(
  commandId: string,
  input: CompletedRunCommandInputV1,
): RunCompletionCommandEnvelope {
  const parsed = parseMaterialCommand({
    envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
    appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
    commandId,
    command: {
      type: RUN_COMPLETION_COMMAND_TYPE,
      schemaVersion: RUN_COMPLETION_COMMAND_SCHEMA_VERSION,
      input,
    },
  })
  if (!parsed.ok) throw new Error(parsed.result.message)
  if (!isRunCompletionCommandEnvelope(parsed.envelope)) {
    throw new Error('The run-completion command parsed as the wrong command type.')
  }
  return parsed.envelope
}

export function createRunDeletionCommand(
  commandId: string,
  options: {
    completedRunId: CompletedRunId
    expectedCompletedRunUpdatedAt: UtcDateTime
    plannedWorkout: PlannedWorkoutCommandReferenceV1 | null
  },
): RunDeletionCommandEnvelope {
  const parsed = parseMaterialCommand({
    envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
    appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
    commandId,
    command: {
      type: RUN_DELETION_COMMAND_TYPE,
      schemaVersion: RUN_DELETION_COMMAND_SCHEMA_VERSION,
      completedRunId: options.completedRunId,
      expectedCompletedRunUpdatedAt:
        options.expectedCompletedRunUpdatedAt,
      plannedWorkout: options.plannedWorkout,
    },
  })
  if (!parsed.ok) throw new Error(parsed.result.message)
  if (!isRunDeletionCommandEnvelope(parsed.envelope)) {
    throw new Error('The run-deletion command parsed as the wrong command type.')
  }
  return parsed.envelope
}
