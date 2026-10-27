import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordSlowRunDiagnostic } from "../diagnostics/slowRunDiagnostics";
import {
  calculateShoeDistance,
  calculateTrainingAnalytics,
  createCompletedRunId,
  createDateOnly,
  createDurationSeconds,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
  metersToMiles,
  milesToMeters,
  type CompletedRun,
  type UserId,
} from "../domain/training";
import { createDocumentTrainingRepositories } from "../persistence/documentTrainingRepositories";
import { InMemoryDocumentStore } from "../persistence/testing/InMemoryDocumentStore";
import type { TrainingRepositories } from "../persistence/trainingRepositories";
import type {
  CompletedRunCommandClient,
  RunCompletionClientResult,
  RunDeletionClientResult,
} from "../services/completedRunCommandClient";
import TrainingDataProvider, {
  type CompletedRunCommandClientFactory,
  type TrainingLiveReadSourceFactory,
  type TrainingRepositoryFactory,
} from "./TrainingDataProvider";
import type {
  SynchronizedTrainingSnapshot,
  TrainingLiveReadEvent,
  TrainingLiveReadEventBatch,
  TrainingLiveReadSource,
  TrainingSnapshotOrigin,
} from "./trainingSynchronization";
import { useTrainingData } from "./useTrainingData";

vi.mock("../diagnostics/slowRunDiagnostics", () => ({
  recordSlowRunDiagnostic: vi.fn(),
}));

const mockedRecordSlowRunDiagnostic = vi.mocked(recordSlowRunDiagnostic);

const userId = createUserId("runner-1");
const timestamp = createUtcDateTime("2026-08-03T12:00:00Z");
const timeZone = createIanaTimeZone("America/Los_Angeles");

class ControlledLiveReadSource implements TrainingLiveReadSource {
  readonly unsubscribe = vi.fn();
  private listener: ((events: TrainingLiveReadEventBatch) => void) | null = null;

  constructor(
    readonly ownerId: UserId,
    readonly sessionGeneration: number,
  ) {}

  subscribe(listener: (events: TrainingLiveReadEventBatch) => void) {
    this.listener = listener;
    return this.unsubscribe;
  }

  emit(events: TrainingLiveReadEventBatch) {
    this.listener?.(events);
  }

  emitSnapshot(
    snapshot: SynchronizedTrainingSnapshot,
    origin: TrainingSnapshotOrigin = "server",
    hasPendingWrites = false,
  ) {
    const session = {
      ownerId: this.ownerId,
      sessionGeneration: this.sessionGeneration,
      origin,
      hasPendingWrites,
      observedAt: timestamp,
    };
    const events: TrainingLiveReadEvent[] = [
      { ...session, type: "source_snapshot", source: "profile", value: snapshot.profile },
      { ...session, type: "source_snapshot", source: "plans", value: snapshot.plans },
      { ...session, type: "source_snapshot", source: "workouts", value: snapshot.workouts },
      { ...session, type: "source_snapshot", source: "runs", value: snapshot.runs },
      { ...session, type: "source_snapshot", source: "shoes", value: snapshot.shoes },
    ];

    this.emit(events);
  }

  emitError(message: string) {
    this.emit([
      {
        type: "source_error",
        source: "runs",
        ownerId: this.ownerId,
        sessionGeneration: this.sessionGeneration,
        message,
        recoverable: true,
      },
    ]);
  }
}

let repositories: TrainingRepositories;
let repositoryFactory: TrainingRepositoryFactory;
let liveReadSourceFactory: TrainingLiveReadSourceFactory;
let sources: ControlledLiveReadSource[];
let completedRunCommandClient: CompletedRunCommandClient;
let completedRunCommandClientFactory: CompletedRunCommandClientFactory;

function unknownCompletion(commandId: string): RunCompletionClientResult {
  return {
    status: "outcome_unknown",
    commandId,
    code: "resolve-by-command-id",
    message: "The completion outcome is still unknown.",
  };
}

function unknownDeletion(commandId: string): RunDeletionClientResult {
  return {
    status: "outcome_unknown",
    commandId,
    code: "resolve-by-command-id",
    message: "The deletion outcome is still unknown.",
  };
}

beforeEach(() => {
  mockedRecordSlowRunDiagnostic.mockClear();
  repositories = createDocumentTrainingRepositories(
    new InMemoryDocumentStore(),
    userId,
    () => timestamp,
  );
  repositoryFactory = async () => repositories;
  sources = [];
  liveReadSourceFactory = async (ownerId, sessionGeneration) => {
    const source = new ControlledLiveReadSource(ownerId, sessionGeneration);
    sources.push(source);
    return source;
  };
  completedRunCommandClient = {
    submitCompletion: vi.fn(async ({ commandId }) =>
      unknownCompletion(commandId),
    ),
    submitDeletion: vi.fn(async ({ commandId }) => unknownDeletion(commandId)),
    submitUpdate: vi.fn(async ({ commandId }) => ({
      status: "outcome_unknown" as const,
      commandId,
      code: "resolve-by-command-id" as const,
      message: "The update outcome is still unknown.",
    })),
    resolveCompletion: vi.fn(async (commandId) =>
      unknownCompletion(commandId),
    ),
    resolveDeletion: vi.fn(async (commandId) => unknownDeletion(commandId)),
    resolveUpdate: vi.fn(async (commandId) => ({
      status: "outcome_unknown" as const,
      commandId,
      code: "resolve-by-command-id" as const,
      message: "The update outcome is still unknown.",
    })),
  };
  completedRunCommandClientFactory = async () => completedRunCommandClient;
});

async function createNamedRepositories(
  owner: UserId,
  displayName: string,
): Promise<TrainingRepositories> {
  const ownedRepositories = createDocumentTrainingRepositories(
    new InMemoryDocumentStore(),
    owner,
    () => timestamp,
  );
  await ownedRepositories.profile.save({
    displayName,
    preferredDistanceUnit: "mile",
    timeZone,
  });
  return ownedRepositories;
}

async function snapshotFromRepositories(
  ownerId: UserId,
  ownedRepositories: TrainingRepositories,
): Promise<SynchronizedTrainingSnapshot> {
  const [profile, plans, runs, shoes] = await Promise.all([
    ownedRepositories.profile.load(),
    ownedRepositories.plans.list(),
    ownedRepositories.runs.list(),
    ownedRepositories.shoes.list(),
  ]);
  const workouts = (
    await Promise.all(
      plans.map((plan) => ownedRepositories.workouts.listForPlan(plan.id)),
    )
  ).flat();

  return { ownerId, profile, plans, workouts, runs, shoes };
}

async function waitForSource(index = sources.length - 1) {
  await waitFor(() => expect(sources[index]).toBeDefined());
  return sources[index] as ControlledLiveReadSource;
}

async function publishRepositories(
  source: ControlledLiveReadSource,
  ownedRepositories = repositories,
  origin: TrainingSnapshotOrigin = "server",
) {
  const snapshot = await snapshotFromRepositories(
    source.ownerId,
    ownedRepositories,
  );
  act(() => source.emitSnapshot(snapshot, origin));
}

function renderProvider(children = <IntegrationProbe />) {
  return render(
    <TrainingDataProvider
      userId={userId}
      repositoryFactory={repositoryFactory}
      liveReadSourceFactory={liveReadSourceFactory}
    >
      {children}
    </TrainingDataProvider>,
  );
}

function renderCommandProvider(children = <IntegrationProbe />) {
  return render(
    <TrainingDataProvider
      userId={userId}
      repositoryFactory={repositoryFactory}
      liveReadSourceFactory={liveReadSourceFactory}
      completedRunCommandsEnabled
      completedRunCommandClientFactory={completedRunCommandClientFactory}
      createCompletedRunCommandId={(operation) =>
        `run-${operation}-test-command`
      }
    >
      {children}
    </TrainingDataProvider>,
  );
}

function IntegrationProbe() {
  const training = useTrainingData();

  if (training.status === "loading" || training.status === "error") {
    return (
      <div>
        <p>{training.error ? `${training.status}: ${training.error}` : training.status}</p>
        <button type="button" onClick={() => void training.reload()}>
          Retry sync
        </button>
      </div>
    );
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
      <p>Status: {training.status}</p>
      <p>Runs: {training.runs.length}</p>
      <p>Profile: {training.profile?.displayName ?? "none"}</p>
      <p>Workout: {workout?.status ?? "none"}</p>
      <p>Total: {Number(metersToMiles(analytics.totalDistance).toFixed(1))}</p>
      <p>Weekly: {Number(metersToMiles(analytics.weeklyDistance).toFixed(1))}</p>
      <p>Shoe: {Number(shoeMiles.toFixed(1))}</p>
      <p>Shoe status: {shoe?.status ?? "none"}</p>
      <button
        type="button"
        disabled={!training.canWrite}
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
        disabled={!training.canWrite || !workout || !shoe}
        onClick={() =>
          void training
            .createRun({
              plannedWorkoutPlanId: workout?.planId,
              plannedWorkoutId: workout?.id,
              shoeId: shoe?.id,
              startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
              timeZone,
              distance: milesToMeters(3),
              duration: createDurationSeconds(1_800),
            })
            .catch(() => undefined)
        }
      >
        Complete workout
      </button>
      <button
        type="button"
        disabled={!training.canWrite || !run}
        onClick={() =>
          run && void training.updateRun(run.id, { distance: milesToMeters(4) })
        }
      >
        Edit run
      </button>
      <button
        type="button"
        disabled={!training.canWrite || !run}
        onClick={() =>
          run && void training.deleteRun(run.id).catch(() => undefined)
        }
      >
        Delete run
      </button>
      <button
        type="button"
        disabled={!training.canWrite || !shoe || shoe.status === "retired"}
        onClick={() =>
          shoe && void training.retireShoe(shoe.id, createDateOnly("2026-08-04"))
        }
      >
        Retire shoe
      </button>
    </div>
  );
}

describe("TrainingDataProvider", () => {
  it("does not initialize the command client while the migration is disabled", async () => {
    const commandFactory = vi.fn(completedRunCommandClientFactory);
    render(
      <TrainingDataProvider
        userId={userId}
        repositoryFactory={repositoryFactory}
        liveReadSourceFactory={liveReadSourceFactory}
        completedRunCommandClientFactory={commandFactory}
      >
        <IntegrationProbe />
      </TrainingDataProvider>,
    );
    const source = await waitForSource();
    await publishRepositories(source);

    expect(await screen.findByText("Status: current")).toBeInTheDocument();
    expect(commandFactory).not.toHaveBeenCalled();
  });

  it("starts live synchronization without repository startup reads", async () => {
    const profileLoad = vi.spyOn(repositories.profile, "load");
    const plansList = vi.spyOn(repositories.plans, "list");
    const runsList = vi.spyOn(repositories.runs, "list");
    const shoesList = vi.spyOn(repositories.shoes, "list");

    renderProvider();
    const source = await waitForSource();
    act(() =>
      source.emitSnapshot({
        ownerId: userId,
        profile: null,
        plans: [],
        workouts: [],
        runs: [],
        shoes: [],
      }),
    );

    expect(await screen.findByText("Status: current")).toBeInTheDocument();
    expect(profileLoad).not.toHaveBeenCalled();
    expect(plansList).not.toHaveBeenCalled();
    expect(runsList).not.toHaveBeenCalled();
    expect(shoesList).not.toHaveBeenCalled();
  });

  it("renders live server changes without reloading", async () => {
    renderProvider();
    const source = await waitForSource();
    await publishRepositories(source);
    expect(await screen.findByText("Profile: none")).toBeInTheDocument();

    await repositories.profile.save({
      displayName: "Second client",
      preferredDistanceUnit: "mile",
      timeZone,
    });
    await publishRepositories(source);

    expect(await screen.findByText("Profile: Second client")).toBeInTheDocument();
  });

  it("keeps cache-only data readable but blocks writes until server confirmation", async () => {
    await repositories.profile.save({
      displayName: "Cached runner",
      preferredDistanceUnit: "mile",
      timeZone,
    });
    renderProvider();
    const source = await waitForSource();
    await publishRepositories(source, repositories, "cache");

    expect(await screen.findByText("Status: stale")).toBeInTheDocument();
    expect(screen.getByText("Profile: Cached runner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();

    await publishRepositories(source);

    expect(await screen.findByText("Status: current")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
  });

  it("publishes an acknowledged repository write without waiting for listener metadata", async () => {
    const user = userEvent.setup();
    renderProvider();
    const source = await waitForSource();
    await publishRepositories(source);

    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(async () =>
      expect(await repositories.profile.load()).toMatchObject({
        displayName: "Runner One",
      }),
    );
    expect(await screen.findByText("Profile: Runner One")).toBeInTheDocument();
    expect(screen.getByText("Status: current")).toBeInTheDocument();
  });

  it("recovers from pending listener metadata when the write promise is acknowledged", async () => {
    const shoe = await repositories.shoes.create({ name: "Daily Trainer" });
    const run = await repositories.runs.create({
      shoeId: shoe.id,
      startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
      timeZone,
      distance: milesToMeters(3),
      duration: createDurationSeconds(1_800),
    });
    let resolveUpdate: (run: CompletedRun) => void = () => undefined;
    const updateRequest = new Promise<CompletedRun>((resolve) => {
      resolveUpdate = resolve;
    });
    vi.spyOn(repositories.runs, "update").mockReturnValue(updateRequest);
    const user = userEvent.setup();
    renderProvider();
    const source = await waitForSource();
    await publishRepositories(source);
    expect(await screen.findByText("Total: 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit run" }));
    const updatedRun: CompletedRun = {
      ...run,
      distance: milesToMeters(4),
      updatedAt: createUtcDateTime("2026-08-03T12:01:00Z"),
    };
    act(() =>
      source.emit([
        {
          type: "source_snapshot",
          source: "runs",
          value: [updatedRun],
          ownerId: userId,
          sessionGeneration: source.sessionGeneration,
          origin: "cache",
          hasPendingWrites: true,
          observedAt: createUtcDateTime("2026-08-03T12:01:00Z"),
        },
      ]),
    );

    expect(screen.getByText("Status: stale")).toBeInTheDocument();
    expect(screen.getByText("Total: 3")).toBeInTheDocument();

    await act(async () => {
      resolveUpdate(updatedRun);
      await updateRequest;
    });

    expect(await screen.findByText("Status: current")).toBeInTheDocument();
    expect(screen.getByText("Total: 4")).toBeInTheDocument();
    expect(sources).toHaveLength(1);
  });

  it("keeps controls enabled when late pending metadata repeats an acknowledged run", async () => {
    const shoe = await repositories.shoes.create({ name: "Daily Trainer" });
    await repositories.runs.create({
      shoeId: shoe.id,
      startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
      timeZone,
      distance: milesToMeters(3),
      duration: createDurationSeconds(1_800),
    });
    const user = userEvent.setup();
    renderProvider();
    const source = await waitForSource();
    await publishRepositories(source);

    await user.click(screen.getByRole("button", { name: "Edit run" }));
    expect(await screen.findByText("Total: 4")).toBeInTheDocument();
    expect(screen.getByText("Status: current")).toBeInTheDocument();

    const acknowledged = await snapshotFromRepositories(userId, repositories);
    act(() =>
      source.emit([
        {
          type: "source_snapshot",
          source: "runs",
          value: acknowledged.runs,
          ownerId: userId,
          sessionGeneration: source.sessionGeneration,
          origin: "cache",
          hasPendingWrites: true,
          observedAt: createUtcDateTime("2026-08-03T12:01:00Z"),
        },
      ]),
    );

    expect(screen.getByText("Status: current")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit run" })).toBeEnabled();
    expect(screen.getByText("Total: 4")).toBeInTheDocument();
  });

  it("converges completion, analytics, and shoe mileage from listener snapshots", async () => {
    const plan = await repositories.plans.create({
      name: "First Marathon Journey",
      startDate: createDateOnly("2026-08-03"),
      targetRaceDate: createDateOnly("2027-01-10"),
    });
    await repositories.workouts.create({
      planId: plan.id,
      scheduledDate: createDateOnly("2026-08-03"),
      phase: "base_building",
      kind: "run",
      purpose: "easy",
      targetDistance: milesToMeters(5),
    });
    await repositories.shoes.create({ name: "Daily Trainer" });
    const user = userEvent.setup();
    renderProvider();
    const source = await waitForSource();
    await publishRepositories(source);

    expect(await screen.findByText("Workout: planned")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Complete workout" }));
    await waitFor(async () => expect(await repositories.runs.list()).toHaveLength(1));
    expect(await screen.findByText("Runs: 1")).toBeInTheDocument();
    expect(mockedRecordSlowRunDiagnostic).toHaveBeenCalledWith({
      submission: expect.objectContaining({ outcome: "succeeded" }),
      plannedWorkout: true,
    });
    expect(screen.getByText("Workout: completed")).toBeInTheDocument();
    expect(screen.getByText("Total: 3")).toBeInTheDocument();
    expect(screen.getByText("Shoe: 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit run" }));
    await waitFor(async () =>
      expect(await repositories.runs.list()).toEqual([
        expect.objectContaining({ distance: milesToMeters(4) }),
      ]),
    );
    expect(await screen.findByText("Total: 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete run" }));
    await waitFor(async () => expect(await repositories.runs.list()).toEqual([]));
    expect(await screen.findByText("Runs: 0")).toBeInTheDocument();
    expect(screen.getByText("Workout: planned")).toBeInTheDocument();
  });

  it("routes completion through a command while listener snapshots remain visible truth", async () => {
    const plan = await repositories.plans.create({
      name: "First Marathon Journey",
      startDate: createDateOnly("2026-08-03"),
      targetRaceDate: createDateOnly("2027-01-10"),
    });
    const workout = await repositories.workouts.create({
      planId: plan.id,
      scheduledDate: createDateOnly("2026-08-03"),
      phase: "base_building",
      kind: "run",
      purpose: "easy",
      targetDistance: milesToMeters(5),
    });
    const shoe = await repositories.shoes.create({ name: "Daily Trainer" });
    const directCreate = vi.spyOn(repositories.runs, "create");
    vi.mocked(completedRunCommandClient.submitCompletion).mockResolvedValue({
      status: "run_completed",
      commandId: "run-complete-test-command",
      completedRunId: createCompletedRunId("run-command-confirmed"),
      completedRunUpdatedAt: timestamp,
      completedPlannedWorkout: {
        planId: workout.planId,
        workoutId: workout.id,
        updatedAt: timestamp,
      },
    });
    const user = userEvent.setup();
    renderCommandProvider();
    const source = await waitForSource();
    await publishRepositories(source);

    await user.click(screen.getByRole("button", { name: "Complete workout" }));

    await waitFor(() =>
      expect(completedRunCommandClient.submitCompletion).toHaveBeenCalledWith({
        commandId: "run-complete-test-command",
        input: {
          plannedWorkout: {
            planId: workout.planId,
            workoutId: workout.id,
            expectedUpdatedAt: workout.updatedAt,
          },
          shoeId: shoe.id,
          startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
          timeZone,
          distance: milesToMeters(3),
          duration: createDurationSeconds(1_800),
          perceivedEffort: undefined,
          unusualPain: undefined,
          notes: undefined,
        },
      }),
    );
    expect(directCreate).not.toHaveBeenCalled();
    expect(screen.getByText("Runs: 0")).toBeInTheDocument();
    expect(screen.getByText("Workout: planned")).toBeInTheDocument();
    expect(mockedRecordSlowRunDiagnostic).toHaveBeenCalledWith({
      submission: expect.objectContaining({ outcome: "succeeded" }),
      plannedWorkout: true,
    });

    await repositories.runs.create({
      plannedWorkoutPlanId: workout.planId,
      plannedWorkoutId: workout.id,
      shoeId: shoe.id,
      startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
      timeZone,
      distance: milesToMeters(3),
      duration: createDurationSeconds(1_800),
    });
    await repositories.workouts.update(workout.planId, workout.id, {
      status: "completed",
    });
    await publishRepositories(source);

    expect(await screen.findByText("Runs: 1")).toBeInTheDocument();
    expect(screen.getByText("Workout: completed")).toBeInTheDocument();
  });

  it("resolves an ambiguous completion with its original command ID", async () => {
    const plan = await repositories.plans.create({
      name: "First Marathon Journey",
      startDate: createDateOnly("2026-08-03"),
      targetRaceDate: createDateOnly("2027-01-10"),
    });
    const workout = await repositories.workouts.create({
      planId: plan.id,
      scheduledDate: createDateOnly("2026-08-03"),
      phase: "base_building",
      kind: "run",
      purpose: "easy",
      targetDistance: milesToMeters(5),
    });
    await repositories.shoes.create({ name: "Daily Trainer" });
    const directCreate = vi.spyOn(repositories.runs, "create");
    vi.mocked(completedRunCommandClient.submitCompletion).mockResolvedValue(
      unknownCompletion("run-complete-test-command"),
    );
    vi.mocked(completedRunCommandClient.resolveCompletion)
      .mockResolvedValueOnce(
        unknownCompletion("run-complete-test-command"),
      )
      .mockResolvedValueOnce({
        status: "run_completed",
        commandId: "run-complete-test-command",
        completedRunId: createCompletedRunId("run-command-resolved"),
        completedRunUpdatedAt: timestamp,
        completedPlannedWorkout: {
          planId: workout.planId,
          workoutId: workout.id,
          updatedAt: timestamp,
        },
      });
    const user = userEvent.setup();
    renderCommandProvider();
    const source = await waitForSource();
    await publishRepositories(source);
    const complete = screen.getByRole("button", { name: "Complete workout" });

    await user.click(complete);
    await waitFor(() =>
      expect(completedRunCommandClient.resolveCompletion).toHaveBeenCalledTimes(1),
    );
    await user.click(complete);

    await waitFor(() =>
      expect(completedRunCommandClient.resolveCompletion).toHaveBeenCalledTimes(2),
    );
    expect(completedRunCommandClient.submitCompletion).toHaveBeenCalledOnce();
    expect(completedRunCommandClient.resolveCompletion).toHaveBeenNthCalledWith(
      1,
      "run-complete-test-command",
    );
    expect(completedRunCommandClient.resolveCompletion).toHaveBeenNthCalledWith(
      2,
      "run-complete-test-command",
    );
    expect(directCreate).not.toHaveBeenCalled();
  });

  it("routes deletion through a command and waits for listener removal", async () => {
    const shoe = await repositories.shoes.create({ name: "Daily Trainer" });
    const run = await repositories.runs.create({
      shoeId: shoe.id,
      startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
      timeZone,
      distance: milesToMeters(3),
      duration: createDurationSeconds(1_800),
    });
    const directDelete = vi.spyOn(repositories.runs, "delete");
    vi.mocked(completedRunCommandClient.submitDeletion).mockResolvedValue({
      status: "run_deleted",
      commandId: "run-delete-test-command",
      completedRunId: run.id,
      deletedAt: timestamp,
      reopenedPlannedWorkout: null,
    });
    const user = userEvent.setup();
    renderCommandProvider();
    const source = await waitForSource();
    await publishRepositories(source);

    await user.click(screen.getByRole("button", { name: "Delete run" }));

    await waitFor(() =>
      expect(completedRunCommandClient.submitDeletion).toHaveBeenCalledWith({
        commandId: "run-delete-test-command",
        completedRunId: run.id,
        expectedCompletedRunUpdatedAt: run.updatedAt,
        plannedWorkout: null,
      }),
    );
    expect(directDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Runs: 1")).toBeInTheDocument();

    await repositories.runs.delete(run.id);
    await publishRepositories(source);
    expect(await screen.findByText("Runs: 0")).toBeInTheDocument();
  });

  it("keeps completed-run editing on its acknowledged repository path", async () => {
    const shoe = await repositories.shoes.create({ name: "Daily Trainer" });
    await repositories.runs.create({
      shoeId: shoe.id,
      startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
      timeZone,
      distance: milesToMeters(3),
      duration: createDurationSeconds(1_800),
    });
    const directUpdate = vi.spyOn(repositories.runs, "update");
    const user = userEvent.setup();
    renderCommandProvider();
    const source = await waitForSource();
    await publishRepositories(source);

    await user.click(screen.getByRole("button", { name: "Edit run" }));

    await waitFor(() => expect(directUpdate).toHaveBeenCalledOnce());
    expect(completedRunCommandClient.submitUpdate).not.toHaveBeenCalled();
    expect(await screen.findByText("Total: 4")).toBeInTheDocument();
    expect(screen.getByText("Status: current")).toBeInTheDocument();
  });

  it("surfaces a listener error and creates a fresh subscription on retry", async () => {
    const user = userEvent.setup();
    renderProvider();
    const firstSource = await waitForSource();
    act(() => firstSource.emitError("Training data is temporarily unavailable."));

    expect(
      await screen.findByText("error: Training data is temporarily unavailable."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry sync" }));

    const replacementSource = await waitForSource(1);
    expect(firstSource.unsubscribe).toHaveBeenCalledOnce();
    expect(replacementSource.sessionGeneration).toBeGreaterThan(
      firstSource.sessionGeneration,
    );
    await publishRepositories(replacementSource);
    expect(await screen.findByText("Status: current")).toBeInTheDocument();
  });

  it("clears an old owner and ignores a deliberately late callback", async () => {
    const secondUserId = createUserId("runner-2");
    const firstRepositories = await createNamedRepositories(userId, "Runner One");
    const secondRepositories = await createNamedRepositories(
      secondUserId,
      "Runner Two",
    );
    repositoryFactory = async (requestedUserId) =>
      requestedUserId === userId ? firstRepositories : secondRepositories;
    const view = renderProvider();
    const firstSource = await waitForSource(0);
    await publishRepositories(firstSource, firstRepositories);
    expect(await screen.findByText("Profile: Runner One")).toBeInTheDocument();

    view.rerender(
      <TrainingDataProvider
        userId={secondUserId}
        repositoryFactory={repositoryFactory}
        liveReadSourceFactory={liveReadSourceFactory}
      >
        <IntegrationProbe />
      </TrainingDataProvider>,
    );

    expect(await screen.findByText("loading")).toBeInTheDocument();
    expect(screen.queryByText("Profile: Runner One")).not.toBeInTheDocument();
    const secondSource = await waitForSource(1);
    await publishRepositories(secondSource, secondRepositories);
    expect(await screen.findByText("Profile: Runner Two")).toBeInTheDocument();
    expect(firstSource.unsubscribe).toHaveBeenCalledOnce();

    await publishRepositories(firstSource, firstRepositories);
    expect(screen.getByText("Profile: Runner Two")).toBeInTheDocument();
    expect(screen.queryByText("Profile: Runner One")).not.toBeInTheDocument();
  });
});
