import { useRef, useState, type FormEvent } from "react";
import {
  createDateOnly,
  createPlanGenerationInputFromProfile,
  generateDeterministicPlan,
  type GeneratedPlanResultV1,
  type PlanGenerationProfileField,
  type PlanGenerationResultV1,
  type PlanGenerationValidationIssue,
  type UserProfile,
} from "../domain/training";
import InternalPlanActivationRehearsal from "./InternalPlanActivationRehearsal";
import {
  INTERNAL_ELIGIBLE_PLAN_REHEARSAL_PROFILE_VERSION,
  internalEligiblePlanRehearsalProfile,
  type InternalPlanRehearsalProfileSource,
} from "./internalEligiblePlanRehearsalProfile";
import type { InternalPlanProposalRehearsalRuleSet } from "./internalPlanProposalRehearsalRules";
import {
  createInternalPlanStartDateCandidates,
  formatInternalPlanStartDate,
  type InternalPlanStartDateCandidateResult,
} from "./internalPlanStartDateCandidates";
import "./InternalPlanProposalRehearsal.css";

interface InternalPlanProposalRehearsalProps {
  readonly profile: UserProfile | null;
  readonly ruleSet: InternalPlanProposalRehearsalRuleSet;
  readonly onSessionActivationChange: (
    result: GeneratedPlanResultV1 | null,
  ) => void;
  readonly onProfileSourceChange?: (
    source: InternalPlanRehearsalProfileSource,
  ) => void;
}

type RehearsalOutcome =
  | { readonly kind: "not_run" }
  | {
      readonly kind: "incomplete_profile";
      readonly missingFields: readonly PlanGenerationProfileField[];
    }
  | {
      readonly kind: "invalid_input";
      readonly issues: readonly PlanGenerationValidationIssue[];
    }
  | {
      readonly kind: "generation_result";
      readonly result: PlanGenerationResultV1;
      readonly revision: number;
    };

function readableIdentifier(value: string): string {
  const words = value
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[_-]/u)
    .join(" ");
  return `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}`;
}

function unavailableCandidateMessage(
  result: Extract<
    InternalPlanStartDateCandidateResult,
    { readonly kind: "unavailable" }
  >,
): string {
  switch (result.reason) {
    case "profile_incomplete":
      return "Save an exact race date and preferred long-run day to see derived start-date choices.";
    case "race_window":
      return "This draft can derive start dates only from an exact race date, not a race window.";
    case "race_weekday_mismatch":
      return "The saved race date does not fall on the preferred long-run day, so this draft has no aligned start-date choices.";
    case "recent_effort_after_supported_start_window":
      return "The saved recent effort occurs after every start date allowed by this draft, so no aligned choice is valid for the saved profile.";
  }
}

export default function InternalPlanProposalRehearsal({
  profile,
  ruleSet,
  onSessionActivationChange,
  onProfileSourceChange,
}: InternalPlanProposalRehearsalProps) {
  const generationRevision = useRef(0);
  const [profileSource, setProfileSource] =
    useState<InternalPlanRehearsalProfileSource>("saved_profile");
  const [planStartDate, setPlanStartDate] = useState("");
  const [cohortConfirmed, setCohortConfirmed] = useState(false);
  const [noSymptomsReported, setNoSymptomsReported] = useState(false);
  const [outcome, setOutcome] = useState<RehearsalOutcome>({
    kind: "not_run",
  });
  const activeProfile =
    profileSource === "saved_profile"
      ? profile
      : internalEligiblePlanRehearsalProfile;
  const candidateResult = createInternalPlanStartDateCandidates(
    activeProfile,
    ruleSet.rules,
  );

  const updateProfileSource = (source: InternalPlanRehearsalProfileSource) => {
    onSessionActivationChange(null);
    setProfileSource(source);
    onProfileSourceChange?.(source);
    setPlanStartDate("");
    setCohortConfirmed(false);
    setNoSymptomsReported(false);
    setOutcome({ kind: "not_run" });
  };

  const updatePlanStartDate = (value: string) => {
    onSessionActivationChange(null);
    setPlanStartDate(value);
    setOutcome({ kind: "not_run" });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSessionActivationChange(null);

    if (activeProfile === null) {
      setOutcome({ kind: "incomplete_profile", missingFields: [] });
      return;
    }

    let normalizedPlanStartDate;
    try {
      normalizedPlanStartDate = createDateOnly(planStartDate);
    } catch {
      setOutcome({
        kind: "invalid_input",
        issues: [
          {
            code: "invalid_value",
            field: "planStartDate",
            message: "Choose a valid plan start date.",
          },
        ],
      });
      return;
    }

    const inputResult = createPlanGenerationInputFromProfile(activeProfile, {
      planStartDate: normalizedPlanStartDate,
      rulesetVersion: ruleSet.rules.rulesetVersion,
      safetySignal: noSymptomsReported ? "none_reported" : "not_answered",
    });

    if (inputResult.kind !== "ready") {
      setOutcome(inputResult);
      return;
    }

    generationRevision.current += 1;
    setOutcome({
      kind: "generation_result",
      result: generateDeterministicPlan({
        input: inputResult.input,
        cohortEligibilityConfirmed: cohortConfirmed,
        generatorVersion: ruleSet.generatorVersion,
        rules: ruleSet.rules,
      }),
      revision: generationRevision.current,
    });
  };

  return (
    <section
      id="internal-plan-proposal"
      className="internal-plan-rehearsal"
      aria-labelledby="internal-plan-rehearsal-title"
    >
      <header>
        <p className="internal-plan-rehearsal-eyebrow">
          Owner-only local tool
        </p>
        <h2 id="internal-plan-rehearsal-title">
          Internal draft plan rehearsal
        </h2>
        <p>
          This uses the pinned, unapproved methodology draft. It is not training
          advice and cannot approve, activate, or save a plan.
        </p>
      </header>

      <form onSubmit={handleSubmit}>
        <fieldset className="internal-plan-profile-source">
          <legend>Runner profile source</legend>
          <label>
            <input
              type="radio"
              name="internal-plan-profile-source"
              value="saved_profile"
              checked={profileSource === "saved_profile"}
              onChange={() => updateProfileSource("saved_profile")}
            />
            <span>
              <strong>Saved owner profile</strong>
              <small>
                The default path. Uses the current profile synchronized from
                Firebase without changing it.
              </small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="internal-plan-profile-source"
              value="frozen_eligible_profile"
              checked={profileSource === "frozen_eligible_profile"}
              onChange={() => updateProfileSource("frozen_eligible_profile")}
            />
            <span>
              <strong>Frozen eligible rehearsal profile</strong>
              <small>
                Checked-in synthetic inputs for completing the owner-only plan
                journey without rewriting the saved profile.
              </small>
            </span>
          </label>
        </fieldset>

        {profileSource === "frozen_eligible_profile" && (
          <aside
            className="internal-plan-profile-fixture"
            aria-label="Frozen rehearsal profile details"
          >
            <h3>Frozen eligible profile</h3>
            <p>
              Version {INTERNAL_ELIGIBLE_PLAN_REHEARSAL_PROFILE_VERSION}. These
              synthetic values live only in the internal rehearsal source and
              are never read from or written to Firebase.
            </p>
            <dl>
              <div>
                <dt>Race date</dt>
                <dd>
                  {formatInternalPlanStartDate(
                    internalEligiblePlanRehearsalProfile.targetRace.date,
                  )}
                </dd>
              </div>
              <div>
                <dt>Consistent running</dt>
                <dd>
                  {internalEligiblePlanRehearsalProfile.consistentRunningWeeks}{" "}
                  weeks
                </dd>
              </div>
              <div>
                <dt>Weekly distance</dt>
                <dd>
                  {Number(
                    internalEligiblePlanRehearsalProfile.currentWeeklyDistance,
                  ) / 1_000}{" "}
                  km
                </dd>
              </div>
              <div>
                <dt>Runs per week</dt>
                <dd>
                  {
                    internalEligiblePlanRehearsalProfile.currentRunningFrequencyDaysPerWeek
                  }
                </dd>
              </div>
              <div>
                <dt>Longest recent run</dt>
                <dd>
                  {Number(
                    internalEligiblePlanRehearsalProfile.longestRecentRunDistance,
                  ) / 1_000}{" "}
                  km
                </dd>
              </div>
              <div>
                <dt>Training days</dt>
                <dd>Tuesday, Thursday, Saturday, Sunday</dd>
              </div>
            </dl>
          </aside>
        )}

        <label htmlFor="internal-plan-start-date">Plan start date</label>
        <input
          id="internal-plan-start-date"
          type="date"
          required
          value={planStartDate}
          onChange={(event) => updatePlanStartDate(event.target.value)}
        />
        <p className="internal-plan-rehearsal-help">
          Choose the day after the preferred long-run day, 18 to 22 whole weeks
          before an exact race date.
        </p>

        {candidateResult.kind === "available" ? (
          <fieldset className="internal-plan-start-candidates">
            <legend>Draft-aligned choices</legend>
            <p>
              Derived from the selected profile's race date and this draft's
              supported horizon. Nothing is selected automatically.
            </p>
            <div>
              {candidateResult.candidates.map((candidate) => (
                <button
                  key={candidate.date}
                  type="button"
                  aria-pressed={planStartDate === candidate.date}
                  onClick={() => updatePlanStartDate(candidate.date)}
                >
                  <span>{formatInternalPlanStartDate(candidate.date)}</span>
                  <small>{candidate.wholeWeeksToRace} weeks to race</small>
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="internal-plan-rehearsal-help" role="status">
            {unavailableCandidateMessage(candidateResult)} You can still enter a
            date manually to rehearse the unsupported result.
          </p>
        )}

        <label className="internal-plan-rehearsal-confirmation">
          <input
            type="checkbox"
            checked={cohortConfirmed}
            onChange={(event) => {
              onSessionActivationChange(null);
              setCohortConfirmed(event.target.checked);
              setOutcome({ kind: "not_run" });
            }}
          />
          For this rehearsal, I have confirmed the {profileSource ===
          "saved_profile"
            ? "saved profile"
            : "frozen eligible rehearsal profile"} represents the intended
          founding cohort.
        </label>
        <label className="internal-plan-rehearsal-confirmation">
          <input
            type="checkbox"
            checked={noSymptomsReported}
            onChange={(event) => {
              onSessionActivationChange(null);
              setNoSymptomsReported(event.target.checked);
              setOutcome({ kind: "not_run" });
            }}
          />
          For this rehearsal, no pain or unusual symptoms have been reported.
        </label>

        <button type="submit" disabled={activeProfile === null}>
          Generate read-only proposal
        </button>
      </form>

      {activeProfile === null && (
        <p className="internal-plan-rehearsal-result" role="status">
          Finish and save the runner profile, or choose the frozen eligible
          profile to rehearse the complete session-only journey.
        </p>
      )}

      {outcome.kind === "incomplete_profile" && activeProfile !== null && (
        <div className="internal-plan-rehearsal-result" role="status">
          <h3>Runner setup is incomplete</h3>
          <p>Finish these saved profile fields before generating a proposal:</p>
          <ul>
            {outcome.missingFields.map((field) => (
              <li key={field}>{readableIdentifier(field)}</li>
            ))}
          </ul>
        </div>
      )}

      {outcome.kind === "invalid_input" && (
        <div className="internal-plan-rehearsal-result" role="alert">
          <h3>The proposal inputs need attention</h3>
          <ul>
            {outcome.issues.map((issue) => (
              <li key={`${issue.field}-${issue.code}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {outcome.kind === "generation_result" &&
        outcome.result.kind === "unsupported" && (
          <div className="internal-plan-rehearsal-result" role="status">
            <h3>The selected starting point is outside this draft</h3>
            <p>
              The generator correctly declined to invent a plan. Review these
              draft boundary results:
            </p>
            <ul>
              {outcome.result.reasonCodes.map((reasonCode) => (
                <li key={reasonCode}>{readableIdentifier(reasonCode)}</li>
              ))}
            </ul>
          </div>
        )}

      {outcome.kind === "generation_result" &&
        outcome.result.kind === "invalid_input" && (
          <div className="internal-plan-rehearsal-result" role="alert">
            <h3>The generator rejected these inputs</h3>
            <ul>
              {outcome.result.issues.map((issue) => (
                <li key={`${issue.field}-${issue.code}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}

      {outcome.kind === "generation_result" &&
        outcome.result.kind === "generated" && (
          <InternalPlanActivationRehearsal
            key={outcome.revision}
            result={outcome.result}
            onReviewInputs={() => setOutcome({ kind: "not_run" })}
            onSessionActivationChange={onSessionActivationChange}
          />
        )}
    </section>
  );
}
