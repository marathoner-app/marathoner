import draftRulesText from "../docs/methodology/artifacts/beta-rules/0.1.0-draft/beta-rules.json?raw";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
  type UserProfile,
} from "../src/domain/training";
import InternalPlanProposalRehearsal from "../src/components/InternalPlanProposalRehearsal";
import { createInternalPlanProposalRehearsalRuleSet } from "../src/components/internalPlanProposalRehearsalRules";

const timestamp = createUtcDateTime("2029-12-01T12:00:00Z");
const profile: UserProfile = {
  id: createUserId("internal-rehearsal-runner"),
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

async function submitRehearsal(options?: {
  confirmCohort?: boolean;
  confirmNoSymptoms?: boolean;
}) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Plan start date"), "2030-01-07");
  if (options?.confirmCohort) {
    await user.click(
      screen.getByLabelText(/confirmed the saved profile represents/u),
    );
  }
  if (options?.confirmNoSymptoms) {
    await user.click(screen.getByLabelText(/no pain or unusual symptoms/u));
  }
  await user.click(
    screen.getByRole("button", { name: "Generate read-only proposal" }),
  );
}

describe("InternalPlanProposalRehearsal", () => {
  it("offers draft-aligned dates without selecting or generating one", async () => {
    const user = userEvent.setup();
    render(
      <InternalPlanProposalRehearsal
        profile={profile}
        ruleSet={ruleSet}
        onSessionActivationChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Plan start date");
    expect(input).toHaveValue("");
    expect(
      screen.queryByRole("heading", { name: "Founding beta completion plan" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "December 10, 2029 22 weeks to race",
      }),
    );

    expect(input).toHaveValue("2029-12-10");
    expect(
      screen.queryByRole("heading", { name: "Founding beta completion plan" }),
    ).not.toBeInTheDocument();
  });

  it("explains when the saved race weekday cannot produce candidates", () => {
    render(
      <InternalPlanProposalRehearsal
        profile={{ ...profile, preferredLongRunDay: "saturday" }}
        ruleSet={ruleSet}
        onSessionActivationChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/does not fall on the preferred long-run day/iu),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Plan start date")).toBeEnabled();
  });

  it("offers only aligned choices that do not predate the saved recent effort", () => {
    render(
      <InternalPlanProposalRehearsal
        profile={{
          ...profile,
          recentPerformance: {
            completedOn: createDateOnly("2029-12-24"),
            distance: createDistanceMeters(10_000),
            duration: createDurationSeconds(3_600),
          },
        }}
        ruleSet={ruleSet}
        onSessionActivationChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "December 10, 2029 22 weeks to race",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "December 17, 2029 21 weeks to race",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "December 24, 2029 20 weeks to race",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "January 7, 2030 18 weeks to race",
      }),
    ).toBeInTheDocument();
  });

  it("explains when the saved effort follows every aligned choice", () => {
    render(
      <InternalPlanProposalRehearsal
        profile={{
          ...profile,
          recentPerformance: {
            completedOn: createDateOnly("2030-01-08"),
            distance: createDistanceMeters(10_000),
            duration: createDurationSeconds(3_600),
          },
        }}
        ruleSet={ruleSet}
        onSessionActivationChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/recent effort occurs after every start date/iu),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/enter a date manually to rehearse the unsupported/iu),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Draft-aligned choices" }),
    ).not.toBeInTheDocument();
  });

  it("renders the real generated proposal with explicit session-only review", async () => {
    render(
      <InternalPlanProposalRehearsal
        profile={profile}
        ruleSet={ruleSet}
        onSessionActivationChange={vi.fn()}
      />,
    );

    await submitRehearsal({
      confirmCohort: true,
      confirmNoSymptoms: true,
    });

    expect(
      screen.getByRole("heading", { name: "Founding beta completion plan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/activate this plan only inside the current rehearsal/u),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review inputs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue review" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Active only in this rehearsal" }),
    ).not.toBeInTheDocument();
  });

  it("completes the real session journey with the frozen eligible profile and resets on source change", async () => {
    const user = userEvent.setup();
    const onSessionActivationChange = vi.fn();
    render(
      <InternalPlanProposalRehearsal
        profile={null}
        ruleSet={ruleSet}
        onSessionActivationChange={onSessionActivationChange}
      />,
    );

    expect(
      screen.getByRole("radio", { name: /saved owner profile/iu }),
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Generate read-only proposal" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("radio", {
        name: /frozen eligible rehearsal profile/iu,
      }),
    );

    expect(
      screen.getByRole("complementary", {
        name: "Frozen rehearsal profile details",
      }),
    ).toHaveTextContent("internal-eligible-profile@1.0.0");
    expect(
      screen.getByRole("complementary", {
        name: "Frozen rehearsal profile details",
      }),
    ).toHaveTextContent("42 km");
    expect(
      screen.getByRole("button", {
        name: "January 7, 2030 18 weeks to race",
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "January 7, 2030 18 weeks to race",
      }),
    );
    await user.click(
      screen.getByLabelText(/confirmed the frozen eligible rehearsal profile/iu),
    );
    await user.click(screen.getByLabelText(/no pain or unusual symptoms/iu));
    await user.click(
      screen.getByRole("button", { name: "Generate read-only proposal" }),
    );

    expect(
      screen.getByRole("heading", { name: "Founding beta completion plan" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue review" }));
    await user.click(
      screen.getByRole("button", {
        name: "Activate only in this rehearsal",
      }),
    );
    expect(onSessionActivationChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "generated" }),
    );

    await user.click(
      screen.getByRole("radio", { name: /saved owner profile/iu }),
    );

    expect(onSessionActivationChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByLabelText("Plan start date")).toHaveValue("");
    expect(
      screen.getByLabelText(/confirmed the saved profile represents/iu),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText(/no pain or unusual symptoms/iu),
    ).not.toBeChecked();
    expect(
      screen.queryByRole("heading", { name: "Founding beta completion plan" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate read-only proposal" }),
    ).toBeDisabled();
  });

  it("clears session activation when a proposal input changes", async () => {
    const user = userEvent.setup();
    const onSessionActivationChange = vi.fn();
    render(
      <InternalPlanProposalRehearsal
        profile={profile}
        ruleSet={ruleSet}
        onSessionActivationChange={onSessionActivationChange}
      />,
    );

    await user.type(screen.getByLabelText("Plan start date"), "2030-01-07");
    await user.click(
      screen.getByLabelText(/confirmed the saved profile represents/u),
    );
    const safetyConfirmation = screen.getByLabelText(
      /no pain or unusual symptoms/u,
    );
    await user.click(safetyConfirmation);
    await user.click(
      screen.getByRole("button", { name: "Generate read-only proposal" }),
    );
    await user.click(screen.getByRole("button", { name: "Continue review" }));
    await user.click(
      screen.getByRole("button", {
        name: "Activate only in this rehearsal",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Active only in this rehearsal" }),
    ).toBeInTheDocument();

    await user.click(safetyConfirmation);

    expect(
      screen.queryByRole("heading", { name: "Active only in this rehearsal" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Founding beta completion plan" }),
    ).not.toBeInTheDocument();
    expect(onSessionActivationChange).toHaveBeenLastCalledWith(null);
  });

  it("clears and resets an active session draft when regenerated", async () => {
    const user = userEvent.setup();
    const onSessionActivationChange = vi.fn();
    render(
      <InternalPlanProposalRehearsal
        profile={profile}
        ruleSet={ruleSet}
        onSessionActivationChange={onSessionActivationChange}
      />,
    );

    await submitRehearsal({
      confirmCohort: true,
      confirmNoSymptoms: true,
    });
    await user.click(screen.getByRole("button", { name: "Continue review" }));
    await user.click(
      screen.getByRole("button", {
        name: "Activate only in this rehearsal",
      }),
    );

    expect(onSessionActivationChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "generated" }),
    );

    await user.click(
      screen.getByRole("button", { name: "Generate read-only proposal" }),
    );

    expect(onSessionActivationChange).toHaveBeenLastCalledWith(null);
    expect(
      screen.getByText("Proposed plan — not active"),
    ).toBeInTheDocument();
  });

  it("shows honest unsupported boundaries when cohort confirmation is absent", async () => {
    render(
      <InternalPlanProposalRehearsal
        profile={profile}
        ruleSet={ruleSet}
        onSessionActivationChange={vi.fn()}
      />,
    );

    await submitRehearsal({ confirmNoSymptoms: true });

    expect(
      screen.getByRole("heading", {
        name: "The selected starting point is outside this draft",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Unsupported cohort gate")).toBeInTheDocument();
  });

  it("lists incomplete saved profile fields instead of inventing defaults", async () => {
    render(
      <InternalPlanProposalRehearsal
        profile={{ ...profile, currentWeeklyDistance: undefined }}
        ruleSet={ruleSet}
        onSessionActivationChange={vi.fn()}
      />,
    );

    await submitRehearsal({
      confirmCohort: true,
      confirmNoSymptoms: true,
    });

    expect(
      screen.getByRole("heading", { name: "Runner setup is incomplete" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Current weekly distance")).toBeInTheDocument();
  });

  it("requires a saved profile before enabling generation", () => {
    render(
      <InternalPlanProposalRehearsal
        profile={null}
        ruleSet={ruleSet}
        onSessionActivationChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Generate read-only proposal" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/finish and save the runner profile/iu),
    ).toBeInTheDocument();
  });
});
