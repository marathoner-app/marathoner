import draftFixturesText from "../docs/methodology/artifacts/beta-adaptation/0.1.0-draft/fixtures.json?raw";
import draftRulesText from "../docs/methodology/artifacts/beta-adaptation/0.1.0-draft/beta-adaptation.json?raw";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import InternalLiveAdaptationRehearsal from "../src/components/InternalLiveAdaptationRehearsal";
import {
  createInternalAdaptationScenarioPacket,
  valuesForInternalAdaptationScenario,
  type DraftAdaptationFixtureValues,
} from "../src/components/internalAdaptationScenarioPacket";
import { inputForInternalLiveAdaptation } from "../src/components/internalLiveAdaptationEvaluation";
import {
  ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
  createDateOnly,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  type AdaptationHistoryEvidenceV1,
} from "../src/domain/training";

const packet = createInternalAdaptationScenarioPacket(
  draftRulesText,
  draftFixturesText,
);

function fixtureValues(id: string): DraftAdaptationFixtureValues {
  const fixture = packet.cases.find((candidate) => candidate.id === id);
  if (fixture === undefined) throw new Error(`Missing fixture ${id}.`);
  return valuesForInternalAdaptationScenario(packet, fixture);
}

function evidenceFor(
  values: DraftAdaptationFixtureValues,
): AdaptationHistoryEvidenceV1 {
  return {
    schemaVersion: ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
    ownerId: createUserId("owner-1"),
    activePlanId: createTrainingPlanId("plan-1"),
    activePlanRevision: values.activePlanRevision,
    evaluatedPlanRevision: values.evaluatedPlanRevision,
    activePlanStatus: "active",
    evaluationDate: createDateOnly("2026-10-27"),
    currentWeekStartDate: createDateOnly("2026-10-26"),
    currentWeekEndDate: createDateOnly("2026-11-01"),
    triggerWorkoutId: createPlannedWorkoutId("workout-1"),
    triggerKind: values.triggerKind,
    currentWeek: values.currentWeek,
    daysUntilRace: values.daysUntilRace,
    daysSinceLastCompletedPlannedRun:
      values.daysSinceLastCompletedPlannedRun,
    recentRunCount: values.recentEfforts.length,
    recentEfforts: values.recentEfforts,
    recentRunsMissingPerceivedEffort: 0,
    safetyGateState: values.safetyGateState,
  };
}

async function fillTrustedFacts(
  user: ReturnType<typeof userEvent.setup>,
  values: DraftAdaptationFixtureValues,
  coreWeek = values.currentCoreWeek,
) {
  await user.type(screen.getByLabelText("Current core week"), String(coreWeek));
  await user.selectOptions(
    screen.getByLabelText("Current week kind"),
    values.currentWeekKind,
  );
  await user.selectOptions(
    screen.getByLabelText("Next week kind"),
    values.nextWeekKind,
  );
  await user.selectOptions(
    screen.getByLabelText("Does the next week introduce progression?"),
    values.nextWeekIntroducesProgression ? "yes" : "no",
  );

  if (!values.rescheduleCandidate.present) {
    await user.selectOptions(
      screen.getByLabelText("Candidate state"),
      "none",
    );
  } else {
    await user.selectOptions(
      screen.getByLabelText("Candidate state"),
      "present",
    );
    await user.selectOptions(
      screen.getByLabelText("Workout purpose"),
      values.rescheduleCandidate.workoutPurpose ?? "",
    );
    await user.type(
      screen.getByLabelText("Delay in calendar days"),
      String(values.rescheduleCandidate.delayCalendarDays),
    );
    await user.selectOptions(
      screen.getByLabelText("Candidate remains in the same plan week"),
      values.rescheduleCandidate.samePlanWeek ? "yes" : "no",
    );
    await user.selectOptions(
      screen.getByLabelText("Runner confirmed the candidate date is available"),
      values.rescheduleCandidate.runnerConfirmedAvailable ? "yes" : "no",
    );
    await user.selectOptions(
      screen.getByLabelText("Candidate date has no other workout"),
      values.rescheduleCandidate.targetDateEmpty ? "yes" : "no",
    );
    await user.type(
      screen.getByLabelText("Consecutive run dates after the move"),
      String(values.rescheduleCandidate.consecutiveRunDatesAfterMove),
    );
  }

  await user.click(
    screen.getByRole("checkbox", {
      name: /confirm that these supplied facts are complete/iu,
    }),
  );
}

describe("InternalLiveAdaptationRehearsal", () => {
  it("waits for explicit facts, evaluates live evidence, and resets a session choice", async () => {
    const values = fixtureValues("hold-at-two-hard-effort-boundary");
    const user = userEvent.setup();
    render(
      <InternalLiveAdaptationRehearsal
        evidence={evidenceFor(values)}
        packet={packet}
      />,
    );

    expect(screen.getByText("beta-rules@0.1.0-draft")).toBeVisible();
    expect(screen.getByText("beta-adaptation@0.1.0-draft")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Evaluate live draft evidence" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("heading", { name: "Internal draft result" }),
    ).not.toBeInTheDocument();

    await fillTrustedFacts(user, values);
    await user.click(
      screen.getByRole("button", { name: "Evaluate live draft evidence" }),
    );

    expect(
      screen.getByText("ADAPT-HOLD-REPEATED-HARD-EFFORT"),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Internal Hold progression" }),
    ).toBeVisible();
    expect(
      screen.getByText(/synchronized owner evidence matched/iu),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Apply in rehearsal" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "Session choice recorded: Apply draft change",
      }),
    ).toBeVisible();

    await user.selectOptions(
      screen.getByLabelText("Current week kind"),
      "cutback",
    );
    expect(
      screen.queryByRole("heading", {
        name: "Session choice recorded: Apply draft change",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("ADAPT-HOLD-REPEATED-HARD-EFFORT"),
    ).not.toBeInTheDocument();
  });

  it("shows invalid assembled input without exposing a plan choice", async () => {
    const values = fixtureValues("hold-at-two-hard-effort-boundary");
    const user = userEvent.setup();
    render(
      <InternalLiveAdaptationRehearsal
        evidence={{ ...evidenceFor(values), activePlanRevision: -1 }}
        packet={packet}
      />,
    );

    await fillTrustedFacts(user, values);
    await user.click(
      screen.getByRole("button", { name: "Evaluate live draft evidence" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("activePlanRevision");
    expect(
      screen.queryByRole("button", { name: "Apply in rehearsal" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Keep in rehearsal" }),
    ).not.toBeInTheDocument();
  });

  it("renders no plan choice for a no-change live result", async () => {
    const values = fixtureValues("no-change-on-track");
    const user = userEvent.setup();
    render(
      <InternalLiveAdaptationRehearsal
        evidence={evidenceFor(values)}
        packet={packet}
      />,
    );

    await fillTrustedFacts(user, values);
    await user.click(
      screen.getByRole("button", { name: "Evaluate live draft evidence" }),
    );

    expect(screen.getAllByText("No change")).toHaveLength(2);
    expect(screen.getByText("ADAPT-NO-CHANGE-ON-TRACK")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Apply in rehearsal" }),
    ).not.toBeInTheDocument();
  });

  it("assembles only normalized history and explicit trusted facts", () => {
    const values = fixtureValues("no-change-on-track");
    const evidence = evidenceFor(values);
    const input = inputForInternalLiveAdaptation(evidence, packet, {
      currentCoreWeek: values.currentCoreWeek,
      currentWeekKind: values.currentWeekKind,
      nextWeekKind: values.nextWeekKind,
      nextWeekIntroducesProgression: values.nextWeekIntroducesProgression,
      rescheduleCandidate: values.rescheduleCandidate,
      inputCompletenessConfirmed: true,
    });

    expect(input).toMatchObject({
      basePlanArtifactVersion: "beta-rules@0.1.0-draft",
      adaptationArtifactVersion: "beta-adaptation@0.1.0-draft",
      activePlanRevision: evidence.activePlanRevision,
      evaluatedPlanRevision: evidence.evaluatedPlanRevision,
      currentWeek: evidence.currentWeek,
      recentEfforts: evidence.recentEfforts,
      inputCompletenessConfirmed: true,
    });
  });
});
