import { describe, expect, it, vi } from "vitest";
import { createUserId, createUtcDateTime } from "../domain/training";
import {
  createTrainingStartupRecorder,
  trainingStartupTimingNames,
} from "./trainingStartupDiagnostics";
import type {
  TrainingLiveReadEvent,
  TrainingSnapshotSource,
} from "./trainingSynchronization";

const ownerId = createUserId("timing-runner");
const observedAt = createUtcDateTime("2026-11-18T12:00:00Z");

function event(source: TrainingSnapshotSource): TrainingLiveReadEvent {
  const shared = {
    type: "source_snapshot" as const,
    ownerId,
    sessionGeneration: 1,
    origin: "server" as const,
    hasPendingWrites: false,
    observedAt,
  };

  switch (source) {
    case "profile":
      return { ...shared, source, value: null };
    case "activePlanState":
      return { ...shared, source, value: null };
    case "plans":
      return { ...shared, source, value: [] };
    case "workouts":
      return { ...shared, source, value: [] };
    case "runs":
      return { ...shared, source, value: [] };
    case "shoes":
      return { ...shared, source, value: [] };
  }
}

describe("training startup diagnostics", () => {
  it("records fixed privacy-safe stages once as sources become available", () => {
    const measure = vi
      .spyOn(globalThis.performance, "measure")
      .mockImplementation(() => ({}) as PerformanceMeasure);
    const recorder = createTrainingStartupRecorder(10);

    recorder.infrastructureReady();
    recorder.infrastructureReady();
    recorder.observe([
      event("profile"),
      event("activePlanState"),
      event("plans"),
      event("workouts"),
    ]);
    recorder.observe([event("workouts"), event("runs"), event("shoes")]);

    expect(measure.mock.calls.map(([name]) => name)).toEqual([
      trainingStartupTimingNames.infrastructureReady,
      trainingStartupTimingNames.source("profile"),
      trainingStartupTimingNames.source("activePlanState"),
      trainingStartupTimingNames.source("plans"),
      trainingStartupTimingNames.source("workouts"),
      trainingStartupTimingNames.readable,
      trainingStartupTimingNames.source("runs"),
      trainingStartupTimingNames.source("shoes"),
      trainingStartupTimingNames.complete,
    ]);
    expect(JSON.stringify(measure.mock.calls)).not.toContain("timing-runner");
  });
});
