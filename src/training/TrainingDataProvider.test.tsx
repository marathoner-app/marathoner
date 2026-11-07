import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordSlowRunDiagnostic } from "../diagnostics/slowRunDiagnostics";
import {
  calculateShoeDistance,
  calculateTrainingAnalytics,
  createCompletedRunId,
  createDateOnly,
  createDurationSeconds,
  createIanaTimeZone,
  createTrainingPlanId,
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
import type { PendingRunSaveStore } from "./pendingRunSave";

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
      {
        ...session,
        type: "source_snapshot",
        source: "activePlanState",
        value: snapshot.activePlanState,
      },
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
let pendingRunSaveRecords: Map<UserId, string>;
let pendingRunSaveStore: PendingRunSaveStore;

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
    submitUpdate: vi.fn(async ({ commandId, completedRunId }) => ({
      status: "run_updated" as const,
      commandId,
      completedRunId,
      completedRunUpdatedAt: createUtcDateTime("2026-08-03T12:01:00Z"),
      reopenedPlannedWorkout: null,
      completedPlannedWorkout: null,
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
  pendingRunSaveRecords = new Map();
  pendingRunSaveStore = {
    read: vi.fn((ownerId) => pendingRunSaveRecords.get(ownerId) ?? null),
    write: vi.fn((ownerId, commandId) => {
      pendingRunSaveRecords.set(ownerId, commandId);
    }),
    clear: vi.fn((ownerId) => {
      pendingRunSaveRecords.delete(ownerId);
    }),
  };
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

  return {
    ownerId,
    profile,
    activePlanState: null,
    plans,
    workouts,
    runs,
    shoes,
  };
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
      completedRunCommandClientFactory={completedRunCommandClientFactory}
      createCompletedRunCommandId={(operation) =>
        `run-${operation}-test-command`
      }
      pendingRunSaveStore={pendingRunSaveStore}
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
      <p>
        Active revision: {training.activePlanState?.activePlanRevision ?? "none"}
      </p>
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

function RunCommandProbe() {
  const training = useTrainingData();
  const [outcome, setOutcome] = useState("idle");
  const [checkOutcome, setCheckOutcome] = useState("idle");

  if (training.status === "loading" || training.status === "error") {
    return <p>{training.status}</p>;
  }

  return (
    <div>
      <p>Command: {outcome}</p>
      <p>Pending run save: {training.hasPendingRunSave ? "yes" : "no"}</p>
      <button
        type="button"
        onClick={() => {
          setOutcome("pending");
          void training
            .createRun({
              shoeId: training.shoes[0]?.id,
              startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
              timeZone,
              distance: milesToMeters(3),
              duration: createDurationSeconds(1_800),
            })
            .then(() => setOutcome("success"))
            .catch((error: unknown) =>
              setOutcome(error instanceof Error ? error.message : "failed"),
            );
        }}
      >
        Create unplanned run
      </button>
      <button
        type="button"
        onClick={() => {
          setCheckOutcome("pending");
          void training
            .checkPendingRunSave()
            .then((result) => setCheckOutcome(result.status));
        }}
      >
        Check run save
      </button>
      <p>Check: {checkOutcome}</p>
    </div>
  );
}

describe("TrainingDataProvider", () => {
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
        activePlanState: null,
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

  it("exposes the server-owned active-plan state without a repository read", async () => {
    renderProvider();
    const source = await waitForSource();
    const snapshot = await snapshotFromRepositories(userId, repositories);

    act(() =>
      source.emitSnapshot({
        ...snapshot,
        activePlanState: {
          userId,
          activePlanId: createTrainingPlanId("approved-plan-1"),
          activePlanRevision: 3,
          approvedAt: timestamp,
          updatedAt: timestamp,
        },
      }),
    );

    expect(await screen.findByText("Active revision: 3")).toBeInTheDocument();
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

  it("keeps a command-acknowledged edit current when pending listener metadata arrives", async () => {
    const shoe = await repositories.shoes.create({ name: "Daily Trainer" });
    const run = await repositories.runs.create({
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

    expect(screen.getByText("Status: current")).toBeInTheDocument();
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
          value: acknowledged.runs.map((run) => ({
            ...run,
            distance: milesToMeters(4),
            updatedAt: createUtcDateTime("2026-08-03T12:01:00Z"),
          })),
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
    const workout = await repositories.workouts.create({
      planId: plan.id,
      scheduledDate: createDateOnly("2026-08-03"),
      phase: "base_building",
      kind: "run",
      purpose: "easy",
      targetDistance: milesToMeters(5),
    });
    const shoe = await repositories.shoes.create({ name: "Daily Trainer" });
    vi.mocked(completedRunCommandClient.submitCompletion).mockResolvedValue({
      status: "run_completed",
      commandId: "run-complete-test-command",
      completedRunId: createCompletedRunId("listener-confirmed-run"),
      completedRunUpdatedAt: timestamp,
      completedPlannedWorkout: {
        planId: workout.planId,
        workoutId: workout.id,
        updatedAt: timestamp,
      },
    });
    const user = userEvent.setup();
    renderProvider();
    const source = await waitForSource();
    await publishRepositories(source);

    expect(await screen.findByText("Workout: planned")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Complete workout" }));
    await waitFor(() =>
      expect(completedRunCommandClient.submitCompletion).toHaveBeenCalledOnce(),
    );
    expect(screen.getByText("Runs: 0")).toBeInTheDocument();

    const run = await repositories.runs.create({
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
    expect(mockedRecordSlowRunDiagnostic).toHaveBeenCalledWith({
      submission: expect.objectContaining({ outcome: "succeeded" }),
      plannedWorkout: true,
    });
    expect(screen.getByText("Workout: completed")).toBeInTheDocument();
    expect(screen.getByText("Total: 3")).toBeInTheDocument();
    expect(screen.getByText("Shoe: 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit run" }));
    await waitFor(() =>
      expect(completedRunCommandClient.submitUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          commandId: "run-update-test-command",
          completedRunId: run.id,
          input: expect.objectContaining({ distance: milesToMeters(4) }),
        }),
      ),
    );
    expect(await screen.findByText("Total: 4")).toBeInTheDocument();

    vi.mocked(completedRunCommandClient.submitDeletion).mockResolvedValue({
      status: "run_deleted",
      commandId: "run-delete-test-command",
      completedRunId: run.id,
      deletedAt: timestamp,
      reopenedPlannedWorkout: {
        planId: workout.planId,
        workoutId: workout.id,
        updatedAt: timestamp,
      },
    });
    await user.click(screen.getByRole("button", { name: "Delete run" }));
    await waitFor(() =>
      expect(completedRunCommandClient.submitDeletion).toHaveBeenCalledOnce(),
    );
    expect(screen.getByText("Runs: 1")).toBeInTheDocument();

    await repositories.runs.delete(run.id);
    await repositories.workouts.update(workout.planId, workout.id, {
      status: "planned",
    });
    await publishRepositories(source);

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
    renderProvider();
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

  it("submits an unplanned run without a workout reference or direct write", async () => {
    await repositories.shoes.create({ name: "Daily Trainer" });
    const directCreate = vi.spyOn(repositories.runs, "create");
    vi.mocked(completedRunCommandClient.submitCompletion).mockResolvedValue({
      status: "run_completed",
      commandId: "run-complete-test-command",
      completedRunId: createCompletedRunId("run-unplanned-confirmed"),
      completedRunUpdatedAt: timestamp,
      completedPlannedWorkout: null,
    });
    const user = userEvent.setup();
    renderProvider(<RunCommandProbe />);
    const source = await waitForSource();
    await publishRepositories(source);

    await user.click(screen.getByRole("button", { name: "Create unplanned run" }));

    expect(await screen.findByText("Command: success")).toBeInTheDocument();
    expect(completedRunCommandClient.submitCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: "run-complete-test-command",
        input: expect.objectContaining({ plannedWorkout: null }),
      }),
    );
    expect(directCreate).not.toHaveBeenCalled();
  });

  it("surfaces an offline completion failure without a direct write or retry", async () => {
    await repositories.shoes.create({ name: "Daily Trainer" });
    const directCreate = vi.spyOn(repositories.runs, "create");
    vi.mocked(completedRunCommandClient.submitCompletion).mockResolvedValue({
      status: "retryable_error",
      commandId: "run-complete-test-command",
      code: "temporarily-unavailable",
      message:
        "You are offline. This command was not queued; reconnect and try again.",
    });
    const user = userEvent.setup();
    renderProvider(<RunCommandProbe />);
    const source = await waitForSource();
    await publishRepositories(source);

    await user.click(screen.getByRole("button", { name: "Create unplanned run" }));

    expect(
      await screen.findByText(
        "Command: You are offline. This command was not queued; reconnect and try again.",
      ),
    ).toBeInTheDocument();
    expect(directCreate).not.toHaveBeenCalled();
    expect(completedRunCommandClient.resolveCompletion).not.toHaveBeenCalled();
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
    renderProvider();
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

  it("restores an uncertain completion after reload and checks the original command", async () => {
    await repositories.shoes.create({ name: "Daily Trainer" });
    vi.mocked(completedRunCommandClient.submitCompletion).mockResolvedValue(
      unknownCompletion("run-complete-test-command"),
    );
    vi.mocked(completedRunCommandClient.resolveCompletion).mockResolvedValue(
      unknownCompletion("run-complete-test-command"),
    );
    const user = userEvent.setup();
    const firstView = renderProvider(<RunCommandProbe />);
    const firstSource = await waitForSource();
    await publishRepositories(firstSource);

    await user.click(screen.getByRole("button", { name: "Create unplanned run" }));

    expect(
      await screen.findByText(/Command: Marathoner couldn't confirm/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Pending run save: yes")).toBeInTheDocument();
    expect(pendingRunSaveStore.write).toHaveBeenCalledWith(
      userId,
      "run-complete-test-command",
    );
    expect(vi.mocked(pendingRunSaveStore.write).mock.calls[0]).toEqual([
      userId,
      "run-complete-test-command",
    ]);

    firstView.unmount();
    vi.mocked(completedRunCommandClient.resolveCompletion).mockResolvedValue({
      status: "run_completed",
      commandId: "run-complete-test-command",
      completedRunId: createCompletedRunId("run-command-restored"),
      completedRunUpdatedAt: timestamp,
      completedPlannedWorkout: null,
    });
    renderProvider(<RunCommandProbe />);
    const restoredSource = await waitForSource();
    await publishRepositories(restoredSource);

    expect(await screen.findByText("Pending run save: yes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check run save" }));

    expect(await screen.findByText("Check: confirmed")).toBeInTheDocument();
    expect(screen.getByText("Pending run save: no")).toBeInTheDocument();
    expect(completedRunCommandClient.submitCompletion).toHaveBeenCalledOnce();
    expect(completedRunCommandClient.resolveCompletion).toHaveBeenLastCalledWith(
      "run-complete-test-command",
    );
    expect(pendingRunSaveStore.clear).toHaveBeenCalledWith(userId);
  });

  it("clears session recovery after a definitive status failure", async () => {
    pendingRunSaveRecords.set(userId, "run-complete-test-command");
    vi.mocked(completedRunCommandClient.resolveCompletion).mockResolvedValue({
      status: "validation_error",
      commandId: "run-complete-test-command",
      code: "invalid-run-completion",
      message: "That run could not be saved. Review it and try again.",
    });
    const user = userEvent.setup();
    renderProvider(<RunCommandProbe />);
    const source = await waitForSource();
    await publishRepositories(source);

    await user.click(screen.getByRole("button", { name: "Check run save" }));

    expect(await screen.findByText("Check: failed")).toBeInTheDocument();
    expect(screen.getByText("Pending run save: no")).toBeInTheDocument();
    expect(pendingRunSaveStore.clear).toHaveBeenCalledWith(userId);
  });

  it("keeps the original command protected when a status check is temporarily unavailable", async () => {
    pendingRunSaveRecords.set(userId, "run-complete-test-command");
    vi.mocked(completedRunCommandClient.resolveCompletion).mockResolvedValue({
      status: "retryable_error",
      commandId: "run-complete-test-command",
      code: "temporarily-unavailable",
      message: "The command service is temporarily unavailable. Retry shortly.",
    });
    const user = userEvent.setup();
    renderProvider(<RunCommandProbe />);
    const source = await waitForSource();
    await publishRepositories(source);

    await user.click(screen.getByRole("button", { name: "Check run save" }));

    expect(
      await screen.findByText("Check: still_unconfirmed"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pending run save: yes")).toBeInTheDocument();
    expect(pendingRunSaveStore.clear).not.toHaveBeenCalled();
  });

  it("submits deletion with run and workout revisions and waits for listener removal", async () => {
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
    const run = await repositories.runs.create({
      plannedWorkoutPlanId: workout.planId,
      plannedWorkoutId: workout.id,
      shoeId: shoe.id,
      startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
      timeZone,
      distance: milesToMeters(3),
      duration: createDurationSeconds(1_800),
    });
    const completedWorkout = await repositories.workouts.update(
      workout.planId,
      workout.id,
      { status: "completed" },
    );
    const directDelete = vi.spyOn(repositories.runs, "delete");
    vi.mocked(completedRunCommandClient.submitDeletion).mockResolvedValue({
      status: "run_deleted",
      commandId: "run-delete-test-command",
      completedRunId: run.id,
      deletedAt: timestamp,
      reopenedPlannedWorkout: {
        planId: completedWorkout.planId,
        workoutId: completedWorkout.id,
        updatedAt: timestamp,
      },
    });
    const user = userEvent.setup();
    renderProvider();
    const source = await waitForSource();
    await publishRepositories(source);

    await user.click(screen.getByRole("button", { name: "Delete run" }));

    await waitFor(() =>
      expect(completedRunCommandClient.submitDeletion).toHaveBeenCalledWith({
        commandId: "run-delete-test-command",
        completedRunId: run.id,
        expectedCompletedRunUpdatedAt: run.updatedAt,
        plannedWorkout: {
          planId: completedWorkout.planId,
          workoutId: completedWorkout.id,
          expectedUpdatedAt: completedWorkout.updatedAt,
        },
      }),
    );
    expect(directDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Runs: 1")).toBeInTheDocument();

    await repositories.runs.delete(run.id);
    await repositories.workouts.update(workout.planId, workout.id, {
      status: "planned",
    });
    await publishRepositories(source);
    expect(await screen.findByText("Runs: 0")).toBeInTheDocument();
    expect(screen.getByText("Workout: planned")).toBeInTheDocument();
  });

  it("resolves an ambiguous deletion with its original command ID", async () => {
    const shoe = await repositories.shoes.create({ name: "Daily Trainer" });
    const run = await repositories.runs.create({
      shoeId: shoe.id,
      startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
      timeZone,
      distance: milesToMeters(3),
      duration: createDurationSeconds(1_800),
    });
    const directDelete = vi.spyOn(repositories.runs, "delete");
    vi.mocked(completedRunCommandClient.submitDeletion).mockResolvedValue(
      unknownDeletion("run-delete-test-command"),
    );
    vi.mocked(completedRunCommandClient.resolveDeletion).mockResolvedValue({
      status: "run_deleted",
      commandId: "run-delete-test-command",
      completedRunId: run.id,
      deletedAt: timestamp,
      reopenedPlannedWorkout: null,
    });
    const user = userEvent.setup();
    renderProvider();
    const source = await waitForSource();
    await publishRepositories(source);

    await user.click(screen.getByRole("button", { name: "Delete run" }));

    await waitFor(() =>
      expect(completedRunCommandClient.resolveDeletion).toHaveBeenCalledWith(
        "run-delete-test-command",
      ),
    );
    expect(completedRunCommandClient.submitDeletion).toHaveBeenCalledOnce();
    expect(directDelete).not.toHaveBeenCalled();
  });

  it("routes completed-run editing through the trusted command path", async () => {
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
    renderProvider();
    const source = await waitForSource();
    await publishRepositories(source);

    await user.click(screen.getByRole("button", { name: "Edit run" }));

    await waitFor(() =>
      expect(completedRunCommandClient.submitUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          commandId: "run-update-test-command",
          input: expect.objectContaining({ distance: milesToMeters(4) }),
        }),
      ),
    );
    expect(directUpdate).not.toHaveBeenCalled();
    expect(await screen.findByText("Total: 4")).toBeInTheDocument();
    expect(screen.getByText("Status: current")).toBeInTheDocument();
  });

  it("keeps imported source facts unchanged during local update projection", async () => {
    const run = await repositories.runs.create({
      startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
      timeZone,
      distance: milesToMeters(3),
      duration: createDurationSeconds(1_800),
    });
    const user = userEvent.setup();
    renderProvider();
    const source = await waitForSource();
    const snapshot = await snapshotFromRepositories(userId, repositories);
    act(() =>
      source.emitSnapshot({
        ...snapshot,
        runs: [
          {
            ...run,
            importProvider: "apple_health",
            reportedOrigin: "garmin",
          },
        ],
      }),
    );

    await user.click(await screen.findByRole("button", { name: "Edit run" }));

    await waitFor(() =>
      expect(completedRunCommandClient.submitUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ distance: milesToMeters(3) }),
        }),
      ),
    );
    expect(screen.getByText("Total: 3")).toBeInTheDocument();
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
        completedRunCommandClientFactory={completedRunCommandClientFactory}
        createCompletedRunCommandId={(operation) =>
          `run-${operation}-test-command`
        }
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
