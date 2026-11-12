import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createSafetyArtifactVersion,
  type SafetyEscalationOutcomeV1,
  type SafetyEscalationResultKind,
  type SafetyEscalationRulesV1,
} from '../../src/domain/safety/safetyEscalation.js'

interface SafetyArtifactDocument {
  readonly artifactVersion: string
  readonly status: string
  readonly outcomes: readonly SafetyEscalationOutcomeV1[]
}

function artifactPath(): string {
  const sourceDirectory = dirname(fileURLToPath(import.meta.url))
  const bundled = resolve(sourceDirectory, '..', 'artifacts', 'beta-safety.json')
  return existsSync(bundled)
    ? bundled
    : resolve(
        sourceDirectory,
        '..',
        '..',
        'docs',
        'methodology',
        'artifacts',
        'beta-safety',
        '0.1.0-draft',
        'beta-safety.json',
      )
}

export function loadPinnedClosedBetaSafetyArtifact(): SafetyEscalationRulesV1 {
  const parsed = JSON.parse(readFileSync(artifactPath(), 'utf8')) as SafetyArtifactDocument
  if (
    parsed.artifactVersion !== 'beta-safety@0.1.0-draft' ||
    parsed.status !== 'draft_not_approved' ||
    !Array.isArray(parsed.outcomes)
  ) {
    throw new Error('The pinned closed-beta safety artifact is unavailable.')
  }
  const outcomes = Object.fromEntries(
    parsed.outcomes.map((outcome) => [outcome.kind, outcome]),
  ) as Partial<Record<SafetyEscalationResultKind, SafetyEscalationOutcomeV1>>
  const requiredKinds: readonly SafetyEscalationResultKind[] = [
    'no_escalation',
    'emergency',
    'qualified_help',
    'insufficient_information',
  ]
  if (requiredKinds.some((kind) => outcomes[kind] === undefined)) {
    throw new Error('The pinned closed-beta safety artifact is incomplete.')
  }
  return {
    artifactVersion: createSafetyArtifactVersion(parsed.artifactVersion),
    outcomes: outcomes as Record<SafetyEscalationResultKind, SafetyEscalationOutcomeV1>,
  }
}
