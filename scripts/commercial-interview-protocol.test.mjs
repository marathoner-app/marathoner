import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const operationsDirectory = resolve(repositoryRoot, 'docs/operations')
const protocol = readFileSync(
  resolve(operationsDirectory, 'commercial-interview-protocol.md'),
  'utf8',
)
const ledgerTemplate = readFileSync(
  resolve(operationsDirectory, 'templates/commercial-evidence-ledger.md'),
  'utf8',
)
const noteTemplate = readFileSync(
  resolve(operationsDirectory, 'templates/commercial-interview-note.md'),
  'utf8',
)
const publicTemplate = readFileSync(
  resolve(operationsDirectory, 'templates/commercial-aggregate-decision.md'),
  'utf8',
)
const syntheticCases = JSON.parse(
  readFileSync(
    resolve(
      operationsDirectory,
      'evidence/commercial-interview-synthetic-cases.json',
    ),
    'utf8',
  ),
)

const trueOnly = (...values) => values.every((value) => value === true)

const classify = (input) => {
  const commercialDiscoveryEligible = trueOnly(
    input.adultConfirmed,
    input.usConfirmed,
    input.englishConfirmed,
    input.firstMarathonConfirmed,
  ) &&
    Number.isInteger(input.monthsToMarathon) &&
    input.monthsToMarathon >= 2 &&
    input.monthsToMarathon <= 12 &&
    [input.raceRegistered, input.planSelected, input.recentDisruption].some(
      (value) => value === true,
    )

  const qualifiedInterview = commercialDiscoveryEligible && trueOnly(
    input.consentValid,
    input.coreProblemTaskComplete,
    input.readinessTaskComplete,
    input.adaptationTaskComplete,
  )

  const recurringConsequentialWorkaround = qualifiedInterview &&
    (input.separateOccurrences >= 2 || input.unresolvedDays >= 7) &&
    ['changed', 'abandoned', 'guessed', 'outside_help'].includes(
      input.workaroundAction,
    ) &&
    [
      input.consequenceTime,
      input.consequenceMoney,
      input.consequenceConfidence,
      input.consequenceRaceDecision,
    ].some((value) => value === true)

  const concreteEightWeekCommitment = qualifiedInterview && trueOnly(
    input.commitmentStartWindowDefined,
    input.commitmentCadenceDefined,
    input.commitmentFollowupDefined,
    input.commitmentSchedulingPermission,
  )

  const comprehensionSuccess = trueOnly(
    input.comprehensionNextAction,
    input.comprehensionReason,
    input.comprehensionConsequence,
    input.comprehensionApprovalRequired,
  )

  const reservationCandidate = qualifiedInterview && trueOnly(
    input.supportedCommercialGeography,
    input.canUseProposedWindow,
  )

  const qualifiedReservationProspect = reservationCandidate && trueOnly(
    input.approvedOfferUnderstood,
    input.identicalTermsShown,
  )

  const fixedReservationRequest = qualifiedReservationProspect && trueOnly(
    input.exactRequestRead,
    input.identicalTermsShown,
    input.threeChoicesDisplayed,
  ) && typeof input.reservationRequestedAtUtc === 'string'

  const confirmedReservationDeposit = fixedReservationRequest &&
    input.processorStatus === 'confirmed' &&
    input.amountUsd === 25

  return {
    commercialDiscoveryEligible,
    qualifiedInterview,
    recurringConsequentialWorkaround,
    concreteEightWeekCommitment,
    comprehensionSuccess,
    reservationCandidate,
    qualifiedReservationProspect,
    fixedReservationRequest,
    confirmedReservationDeposit,
  }
}

describe('commercial interview protocol', () => {
  it('freezes the commercial segment separately from live-beta eligibility', () => {
    expect(protocol).toContain('commercial-interview-protocol@1.0.0')
    expect(protocol).toMatch(/commercial eligibility is never beta\s+eligibility/i)
    expect(protocol).toMatch(/gives no individualized plan or recommendation/i)
    expect(protocol).not.toMatch(/40–45 km weekly-distance/i)
  })

  it('uses fixed non-leading questions and captures disconfirming evidence', () => {
    for (const prompt of [
      'What plan, person, app, community, or other approach',
      'What other options did you consider?',
      'What would make you decide not to use or pay',
      'What about this approach could fail to solve',
      'If this did not exist, what would you do?',
    ]) {
      expect(protocol).toContain(prompt)
    }

    expect(noteTemplate).toMatch(/Purchase objections:/)
    expect(noteTemplate).toMatch(/Evidence that contradicts the proposition:/)
  })

  it('keeps all required acquisition sources distinguishable', () => {
    for (const source of ['warm_network', 'organic', 'partner', 'paid', 'unknown']) {
      expect(protocol).toContain(`\`${source}\``)
      expect(ledgerTemplate).toContain(source)
    }

    expect(protocol).toMatch(/Paid exposure is never relabeled organic/i)
  })

  it('separates pre-offer routing from offer comprehension', () => {
    expect(protocol).toMatch(/reservation candidate.*qualified-interview/s)
    expect(protocol).toMatch(
      /candidate-to-prospect comprehension failures as negative evidence/i,
    )
    expect(ledgerTemplate).toContain('reservation_candidate =')
    expect(publicTemplate).toContain('Reservation candidates')
  })

  it('defines reproducible ownership, windows, denominators, and small-count limits', () => {
    expect(protocol).toMatch(/Owner and evidence owner.*Kevin Tulloch/i)
    expect(protocol).toMatch(/first fifteen qualified interviews/i)
    expect(protocol).toMatch(/first ten qualified reservation prospects/i)
    expect(protocol).toMatch(/not evaluable/i)
    expect(protocol).toMatch(/not a\s+statistical estimate/i)
    expect(publicTemplate).toMatch(/numerator/i)
    expect(publicTemplate).toMatch(/denominator/i)
    expect(publicTemplate).toMatch(/small study provides directional decision evidence/i)
  })

  it('defines ledger inputs for interview, payment, support, and acquisition metrics', () => {
    for (const tab of [
      'interviews',
      'reservation_events',
      'support_events',
      'participant_weeks',
      'source_spend',
      'change_log',
    ]) {
      expect(ledgerTemplate).toContain(`\`${tab}\``)
    }

    expect(ledgerTemplate).toContain('cash_acquisition_cost =')
    expect(ledgerTemplate).toContain('net_journey_revenue_before_acquisition =')
    expect(ledgerTemplate).toMatch(/included_support_minutes.*support_events/s)
    expect(ledgerTemplate).toMatch(/reservation cash outside net journey revenue/i)
  })

  it('keeps private row-level evidence out of the public template', () => {
    expect(noteTemplate).toMatch(/Never commit participant responses/i)
    expect(ledgerTemplate).toMatch(/Never put live rows/i)
    expect(publicTemplate).toMatch(/Do not publish participant IDs/i)
    expect(publicTemplate).toMatch(/re-identification review/i)
  })

  it('preserves protocol versions and reasons for change', () => {
    for (const field of [
      'prior_version',
      'new_version',
      'reason',
      'comparable_to_prior_cohort',
    ]) {
      expect(ledgerTemplate).toContain(field)
    }

    expect(protocol).toMatch(/materially different versions\s+as separate cohorts/i)
    expect(protocol).toMatch(/always require a new version/i)
  })

  it.each(syntheticCases)(
    'reproduces the $case synthetic classification without using sentiment',
    ({ input, expected, sentiment }) => {
      expect(classify(input)).toEqual(expected)
      expect(Object.keys(input)).not.toContain('sentiment')
      expect(sentiment).toBeTruthy()
    },
  )
})
