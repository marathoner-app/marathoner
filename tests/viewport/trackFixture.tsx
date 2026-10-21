/* eslint-disable react-refresh/only-export-components -- Standalone browser-test entrypoint. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import ShoeTracker from "../../src/components/ShoeTracker";
import {
  createCompletedRunId,
  createDistanceMeters,
  createShoeId,
  createUserId,
  createUtcDateTime,
  type CompletedRun,
  type DateOnly,
  type Shoe,
  type ShoeId,
} from "../../src/domain/training";
import type {
  CreateCompletedRunInput,
  CreateShoeInput,
  UpdateCompletedRunInput,
} from "../../src/persistence/trainingRepositories";

const userId = createUserId("viewport-runner");
const timestamp = createUtcDateTime("2026-10-21T16:00:00Z");

function TrackViewportFixture() {
  const [runs, setRuns] = useState<CompletedRun[]>([]);
  const [shoes, setShoes] = useState<Shoe[]>([]);

  const createShoe = async (input: CreateShoeInput) => {
    const shoe: Shoe = {
      id: createShoeId(`viewport-shoe-${shoes.length + 1}`),
      userId,
      name: input.name,
      startingDistance: input.startingDistance ?? createDistanceMeters(0),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setShoes((current) => [...current, shoe]);
    return shoe;
  };

  const createRun = async (input: CreateCompletedRunInput) => {
    const run: CompletedRun = {
      ...input,
      id: createCompletedRunId(`viewport-run-${runs.length + 1}`),
      userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setRuns((current) => [run, ...current]);
    return run;
  };

  const updateRun = async (
    id: CompletedRun["id"],
    changes: UpdateCompletedRunInput,
  ) => {
    const existing = runs.find((run) => run.id === id);
    if (existing === undefined) throw new Error("Run not found");

    const updated: CompletedRun = {
      ...existing,
      startedAt: changes.startedAt ?? existing.startedAt,
      timeZone: changes.timeZone ?? existing.timeZone,
      distance: changes.distance ?? existing.distance,
      duration: changes.duration ?? existing.duration,
      shoeId:
        changes.shoeId === null ? undefined : changes.shoeId ?? existing.shoeId,
      perceivedEffort:
        changes.perceivedEffort === null
          ? undefined
          : changes.perceivedEffort ?? existing.perceivedEffort,
      notes:
        changes.notes === null ? undefined : changes.notes ?? existing.notes,
      updatedAt: timestamp,
    };
    setRuns((current) =>
      current.map((run) => (run.id === updated.id ? updated : run)),
    );
    return updated;
  };

  const retireShoe = async (id: ShoeId, retiredOn: DateOnly) => {
    const existing = shoes.find((shoe) => shoe.id === id);
    if (existing === undefined) throw new Error("Shoe not found");

    const retired: Shoe = {
      ...existing,
      status: "retired",
      retiredOn,
      updatedAt: timestamp,
    };
    setShoes((current) =>
      current.map((shoe) => (shoe.id === retired.id ? retired : shoe)),
    );
    return retired;
  };

  return (
    <ShoeTracker
      distanceUnit="mile"
      runs={runs}
      shoes={shoes}
      plannedWorkouts={[]}
      onCreateShoe={createShoe}
      onRetireShoe={retireShoe}
      onCreateRun={createRun}
      onUpdateRun={updateRun}
      onDeleteRun={async (id) => {
        setRuns((current) => current.filter((run) => run.id !== id));
      }}
    />
  );
}

const root = document.querySelector("#root");
if (root === null) throw new Error("Track viewport fixture root was not found.");
createRoot(root).render(<TrackViewportFixture />);
