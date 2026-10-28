import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDateOnly,
  createDistanceMeters,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
  milesToMeters,
  type UserProfile,
} from "../domain/training";
import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import RunnerOnboarding from "./RunnerOnboarding";

const timestamp = createUtcDateTime("2026-10-05T12:00:00Z");
const completeProfile: UserProfile = {
  id: createUserId("runner-1"),
  displayName: "Kevin",
  preferredDistanceUnit: "mile",
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  experienceLevel: "consistent",
  consistentRunningWeeks: 12,
  targetRace: {
    kind: "date",
    date: createDateOnly("2027-05-02"),
  },
  currentWeeklyDistance: createDistanceMeters(32_187),
  currentRunningFrequencyDaysPerWeek: 4,
  longestRecentRunDistance: createDistanceMeters(16_093),
  availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
  preferredLongRunDay: "sunday",
  scheduleConstraints: "Weekday runs need to happen before work.",
  completionGoal: "complete_first_marathon",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const onSave = vi.fn();
const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  onSave.mockResolvedValue(completeProfile);
});

describe("RunnerOnboarding", () => {
  it("has no beta-blocking accessibility violations in runner setup", async () => {
    render(
      <RunnerOnboarding profile={null} onSave={onSave} onClose={onClose} />,
    );

    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });

  it("moves focus into the modal, contains it, and closes with Escape", async () => {
    const user = userEvent.setup();
    render(
      <RunnerOnboarding profile={null} onSave={onSave} onClose={onClose} />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Tell us where you are starting",
    });
    const heading = screen.getByRole("heading", {
      name: "Tell us where you are starting",
    });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(
      /These answers give Marathoner the context/i,
    );
    await waitFor(() => expect(heading).toHaveFocus());

    await user.tab();
    expect(
      screen.getByRole("button", { name: "Continue later" }),
    ).toHaveFocus();
    await user.tab({ shift: true });
    expect(
      screen.getByRole("button", { name: "Complete setup" }),
    ).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("explains the intake and saves a complete first-marathon profile", async () => {
    const user = userEvent.setup();
    render(
      <RunnerOnboarding profile={null} onSave={onSave} onClose={onClose} />,
    );

    expect(
      screen.getByText(/usual recent week gives a more useful starting point/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/availability to fit training into your life/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/finish-time targeting waits/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText("(optional)")).toHaveLength(3);

    await user.click(screen.getByLabelText("I run consistently now"));
    await user.type(
      screen.getByLabelText(/How many consecutive weeks/i),
      "12",
    );
    await user.click(screen.getByLabelText("I have a date"));
    await user.type(screen.getByLabelText("Marathon date"), "2027-05-02");
    await user.type(
      screen.getByLabelText(/About how many miles/i),
      "20",
    );
    await user.type(
      screen.getByLabelText(/How many days per week/i),
      "4",
    );
    await user.type(
      screen.getByLabelText(/longest recent continuous run/i),
      "10",
    );
    for (const day of ["Tue", "Thu", "Sat", "Sun"]) {
      await user.click(screen.getByLabelText(day));
    }
    await user.selectOptions(
      screen.getByLabelText("Preferred long-run day"),
      "sunday",
    );
    await user.click(
      screen.getByLabelText(/Complete my first marathon feeling prepared/i),
    );
    await user.click(screen.getByRole("button", { name: "Complete setup" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      preferredDistanceUnit: "mile",
      timeZone: expect.any(String),
      experienceLevel: "consistent",
      consistentRunningWeeks: 12,
      targetRace: { kind: "date", date: "2027-05-02" },
      currentWeeklyDistance: milesToMeters(20),
      currentRunningFrequencyDaysPerWeek: 4,
      longestRecentRunDistance: milesToMeters(10),
      availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
      preferredLongRunDay: "sunday",
      completionGoal: "complete_first_marathon",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps entered answers and identifies the missing completion fields", async () => {
    const user = userEvent.setup();
    render(
      <RunnerOnboarding profile={null} onSave={onSave} onClose={onClose} />,
    );

    await user.type(screen.getByLabelText(/What should we call you/i), "Kevin");
    await user.click(screen.getByRole("button", { name: "Complete setup" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "A few answers need attention. Your other entries are still here.",
    );
    expect(screen.getByLabelText(/What should we call you/i)).toHaveValue("Kevin");
    expect(screen.getByText(/Choose the option that best matches/i)).toBeInTheDocument();
    expect(screen.getByText(/Choose a marathon date or a target window/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves coherent partial progress without requiring research first", async () => {
    const user = userEvent.setup();
    render(
      <RunnerOnboarding profile={null} onSave={onSave} onClose={onClose} />,
    );

    await user.type(screen.getByLabelText(/What should we call you/i), "Kevin");
    await user.click(screen.getByLabelText("My running has been inconsistent"));
    await user.click(screen.getByRole("button", { name: "Save progress" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      displayName: "Kevin",
      preferredDistanceUnit: "mile",
      timeZone: expect.any(String),
      experienceLevel: "inconsistent",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("loads a saved profile and persists revisions through the same boundary", async () => {
    const user = userEvent.setup();
    render(
      <RunnerOnboarding
        profile={completeProfile}
        onSave={onSave}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Review your starting point" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/What should we call you/i)).toHaveValue("Kevin");
    expect(screen.getByLabelText(/How many consecutive weeks/i)).toHaveValue(12);
    expect(screen.getByLabelText("Sun")).toBeChecked();

    const weeklyDistance = screen.getByLabelText(/About how many miles/i);
    await user.clear(weeklyDistance);
    await user.type(weeklyDistance, "25");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Kevin",
        currentWeeklyDistance: milesToMeters(25),
        completionGoal: "complete_first_marathon",
      }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("prompts a legacy consistent profile for the missing duration instead of inventing it", async () => {
    const user = userEvent.setup();
    render(
      <RunnerOnboarding
        profile={{ ...completeProfile, consistentRunningWeeks: undefined }}
        onSave={onSave}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Tell us where you are starting" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/How many consecutive weeks/i)).toHaveValue(null);

    await user.click(screen.getByRole("button", { name: "Complete setup" }));

    expect(
      screen.getByText(/Enter how many consecutive weeks/i),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/How many consecutive weeks/i), "12");
    await user.click(screen.getByRole("button", { name: "Complete setup" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Kevin",
        consistentRunningWeeks: 12,
        currentRunningFrequencyDaysPerWeek: 4,
      }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps optional performance data all-or-nothing and reports save failures", async () => {
    const user = userEvent.setup();
    render(
      <RunnerOnboarding profile={null} onSave={onSave} onClose={onClose} />,
    );

    await user.type(screen.getByLabelText("Date", { selector: "input" }), "2026-09-27");
    await user.click(screen.getByRole("button", { name: "Save progress" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/answers need attention/i);
    expect(screen.getByText(/add its date, positive distance/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Date", { selector: "input" }));
    onSave.mockRejectedValueOnce(new Error("Your connection was interrupted."));
    await user.click(screen.getByRole("button", { name: "Save progress" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your connection was interrupted.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
