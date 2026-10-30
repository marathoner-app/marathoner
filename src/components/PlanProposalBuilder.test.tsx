import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  createDateOnly,
  createDistanceMeters,
  createIanaTimeZone,
  createPlanGenerationArtifactVersion,
  createPlanGenerationReasonCode,
  createUserId,
  createUtcDateTime,
  type DeterministicPlanRulesV1,
  type UserProfile,
} from "../domain/training";
import type { PlanApprovalClient } from "../services/planApprovalClient";
import PlanProposalBuilder from "./PlanProposalBuilder";

const timestamp = createUtcDateTime("2026-12-01T12:00:00Z");
const profile: UserProfile = {
  id: createUserId("plan-builder-runner"),
  preferredDistanceUnit: "mile",
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  experienceLevel: "consistent",
  consistentRunningWeeks: 12,
  targetRace: { kind: "date", date: createDateOnly("2027-05-02") },
  currentWeeklyDistance: createDistanceMeters(42_000),
  currentRunningFrequencyDaysPerWeek: 4,
  longestRecentRunDistance: createDistanceMeters(16_000),
  availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
  preferredLongRunDay: "sunday",
  completionGoal: "complete_first_marathon",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const testReasonCode = createPlanGenerationReasonCode("TEST-PLAN-RULE");
const rules: DeterministicPlanRulesV1 = {
  rulesetVersion: createPlanGenerationArtifactVersion("test-rules@1.0.0"),
  eligibleExperienceLevel: "consistent",
  minimumConsistentRunningWeeks: 8,
  currentWeeklyDistanceMeters: { minimum: 40_000, maximum: 45_000 },
  currentRunningFrequencyDaysPerWeek: { minimum: 4, maximum: 5 },
  longestRecentRunDistanceMeters: { minimum: 14_000, maximum: 20_000 },
  minimumAvailableTrainingDays: 4,
  requiredTrainingDayPositionsRelativeToPreferredLongRunDay: [2, 4, 6, 0],
  scheduleConstraintsSupported: "omitted",
  requiredSafetySignal: "none_reported",
  targetRaceKind: "date",
  wholeWeeksFromPlanStartToRace: { minimum: 18, maximum: 22 },
  reasonCodes: {
    cohortGate: testReasonCode,
    experience: testReasonCode,
    consistencyDuration: testReasonCode,
    weeklyDistance: testReasonCode,
    runFrequency: testReasonCode,
    longestRun: testReasonCode,
    raceDateRequired: testReasonCode,
    raceHorizon: testReasonCode,
    raceAlignment: testReasonCode,
    availability: testReasonCode,
    scheduleConstraint: testReasonCode,
  },
  unsupportedReasonCodeOrder: [testReasonCode],
  planName: "Test completion plan",
  planReasonCodes: [testReasonCode],
  positionPurposes: ["easy", "easy", "recovery", "long"],
  leadInWeek: {
    phase: "base_building",
    distancesMetersByPosition: [
      createDistanceMeters(10_000),
      createDistanceMeters(9_000),
      createDistanceMeters(7_000),
      createDistanceMeters(14_000),
    ],
    reasonCodes: [testReasonCode],
  },
  coreWeeks: [],
  raceWeek: {
    finalPositionPurpose: "race",
    raceDistanceMeters: createDistanceMeters(42_195),
  },
  recoveryWeek: {
    phase: "recovery",
    days: 7,
    reasonCodes: [testReasonCode],
  },
};
const approvalClient: PlanApprovalClient = {
  submit: vi.fn(),
  resolve: vi.fn(),
};

function renderBuilder() {
  render(
    <PlanProposalBuilder
      profile={profile}
      generatorVersion={createPlanGenerationArtifactVersion(
        "test-generator@1.0.0",
      )}
      rules={rules}
      onEditProfile={vi.fn()}
      approval={{
        expectedActivePlanRevision: null,
        client: approvalClient,
        reloadTrainingData: vi.fn().mockResolvedValue(undefined),
        onApproved: vi.fn(),
      }}
      today={createDateOnly("2026-12-01")}
    />,
  );
}

describe("PlanProposalBuilder", () => {
  it("explains and focuses an unanswered safety question", async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getAllByRole("radio", { name: /weeks to race/i })[0]);
    await user.click(
      screen.getByRole("button", { name: "Create plan proposal" }),
    );

    expect(
      screen.getByText("Choose Yes or No before creating a plan proposal."),
    ).toHaveAttribute("role", "alert");
    expect(screen.getByRole("radio", { name: "No" })).toHaveFocus();

    await user.click(screen.getByRole("radio", { name: "No" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("focuses the plan-start choices when no proposal inputs are answered", async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(
      screen.getByRole("button", { name: "Create plan proposal" }),
    );

    expect(
      screen.getByText("Choose when this plan should start."),
    ).toHaveAttribute("role", "alert");
    expect(
      screen.getAllByRole("radio", { name: /weeks to race/i })[0],
    ).toHaveFocus();
  });
});
