import type {
  ActivePlanState,
  CompletedRun,
  GeneratedPlanResultV1,
  PlannedWorkout,
  TrainingPlan,
  UserId,
  UserProfile,
} from "../domain/training";
import "./InternalDogfoodJourneyOverview.css";

interface InternalDogfoodJourneyOverviewProps {
  readonly ownerId: UserId;
  readonly profile: UserProfile | null;
  readonly activePlanState: ActivePlanState | null;
  readonly plans: readonly TrainingPlan[];
  readonly workouts: readonly PlannedWorkout[];
  readonly runs: readonly CompletedRun[];
  readonly sessionDraftPlan: GeneratedPlanResultV1 | null;
}

interface EvidenceStatus {
  readonly label: string;
  readonly ready: boolean;
  readonly readyText: string;
  readonly missingText: string;
}

const journeySteps = [
  {
    href: "#internal-plan-proposal",
    title: "Review a draft plan",
    description:
      "Use the saved runner setup to generate, inspect, and activate a draft only for this browser session.",
  },
  {
    href: "#internal-adaptation-history",
    title: "Inspect synchronized history",
    description:
      "Read the real owner snapshot and verify whether its plan, workouts, and completed runs form coherent adaptation evidence.",
  },
  {
    href: "#internal-adaptation-scenarios",
    title: "Compare frozen adaptation cases",
    description:
      "Run the pinned fixtures through the same deterministic evaluator before trusting a live-history result.",
  },
  {
    href: "#internal-guidance-review",
    title: "Review draft guidance",
    description:
      "Inspect the exact disabled copy and limitations that could accompany a future recommendation.",
  },
  {
    href: "#internal-safety-review",
    title: "Rehearse safety escalation",
    description:
      "Verify that pain and unusual-symptom fixtures withhold training behavior at the intended boundaries.",
  },
] as const;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

export default function InternalDogfoodJourneyOverview({
  ownerId,
  profile,
  activePlanState,
  plans,
  workouts,
  runs,
  sessionDraftPlan,
}: InternalDogfoodJourneyOverviewProps) {
  const synchronizedPlanReady =
    activePlanState !== null &&
    activePlanState.userId === ownerId &&
    plans.some(
      (plan) =>
        plan.userId === ownerId && plan.id === activePlanState.activePlanId,
    );
  const synchronizedWorkoutHistoryReady = workouts.some(
    (workout) =>
      workout.userId === ownerId &&
      (activePlanState === null ||
        workout.planId === activePlanState.activePlanId),
  );
  const synchronizedRunHistoryReady = runs.some(
    (run) => run.userId === ownerId,
  );
  const evidenceStatuses: readonly EvidenceStatus[] = [
    {
      label: "Runner setup",
      ready: profile !== null,
      readyText: "Saved profile present",
      missingText: "Save runner setup first",
    },
    {
      label: "Active plan data",
      ready: synchronizedPlanReady,
      readyText: "Synchronized plan found",
      missingText: "No synchronized active plan",
    },
    {
      label: "Workout history",
      ready: synchronizedWorkoutHistoryReady,
      readyText: "Synchronized workouts found",
      missingText: "No synchronized workouts",
    },
    {
      label: "Completed-run history",
      ready: synchronizedRunHistoryReady,
      readyText: "Synchronized runs found",
      missingText: "No synchronized runs",
    },
  ];

  return (
    <section
      className="internal-dogfood-journey"
      aria-labelledby="internal-dogfood-journey-title"
    >
      <header>
        <p className="internal-dogfood-journey-eyebrow">
          Owner-only dogfood workspace
        </p>
        <h2 id="internal-dogfood-journey-title">
          Rehearse the complete training loop
        </h2>
        <p>
          Follow these steps in order when evaluating the current internal
          build. A ready status means the evidence exists; it does not mean the
          draft methodology is approved for participants.
        </p>
      </header>

      <section
        className={`internal-dogfood-session-draft ${
          sessionDraftPlan === null ? "is-not-ready" : "is-ready"
        }`}
        aria-labelledby="internal-dogfood-session-draft-title"
      >
        <h3 id="internal-dogfood-session-draft-title">Session draft plan</h3>
        {sessionDraftPlan === null ? (
          <p>No draft plan is active in this rehearsal session.</p>
        ) : (
          <>
            <p>
              <strong>{sessionDraftPlan.plan.name}</strong> is active only in
              this workspace session.
            </p>
            <p>
              Starts {formatDate(sessionDraftPlan.plan.startDate)} · Race day{" "}
              {formatDate(sessionDraftPlan.plan.targetRaceDate)}
            </p>
          </>
        )}
      </section>

      <ul
        className="internal-dogfood-evidence"
        aria-label="Synchronized owner evidence"
      >
        {evidenceStatuses.map((status) => (
          <li
            key={status.label}
            className={status.ready ? "is-ready" : "is-not-ready"}
          >
            <span className="internal-dogfood-evidence-label">
              {status.label}
            </span>
            <span>{status.ready ? status.readyText : status.missingText}</span>
          </li>
        ))}
      </ul>

      <aside className="internal-dogfood-boundary" aria-label="Data boundary">
        <strong>Keep the two data lanes separate.</strong> Draft plan activation
        lasts only for this rehearsal session and never writes Firestore. Live
        adaptation history reads the synchronized owner plan, workouts, and
        runs shown above.
      </aside>

      <nav aria-label="Internal dogfood journey">
        <ol>
          {journeySteps.map((step) => (
            <li key={step.href}>
              <a href={step.href}>{step.title}</a>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </nav>
    </section>
  );
}
