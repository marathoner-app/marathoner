import draftRulesText from "../docs/methodology/artifacts/beta-rules/0.1.0-draft/beta-rules.json?raw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  createDateOnly,
  createDistanceMeters,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
  type UserProfile,
} from "../src/domain/training";
import type { PlanApprovalClient } from "../src/services/planApprovalClient";
import PlanProposalBuilder from "../src/components/PlanProposalBuilder";
import { createInternalPlanProposalRehearsalRuleSet } from "../src/components/internalPlanProposalRehearsalRules";

const timestamp = createUtcDateTime("2029-12-01T12:00:00Z");
const profile: UserProfile = {
  id: createUserId("owner-dogfood-runner"),
  preferredDistanceUnit: "mile",
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  experienceLevel: "consistent",
  consistentRunningWeeks: 12,
  targetRace: { kind: "date", date: createDateOnly("2030-05-12") },
  currentWeeklyDistance: createDistanceMeters(42_000),
  currentRunningFrequencyDaysPerWeek: 4,
  longestRecentRunDistance: createDistanceMeters(16_000),
  availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
  preferredLongRunDay: "sunday",
  completionGoal: "complete_first_marathon",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const ruleSet = createInternalPlanProposalRehearsalRuleSet(draftRulesText);

function renderBuilder(overrides: { profile?: UserProfile | null } = {}) {
  const approvalClient: PlanApprovalClient = {
    submit: vi.fn().mockResolvedValue({
      status: "plan_approved",
      commandId: "approve-owner-dogfood-plan",
      planId: "owner-dogfood-plan",
      activePlanRevision: 1,
      approvedAt: "2029-12-01T12:01:00.000Z",
    }),
    resolve: vi.fn(),
  };
  const onEditProfile = vi.fn();
  const reloadTrainingData = vi.fn().mockResolvedValue(undefined);
  const onApproved = vi.fn();

  render(
    <PlanProposalBuilder
      profile={overrides.profile === undefined ? profile : overrides.profile}
      generatorVersion={ruleSet.generatorVersion}
      rules={ruleSet.rules}
      onEditProfile={onEditProfile}
      approval={{
        client: approvalClient,
        expectedActivePlanRevision: null,
        reloadTrainingData,
        onApproved,
      }}
      today={createDateOnly("2029-12-01")}
    />,
  );

  return { approvalClient, onApproved, onEditProfile, reloadTrainingData };
}

describe("PlanProposalBuilder", () => {
  it("generates, reviews, and activates the pinned provisional plan", async () => {
    const user = userEvent.setup();
    const dependencies = renderBuilder();

    expect(
      screen.getByRole("heading", { name: "Choose where training begins" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Owner dogfood only",
    );

    await user.click(
      screen.getByRole("radio", {
        name: /December 10, 2029 22 weeks to race day/i,
      }),
    );
    await user.click(screen.getByRole("radio", { name: "No" }));
    await user.click(
      screen.getByRole("button", { name: "Create plan proposal" }),
    );

    expect(
      screen.getByRole("heading", { name: "Founding beta completion plan" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("beta-rules@0.1.0-draft")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue review" }));
    await user.click(
      screen.getByRole("button", { name: "Approve and activate" }),
    );

    await waitFor(() =>
      expect(dependencies.approvalClient.submit).toHaveBeenCalledOnce(),
    );
    expect(dependencies.reloadTrainingData).toHaveBeenCalledOnce();
    expect(dependencies.onApproved).toHaveBeenCalledOnce();
  });

  it("routes an incomplete profile back to runner setup", async () => {
    const user = userEvent.setup();
    const dependencies = renderBuilder({
      profile: { ...profile, currentWeeklyDistance: undefined },
    });

    expect(
      screen.getByRole("heading", { name: "Finish your starting point first" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Finish runner setup" }),
    );
    expect(dependencies.onEditProfile).toHaveBeenCalledOnce();
  });
});
