import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const packetDirectory = join(
  repositoryRoot,
  'docs/methodology/artifacts/beta-adaptation/0.2.0-draft',
);

async function readJson(fileName) {
  return JSON.parse(await readFile(join(packetDirectory, fileName), 'utf8'));
}

function deepMerge(base, changes) {
  if (
    base === null ||
    changes === null ||
    Array.isArray(base) ||
    Array.isArray(changes) ||
    typeof base !== 'object' ||
    typeof changes !== 'object'
  ) {
    return changes;
  }

  return Object.fromEntries(
    [...new Set([...Object.keys(base), ...Object.keys(changes)])].map((key) => [
      key,
      key in changes ? deepMerge(base[key], changes[key]) : base[key],
    ]),
  );
}

function evaluate(input, rules) {
  const outcomes = new Map(
    rules.outcomes.map((outcome) => [outcome.decision, outcome]),
  );
  const choose = (decision) => {
    const outcome = outcomes.get(decision);
    return {
      kind: outcome.kind,
      action: outcome.action,
      reasonCode: outcome.reasonCode,
      runnerApprovalRequired: outcome.runnerApprovalRequired,
    };
  };
  const hardValues = new Set(rules.inputContract.recentEffortWindow.hardValues);
  const hardEfforts = input.recentEfforts.filter((effort) =>
    hardValues.has(effort),
  ).length;
  const skippedRuns = input.currentWeek.skippedRunCount;
  const pendingRuns = input.currentWeek.pendingRunCount;
  const thresholds = rules.thresholds;

  if (
    input.basePlanArtifactVersion !== rules.basePlanArtifactVersion ||
    input.adaptationArtifactVersion !== rules.artifactVersion
  ) {
    return choose('refuse_unsupported_ruleset');
  }
  if (input.safetyGateState !== rules.scope.safetyGate.requiredState) {
    return choose('refuse_safety_gate');
  }
  if (input.evaluatedPlanRevision !== input.activePlanRevision) {
    return choose('refuse_stale_plan');
  }
  if (
    !input.inputCompletenessConfirmed ||
    input.activePlanStatus !== rules.scope.supportedPlanStatus ||
    input.currentCoreWeek < rules.scope.supportedCoreWeeks.minimum ||
    input.currentCoreWeek > rules.scope.supportedCoreWeeks.maximum ||
    input.currentWeek.plannedRunCount !== rules.inputContract.weekEvidence.plannedRunCount ||
    input.currentWeek.completedRunCount + skippedRuns + pendingRuns !==
      input.currentWeek.plannedRunCount
  ) {
    return choose('refuse_incomplete_evidence');
  }
  if (input.daysSinceLastCompletedPlannedRun >= thresholds.longDisruptionDays) {
    return choose('refuse_long_disruption');
  }
  if (skippedRuns > thresholds.maximumMissedRunsForAutomaticDecision) {
    return choose('refuse_excessive_disruption');
  }
  if (
    skippedRuns === thresholds.missedRunsForRepeat &&
    input.daysUntilRace < thresholds.minimumDaysUntilRaceForRepeat
  ) {
    return choose('refuse_late_disruption');
  }
  if (skippedRuns > 0 && hardEfforts >= thresholds.minimumHardEffortsForHold) {
    return choose('refuse_conflicting_signals');
  }
  if (
    skippedRuns === thresholds.missedRunsForRepeat &&
    pendingRuns === 0 &&
    thresholds.repeatEligibleCurrentWeekKinds.includes(input.currentWeekKind) &&
    thresholds.repeatEligibleNextWeekKinds.includes(input.nextWeekKind) &&
    input.daysUntilRace >= thresholds.minimumDaysUntilRaceForRepeat
  ) {
    return choose('repeat_period');
  }
  if (
    skippedRuns === 0 &&
    input.recentEfforts.length === thresholds.requiredRecordedEffortsForHold &&
    hardEfforts >= thresholds.minimumHardEffortsForHold &&
    input.nextWeekIntroducesProgression &&
    thresholds.holdEligibleNextWeekKinds.includes(input.nextWeekKind) &&
    input.daysUntilRace >= thresholds.minimumDaysUntilRaceForHold
  ) {
    return choose('hold_progression');
  }

  const candidate = input.rescheduleCandidate;
  const rescheduleAllowed =
    skippedRuns === 1 &&
    candidate.present &&
    rules.inputContract.rescheduleCandidate.allowedPurposes.includes(
      candidate.workoutPurpose,
    ) &&
    candidate.delayCalendarDays <= thresholds.maximumRescheduleDelayDays &&
    candidate.samePlanWeek &&
    candidate.runnerConfirmedAvailable &&
    candidate.targetDateEmpty &&
    candidate.consecutiveRunDatesAfterMove <=
      thresholds.maximumConsecutiveRunDatesAfterReschedule &&
    input.daysUntilRace >= thresholds.minimumDaysUntilRaceForReschedule &&
    !thresholds.protectedRecoveryWeekKinds.includes(input.nextWeekKind);
  if (rescheduleAllowed) return choose('reschedule');

  if (
    (hardEfforts >= thresholds.minimumHardEffortsForHold || skippedRuns > 0) &&
    thresholds.protectedRecoveryWeekKinds.includes(input.nextWeekKind)
  ) {
    return choose('no_change_recovery_already_scheduled');
  }
  if (
    skippedRuns === 0 &&
    input.recentEfforts.length < thresholds.requiredRecordedEffortsForHold
  ) {
    return choose('no_change_insufficient_pattern');
  }
  if (skippedRuns === 0 && hardEfforts === 1) {
    return choose('no_change_single_hard_effort');
  }
  if (skippedRuns === thresholds.missedRunsForRepeat && pendingRuns > 0) {
    return choose('no_change_wait_for_week_completion');
  }
  if (skippedRuns > 0) return choose('no_change_do_not_stack');
  return choose('no_change_on_track');
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(path)));
    else if (
      !entry.name.includes('.test.') &&
      ['.js', '.mjs', '.ts', '.tsx'].includes(extname(entry.name))
    ) {
      files.push(path);
    }
  }

  return files;
}

describe('founding-beta adaptation review packet', () => {
  it('is exact, visibly draft, and limited to adaptation inventory rows', async () => {
    const rules = await readJson('beta-adaptation.json');

    expect(rules).toMatchObject({
      schemaVersion: 'beta-adaptation-review-packet@1',
      artifactVersion: 'beta-adaptation@0.2.0-draft',
      status: 'draft_not_approved',
      runtimeUseAllowed: false,
      requiredReviewerRole: 'EMR',
      basePlanArtifactVersion: 'beta-rules@0.2.0-draft',
      reviewState: {
        submitted: false,
        decision: 'pending',
        approvedArtifactVersion: null,
      },
    });
    expect(rules.inventoryIds).toEqual([
      'ADAPT-001',
      'ADAPT-002',
      'ADAPT-003',
      'ADAPT-004',
    ]);
    expect(rules.sources).toHaveLength(5);
    expect(rules.productJudgmentsRequiringReview).not.toHaveLength(0);
  });

  it('defines one stable reason code and explanation key per outcome', async () => {
    const rules = await readJson('beta-adaptation.json');
    const reasonCodes = rules.outcomes.map(({ reasonCode }) => reasonCode);
    const explanationKeys = rules.outcomes.map(
      ({ explanationKey }) => explanationKey,
    );

    expect(rules.decisionOrder).toEqual(
      rules.outcomes.map(({ decision }) => decision),
    );
    expect(rules.decisionOrder).toHaveLength(rules.outcomes.length);
    expect(new Set(reasonCodes).size).toBe(reasonCodes.length);
    expect(new Set(explanationKeys).size).toBe(explanationKeys.length);
    expect(
      reasonCodes.every((code) => /^ADAPT-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)),
    ).toBe(true);
    expect(
      rules.outcomes.every(({ inventoryId }) =>
        rules.inventoryIds.includes(inventoryId),
      ),
    ).toBe(true);
  });

  it('evaluates every representative fixture to the frozen outcome', async () => {
    const [rules, fixtures] = await Promise.all([
      readJson('beta-adaptation.json'),
      readJson('fixtures.json'),
    ]);

    expect(fixtures).toMatchObject({
      schemaVersion: 'beta-adaptation-fixtures@1',
      artifactVersion: rules.artifactVersion,
      status: 'draft_not_approved',
    });
    expect(fixtures.cases.length).toBeGreaterThanOrEqual(18);

    for (const fixture of fixtures.cases) {
      expect(
        evaluate(deepMerge(fixtures.defaults, fixture.changes), rules),
        fixture.id,
      ).toEqual(fixture.expected);
    }
  });

  it('never turns one hard effort into a material recommendation', async () => {
    const [rules, fixtures] = await Promise.all([
      readJson('beta-adaptation.json'),
      readJson('fixtures.json'),
    ]);
    const values = rules.inputContract.recentEffortWindow.hardValues;

    for (const hardValue of values) {
      for (let index = 0; index < 4; index += 1) {
        const input = structuredClone(fixtures.defaults);
        input.recentEfforts[index] = hardValue;
        expect(evaluate(input, rules)).toMatchObject({
          kind: 'no_change',
          action: 'no_change',
          reasonCode: 'ADAPT-NO-CHANGE-SINGLE-HARD-EFFORT',
          runnerApprovalRequired: false,
        });
      }
    }
  });

  it('requires runner approval for every proposed plan mutation', async () => {
    const rules = await readJson('beta-adaptation.json');
    const recommendations = rules.outcomes.filter(
      ({ kind }) => kind === 'recommendation',
    );

    expect(recommendations.map(({ action }) => action)).toEqual([
      'repeat_period',
      'hold_progression',
      'reschedule',
    ]);
    expect(
      recommendations.every(
        ({ runnerApprovalRequired, planMutation }) =>
          runnerApprovalRequired && planMutation !== null,
      ),
    ).toBe(true);
    expect(
      rules.outcomes
        .filter(({ kind }) => kind !== 'recommendation')
        .every(
          ({ runnerApprovalRequired, planMutation }) =>
            !runnerApprovalRequired && planMutation === null,
        ),
    ).toBe(true);
    expect(rules.scope.autonomousPlanMutationAllowed).toBe(false);
    expect(rules.scope.raceDateMayChange).toBe(false);
    expect(rules.scope.laterWeeksMayShift).toBe(false);
  });

  it('pins every file in the artifact-local checksum manifest', async () => {
    const checksumLines = (
      await readFile(join(packetDirectory, 'SHA256SUMS'), 'utf8')
    )
      .trim()
      .split('\n');

    expect(checksumLines).toHaveLength(3);
    for (const line of checksumLines) {
      const [expectedDigest, fileName] = line.split(/\s+/);
      const actualDigest = createHash('sha256')
        .update(await readFile(join(packetDirectory, fileName)))
        .digest('hex');
      expect(actualDigest, fileName).toBe(expectedDigest);
    }
  });

  it('keeps the draft artifact out of runtime source', async () => {
    const runtimeDirectories = ['src', 'functions/src', 'packages'].map((path) =>
      join(repositoryRoot, path),
    );
    const sourceFiles = (
      await Promise.all(runtimeDirectories.map(collectSourceFiles))
    ).flat();

    for (const path of sourceFiles) {
      const source = await readFile(path, 'utf8');
      expect(source, path).not.toContain('beta-adaptation@0.2.0-draft');
      expect(source, path).not.toContain(
        'docs/methodology/artifacts/beta-adaptation',
      );
    }
  });

  it('keeps the reviewer workbook aligned with the exact draft thresholds', async () => {
    const rules = await readJson('beta-adaptation.json');
    const workbook = await readFile(
      join(repositoryRoot, 'docs/methodology/endurance-reviewer-workbook.md'),
      'utf8',
    );

    expect(workbook).toContain('## Proposed adaptation rules');
    expect(workbook).toContain(
      `previous ${rules.thresholds.effortLookbackDays} days`,
    );
    expect(rules.thresholds.minimumHardEffortsForHold).toBe(2);
    expect(workbook).toMatch(/at least\s+two of those four/);
    expect(workbook).toContain(
      `${rules.thresholds.minimumDaysUntilRaceForRepeat} days remain before the race`,
    );
    expect(workbook).toContain(
      `${rules.thresholds.minimumDaysUntilRaceForHold} days remain before the race`,
    );
    expect(workbook).toContain(
      `at least ${rules.thresholds.minimumDaysUntilRaceForReschedule} days remain before the race`,
    );
    expect(rules.thresholds.longDisruptionDays).toBe(7);
    expect(workbook).toContain('seven days without a completed planned run');
  });
});
