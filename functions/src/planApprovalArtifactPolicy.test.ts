import { describe, expect, it } from 'vitest'

import { createPlanApprovalCommand } from '../../src/domain/materialCommands/contract.js'
import {
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  createPlanGenerationArtifactVersion,
  planGenerationContractFixtures,
} from '../../src/domain/training/index.js'
import {
  DEVELOPMENT_DOGFOOD_PLAN_APPROVAL_ARTIFACT_POLICY,
  DEVELOPMENT_DOGFOOD_PLAN_SCOPE_ID,
  evaluatePlanApprovalArtifactPolicy,
  PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY,
  selectLivePlanApprovalArtifactPolicy,
  type PlanApprovalArtifactPolicyRecord,
  type PlanApprovalArtifactReviewState,
} from './planApprovalArtifactPolicy.js'

const commandId = 'approve-plan-policy-0001'
const supportedScopeId = 'synthetic-consistent-runner@1'
const generatedFixture = planGenerationContractFixtures.find(
  (fixture) => fixture.id === 'generated-exact-date-distance-target',
)
if (generatedFixture?.result.kind !== 'generated') {
  throw new Error('Expected the generated plan contract fixture.')
}

const command = createPlanApprovalCommand(commandId, {
  expectedActivePlanRevision: null,
  input: generatedFixture.input,
  proposal: generatedFixture.result.plan,
})

function policyRecord(
  reviewState: PlanApprovalArtifactReviewState = 'approved',
): PlanApprovalArtifactPolicyRecord {
  return {
    supportedScopeId,
    inputSchemaVersion: command.command.input.schemaVersion,
    generatorVersion: command.command.proposal.provenance.generatorVersion,
    rulesetVersion: command.command.input.rulesetVersion,
    generatedPlanSchemaVersion: command.command.proposal.schemaVersion,
    resultSchemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
    reviewState,
  }
}

function evaluate(
  records: readonly PlanApprovalArtifactPolicyRecord[],
  scopeId: string | null = supportedScopeId,
  allowProvisionalDogfood = false,
) {
  return evaluatePlanApprovalArtifactPolicy(command, {
    allowProvisionalDogfood,
    records,
    supportedScopeId: scopeId,
  })
}

describe('plan-approval artifact policy', () => {
  it('pins one provisional tuple for the closed development dogfood scope', () => {
    expect(DEVELOPMENT_DOGFOOD_PLAN_APPROVAL_ARTIFACT_POLICY).toEqual([
      expect.objectContaining({
        supportedScopeId: DEVELOPMENT_DOGFOOD_PLAN_SCOPE_ID,
        generatorVersion: 'deterministic-plan-generator@1.0.0',
        rulesetVersion: 'beta-rules@0.2.0-draft',
        reviewState: 'provisional_dogfood',
      }),
    ])
  })

  it('installs provisional rules only for the enabled development Functions project', () => {
    expect(
      selectLivePlanApprovalArtifactPolicy({
        projectId: 'marathoner-d9bf9',
        provisionalDogfoodEnabled: true,
      }),
    ).toEqual({
      allowProvisionalDogfood: true,
      records: DEVELOPMENT_DOGFOOD_PLAN_APPROVAL_ARTIFACT_POLICY,
      supportedScopeId: DEVELOPMENT_DOGFOOD_PLAN_SCOPE_ID,
    })

    for (const options of [
      {
        projectId: 'marathoner-d9bf9',
        provisionalDogfoodEnabled: false,
      },
      {
        projectId: 'marathonerapp-beta',
        provisionalDogfoodEnabled: true,
      },
      { projectId: 'unknown-project', provisionalDogfoodEnabled: true },
    ]) {
      expect(selectLivePlanApprovalArtifactPolicy(options)).toEqual({
        allowProvisionalDogfood: false,
        records: PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY,
        supportedScopeId: null,
      })
    }
  })

  it('allows one exact approved tuple for one exact server-provided scope', () => {
    const record = policyRecord()

    expect(evaluate([record])).toEqual({ allowed: true, record })
  })

  it('keeps the production registry empty and rejects every proposal', () => {
    expect(PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY).toEqual([])
    expect(evaluate(PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY)).toEqual({
      allowed: false,
    })
  })

  it.each<PlanApprovalArtifactReviewState>([
    'missing',
    'draft',
    'ready_for_review',
    'conditional',
    'provisional_dogfood',
    'rejected',
    'retired',
  ])('rejects an exact tuple in the %s review state', (reviewState) => {
    expect(evaluate([policyRecord(reviewState)])).toEqual({ allowed: false })
  })

  it.each([
    ['supportedScopeId', 'another-scope@1'],
    ['inputSchemaVersion', 'plan-generation-input@999'],
    ['generatorVersion', 'fixture-generator@999.0.0'],
    ['rulesetVersion', 'fixture-rules@999.0.0'],
    ['generatedPlanSchemaVersion', 'generated-plan@999'],
    ['resultSchemaVersion', 'plan-generation-result@999'],
  ] satisfies ReadonlyArray<
    readonly [keyof PlanApprovalArtifactPolicyRecord, string]
  >)('rejects a %s mismatch', (field, value) => {
    expect(evaluate([{ ...policyRecord(), [field]: value }])).toEqual({
      allowed: false,
    })
  })

  it('rejects an unknown tuple, missing scope, malformed scope, and ambiguous duplicate', () => {
    const record = policyRecord()

    expect(evaluate([])).toEqual({ allowed: false })
    expect(evaluate([record], null)).toEqual({ allowed: false })
    expect(evaluate([record], 'not versioned')).toEqual({ allowed: false })
    expect(evaluate([record, { ...record }])).toEqual({ allowed: false })
  })

  it.each(['generator', 'ruleset'])('rejects an approved tuple with a draft %s version', (field) => {
    const draftVersion = createPlanGenerationArtifactVersion(
      `fixture-${field}@1.0.0-draft`,
    )
    const draftInput =
      field === 'ruleset'
        ? { ...command.command.input, rulesetVersion: draftVersion }
        : command.command.input
    const draftProposal = {
      ...command.command.proposal,
      provenance: {
        ...command.command.proposal.provenance,
        generatorVersion:
          field === 'generator'
            ? draftVersion
            : command.command.proposal.provenance.generatorVersion,
        rulesetVersion:
          field === 'ruleset'
            ? draftVersion
            : command.command.proposal.provenance.rulesetVersion,
      },
    }
    const draftCommand = createPlanApprovalCommand(
      `approve-draft-${field}-0001`,
      {
        expectedActivePlanRevision: null,
        input: draftInput,
        proposal: draftProposal,
      },
    )
    const approvedDraftRecord: PlanApprovalArtifactPolicyRecord = {
      ...policyRecord(),
      generatorVersion: draftCommand.command.proposal.provenance.generatorVersion,
      rulesetVersion: draftCommand.command.input.rulesetVersion,
    }

    expect(
      evaluatePlanApprovalArtifactPolicy(draftCommand, {
        records: [approvedDraftRecord],
        supportedScopeId,
      }),
    ).toEqual({ allowed: false })
  })

  it('allows one exact draft only when the server installs the provisional dogfood policy', () => {
    const draftRulesetVersion = createPlanGenerationArtifactVersion(
      'fixture-rules@1.0.0-draft',
    )
    const draftCommand = createPlanApprovalCommand(
      'approve-provisional-dogfood-0001',
      {
        expectedActivePlanRevision: null,
        input: {
          ...command.command.input,
          rulesetVersion: draftRulesetVersion,
        },
        proposal: {
          ...command.command.proposal,
          provenance: {
            ...command.command.proposal.provenance,
            rulesetVersion: draftRulesetVersion,
          },
        },
      },
    )
    const record: PlanApprovalArtifactPolicyRecord = {
      ...policyRecord('provisional_dogfood'),
      rulesetVersion: draftRulesetVersion,
    }

    expect(
      evaluatePlanApprovalArtifactPolicy(draftCommand, {
        records: [record],
        supportedScopeId,
      }),
    ).toEqual({ allowed: false })
    expect(
      evaluatePlanApprovalArtifactPolicy(draftCommand, {
        allowProvisionalDogfood: true,
        records: [record],
        supportedScopeId,
      }),
    ).toEqual({ allowed: true, record })
  })
})
