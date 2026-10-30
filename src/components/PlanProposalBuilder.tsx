import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { PlanApprovalReceiptResult } from "../domain/materialCommands/contract";
import {
  createDateOnly,
  createPlanGenerationInputFromProfile,
  createPlanStartDateCandidates,
  formatPlanStartDate,
  generateDeterministicPlan,
  type DateOnly,
  type DeterministicPlanRulesV1,
  type IanaTimeZone,
  type PlanGenerationArtifactVersion,
  type PlanGenerationInputV1,
  type PlanGenerationResultV1,
  type PlanGenerationSafetySignal,
  type UserProfile,
} from "../domain/training";
import { isRunnerProfileOnboardingComplete } from "../onboarding/runnerProfileDraft";
import type { PlanApprovalClient } from "../services/planApprovalClient";
import PlanGenerationResultView from "./PlanGenerationResultView";
import "./PlanProposalBuilder.css";

interface PlanProposalBuilderProps {
  readonly profile: UserProfile | null;
  readonly generatorVersion: PlanGenerationArtifactVersion;
  readonly rules: DeterministicPlanRulesV1;
  readonly onEditProfile: () => void;
  readonly approval: {
    readonly expectedActivePlanRevision: number | null;
    readonly client: PlanApprovalClient;
    readonly reloadTrainingData: () => Promise<void>;
    readonly onApproved: (receipt: PlanApprovalReceiptResult) => void;
  };
  readonly today?: DateOnly;
}

type SafetyAnswer = "" | PlanGenerationSafetySignal;

interface BuilderValidationErrors {
  readonly planStartDate: boolean;
  readonly safetyAnswer: boolean;
}

const noValidationErrors: BuilderValidationErrors = {
  planStartDate: false,
  safetyAnswer: false,
};

type BuilderOutcome =
  | { readonly kind: "form" }
  | {
      readonly kind: "result";
      readonly input: PlanGenerationInputV1;
      readonly result: PlanGenerationResultV1;
      readonly distanceUnit: UserProfile["preferredDistanceUnit"];
    };

function dateOnlyInTimeZone(timeZone: IanaTimeZone, instant = new Date()): DateOnly {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );

  return createDateOnly(`${parts.year}-${parts.month}-${parts.day}`);
}

function unavailableMessage(
  reason: Exclude<
    ReturnType<typeof createPlanStartDateCandidates>,
    { readonly kind: "available" }
  >["reason"],
): string {
  switch (reason) {
    case "profile_incomplete":
      return "Add an exact marathon date and preferred long-run day before building a plan.";
    case "race_window":
      return "Choose an exact marathon date before building a plan. A date range is not supported yet.";
    case "race_weekday_mismatch":
      return "Your marathon date and preferred long-run day do not align. Review your runner setup before building a plan.";
    case "recent_effort_after_supported_start_window":
      return "Your recent effort is later than every supported plan start. Review the effort date or race date before continuing.";
    case "supported_start_window_has_passed":
      return "The supported start window for this marathon date has already passed. Choose a later race before building a plan.";
  }
}

export default function PlanProposalBuilder({
  profile,
  generatorVersion,
  rules,
  onEditProfile,
  approval,
  today,
}: PlanProposalBuilderProps) {
  const idPrefix = useId();
  const [planStartDate, setPlanStartDate] = useState<DateOnly | "">("");
  const [safetyAnswer, setSafetyAnswer] = useState<SafetyAnswer>("");
  const [validationErrors, setValidationErrors] =
    useState<BuilderValidationErrors>(noValidationErrors);
  const [outcome, setOutcome] = useState<BuilderOutcome>({ kind: "form" });
  const firstPlanStartInput = useRef<HTMLInputElement>(null);
  const firstSafetyInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPlanStartDate("");
    setSafetyAnswer("");
    setValidationErrors(noValidationErrors);
    setOutcome({ kind: "form" });
  }, [profile?.updatedAt]);

  const profileComplete = isRunnerProfileOnboardingComplete(profile);
  const currentDate =
    today ?? (profile === null ? null : dateOnlyInTimeZone(profile.timeZone));
  const candidates = createPlanStartDateCandidates(profile, rules, {
    ...(currentDate === null ? {} : { notBefore: currentDate }),
  });

  const reviewInputs = () => setOutcome({ kind: "form" });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValidationErrors = {
      planStartDate: planStartDate === "",
      safetyAnswer: safetyAnswer === "",
    };
    setValidationErrors(nextValidationErrors);

    if (nextValidationErrors.planStartDate) {
      firstPlanStartInput.current?.focus();
      return;
    }
    if (nextValidationErrors.safetyAnswer) {
      firstSafetyInput.current?.focus();
      return;
    }
    if (profile === null || planStartDate === "" || safetyAnswer === "") {
      return;
    }

    const inputResult = createPlanGenerationInputFromProfile(profile, {
      planStartDate,
      rulesetVersion: rules.rulesetVersion,
      safetySignal: safetyAnswer,
    });
    if (inputResult.kind !== "ready") return;

    setOutcome({
      kind: "result",
      input: inputResult.input,
      distanceUnit: profile.preferredDistanceUnit,
      result: generateDeterministicPlan({
        input: inputResult.input,
        cohortEligibilityConfirmed:
          profile.completionGoal === "complete_first_marathon",
        generatorVersion,
        rules,
      }),
    });
  };

  if (outcome.kind === "result") {
    return (
      <div className="plan-proposal-builder plan-proposal-result">
        <p className="plan-proposal-boundary" role="note">
          This owner-dogfood plan uses provisional training rules. It is for
          internal testing and has not received external methodology review.
        </p>
        <PlanGenerationResultView
          input={outcome.input}
          result={outcome.result}
          distanceUnit={outcome.distanceUnit}
          supportRules={rules}
          onReviewInputs={reviewInputs}
          onReviewRunnerProfile={onEditProfile}
          approval={approval}
        />
      </div>
    );
  }

  if (!profileComplete) {
    return (
      <section
        className="plan-proposal-builder plan-proposal-unavailable"
        aria-labelledby={`${idPrefix}-title`}
      >
        <p className="plan-proposal-eyebrow">Build your plan</p>
        <h2 id={`${idPrefix}-title`}>Finish your starting point first</h2>
        <p>
          Marathoner needs your recent running, race timing, and weekly
          availability before it can evaluate a plan.
        </p>
        <button type="button" onClick={onEditProfile}>
          Finish runner setup
        </button>
      </section>
    );
  }

  if (candidates.kind === "unavailable") {
    return (
      <section
        className="plan-proposal-builder plan-proposal-unavailable"
        aria-labelledby={`${idPrefix}-title`}
      >
        <p className="plan-proposal-eyebrow">Build your plan</p>
        <h2 id={`${idPrefix}-title`}>Review your starting point</h2>
        <p>{unavailableMessage(candidates.reason)}</p>
        <button type="button" onClick={onEditProfile}>
          Review runner setup
        </button>
      </section>
    );
  }

  return (
    <section
      className="plan-proposal-builder"
      aria-labelledby={`${idPrefix}-title`}
    >
      <header className="plan-proposal-header">
        <p className="plan-proposal-eyebrow">Build your plan</p>
        <h2 id={`${idPrefix}-title`}>Choose where training begins</h2>
        <p>
          Marathoner will build a proposal from your saved starting point. You
          will review the complete schedule before anything can become active.
        </p>
      </header>

      <p className="plan-proposal-boundary" role="note">
        Owner dogfood only. The current training rules are provisional and
        have not received external methodology review.
      </p>

      <form className="plan-proposal-form" onSubmit={handleSubmit}>
        <fieldset
          className="plan-proposal-start-dates"
          aria-describedby={
            validationErrors.planStartDate
              ? `${idPrefix}-plan-start-help ${idPrefix}-plan-start-error`
              : `${idPrefix}-plan-start-help`
          }
        >
          <legend>When should this plan start?</legend>
          <p id={`${idPrefix}-plan-start-help`}>
            These dates align with your marathon date and preferred long-run
            day.
          </p>
          <div className="plan-proposal-choice-grid">
            {candidates.candidates.map((candidate, index) => (
              <label key={candidate.date}>
                <input
                  ref={index === 0 ? firstPlanStartInput : undefined}
                  type="radio"
                  name={`${idPrefix}-plan-start`}
                  value={candidate.date}
                  checked={planStartDate === candidate.date}
                  aria-invalid={validationErrors.planStartDate}
                  onChange={() => {
                    setPlanStartDate(candidate.date);
                    setValidationErrors((current) => ({
                      ...current,
                      planStartDate: false,
                    }));
                    setOutcome({ kind: "form" });
                  }}
                />
                <span>
                  <strong>{formatPlanStartDate(candidate.date)}</strong>
                  <small>{candidate.wholeWeeksToRace} weeks to race day</small>
                </span>
              </label>
            ))}
          </div>
          {validationErrors.planStartDate && (
            <p
              id={`${idPrefix}-plan-start-error`}
              className="plan-proposal-field-error"
              role="alert"
            >
              Choose when this plan should start.
            </p>
          )}
        </fieldset>

        <fieldset
          className="plan-proposal-safety"
          aria-describedby={
            validationErrors.safetyAnswer
              ? `${idPrefix}-safety-help ${idPrefix}-safety-error`
              : `${idPrefix}-safety-help`
          }
        >
          <legend>
            Are pain or unusual symptoms currently affecting your running?
          </legend>
          <p id={`${idPrefix}-safety-help`}>
            This helps Marathoner avoid creating a plan when a training plan is
            not the right next step.
          </p>
          <div className="plan-proposal-safety-choices">
            <label>
              <input
                ref={firstSafetyInput}
                type="radio"
                name={`${idPrefix}-safety`}
                value="none_reported"
                checked={safetyAnswer === "none_reported"}
                aria-invalid={validationErrors.safetyAnswer}
                onChange={() => {
                  setSafetyAnswer("none_reported");
                  setValidationErrors((current) => ({
                    ...current,
                    safetyAnswer: false,
                  }));
                }}
              />
              No
            </label>
            <label>
              <input
                type="radio"
                name={`${idPrefix}-safety`}
                value="pain_or_unusual_symptoms_reported"
                checked={
                  safetyAnswer === "pain_or_unusual_symptoms_reported"
                }
                aria-invalid={validationErrors.safetyAnswer}
                onChange={() => {
                  setSafetyAnswer("pain_or_unusual_symptoms_reported");
                  setValidationErrors((current) => ({
                    ...current,
                    safetyAnswer: false,
                  }));
                }}
              />
              Yes
            </label>
          </div>
          {validationErrors.safetyAnswer && (
            <p
              id={`${idPrefix}-safety-error`}
              className="plan-proposal-field-error"
              role="alert"
            >
              Choose Yes or No before creating a plan proposal.
            </p>
          )}
        </fieldset>

        <div className="plan-proposal-actions">
          <button type="button" className="secondary" onClick={onEditProfile}>
            Review runner setup
          </button>
          <button type="submit">
            Create plan proposal
          </button>
        </div>
      </form>
    </section>
  );
}
