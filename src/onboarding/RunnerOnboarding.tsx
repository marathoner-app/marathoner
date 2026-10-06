import {
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  DistanceUnit,
  UserProfile,
  Weekday,
} from "../domain/training";
import type { SaveUserProfileInput } from "../persistence/trainingRepositories";
import {
  changeRunnerProfileDraftUnit,
  createRunnerProfileDraft,
  isRunnerProfileOnboardingComplete,
  runnerProfileDraftToInput,
  validateRunnerProfileDraft,
  type RunnerProfileDraft,
  type RunnerProfileDraftField,
  type RunnerProfileDraftErrors,
} from "./runnerProfileDraft";

interface RunnerOnboardingProps {
  readonly profile: UserProfile | null;
  readonly onSave: (input: SaveUserProfileInput) => Promise<UserProfile>;
  readonly onClose: () => void;
}

const weekdayOptions: readonly { value: Weekday; label: string }[] = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

const validationFieldByDraftField: Partial<
  Record<keyof RunnerProfileDraft, RunnerProfileDraftField>
> = {
  displayName: "displayName",
  experienceLevel: "experienceLevel",
  raceTimingMode: "targetRace",
  raceDate: "targetRace",
  raceWindowStartDate: "targetRace",
  raceWindowEndDate: "targetRace",
  currentWeeklyDistance: "currentWeeklyDistance",
  currentRunningFrequencyDaysPerWeek:
    "currentRunningFrequencyDaysPerWeek",
  longestRecentRunDistance: "longestRecentRunDistance",
  recentPerformanceDate: "recentPerformance",
  recentPerformanceDistance: "recentPerformance",
  recentPerformanceDurationMinutes: "recentPerformance",
  preferredLongRunDay: "preferredLongRunDay",
  scheduleConstraints: "scheduleConstraints",
  completionGoalConfirmed: "completionGoal",
};

function currentTimeZone(profile: UserProfile | null): string {
  if (profile !== null) return profile.timeZone;

  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return detected || "UTC";
}

function distanceLabel(unit: DistanceUnit): string {
  return unit === "mile" ? "miles" : "kilometers";
}

export default function RunnerOnboarding({
  profile,
  onSave,
  onClose,
}: RunnerOnboardingProps) {
  const [draft, setDraft] = useState(() => createRunnerProfileDraft(profile));
  const [errors, setErrors] = useState<RunnerProfileDraftErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const wasComplete = isRunnerProfileOnboardingComplete(profile);
  const unitLabel = distanceLabel(draft.preferredDistanceUnit);

  const update = <Key extends keyof RunnerProfileDraft>(
    field: Key,
    value: RunnerProfileDraft[Key],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
    const validationField = validationFieldByDraftField[field];
    if (validationField !== undefined) {
      setErrors((current) => {
        const next = { ...current };
        delete next[validationField];
        return next;
      });
    }
    setSubmitError(null);
  };

  const toggleTrainingDay = (day: Weekday) => {
    setDraft((current) => {
      const selected = current.availableTrainingDays.includes(day);
      const availableTrainingDays = selected
        ? current.availableTrainingDays.filter((candidate) => candidate !== day)
        : [...current.availableTrainingDays, day];

      return {
        ...current,
        availableTrainingDays,
        preferredLongRunDay:
          selected && current.preferredLongRunDay === day
            ? ""
            : current.preferredLongRunDay,
      };
    });
    setErrors((current) => ({
      ...current,
      availableTrainingDays: undefined,
      preferredLongRunDay: undefined,
    }));
    setSubmitError(null);
  };

  const save = async (requireComplete: boolean) => {
    const nextErrors = validateRunnerProfileDraft(draft, requireComplete);
    setErrors(nextErrors);
    setSubmitError(null);

    if (Object.keys(nextErrors).length > 0) {
      focusErrorSummary();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(runnerProfileDraftToInput(draft, currentTimeZone(profile)));
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Your runner profile could not be saved. Please try again.",
      );
      focusErrorSummary();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save(true);
  };

  const hasErrors = Object.keys(errors).length > 0 || submitError !== null;

  function focusErrorSummary() {
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    errorSummaryRef.current?.focus();
  }

  return (
    <section
      className="onboarding-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="onboarding-card">
        <header className="onboarding-header">
          <div>
            <p className="onboarding-eyebrow">Runner setup</p>
            <h1 id="onboarding-title">
              {wasComplete ? "Review your starting point" : "Tell us where you are starting"}
            </h1>
            <p>
              These answers give Marathoner the context to evaluate a first-marathon
              path. They do not create a plan or promise a finish time yet.
            </p>
          </div>
          <button
            type="button"
            className="onboarding-close"
            onClick={onClose}
            disabled={isSaving}
          >
            {wasComplete ? "Cancel" : "Continue later"}
          </button>
        </header>

        {hasErrors && (
          <div
            ref={errorSummaryRef}
            className="onboarding-error-summary"
            role="alert"
            tabIndex={-1}
          >
            {submitError ??
              "A few answers need attention. Your other entries are still here."}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate aria-busy={isSaving}>
          <div className="onboarding-grid">
            <div className="onboarding-question">
              <label htmlFor="runner-display-name">
                What should we call you? <span>(optional)</span>
              </label>
              <p id="runner-display-name-help">
                This personalizes the experience; your account email remains unchanged.
              </p>
              <input
                id="runner-display-name"
                type="text"
                autoComplete="name"
                maxLength={121}
                value={draft.displayName}
                aria-describedby={`runner-display-name-help${errors.displayName ? " runner-display-name-error" : ""}`}
                aria-invalid={errors.displayName ? "true" : undefined}
                onChange={(event) => update("displayName", event.target.value)}
              />
              {errors.displayName && (
                <p id="runner-display-name-error" className="onboarding-field-error">
                  {errors.displayName}
                </p>
              )}
            </div>

            <fieldset className="onboarding-question">
              <legend>Which distance unit feels natural?</legend>
              <p>This keeps every distance question in the unit you already use.</p>
              <div className="onboarding-choice-row">
                {(["mile", "kilometer"] as const).map((unit) => (
                  <label key={unit}>
                    <input
                      type="radio"
                      name="distance-unit"
                      value={unit}
                      checked={draft.preferredDistanceUnit === unit}
                      onChange={() => {
                        setDraft((current) =>
                          changeRunnerProfileDraftUnit(current, unit),
                        );
                        setSubmitError(null);
                      }}
                    />
                    {unit === "mile" ? "Miles" : "Kilometers"}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="onboarding-question onboarding-question-wide">
              <legend>Which best describes your recent running?</legend>
              <p id="runner-experience-help">
                Recent consistency helps us identify whether this founding-beta path
                supports your starting point. An unsupported answer will receive an
                honest explanation later, not an improvised plan.
              </p>
              <div className="onboarding-option-grid">
                {[
                  ["consistent", "I run consistently now"],
                  ["inconsistent", "My running has been inconsistent"],
                  ["returning", "I am returning after time away"],
                  ["not_running", "I am not currently running"],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="experience-level"
                      value={value}
                      checked={draft.experienceLevel === value}
                      aria-describedby={`runner-experience-help${errors.experienceLevel ? " runner-experience-error" : ""}`}
                      onChange={() =>
                        update(
                          "experienceLevel",
                          value as RunnerProfileDraft["experienceLevel"],
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              {errors.experienceLevel && (
                <p id="runner-experience-error" className="onboarding-field-error">
                  {errors.experienceLevel}
                </p>
              )}
            </fieldset>

            <fieldset className="onboarding-question onboarding-question-wide">
              <legend>When are you hoping to run your marathon?</legend>
              <p id="runner-race-help">
                The available preparation time determines whether a responsible plan
                is possible. A target window is fine if you have not chosen a race.
              </p>
              <div className="onboarding-choice-row">
                <label>
                  <input
                    type="radio"
                    name="race-timing"
                    checked={draft.raceTimingMode === "date"}
                    onChange={() => update("raceTimingMode", "date")}
                  />
                  I have a date
                </label>
                <label>
                  <input
                    type="radio"
                    name="race-timing"
                    checked={draft.raceTimingMode === "window"}
                    onChange={() => update("raceTimingMode", "window")}
                  />
                  I have a target window
                </label>
              </div>
              {draft.raceTimingMode === "date" && (
                <label className="onboarding-inline-field" htmlFor="runner-race-date">
                  Marathon date
                  <input
                    id="runner-race-date"
                    type="date"
                    value={draft.raceDate}
                    aria-describedby={`runner-race-help${errors.targetRace ? " runner-race-error" : ""}`}
                    aria-invalid={errors.targetRace ? "true" : undefined}
                    onChange={(event) => update("raceDate", event.target.value)}
                  />
                </label>
              )}
              {draft.raceTimingMode === "window" && (
                <div className="onboarding-date-row">
                  <label htmlFor="runner-race-window-start">
                    Window begins
                    <input
                    id="runner-race-window-start"
                    type="date"
                    value={draft.raceWindowStartDate}
                    aria-describedby={`runner-race-help${errors.targetRace ? " runner-race-error" : ""}`}
                    aria-invalid={errors.targetRace ? "true" : undefined}
                      onChange={(event) =>
                        update("raceWindowStartDate", event.target.value)
                      }
                    />
                  </label>
                  <label htmlFor="runner-race-window-end">
                    Window ends
                    <input
                      id="runner-race-window-end"
                      type="date"
                      value={draft.raceWindowEndDate}
                      aria-describedby={errors.targetRace ? "runner-race-error" : undefined}
                      aria-invalid={errors.targetRace ? "true" : undefined}
                      onChange={(event) =>
                        update("raceWindowEndDate", event.target.value)
                      }
                    />
                  </label>
                </div>
              )}
              {errors.targetRace && (
                <p id="runner-race-error" className="onboarding-field-error">
                  {errors.targetRace}
                </p>
              )}
            </fieldset>

            <div className="onboarding-question">
              <label htmlFor="runner-weekly-distance">
                About how many {unitLabel} do you run in a current week?
              </label>
              <p id="runner-weekly-distance-help">
                A usual recent week gives a more useful starting point than your best week.
              </p>
              <input
                id="runner-weekly-distance"
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={draft.currentWeeklyDistance}
                aria-describedby={`runner-weekly-distance-help${errors.currentWeeklyDistance ? " runner-weekly-distance-error" : ""}`}
                aria-invalid={errors.currentWeeklyDistance ? "true" : undefined}
                onChange={(event) =>
                  update("currentWeeklyDistance", event.target.value)
                }
              />
              {errors.currentWeeklyDistance && (
                <p id="runner-weekly-distance-error" className="onboarding-field-error">
                  {errors.currentWeeklyDistance}
                </p>
              )}
            </div>

            <div className="onboarding-question">
              <label htmlFor="runner-frequency">
                How many days per week do you currently run?
              </label>
              <p id="runner-frequency-help">
                Frequency helps distinguish a stable routine from one unusually large week.
              </p>
              <input
                id="runner-frequency"
                type="number"
                min="0"
                max="7"
                step="1"
                inputMode="numeric"
                value={draft.currentRunningFrequencyDaysPerWeek}
                aria-describedby={`runner-frequency-help${errors.currentRunningFrequencyDaysPerWeek ? " runner-frequency-error" : ""}`}
                aria-invalid={errors.currentRunningFrequencyDaysPerWeek ? "true" : undefined}
                onChange={(event) =>
                  update(
                    "currentRunningFrequencyDaysPerWeek",
                    event.target.value,
                  )
                }
              />
              {errors.currentRunningFrequencyDaysPerWeek && (
                <p id="runner-frequency-error" className="onboarding-field-error">
                  {errors.currentRunningFrequencyDaysPerWeek}
                </p>
              )}
            </div>

            <div className="onboarding-question">
              <label htmlFor="runner-longest-run">
                What is your longest recent continuous run in {unitLabel}?
              </label>
              <p id="runner-longest-run-help">
                This helps us avoid treating weekly volume as if it were one long run.
              </p>
              <input
                id="runner-longest-run"
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={draft.longestRecentRunDistance}
                aria-describedby={`runner-longest-run-help${errors.longestRecentRunDistance ? " runner-longest-run-error" : ""}`}
                aria-invalid={errors.longestRecentRunDistance ? "true" : undefined}
                onChange={(event) =>
                  update("longestRecentRunDistance", event.target.value)
                }
              />
              {errors.longestRecentRunDistance && (
                <p id="runner-longest-run-error" className="onboarding-field-error">
                  {errors.longestRecentRunDistance}
                </p>
              )}
            </div>

            <fieldset className="onboarding-question onboarding-question-wide">
              <legend>Which days can you usually train?</legend>
              <p id="runner-days-help">
                We use availability to fit training into your life instead of assuming
                a seven-day schedule. Your preferred long-run day anchors the largest
                session in a future plan.
              </p>
              <div className="onboarding-day-grid">
                {weekdayOptions.map(({ value, label }) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      checked={draft.availableTrainingDays.includes(value)}
                      aria-describedby={`runner-days-help${errors.availableTrainingDays ? " runner-days-error" : ""}`}
                      onChange={() => toggleTrainingDay(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {errors.availableTrainingDays && (
                <p id="runner-days-error" className="onboarding-field-error">
                  {errors.availableTrainingDays}
                </p>
              )}
              <label className="onboarding-inline-field" htmlFor="runner-long-run-day">
                Preferred long-run day
                <select
                  id="runner-long-run-day"
                  value={draft.preferredLongRunDay}
                  aria-invalid={errors.preferredLongRunDay ? "true" : undefined}
                  aria-describedby={errors.preferredLongRunDay ? "runner-long-run-day-error" : undefined}
                  onChange={(event) =>
                    update(
                      "preferredLongRunDay",
                      event.target.value as RunnerProfileDraft["preferredLongRunDay"],
                    )
                  }
                >
                  <option value="">Choose a day</option>
                  {weekdayOptions
                    .filter(({ value }) =>
                      draft.availableTrainingDays.includes(value),
                    )
                    .map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              {errors.preferredLongRunDay && (
                <p id="runner-long-run-day-error" className="onboarding-field-error">
                  {errors.preferredLongRunDay}
                </p>
              )}
            </fieldset>

            <fieldset className="onboarding-question onboarding-question-wide">
              <legend>Representative recent effort <span>(optional)</span></legend>
              <p id="runner-performance-help">
                If you have one, a recent race or steady run adds context. You can leave
                all three fields blank; pace is not a finish-time promise.
              </p>
              <div className="onboarding-three-column-row">
                <label htmlFor="runner-performance-date">
                  Date
                  <input
                    id="runner-performance-date"
                    type="date"
                    value={draft.recentPerformanceDate}
                    aria-describedby={`runner-performance-help${errors.recentPerformance ? " runner-performance-error" : ""}`}
                    aria-invalid={errors.recentPerformance ? "true" : undefined}
                    onChange={(event) =>
                      update("recentPerformanceDate", event.target.value)
                    }
                  />
                </label>
                <label htmlFor="runner-performance-distance">
                  Distance ({unitLabel})
                  <input
                    id="runner-performance-distance"
                    type="number"
                    min="0.1"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.recentPerformanceDistance}
                    aria-describedby={`runner-performance-help${errors.recentPerformance ? " runner-performance-error" : ""}`}
                    aria-invalid={errors.recentPerformance ? "true" : undefined}
                    onChange={(event) =>
                      update("recentPerformanceDistance", event.target.value)
                    }
                  />
                </label>
                <label htmlFor="runner-performance-duration">
                  Elapsed minutes
                  <input
                    id="runner-performance-duration"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="decimal"
                    value={draft.recentPerformanceDurationMinutes}
                    aria-describedby={`runner-performance-help${errors.recentPerformance ? " runner-performance-error" : ""}`}
                    aria-invalid={errors.recentPerformance ? "true" : undefined}
                    onChange={(event) =>
                      update(
                        "recentPerformanceDurationMinutes",
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>
              {errors.recentPerformance && (
                <p id="runner-performance-error" className="onboarding-field-error">
                  {errors.recentPerformance}
                </p>
              )}
            </fieldset>

            <div className="onboarding-question onboarding-question-wide">
              <label htmlFor="runner-constraints">
                What schedule constraints should we respect? <span>(optional)</span>
              </label>
              <p id="runner-constraints-help">
                Examples include travel, shift work, or days that cannot support a long run.
                This keeps future scheduling realistic. Do not include medical details.
              </p>
              <textarea
                id="runner-constraints"
                rows={3}
                maxLength={501}
                value={draft.scheduleConstraints}
                aria-describedby={`runner-constraints-help${errors.scheduleConstraints ? " runner-constraints-error" : ""}`}
                aria-invalid={errors.scheduleConstraints ? "true" : undefined}
                onChange={(event) =>
                  update("scheduleConstraints", event.target.value)
                }
              />
              <p className="onboarding-character-count">
                {draft.scheduleConstraints.length}/500
              </p>
              {errors.scheduleConstraints && (
                <p id="runner-constraints-error" className="onboarding-field-error">
                  {errors.scheduleConstraints}
                </p>
              )}
            </div>

            <fieldset className="onboarding-question onboarding-question-wide">
              <legend>What is the goal for this first plan?</legend>
              <p id="runner-goal-help">
                The founding beta is completion-focused. Finish-time targeting waits
                until enough trustworthy training data exists.
              </p>
              <label className="onboarding-confirmation">
                <input
                  type="checkbox"
                  checked={draft.completionGoalConfirmed}
                  aria-describedby={`runner-goal-help${errors.completionGoal ? " runner-goal-error" : ""}`}
                  onChange={(event) =>
                    update("completionGoalConfirmed", event.target.checked)
                  }
                />
                Complete my first marathon feeling prepared and in control
              </label>
              {errors.completionGoal && (
                <p id="runner-goal-error" className="onboarding-field-error">
                  {errors.completionGoal}
                </p>
              )}
            </fieldset>
          </div>

          <footer className="onboarding-actions">
            <p>Saving progress does not generate or activate a training plan.</p>
            <div>
              <button
                type="button"
                className="onboarding-secondary-action"
                disabled={isSaving}
                onClick={() => void save(false)}
              >
                {isSaving ? "Saving…" : "Save progress"}
              </button>
              <button type="submit" disabled={isSaving}>
                {isSaving
                  ? "Saving…"
                  : wasComplete
                    ? "Save changes"
                    : "Complete setup"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </section>
  );
}
