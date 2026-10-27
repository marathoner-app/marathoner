export const runCreationTimingNames = {
  submissionTotal: "marathoner:run-create:submission-total",
  total: "marathoner:run-create:total",
  associations: "marathoner:run-create:associations",
  writeAcknowledgement: "marathoner:run-create:write-acknowledgement",
  plannedWorkoutAcknowledgement:
    "marathoner:run-create:planned-workout-acknowledgement",
} as const;

export const runUpdateTimingNames = {
  total: "marathoner:run-update:total",
  existingRead: "marathoner:run-update:existing-read",
  associations: "marathoner:run-update:associations",
  writeAcknowledgement: "marathoner:run-update:write-acknowledgement",
} as const;

export interface OperationMeasurement {
  readonly startedAtMilliseconds: number;
  readonly durationMilliseconds: number;
  readonly outcome: "succeeded" | "failed";
}

export async function measureOperation<T>(
  name: string,
  operation: () => Promise<T>,
  onMeasured?: (measurement: OperationMeasurement) => void,
): Promise<T> {
  const timeline = globalThis.performance;
  let startedAt: number | undefined;
  let outcome: OperationMeasurement["outcome"] = "failed";

  try {
    startedAt = timeline?.now();
  } catch {
    // Timing availability must never gate the persistence operation.
  }

  try {
    const result = await operation();
    outcome = "succeeded";
    return result;
  } finally {
    if (timeline !== undefined && startedAt !== undefined) {
      try {
        const endedAt = timeline.now();
        try {
          timeline.measure(name, {
            start: startedAt,
            end: endedAt,
          });
        } catch {
          // The callback can still retain a coarse duration when the browser's
          // Performance timeline is unavailable.
        }

        try {
          onMeasured?.({
            startedAtMilliseconds: startedAt,
            durationMilliseconds: endedAt - startedAt,
            outcome,
          });
        } catch {
          // Diagnostics must never change whether a persistence operation succeeds.
        }
      } catch {
        // Timing availability must never change the persistence result.
      }
    }
  }
}
