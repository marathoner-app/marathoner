import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  parsePinnedDraftAdaptationRuleSet,
  parsePinnedDraftPlanRuleSet,
  type DraftAdaptationRuleSet,
  type DraftPlanRuleSet,
} from '../../src/domain/training/pinnedDraftMethodology.js'

export interface PinnedInternalAdaptationArtifacts {
  readonly adaptation: DraftAdaptationRuleSet
  readonly basePlan: DraftPlanRuleSet
}

function artifactPath(fileName: string, workspacePath: string): string {
  const sourceDirectory = dirname(fileURLToPath(import.meta.url))
  const bundled = resolve(sourceDirectory, '..', 'artifacts', fileName)
  return existsSync(bundled)
    ? bundled
    : resolve(
        sourceDirectory,
        '..',
        '..',
        'docs',
        'methodology',
        'artifacts',
        workspacePath,
      )
}

export function loadPinnedInternalAdaptationArtifacts(): PinnedInternalAdaptationArtifacts {
  const basePlan = parsePinnedDraftPlanRuleSet(
    readFileSync(
      artifactPath(
        'beta-rules.json',
        'beta-rules/0.2.0-draft/beta-rules.json',
      ),
      'utf8',
    ),
  )
  const adaptation = parsePinnedDraftAdaptationRuleSet(
    readFileSync(
      artifactPath(
        'beta-adaptation.json',
        'beta-adaptation/0.2.0-draft/beta-adaptation.json',
      ),
      'utf8',
    ),
  )

  if (
    String(adaptation.rules.basePlanArtifactVersion) !==
    String(basePlan.rules.rulesetVersion)
  ) {
    throw new Error(
      'The pinned adaptation artifact does not target the pinned base-plan artifact.',
    )
  }

  return { adaptation, basePlan }
}
