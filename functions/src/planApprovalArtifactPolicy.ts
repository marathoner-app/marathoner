import type { PlanApprovalCommandEnvelope } from '../../src/domain/materialCommands/contract.js'
import { PLAN_GENERATION_RESULT_SCHEMA_VERSION } from '../../src/domain/training/planGeneration.js'

export const PLAN_APPROVAL_ARTIFACT_REVIEW_STATES = [
  'missing',
  'draft',
  'ready_for_review',
  'approved',
  'conditional',
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
  if (
    supportedScopeId === null ||
    !scopeIdPattern.test(supportedScopeId) ||
    isDraftArtifactVersion(
      envelope.command.proposal.provenance.generatorVersion,
    ) ||
    isDraftArtifactVersion(envelope.command.input.rulesetVersion)
  ) {
    return { allowed: false }
  }

  const exactMatches = context.records.filter((record) =>
    matchesCommand(record, envelope, supportedScopeId),
  )
  if (exactMatches.length !== 1 || exactMatches[0]?.reviewState !== 'approved') {
    return { allowed: false }
  }

  return { allowed: true, record: exactMatches[0] }
}
