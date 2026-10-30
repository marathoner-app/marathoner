import type { PlanApprovalCommandEnvelope } from '../../src/domain/materialCommands/contract.js'
import {
  GENERATED_PLAN_SCHEMA_VERSION,
  PLAN_GENERATION_INPUT_SCHEMA_VERSION,
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
} from '../../src/domain/training/planGeneration.js'

export const DEVELOPMENT_DOGFOOD_PROJECT_ID = 'marathoner-d9bf9'
export const DEVELOPMENT_DOGFOOD_PLAN_SCOPE_ID =
  'owner-dogfood-consistent-runner@1'
export const DEVELOPMENT_DOGFOOD_GENERATOR_VERSION =
  'deterministic-plan-generator@1.0.0'
export const DEVELOPMENT_DOGFOOD_RULESET_VERSION =
  'beta-rules@0.2.0-draft'

export const PLAN_APPROVAL_ARTIFACT_REVIEW_STATES = [
  'missing',
  'draft',
  'ready_for_review',
  'approved',
  'conditional',
  'provisional_dogfood',
  'rejected',
  'retired',
] as const

export type PlanApprovalArtifactReviewState =
  (typeof PLAN_APPROVAL_ARTIFACT_REVIEW_STATES)[number]

/**
 * One server-owned decision for one exact generation tuple and participant
 * scope. String schema fields are compared at runtime so an obsolete or
 * malformed registry record fails closed instead of being trusted by type
 * assertion alone.
 */
export interface PlanApprovalArtifactPolicyRecord {
  supportedScopeId: string
  inputSchemaVersion: string
  generatorVersion: string
  rulesetVersion: string
  generatedPlanSchemaVersion: string
  resultSchemaVersion: string
  reviewState: PlanApprovalArtifactReviewState
}

export interface PlanApprovalArtifactPolicyContext {
  supportedScopeId: string | null
  records: readonly PlanApprovalArtifactPolicyRecord[]
  allowProvisionalDogfood?: boolean
}

export interface InstalledPlanApprovalArtifactPolicy
  extends PlanApprovalArtifactPolicyContext {
  allowProvisionalDogfood: boolean
}

export type PlanApprovalArtifactPolicyDecision =
  | { allowed: true; record: PlanApprovalArtifactPolicyRecord }
  | { allowed: false }

/**
 * Production deliberately approves no generation tuple. Adding a record is a
 * release decision and must happen in the reviewed issue that activates an
 * exact non-draft methodology artifact.
 */
export const PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY: readonly PlanApprovalArtifactPolicyRecord[] =
  Object.freeze([])

/**
 * The closed development project may activate this one pinned draft for the
 * two existing dogfood accounts. The review state is persisted as provisional
 * and this record is never installed in the beta project.
 */
export const DEVELOPMENT_DOGFOOD_PLAN_APPROVAL_ARTIFACT_POLICY: readonly PlanApprovalArtifactPolicyRecord[] =
  Object.freeze([
    {
      supportedScopeId: DEVELOPMENT_DOGFOOD_PLAN_SCOPE_ID,
      inputSchemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
      generatorVersion: DEVELOPMENT_DOGFOOD_GENERATOR_VERSION,
      rulesetVersion: DEVELOPMENT_DOGFOOD_RULESET_VERSION,
      generatedPlanSchemaVersion: GENERATED_PLAN_SCHEMA_VERSION,
      resultSchemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
      reviewState: 'provisional_dogfood',
    },
  ])

/**
 * Selects the live server policy without trusting a client build flag. The
 * provisional artifact is available only when the deployed Functions project
 * is the development project and its operator-controlled parameter is enabled.
 */
export function selectLivePlanApprovalArtifactPolicy(options: {
  projectId: string
  provisionalDogfoodEnabled: boolean
}): InstalledPlanApprovalArtifactPolicy {
  const dogfoodEnabled =
    options.projectId === DEVELOPMENT_DOGFOOD_PROJECT_ID &&
    options.provisionalDogfoodEnabled

  return {
    allowProvisionalDogfood: dogfoodEnabled,
    records: dogfoodEnabled
      ? DEVELOPMENT_DOGFOOD_PLAN_APPROVAL_ARTIFACT_POLICY
      : PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY,
    supportedScopeId: dogfoodEnabled
      ? DEVELOPMENT_DOGFOOD_PLAN_SCOPE_ID
      : null,
  }
}

const scopeIdPattern = /^[a-z][a-z0-9-]*@[1-9]\d*$/
const draftArtifactPattern = /(?:-|\.)draft(?:[.-]|$)/

function isDraftArtifactVersion(version: string): boolean {
  return draftArtifactPattern.test(version)
}

function matchesCommand(
  record: PlanApprovalArtifactPolicyRecord,
  envelope: PlanApprovalCommandEnvelope,
  supportedScopeId: string,
): boolean {
  return (
    record.supportedScopeId === supportedScopeId &&
    record.inputSchemaVersion === envelope.command.input.schemaVersion &&
    record.generatorVersion ===
      envelope.command.proposal.provenance.generatorVersion &&
    record.rulesetVersion === envelope.command.input.rulesetVersion &&
    record.rulesetVersion ===
      envelope.command.proposal.provenance.rulesetVersion &&
    record.generatedPlanSchemaVersion === envelope.command.proposal.schemaVersion &&
    record.resultSchemaVersion === PLAN_GENERATION_RESULT_SCHEMA_VERSION
  )
}

export function evaluatePlanApprovalArtifactPolicy(
  envelope: PlanApprovalCommandEnvelope,
  context: PlanApprovalArtifactPolicyContext,
): PlanApprovalArtifactPolicyDecision {
  const supportedScopeId = context.supportedScopeId
  const commandUsesDraftArtifact =
    isDraftArtifactVersion(
      envelope.command.proposal.provenance.generatorVersion,
    ) || isDraftArtifactVersion(envelope.command.input.rulesetVersion)
  if (
    supportedScopeId === null ||
    !scopeIdPattern.test(supportedScopeId)
  ) {
    return { allowed: false }
  }

  const exactMatches = context.records.filter((record) =>
    matchesCommand(record, envelope, supportedScopeId),
  )
  if (exactMatches.length !== 1) {
    return { allowed: false }
  }

  const record = exactMatches[0]
  if (record?.reviewState === 'approved' && !commandUsesDraftArtifact) {
    return { allowed: true, record }
  }
  if (
    record?.reviewState === 'provisional_dogfood' &&
    context.allowProvisionalDogfood === true &&
    commandUsesDraftArtifact
  ) {
    return { allowed: true, record }
  }

  return { allowed: false }
}
