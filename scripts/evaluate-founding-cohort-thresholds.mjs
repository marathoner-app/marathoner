const RATE_THRESHOLDS = Object.freeze({
  activation: { minimumDenominator: 5, pauseBelow: 0.5, proceedAt: 0.75 },
  comprehension: { minimumDenominator: 5, pauseBelow: 0.6, proceedAt: 0.8 },
  weeklyUse: { minimumDenominator: 5, pauseBelow: 0.5, proceedAt: 0.7 },
  withdrawal: {
    direction: 'maximum',
    minimumDenominator: 5,
    pauseAt: 0.4,
    proceedAtOrBelow: 0.2,
  },
})

function classifyMinimumRate({ denominator, numerator }, threshold) {
  if (denominator < threshold.minimumDenominator) return 'refine'

  const rate = numerator / denominator
  if (rate < threshold.pauseBelow) return 'pause'
  if (rate >= threshold.proceedAt) return 'proceed'
  return 'refine'
}

function classifyMaximumRate({ denominator, numerator }, threshold) {
  if (denominator < threshold.minimumDenominator) return 'refine'

  const rate = numerator / denominator
  if (rate >= threshold.pauseAt) return 'pause'
  if (rate <= threshold.proceedAtOrBelow) return 'proceed'
  return 'refine'
}

function validateCount(metricName, { denominator, numerator }) {
  if (
    !Number.isInteger(numerator) ||
    !Number.isInteger(denominator) ||
    numerator < 0 ||
    denominator < 0 ||
    numerator > denominator
  ) {
    throw new Error(`${metricName} must contain valid whole-number counts`)
  }
}

export function evaluateFoundingCohortTwoWeekDecision(snapshot) {
  for (const metricName of Object.keys(RATE_THRESHOLDS)) {
    validateCount(metricName, snapshot[metricName])
  }

  const support = snapshot.support
  if (
    !Number.isFinite(support.minutes) ||
    !Number.isInteger(support.activeParticipantWeeks) ||
    support.minutes < 0 ||
    support.activeParticipantWeeks < 1 ||
    !Array.isArray(support.weeklyAverageMinutes) ||
    support.weeklyAverageMinutes.some(
      (minutes) => !Number.isFinite(minutes) || minutes < 0,
    ) ||
    !Array.isArray(support.weeklyOwnerHours) ||
    support.weeklyOwnerHours.some(
      (hours) => !Number.isFinite(hours) || hours < 0,
    )
  ) {
    throw new Error('support must contain valid burden evidence')
  }
  for (const countName of [
    'unresolvedCriticalSafetyEvents',
    'criticalComprehensionMisunderstandings',
    'criticalPrivacyFailures',
    'criticalIntegrityFailures',
  ]) {
    if (!Number.isInteger(snapshot[countName]) || snapshot[countName] < 0) {
      throw new Error(`${countName} must be a non-negative whole number`)
    }
  }

  const hardStopReasons = []
  if (snapshot.unresolvedCriticalSafetyEvents > 0) {
    hardStopReasons.push('unresolved critical safety event')
  }
  if (snapshot.criticalComprehensionMisunderstandings > 0) {
    hardStopReasons.push('unresolved safety-critical misunderstanding')
  }
  if (snapshot.criticalPrivacyFailures > 0) {
    hardStopReasons.push('critical privacy failure')
  }
  if (snapshot.criticalIntegrityFailures > 0) {
    hardStopReasons.push('critical data-integrity failure')
  }
  if (snapshot.withdrawal.unresolvedCriticalCause) {
    hardStopReasons.push('withdrawal tied to an unresolved critical failure')
  }
  if (support.missedCriticalResponse) {
    hardStopReasons.push('critical response missed because support was unavailable')
  }

  const averageSupportMinutes =
    support.minutes / support.activeParticipantWeeks
  const hasConsecutiveWeeksAbove = (values, threshold) =>
    values.some(
      (value, index) =>
        index > 0 && value > threshold && values[index - 1] > threshold,
    )
  if (hasConsecutiveWeeksAbove(support.weeklyAverageMinutes, 60)) {
    hardStopReasons.push('support exceeded 60 minutes per participant-week')
  }
  if (hasConsecutiveWeeksAbove(support.weeklyOwnerHours, 4)) {
    hardStopReasons.push('owner support exceeded four hours in consecutive weeks')
  }

  if (hardStopReasons.length > 0) {
    return { outcome: 'pause', reasons: hardStopReasons }
  }

  const classifications = {
    activation: classifyMinimumRate(
      snapshot.activation,
      RATE_THRESHOLDS.activation,
    ),
    comprehension: classifyMinimumRate(
      snapshot.comprehension,
      RATE_THRESHOLDS.comprehension,
    ),
    weeklyUse: classifyMinimumRate(
      snapshot.weeklyUse,
      RATE_THRESHOLDS.weeklyUse,
    ),
    withdrawal: classifyMaximumRate(
      snapshot.withdrawal,
      RATE_THRESHOLDS.withdrawal,
    ),
    support:
      support.weeklyAverageMinutes.length >= 2 &&
      support.weeklyOwnerHours.length >= 2 &&
      averageSupportMinutes <= 30 &&
      support.weeklyAverageMinutes.every((minutes) => minutes <= 30) &&
      support.weeklyOwnerHours.every((hours) => hours <= 4)
        ? 'proceed'
        : 'refine',
  }

  const pausedMetrics = Object.entries(classifications)
    .filter(([, outcome]) => outcome === 'pause')
    .map(([metric]) => metric)
  if (pausedMetrics.length > 0) {
    return {
      outcome: 'pause',
      reasons: pausedMetrics.map((metric) => `${metric} crossed its pause threshold`),
    }
  }

  const refinedMetrics = Object.entries(classifications)
    .filter(([, outcome]) => outcome === 'refine')
    .map(([metric]) => metric)
  if (refinedMetrics.length > 0) {
    return {
      outcome: 'refine',
      reasons: refinedMetrics.map((metric) => `${metric} requires refinement or more evidence`),
    }
  }

  return { outcome: 'proceed', reasons: [] }
}
