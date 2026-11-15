import { beforeEach, describe, expect, it, vi } from "vitest";

import { runCreationTimingNames } from "../persistence/operationTiming";
import {
  formatSlowRunDiagnostics,
  readSlowRunDiagnostics,
  recordSlowRunDiagnostic,
} from "./slowRunDiagnostics";

function measurement(durationMilliseconds: number, startedAtMilliseconds = 10) {
  return {
    startedAtMilliseconds,
    durationMilliseconds,
    outcome: "succeeded" as const,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("slow run diagnostics", () => {
  it("keeps legacy schema-one records readable", () => {
    const capturedAt = "2026-10-01T12:00:00.000Z";
    window.localStorage.setItem(
      "marathoner:slow-run-diagnostics:v1",
      JSON.stringify([
        {
          schemaVersion: 1,
          capturedAt,
          bundle: "index-legacy.js",
          runtime: "web",
          platform: "ios",
          browser: "safari",
          online: true,
          visibility: "visible",
          plannedWorkout: true,
          outcome: "succeeded",
          milliseconds: {
            submissionTotal: 7_000,
            repositoryTotal: null,
            associations: null,
            writeAcknowledgement: null,
            plannedWorkoutAcknowledgement: null,
          },
        },
      ]),
    );

    expect(
      readSlowRunDiagnostics(new Date("2026-10-02T12:00:00.000Z").getTime()),
    ).toEqual([
      expect.objectContaining({ schemaVersion: 1, capturedAt }),
    ]);
  });

  it("ignores routine run submissions", () => {
    recordSlowRunDiagnostic({
      submission: measurement(4_999),
      plannedWorkout: false,
    });

    expect(readSlowRunDiagnostics()).toEqual([]);
  });

  it("retains only the three most recent slow submissions for 14 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));

    for (let index = 0; index < 4; index += 1) {
      recordSlowRunDiagnostic({
        submission: measurement(6_000 + index),
        plannedWorkout: index % 2 === 0,
      });
      vi.advanceTimersByTime(1_000);
    }

    const retained = readSlowRunDiagnostics();
    expect(retained).toHaveLength(3);
    expect(retained.map(({ milliseconds }) => milliseconds.submissionTotal)).toEqual([
      6_001,
      6_002,
      6_003,
    ]);

    expect(
      readSlowRunDiagnostics(
        new Date("2026-10-16T12:00:00.000Z").getTime(),
      ),
    ).toEqual([]);
  });

  it("captures only phase measurements from the current submission", () => {
    const entries = new Map<string, PerformanceEntry[]>([
      [
        runCreationTimingNames.total,
        [
          { startTime: 5, duration: 30_000 } as PerformanceEntry,
          { startTime: 120, duration: 6_200 } as PerformanceEntry,
        ],
      ],
      [
        runCreationTimingNames.associations,
        [{ startTime: 130, duration: 5_800 } as PerformanceEntry],
      ],
      [
        runCreationTimingNames.writeAcknowledgement,
        [{ startTime: 5, duration: 29_000 } as PerformanceEntry],
      ],
    ]);
    vi.spyOn(performance, "getEntriesByName").mockImplementation(
      (name) => entries.get(name) ?? [],
    );

    recordSlowRunDiagnostic({
      submission: measurement(6_500, 100),
      plannedWorkout: false,
    });

    expect(readSlowRunDiagnostics()[0]).toMatchObject({
      plannedWorkout: false,
      outcome: "succeeded",
      milliseconds: {
        submissionTotal: 6_500,
        repositoryTotal: 6_200,
        associations: 5_800,
        writeAcknowledgement: null,
        plannedWorkoutAcknowledgement: null,
      },
    });
  });

  it("records command stages and slow listener convergence without identifiers", () => {
    const entries = new Map<string, PerformanceEntry[]>([
      [
        runCreationTimingNames.commandClientAcquisition,
        [{ startTime: 110, duration: 120 } as PerformanceEntry],
      ],
      [
        runCreationTimingNames.firstSubmission,
        [{ startTime: 240, duration: 800 } as PerformanceEntry],
      ],
      [
        runCreationTimingNames.safeRetry,
        [{ startTime: 1_050, duration: 900 } as PerformanceEntry],
      ],
      [
        runCreationTimingNames.commandResolution,
        [{ startTime: 1_960, duration: 400 } as PerformanceEntry],
      ],
    ]);
    vi.spyOn(performance, "getEntriesByName").mockImplementation(
      (name) => entries.get(name) ?? [],
    );

    recordSlowRunDiagnostic({
      submission: measurement(2_500, 100),
      plannedWorkout: true,
      commandOutcome: "committed",
      listenerConfirmation: {
        durationMilliseconds: 6_100,
        status: "confirmed",
      },
    });

    const diagnostics = readSlowRunDiagnostics();
    expect(diagnostics).toEqual([
      expect.objectContaining({
        schemaVersion: 2,
        commandOutcome: "committed",
        listenerConfirmationStatus: "confirmed",
        milliseconds: expect.objectContaining({
          submissionTotal: 2_500,
          commandClientAcquisition: 120,
          firstSubmission: 800,
          safeRetry: 900,
          commandResolution: 400,
          listenerConfirmation: 6_100,
        }),
      }),
    ]);

    const report = formatSlowRunDiagnostics(diagnostics);
    expect(report).not.toContain("commandId");
    expect(report).not.toContain("completedRunId");
    expect(report).not.toContain("userId");
  });

  it("formats a support report without account or run content", () => {
    recordSlowRunDiagnostic({
      submission: measurement(7_000),
      plannedWorkout: true,
    });

    const report = formatSlowRunDiagnostics(readSlowRunDiagnostics());

    expect(report).toContain("privacy-safe slow run diagnostics");
    expect(report).toContain('"submissionTotal": 7000');
    expect(report).not.toContain("userId");
    expect(report).not.toContain("distance");
    expect(report).not.toContain("notes");
  });
});
