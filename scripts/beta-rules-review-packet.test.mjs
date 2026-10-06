import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const packetDirectory = join(
  repositoryRoot,
  'docs/methodology/artifacts/beta-rules/0.1.0-draft',
)

async function readJson(fileName) {
  return JSON.parse(await readFile(join(packetDirectory, fileName), 'utf8'))
}

function evaluateFixture(defaults, fixture, rules) {
  const input = { ...defaults, ...fixture.changes }
  const reasonCodes = []

  if (!input.cohortEligibilityConfirmed) {
    reasonCodes.push('UNSUPPORTED-COHORT-GATE')
  }
  if (input.experienceLevel !== rules.eligibility.experienceLevel) {
    reasonCodes.push('UNSUPPORTED-EXPERIENCE')
  }
  if (
    input.consistentRunningWeeks <
    rules.eligibility.consistentRunningWeeks.minimum
  ) {
    reasonCodes.push('UNSUPPORTED-CONSISTENCY-DURATION')
  }

  const weeklyDistance = rules.eligibility.currentWeeklyDistanceMeters
  if (
    input.currentWeeklyDistanceMeters < weeklyDistance.minimum ||
    input.currentWeeklyDistanceMeters > weeklyDistance.maximum
  ) {
    reasonCodes.push('UNSUPPORTED-WEEKLY-DISTANCE')
  }

  const frequency = rules.eligibility.currentRunningFrequencyDaysPerWeek
  if (
    input.currentRunningFrequencyDaysPerWeek < frequency.minimum ||
    input.currentRunningFrequencyDaysPerWeek > frequency.maximum
  ) {
    reasonCodes.push('UNSUPPORTED-RUN-FREQUENCY')
  }

  const longestRun = rules.eligibility.longestRecentRunDistanceMeters
  if (
    input.longestRecentRunDistanceMeters < longestRun.minimum ||
    input.longestRecentRunDistanceMeters > longestRun.maximum
  ) {
    reasonCodes.push('UNSUPPORTED-LONGEST-RUN')
  }
  if (input.targetRaceKind !== rules.feasibility.targetRaceKind) {
    reasonCodes.push('UNSUPPORTED-RACE-DATE-REQUIRED')
  }
  if (
    input.wholeWeeksFromPlanStartToRace <
      rules.feasibility.minimumWholeWeeksFromPlanStartToRace ||
    input.wholeWeeksFromPlanStartToRace >
      rules.feasibility.maximumWholeWeeksFromPlanStartToRace
  ) {
    reasonCodes.push('UNSUPPORTED-RACE-HORIZON')
  }
  if (!input.raceAlignmentValid) {
    reasonCodes.push('UNSUPPORTED-RACE-ALIGNMENT')
  }
  if (!input.availablePatternValid) {
    reasonCodes.push('UNSUPPORTED-AVAILABILITY')
  }
  if (input.scheduleConstraints !== null) {
    reasonCodes.push('UNSUPPORTED-SCHEDULE-CONSTRAINT')
  }

  const stableOrder = new Map(
    rules.unsupportedEvaluation.order.map((code, index) => [code, index]),
  )
  reasonCodes.sort((left, right) => stableOrder.get(left) - stableOrder.get(right))

  return {
    kind: reasonCodes.length === 0 ? 'generated' : 'unsupported',
    reasonCodes,
  }
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(path)))
    else if (
      !entry.name.includes('.test.') &&
      ['.js', '.mjs', '.ts', '.tsx'].includes(extname(entry.name))
    ) {
      files.push(path)
    }
  }

  return files
}

describe('founding-beta rules review packet', () => {
  it('is complete, visibly draft, and limited to the declared inventory', async () => {
    const rules = await readJson('beta-rules.json')

    expect(rules).toMatchObject({
      schemaVersion: 'beta-rules-review-packet@1',
      artifactVersion: 'beta-rules@0.1.0-draft',
      status: 'draft_not_approved',
      runtimeUseAllowed: false,
      requiredReviewerRole: 'EMR',
      reviewState: {
        submitted: false,
        decision: 'pending',
        approvedArtifactVersion: null,
      },
    })
    expect(rules.inventoryIds).toEqual([
      'ELIG-001',
      'ELIG-002',
      'FEAS-001',
      'PLAN-001',
      'PROG-001',
      'UNSUP-001',
      'UNSUP-002',
    ])
    expect(rules.sources).toHaveLength(7)
    expect(rules.sources.every((source) => source.url.startsWith('https://'))).toBe(
      true,
    )
  })

  it('freezes a coherent 18-week table with declared cutbacks and taper', async () => {
    const rules = await readJson('beta-rules.json')
    const weeks = rules.planFamily.coreWeeks

    expect(weeks).toHaveLength(18)
    expect(weeks.map((week) => week.week)).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    )
    expect(
      weeks.filter((week) => week.kind === 'cutback').map((week) => week.week),
    ).toEqual(rules.progression.cutbackCoreWeeks)
    expect(
      weeks.filter((week) => week.kind === 'taper').map((week) => week.week),
    ).toEqual(rules.progression.taperCoreWeeks)
    expect(
      weeks.every(
        (week) =>
          week.distancesMetersByPosition.length === 4 &&
          week.distancesMetersByPosition.every(
            (distance) => Number.isSafeInteger(distance) && distance > 0,
          ),
      ),
    ).toBe(true)

    const preRaceWeeks = weeks.slice(0, -1)
    const weeklyTotals = preRaceWeeks.map((week) =>
      week.distancesMetersByPosition.reduce((sum, distance) => sum + distance, 0),
    )
    const longRuns = preRaceWeeks.map(
      (week) => week.distancesMetersByPosition.at(-1),
    )

    expect(Math.max(...weeklyTotals)).toBe(
      rules.progression.maximumTrainingWeekDistanceMeters,
    )
    expect(Math.max(...longRuns)).toBe(
      rules.progression.maximumLongRunDistanceMeters,
    )
    expect(weeks.at(-1).distancesMetersByPosition.at(-1)).toBe(42195)
    expect(rules.planFamily.raceWeek).toMatchObject({
      paceTarget: null,
      finishTimeTarget: null,
    })

    let priorWeeklyHigh = rules.planFamily.leadInWeek.distancesMetersByPosition.reduce(
      (sum, distance) => sum + distance,
      0,
    )
    let priorLongRunHigh = rules.planFamily.leadInWeek.distancesMetersByPosition.at(-1)

    for (const week of preRaceWeeks) {
      const weeklyTotal = week.distancesMetersByPosition.reduce(
        (sum, distance) => sum + distance,
        0,
      )
      const longRun = week.distancesMetersByPosition.at(-1)
      if (weeklyTotal > priorWeeklyHigh) {
        expect(weeklyTotal - priorWeeklyHigh).toBeLessThanOrEqual(
          rules.progression.newHighWeeklyDistanceIncrementMeters,
        )
        priorWeeklyHigh = weeklyTotal
      }
      if (longRun > priorLongRunHigh) {
        expect(longRun - priorLongRunHigh).toBeLessThanOrEqual(
          rules.progression.newHighLongRunIncrementMeters,
        )
        priorLongRunHigh = longRun
      }
    }
  })

  it('has unique stable reason codes mapped to declared inventory rows', async () => {
    const rules = await readJson('beta-rules.json')
    const reasonCodes = rules.reasonCodes.map(({ code }) => code)

    expect(new Set(reasonCodes).size).toBe(reasonCodes.length)
    expect(reasonCodes.every((code) => /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/.test(code))).toBe(
      true,
    )
    expect(
      rules.reasonCodes.every(({ inventoryId }) =>
        rules.inventoryIds.includes(inventoryId),
      ),
    ).toBe(true)
    expect(rules.unsupportedEvaluation.order).toEqual(
      rules.reasonCodes
        .filter(({ kind }) => kind === 'unsupported')
        .map(({ code }) => code),
    )
  })

  it('evaluates every boundary fixture to its frozen outcome and order', async () => {
    const [rules, fixtures] = await Promise.all([
      readJson('beta-rules.json'),
      readJson('fixtures.json'),
    ])

    expect(fixtures).toMatchObject({
      schemaVersion: 'beta-rules-fixtures@1',
      artifactVersion: rules.artifactVersion,
      status: 'draft_not_approved',
    })
    expect(fixtures.cases.length).toBeGreaterThanOrEqual(15)

    for (const fixture of fixtures.cases) {
      const input = { ...fixtures.defaults, ...fixture.changes }
      expect(evaluateFixture(fixtures.defaults, fixture, rules), fixture.id).toEqual({
        kind: fixture.expectedKind,
        reasonCodes: fixture.expectedReasonCodes,
      })
      if (fixture.expectedKind === 'generated') {
        const leadInWeeks =
          input.wholeWeeksFromPlanStartToRace - rules.planFamily.coreTrainingWeeks
        expect(fixture.expectedPlan, fixture.id).toEqual({
          leadInWeeks,
          raceWeek: input.wholeWeeksFromPlanStartToRace,
          recoveryWeek: input.wholeWeeksFromPlanStartToRace + 1,
          totalGeneratedWeeks: input.wholeWeeksFromPlanStartToRace + 1,
          peakTrainingWeekDistanceMeters:
            rules.progression.maximumTrainingWeekDistanceMeters,
          peakLongRunDistanceMeters: rules.progression.maximumLongRunDistanceMeters,
        })
      } else {
        expect(fixture, fixture.id).not.toHaveProperty('expectedPlan')
      }
    }
  })

  it('pins packet hashes and remains absent from runtime source graphs', async () => {
    const checksumLines = (await readFile(join(packetDirectory, 'SHA256SUMS'), 'utf8'))
      .trim()
      .split('\n')

    expect(checksumLines.map((line) => line.split('  ')[1])).toEqual([
      'README.md',
      'beta-rules.json',
      'fixtures.json',
    ])

    for (const line of checksumLines) {
      const [expectedHash, fileName] = line.split('  ')
      const contents = await readFile(join(packetDirectory, fileName))
      const actualHash = createHash('sha256').update(contents).digest('hex')
      expect(actualHash, fileName).toBe(expectedHash)
    }

    const runtimeFiles = (
      await Promise.all(
        ['src', 'functions/src', 'packages/training-contract/src'].map((directory) =>
          collectSourceFiles(join(repositoryRoot, directory)),
        ),
      )
    ).flat()

    for (const file of runtimeFiles) {
      const contents = await readFile(file, 'utf8')
      expect(contents, file).not.toContain('beta-rules@0.1.0-draft')
      expect(contents, file).not.toContain('methodology/artifacts/beta-rules')
    }
  })
})
