# Private commercial evidence-ledger template

> Private operational template. Create the live workbook inside the restricted
> `05 Evidence ledger` folder. Never put live rows, identity mappings, or
> transaction references in GitHub.

## Workbook controls

- Workbook version: `commercial-evidence-ledger@1.0.0`
- Protocol version: `commercial-interview-protocol@1.0.0`
- Owner: Kevin Tulloch
- Time zone: UTC
- Missing value: leave the atomic value blank and set the matching
  `missing_fields` entry; never convert unknown to `No`.
- Formula columns are protected. Corrections happen in atomic fields and are
  recorded in `change_log`.

Use six tabs. Column names below are exact and stable for version 1.0.0.

## `interviews`

One row per participant ID. No names or contact details.

| Column group | Exact columns |
| --- | --- |
| Control | `participant_id`, `interview_completed_at_utc`, `protocol_version`, `artifact_version`, `consent_version`, `consent_valid`, `core_problem_task_complete`, `readiness_task_complete`, `adaptation_task_complete`, `protocol_deviation`, `missing_fields` |
| Screener atoms | `adult_confirmed`, `us_confirmed`, `english_confirmed`, `first_marathon_confirmed`, `months_to_marathon`, `race_registered`, `plan_selected`, `recent_disruption` |
| Source | `acquisition_source`, `source_detail_private` |
| Workaround atoms | `separate_occurrences`, `unresolved_days`, `workaround_action`, `consequence_time`, `consequence_money`, `consequence_confidence`, `consequence_race_decision`, `current_alternative_code` |
| Commitment atoms | `commitment_start_window_defined`, `commitment_cadence_defined`, `commitment_followup_defined`, `commitment_scheduling_permission` |
| Comprehension atoms | `comprehension_next_action`, `comprehension_reason`, `comprehension_consequence`, `comprehension_approval_required` |
| Prospect/request atoms | `approved_offer_understood`, `supported_commercial_geography`, `can_use_proposed_window`, `identical_terms_shown`, `terms_version`, `exact_request_read`, `three_choices_displayed`, `reservation_requested_at_utc`, `reservation_choice` |
| Computed, protected | `commercial_discovery_eligible`, `qualified_interview`, `recurring_consequential_workaround`, `concrete_eight_week_commitment`, `comprehension_success`, `reservation_candidate`, `qualified_reservation_prospect`, `fixed_reservation_request` |
| Coded evidence | `primary_objection_code`, `disconfirming_evidence_code`, `negative_evidence_present`, `coding_checked_by_owner_at_utc` |

Allowed enums:

- `acquisition_source`: `warm_network`, `organic`, `partner`, `paid`, `unknown`
- `workaround_action`: `changed`, `abandoned`, `guessed`, `outside_help`, `none`, `other`, `unknown`
- `current_alternative_code`: `free_plan`, `paid_app`, `human_coach`, `club_or_community`, `self_directed`, `other`, `unknown`
- `reservation_choice`: `place_reservation`, `no`, `clarification`, `not_asked`
- atomic decisions: `true`, `false`, or blank plus `missing_fields`

### Protected expressions

The following named-field expressions are the source of truth. `AND` returns
true only when every input is explicitly true; blanks therefore do not pass.

```text
commercial_discovery_eligible =
  adult_confirmed AND us_confirmed AND english_confirmed AND
  first_marathon_confirmed AND (2 <= months_to_marathon <= 12) AND
  (race_registered OR plan_selected OR recent_disruption)

qualified_interview =
  commercial_discovery_eligible AND consent_valid AND
  core_problem_task_complete AND readiness_task_complete AND
  adaptation_task_complete

recurring_consequential_workaround =
  qualified_interview AND (separate_occurrences >= 2 OR unresolved_days >= 7) AND
  workaround_action IN [changed, abandoned, guessed, outside_help] AND
  (consequence_time OR consequence_money OR consequence_confidence OR
   consequence_race_decision)

concrete_eight_week_commitment =
  qualified_interview AND commitment_start_window_defined AND
  commitment_cadence_defined AND commitment_followup_defined AND
  commitment_scheduling_permission

comprehension_success =
  comprehension_next_action AND comprehension_reason AND
  comprehension_consequence AND comprehension_approval_required

reservation_candidate =
  qualified_interview AND supported_commercial_geography AND
  can_use_proposed_window

qualified_reservation_prospect =
  reservation_candidate AND approved_offer_understood AND identical_terms_shown

fixed_reservation_request =
  qualified_reservation_prospect AND exact_request_read AND
  identical_terms_shown AND three_choices_displayed AND
  reservation_requested_at_utc IS NOT BLANK
```

## `reservation_events`

One row per processor event. Stripe remains the payment source of truth.

`participant_id`, `event_at_utc`, `offer_version`, `terms_version`,
`processor_object_reference`, `event_type`, `amount_usd`, `processor_fee_usd`,
`discount_usd`, `refund_amount_usd`, `processor_status`, `reconciled_at_utc`,
`confirmed_reservation_deposit`

`confirmed_reservation_deposit` is true only when a matching interview row has
`fixed_reservation_request = true`, `processor_status = confirmed`, and
`amount_usd = 25.00`. Never store card, bank, billing-address, or authentication
data.

Allowed `event_type` values are `reservation_charge`, `reservation_refund`,
`journey_payment`, `journey_refund`, and `processor_adjustment`. A reservation
charge is excluded from journey revenue unless the approved terms and event
record show that it converted into earned journey payment.

## `support_events`

One row per support interval:

`participant_id`, `event_date_utc`, `study_week`, `category`, `whole_minutes`,
`included_in_support_metric`, `exclusion_reason`

Allowed categories are `onboarding`, `setup`, `clarification`,
`troubleshooting`, `recommendation_handling`, and `administration`. Research
interview minutes are not entered. Report onboarding separately even when it is
included in total operating time.

## `participant_weeks`

One row per participant and complete operating week:

`participant_id`, `study_week`, `week_started_at_utc`, `week_ended_at_utc`,
`active_participant_week`, `onboarding_minutes`, `included_support_minutes`,
`support_minutes_reconciled_at_utc`

`included_support_minutes` must equal the matching included rows in
`support_events`. Weekly support burden is the sum of included support minutes
divided by the count of rows where `active_participant_week = true`, grouped by
study week. A week with no active participant-weeks is `not calculable`, not
zero.

## `source_spend`

One row per source and spend period:

`period_start_utc`, `period_end_utc`, `acquisition_source`,
`source_detail_private`, `cash_spend_usd`, `founder_minutes`, `invoice_reference`

Do not assign an invented cash value to founder minutes. Cash acquisition cost
is not calculable with zero confirmed reservations and is not labeled viable
before ten paid-source conversions.

For a source and observation window:

```text
cash_acquisition_cost =
  SUM(source_spend.cash_spend_usd) /
  COUNT(DISTINCT confirmed reservation participant_id attributed to source)

net_journey_revenue_before_acquisition =
  SUM(journey_payment.amount_usd) - SUM(journey_refund.refund_amount_usd) -
  SUM(processor_fee_usd) - SUM(discount_usd)
```

When the confirmed-reservation count is zero, cash acquisition cost is `not
calculable`. Keep reservation cash outside net journey revenue until the
approved terms and event trail show it converted into earned journey payment.

## `change_log`

One row per factual correction or protocol change:

`changed_at_utc`, `owner`, `participant_id_or_protocol`, `field`, `old_value`,
`new_value`, `evidence`, `reason`, `prior_version`, `new_version`,
`comparable_to_prior_cohort`

Never overwrite an atomic field silently. Protocol changes follow the version
and cohort-separation rule in the frozen protocol.

## Reproduction checklist

1. Validate participant IDs and version fields.
2. Recompute every protected classification from atomic fields.
3. Sort the problem cohort and reservation cohort using the frozen timestamps
   and participant-ID tie-breaker.
4. Reconcile confirmed deposits to Stripe without copying payment details.
5. Reconcile every `participant_weeks` total to its source support events.
6. Produce numerator, denominator, missing count, source mix, and observation
   window for each metric.
7. Compare computed counts with the public aggregate; a mismatch blocks
   publication.
8. Apply subgroup suppression and the re-identification review before export.
