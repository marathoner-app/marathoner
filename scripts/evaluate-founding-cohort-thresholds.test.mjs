import { describe, expect, it } from 'vitest'

import { evaluateFoundingCohortTwoWeekDecision } from './evaluate-founding-cohort-thresholds.mjs'

function healthySnapshot() {
  return {
    activation: { numerator: 6, denominator: 8 },
    comprehension: { numerator: 5, denominator: 6 },
    weeklyUse: { numerator: 10, denominator: 14 },
    withdrawal: {
      numerator: 1,
      denominator: 8,
      unresolvedCriticalCause: false,
    },
    unresolvedCriticalSafetyEvents: 0,
    criticalComprehensionMisunderstandings: 0,
    criticalPrivacyFailures: 0,
    criticalIntegrityFailures: 0,
    support: {
      minutes: 180,
      activeParticipantWeeks: 14,
      weeklyAverageMinutes: [13, 13],
      weeklyOwnerHours: [1.5, 1.5],
      missedCriticalResponse: false,
    },
  }
}

describe('founding-cohort decision thresholds', () => {
  it('proceeds only when every due metric passes', () => {
    expect(evaluateFoundingCohortTwoWeekDecision(healthySnapshot())).toEqual({
      outcome: 'proceed',
      reasons: [],
    })
  })

  it('refines when activation or comprehension is promising but below target', () => {
    const snapshot = healthySnapshot()
    snapshot.activation = { numerator: 5, denominator: 8 }
    snapshot.comprehension = { numerator: 4, denominator: 6 }

    expect(evaluateFoundingCohortTwoWeekDecision(snapshot)).toEqual({
      outcome: 'refine',
      reasons: [
        'activation requires refinement or more evidence',
        'comprehension requires refinement or more evidence',
      ],
    })
  })

  it('does not proceed with too little completed evidence', () => {
    const snapshot = healthySnapshot()
    snapshot.activation = { numerator: 3, denominator: 3 }
    snapshot.comprehension = { numerator: 3, denominator: 3 }

    expect(evaluateFoundingCohortTwoWeekDecision(snapshot).outcome).toBe(
      'refine',
    )
  })

  it('pauses on a critical integrity failure despite strong engagement', () => {
    const snapshot = healthySnapshot()
    snapshot.criticalIntegrityFailures = 1

    expect(evaluateFoundingCohortTwoWeekDecision(snapshot)).toEqual({
      outcome: 'pause',
      reasons: ['critical data-integrity failure'],
    })
  })

  it('pauses when owner support exceeds capacity in consecutive weeks', () => {
    const snapshot = healthySnapshot()
    snapshot.support.weeklyOwnerHours = [4.5, 5]

    expect(evaluateFoundingCohortTwoWeekDecision(snapshot)).toEqual({
      outcome: 'pause',
      reasons: ['owner support exceeded four hours in consecutive weeks'],
    })
  })

  it('rejects malformed counts instead of silently classifying them', () => {
    const snapshot = healthySnapshot()
    snapshot.activation = { numerator: 9, denominator: 8 }

    expect(() => evaluateFoundingCohortTwoWeekDecision(snapshot)).toThrow(
      'activation must contain valid whole-number counts',
    )
  })
})
