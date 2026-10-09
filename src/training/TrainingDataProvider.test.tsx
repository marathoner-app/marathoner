import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  calculateShoeDistance,
  calculateTrainingAnalytics,
  createDateOnly,
  createDurationSeconds,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
  metersToMiles,
  milesToMeters,
} from "../domain/training";
import { createDocumentTrainingRepositories } from "../persistence/documentTrainingRepositories";
import { InMemoryDocumentStore } from "../persistence/testing/InMemoryDocumentStore";
import type { TrainingRepositories } from "../persistence/trainingRepositories";
import TrainingDataProvider, {
  type TrainingRepositoryFactory,
} from "./TrainingDataProvider";
import { useTrainingData } from "./useTrainingData";

const userId = createUserId("runner-1");
const timestamp = createUtcDateTime("2026-08-03T12:00:00Z");
const timeZone = createIanaTimeZone("America/Los_Angeles");

let repositories: TrainingRepositories;
let repositoryFactory: TrainingRepositoryFactory;

beforeEach(() => {
  repositories = createDocumentTrainingRepositories(
    new InMemoryDocumentStore(),
    userId,
    () => timestamp,
  );
  repositoryFactory = async () => repositories;
});

function IntegrationProbe() {
  const training = useTrainingData();

  if (training.status !== "ready") {
    return <p>{training.error ? `${training.status}: ${training.error}` : training.status}</p>;
  }

  const workout = training.workouts[0];
  const shoe = training.shoes[0];
  const run = training.runs[0];
  const analytics = calculateTrainingAnalytics(
    training.runs,
    createDateOnly("2026-08-03"),
    "mile",
  );
  const shoeMiles = shoe
    ? metersToMiles(calculateShoeDistance(shoe, training.runs))
    : 0;

  return (
    <div>
      <p>Runs: {training.runs.length}</p>
      <p>Profile: {training.profile?.displayName ?? "none"}</p>
      <p>Workout: {workout?.status ?? "none"}</p>
      <p>Total: {Number(metersToMiles(analytics.totalDistance).toFixed(1))}</p>
      <p>Weekly: {Number(metersToMiles(analytics.weeklyDistance).toFixed(1))}</p>
      <p>Shoe: {Number(shoeMiles.toFixed(1))}</p>
      <button
        type="button"
        onClick={() =>
          void training.saveProfile({
            displayName: "Runner One",
            preferredDistanceUnit: "mile",
            timeZone,
            experienceLevel: "consistent",
            currentRunningFrequencyDaysPerWeek: 4,
            completionGoal: "complete_first_marathon",
          })
        }
      >
        Save profile
      </button>
      <button
        type="button"
        disabled={!workout || !shoe}
        onClick={() =>
          void training.createRun({
            plannedWorkoutPlanId: workout.planId,
            plannedWorkoutId: workout.id,
            shoeId: shoe.id,
            startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
            timeZone,
            distance: milesToMeters(3),
            duration: createDurationSeconds(1_800),
          })
        }
      >
        Complete workout
      </button>
      <button
        type="button"
        disabled={!run}
        onClick={() =>
          run && void training.updateRun(run.id, { distance: milesToMeters(4) })
        }
      >
        Edit run
      </button>
      <button
        type="button"
        disabled={!run}
        onClick={() =>
          run &&
          void training.updateRun(run.id, {
            startedAt: createUtcDateTime("2026-08-10T14:00:00Z"),
          })
        }
      >
        Move run to next week
      </button>
      <button
        type="button"
        disabled={!run}
        onClick={() => run && void training.deleteRun(run.id)}
      >
        Delete run
      </button>
    </div>
  );
}

describe("TrainingDataProvider", () => {
  it("renders an empty authenticated training dataset", async () => {
    render(
      <TrainingDataProvider
        userId={userId}
        repositoryFactory={repositoryFactory}
      >
        <IntegrationProbe />
      </TrainingDataProvider>,
    );

    expect(await screen.findByText("Runs: 0")).toBeInTheDocument();
    expect(screen.getByText("Workout: none")).toBeInTheDocument();
    expect(screen.getByText("Total: 0")).toBeInTheDocument();
    expect(screen.getByText("Weekly: 0")).toBeInTheDocument();
    expect(screen.getByText("Profile: none")).toBeInTheDocument();
  });

  it("saves an owned profile through the application boundary", async () => {
    const user = userEvent.setup();

    render(
      <TrainingDataProvider
        userId={userId}
        repositoryFactory={repositoryFactory}
      >
        <IntegrationProbe />
      </TrainingDataProvider>,
    );

    await screen.findByText("Profile: none");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText("Profile: Runner One")).toBeInTheDocument();
    await expect(repositories.profile.load()).resolves.toMatchObject({
      id: userId,
      displayName: "Runner One",
      experienceLevel: "consistent",
      currentRunningFrequencyDaysPerWeek: 4,
    });
  });

  it("keeps completion status, analytics, and shoe mileage in sync", async () => {
    const plan = await repositories.plans.create({
      name: "First Marathon Journey",
      startDate: createDateOnly("2026-08-03"),
      targetRaceDate: createDateOnly("2027-01-10"),
    });
    const plannedWorkout = await repositories.workouts.create({
      planId: plan.id,
      scheduledDate: createDateOnly("2026-08-03"),
      phase: "base_building",
      kind: "run",
      purpose: "easy",
      targetDistance: milesToMeters(5),
    });
    await repositories.shoes.create({ name: "Daily Trainer" });
    const user = userEvent.setup();

    render(
      <TrainingDataProvider
        userId={userId}
        repositoryFactory={repositoryFactory}
      >
        <IntegrationProbe />
      </TrainingDataProvider>,
    );

    await screen.findByText("Workout: planned");
    await user.click(screen.getByRole("button", { name: "Complete workout" }));

    expect(await screen.findByText("Runs: 1")).toBeInTheDocument();
    expect(screen.getByText("Workout: completed")).toBeInTheDocument();
    expect(screen.getByText("Total: 3")).toBeInTheDocument();
    expect(screen.getByText("Weekly: 3")).toBeInTheDocument();
    expect(screen.getByText("Shoe: 3")).toBeInTheDocument();
    await expect(
      repositories.workouts.get(plan.id, plannedWorkout.id),
    ).resolves.toMatchObject({
      status: "completed",
      targetDistance: milesToMeters(5),
    });

    await user.click(screen.getByRole("button", { name: "Edit run" }));
    expect(await screen.findByText("Total: 4")).toBeInTheDocument();
    expect(screen.getByText("Weekly: 4")).toBeInTheDocument();
    expect(screen.getByText("Shoe: 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move run to next week" }));
    expect(await screen.findByText("Weekly: 0")).toBeInTheDocument();
    expect(screen.getByText("Total: 4")).toBeInTheDocument();
    expect(screen.getByText("Workout: completed")).toBeInTheDocument();
    await expect(repositories.runs.list()).resolves.toEqual([
      expect.objectContaining({
        startedAt: createUtcDateTime("2026-08-10T14:00:00Z"),
        plannedWorkoutPlanId: plan.id,
        plannedWorkoutId: plannedWorkout.id,
      }),
    ]);

    await user.click(screen.getByRole("button", { name: "Delete run" }));
    expect(await screen.findByText("Runs: 0")).toBeInTheDocument();
    expect(screen.getByText("Workout: planned")).toBeInTheDocument();
    expect(screen.getByText("Total: 0")).toBeInTheDocument();
    expect(screen.getByText("Weekly: 0")).toBeInTheDocument();
    expect(screen.getByText("Shoe: 0")).toBeInTheDocument();
  });

  it("reloads a shoe total containing starting and Marathoner-recorded distance", async () => {
    const shoe = await repositories.shoes.create({
      name: "Daily Trainer",
      startingDistance: milesToMeters(10),
    });
    await repositories.runs.create({
      shoeId: shoe.id,
      startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
      timeZone,
      distance: milesToMeters(3),
      duration: createDurationSeconds(1_800),
    });

    const firstLoad = render(
      <TrainingDataProvider
        userId={userId}
        repositoryFactory={repositoryFactory}
      >
        <IntegrationProbe />
      </TrainingDataProvider>,
    );

    expect(await screen.findByText("Shoe: 13")).toBeInTheDocument();
    firstLoad.unmount();

    render(
      <TrainingDataProvider
        userId={userId}
        repositoryFactory={repositoryFactory}
      >
        <IntegrationProbe />
      </TrainingDataProvider>,
    );

    expect(await screen.findByText("Shoe: 13")).toBeInTheDocument();
  });

  it("surfaces a calm recoverable load error", async () => {
    const failingFactory: TrainingRepositoryFactory = async () => {
      throw new Error("Training data is temporarily unavailable.");
    };

    render(
      <TrainingDataProvider userId={userId} repositoryFactory={failingFactory}>
        <IntegrationProbe />
      </TrainingDataProvider>,
    );

    expect(
      await screen.findByText(
        "error: Training data is temporarily unavailable.",
      ),
    ).toBeInTheDocument();
  });
});
