import {
  CLOSED_BETA_GUIDANCE_RESULT_SCHEMA_VERSION,
  CLOSED_BETA_GUIDANCE_SAFETY_STATES,
  type ClosedBetaGuidanceResult,
  type DismissClosedBetaGuidanceRequest,
  type GetClosedBetaGuidanceRequest,
} from '../../src/domain/guidance/closedBetaGuidance.js'
import {
  GUIDANCE_ITEM_SCHEMA_VERSION,
  createGuidanceArtifactVersion,
  createGuidanceItemId,
  createGuidanceTriggerCode,
  type GuidanceItemV1,
} from '../../src/domain/guidance/guidance.js'
import { foundingBetaGuidanceManifest } from '../../src/domain/guidance/foundingBetaGuidanceManifest.js'
import {
  SAFETY_ESCALATION_INPUT_SCHEMA_VERSION,
  createSafetyArtifactVersion,
  evaluateSafetyEscalation,
  type SafetyEmergencySignal,
  type SafetyEscalationRulesV1,
} from '../../src/domain/safety/safetyEscalation.js'
import type { ClosedBetaMethodologyEligibilityDecision } from './closedBetaMethodologyEligibility.js'

const resultSchemaVersion = CLOSED_BETA_GUIDANCE_RESULT_SCHEMA_VERSION
const safetySignals: readonly SafetyEmergencySignal[] = [
  'chest_pressure_or_pain',
  'severe_or_sudden_breathing_trouble',
  'fainting_or_loss_of_consciousness',
  'new_confusion_or_slurred_speech',
  'stroke_warning_sign',
  'heat_illness_emergency_sign',
]

export interface ClosedBetaGuidanceCaller {
  readonly ownerId: string | null
  readonly appCheckVerified: boolean
}

export interface ClosedBetaGuidanceStore {
  present(options: {
    readonly ownerId: string
    readonly candidates: readonly GuidanceItemV1[]
    readonly activeTriggerCodes: readonly string[]
    readonly provisionalArtifactVersion: string
    readonly now: string
  }): Promise<
    | { readonly kind: 'available'; readonly item: GuidanceItemV1; readonly presentationId: string }
    | { readonly kind: 'none' }
    | { readonly kind: 'disabled' }
  >
  dismiss(options: {
    readonly ownerId: string
    readonly presentationId: string
    readonly artifactVersion: string
    readonly now: string
  }): Promise<'dismissed' | 'not_found' | 'version_mismatch' | 'not_dismissible'>
}

interface Dependencies {
  readonly projectId: string
  readonly guidanceArtifactVersion: string
  readonly safetyArtifact: SafetyEscalationRulesV1
  readonly eligibility: {
    evaluate(request: {
      readonly ownerId: string | null
      readonly projectId: string
      readonly capability: 'guidance' | 'safety'
      readonly serverArtifactVersion: string
      readonly inputDisposition: 'supported' | 'symptom_escalation'
    }): Promise<ClosedBetaMethodologyEligibilityDecision>
  }
  readonly store: ClosedBetaGuidanceStore
  readonly now: () => Date
}

function boundary(
  caller: ClosedBetaGuidanceCaller,
): ClosedBetaGuidanceResult | null {
  if (caller.ownerId === null || caller.ownerId.trim().length === 0) {
    return { schemaVersion: resultSchemaVersion, status: 'authorization_error', code: 'sign-in-required' }
  }
  if (!caller.appCheckVerified) {
    return { schemaVersion: resultSchemaVersion, status: 'authorization_error', code: 'app-check-required' }
  }
  return null
}

function resultFromEligibility(
  decision: ClosedBetaMethodologyEligibilityDecision,
): ClosedBetaGuidanceResult | null {
  if (decision.status === 'allowed') return null
  if (decision.status === 'stale_version') {
    return { schemaVersion: resultSchemaVersion, status: 'stale_version', code: decision.code }
  }
  if (decision.status === 'unavailable') {
    return { schemaVersion: resultSchemaVersion, status: 'unavailable', code: decision.code }
  }
  const code =
    decision.code === 'authentication-required'
      ? 'sign-in-required'
      : decision.code === 'closed-beta-access-required'
        ? 'approved-beta-membership-required'
        : decision.code === 'closed-beta-methodology-consent-required'
          ? 'methodology-consent-required'
          : decision.code
  return code === 'closed-beta-methodology-disabled'
    ? { schemaVersion: resultSchemaVersion, status: 'none', reason: 'guidance_disabled' }
    : { schemaVersion: resultSchemaVersion, status: 'authorization_error', code: code as 'sign-in-required' | 'approved-beta-membership-required' | 'methodology-consent-required' }
}

function parseGetRequest(value: unknown): GetClosedBetaGuidanceRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  if (
    keys.join('|') !==
      ['activeTriggerCodes', 'emergencySignals', 'otherConcerningOrPersistentSymptoms', 'safetyState'].sort().join('|') ||
    !Array.isArray(record.activeTriggerCodes) ||
    record.activeTriggerCodes.length > 10 ||
    !record.activeTriggerCodes.every((entry) => typeof entry === 'string') ||
    !CLOSED_BETA_GUIDANCE_SAFETY_STATES.includes(record.safetyState as never) ||
    !Array.isArray(record.emergencySignals) ||
    !record.emergencySignals.every((entry) => safetySignals.includes(entry as SafetyEmergencySignal)) ||
    typeof record.otherConcerningOrPersistentSymptoms !== 'boolean'
  ) return null
  const knownTriggers = new Set(
    foundingBetaGuidanceManifest.flatMap((item) => item.triggers.map(({ code }) => code)),
  )
  if (!record.activeTriggerCodes.every((code) => knownTriggers.has(code as never))) return null
  return record as unknown as GetClosedBetaGuidanceRequest
}

function parseDismissRequest(value: unknown): DismissClosedBetaGuidanceRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  if (
    keys.join('|') !== ['artifactVersion', 'presentationId'].sort().join('|') ||
    typeof record.presentationId !== 'string' ||
    record.presentationId.length === 0 ||
    typeof record.artifactVersion !== 'string' ||
    record.artifactVersion.length === 0
  ) return null
  return record as unknown as DismissClosedBetaGuidanceRequest
}

function safetyGuidanceItem(
  request: GetClosedBetaGuidanceRequest,
  rules: SafetyEscalationRulesV1,
): GuidanceItemV1 {
  const outcome = evaluateSafetyEscalation(
    {
      schemaVersion: SAFETY_ESCALATION_INPUT_SCHEMA_VERSION,
      artifactVersion: createSafetyArtifactVersion(String(rules.artifactVersion)),
      reportState: request.safetyState,
      emergencySignals: request.emergencySignals as readonly SafetyEmergencySignal[],
      otherConcerningOrPersistentSymptoms:
        request.otherConcerningOrPersistentSymptoms,
    },
    rules,
  )
  const artifactVersion = createGuidanceArtifactVersion(String(rules.artifactVersion))
  return {
    schemaVersion: GUIDANCE_ITEM_SCHEMA_VERSION,
    id: createGuidanceItemId('founding-beta.pain-escalation'),
    contentVersion: artifactVersion,
    topic: 'pain_escalation',
    title:
      outcome.kind === 'emergency'
        ? 'Stop and call 911 now'
        : outcome.kind === 'qualified_help'
          ? 'Stop and seek qualified medical advice'
          : 'Training guidance is withheld',
    body: outcome.message,
    limitations: outcome.limitations,
    contentOwner: 'Marathoner product and claims owner',
    correctionOwner: 'Marathoner product and claims owner',
    correctionChannel: 'Repository issue #134',
    requiredReviewerRoles: ['clinical_safety'],
    reviewState: 'draft',
    publicationState: 'disabled',
    triggers: [
      {
        code: createGuidanceTriggerCode('PAIN-OR-UNUSUAL-SYMPTOM-REPORTED'),
        event: 'safety_signal_reported',
      },
    ],
    suppression: {
      cooldownHours: 0,
      maxPresentationsPerVersion: 1,
      dismissesVersion: false,
    },
  }
}

const contextLabels: Readonly<Record<GuidanceItemV1['topic'], string>> = {
  easy_effort: 'Before an easy workout',
  shoes: 'After adding running shoes',
  fueling: 'Before a longer workout',
  hydration: 'Before a longer workout',
  sleep: 'At the start of a training week',
  recovery: 'After a repeated run pattern',
  pain_escalation: 'Pain or unusual symptoms reported',
  plan_change: 'Before reviewing a plan change',
  limitations: 'While reviewing your plan',
  unsupported_case: 'When Marathoner cannot support a result',
}

export async function getClosedBetaGuidance(
  caller: ClosedBetaGuidanceCaller,
  data: unknown,
  dependencies: Dependencies,
): Promise<ClosedBetaGuidanceResult> {
  const boundaryResult = boundary(caller)
  if (boundaryResult !== null) return boundaryResult
  const request = parseGetRequest(data)
  if (request === null) {
    return { schemaVersion: resultSchemaVersion, status: 'validation_error', code: 'invalid-guidance-request' }
  }
  const ownerId = caller.ownerId
  if (ownerId === null) throw new Error('The guidance boundary did not narrow the owner.')
  const safetyActive =
    request.safetyState !== 'none_reported' ||
    request.emergencySignals.length > 0 ||
    request.otherConcerningOrPersistentSymptoms
  const capability = safetyActive ? 'safety' : 'guidance'
  const artifactVersion = safetyActive
    ? String(dependencies.safetyArtifact.artifactVersion)
    : dependencies.guidanceArtifactVersion
  const eligibilityResult = resultFromEligibility(
    await dependencies.eligibility.evaluate({
      ownerId,
      projectId: dependencies.projectId,
      capability,
      serverArtifactVersion: artifactVersion,
      inputDisposition: safetyActive ? 'symptom_escalation' : 'supported',
    }),
  )
  if (eligibilityResult !== null) return eligibilityResult

  const candidates = safetyActive
    ? [safetyGuidanceItem(request, dependencies.safetyArtifact)]
    : foundingBetaGuidanceManifest.filter((item) => item.topic !== 'pain_escalation')
  const activeTriggerCodes = safetyActive
    ? ['PAIN-OR-UNUSUAL-SYMPTOM-REPORTED']
    : request.activeTriggerCodes
  const result = await dependencies.store.present({
    ownerId,
    candidates,
    activeTriggerCodes,
    provisionalArtifactVersion: artifactVersion,
    now: dependencies.now().toISOString(),
  })
  if (result.kind !== 'available') {
    return {
      schemaVersion: resultSchemaVersion,
      status: 'none',
      reason: result.kind === 'disabled' ? 'guidance_disabled' : 'suppressed',
    }
  }
  return {
    schemaVersion: resultSchemaVersion,
    status: 'available',
    presentation: {
      presentationId: result.presentationId,
      artifactVersion: String(result.item.contentVersion),
      kind: safetyActive ? 'safety' : 'guidance',
      title: result.item.title,
      message: result.item.body,
      limitations: result.item.limitations,
      contextLabel: contextLabels[result.item.topic],
      dismissible: result.item.suppression.dismissesVersion,
    },
  }
}

export async function dismissClosedBetaGuidance(
  caller: ClosedBetaGuidanceCaller,
  data: unknown,
  dependencies: Dependencies,
): Promise<ClosedBetaGuidanceResult> {
  const boundaryResult = boundary(caller)
  if (boundaryResult !== null) return boundaryResult
  const request = parseDismissRequest(data)
  if (request === null) {
    return { schemaVersion: resultSchemaVersion, status: 'validation_error', code: 'invalid-guidance-dismissal' }
  }
  const ownerId = caller.ownerId
  if (ownerId === null) throw new Error('The guidance boundary did not narrow the owner.')
  const capability = request.artifactVersion.startsWith('beta-safety@')
    ? 'safety'
    : 'guidance'
  const eligibilityResult = resultFromEligibility(
    await dependencies.eligibility.evaluate({
      ownerId,
      projectId: dependencies.projectId,
      capability,
      serverArtifactVersion: request.artifactVersion,
      inputDisposition: capability === 'safety' ? 'symptom_escalation' : 'supported',
    }),
  )
  if (eligibilityResult !== null) return eligibilityResult
  const result = await dependencies.store.dismiss({
    ownerId,
    presentationId: request.presentationId,
    artifactVersion: request.artifactVersion,
    now: dependencies.now().toISOString(),
  })
  return result === 'dismissed'
    ? {
        schemaVersion: resultSchemaVersion,
        status: 'dismissed',
        presentationId: request.presentationId,
      }
    : {
        schemaVersion: resultSchemaVersion,
        status: 'validation_error',
        code: `guidance-${result.replaceAll('_', '-')}`,
      }
}
