import {
  trainingInitialRenderSources,
  trainingSnapshotSources,
  type TrainingLiveReadEventBatch,
  type TrainingSnapshotSource,
} from "./trainingSynchronization";

const timingPrefix = "marathoner:training-startup";

export const trainingStartupTimingNames = {
  infrastructureReady: `${timingPrefix}:infrastructure-ready`,
  source: (source: TrainingSnapshotSource) => `${timingPrefix}:source:${source}`,
  readable: `${timingPrefix}:readable`,
  complete: `${timingPrefix}:complete`,
} as const;

function performanceNow(): number {
  try {
    return globalThis.performance?.now() ?? Date.now();
  } catch {
    return Date.now();
  }
}

function recordDuration(name: string, startedAt: number): void {
  try {
    globalThis.performance?.measure(name, {
      start: startedAt,
      end: performanceNow(),
    });
  } catch {
    // Privacy-safe startup timing must never change synchronization behavior.
  }
}

export interface TrainingStartupRecorder {
  readonly infrastructureReady: () => void;
  readonly observe: (events: TrainingLiveReadEventBatch) => void;
}

/**
 * Records fixed stage names and durations only. No owner IDs, document values,
 * paths, or error messages are included in the Performance entries.
 */
export function createTrainingStartupRecorder(
  startedAt = performanceNow(),
): TrainingStartupRecorder {
  const observedSources = new Set<TrainingSnapshotSource>();
  let infrastructureRecorded = false;
  let readableRecorded = false;
  let completeRecorded = false;

  return {
    infrastructureReady() {
      if (infrastructureRecorded) return;
      infrastructureRecorded = true;
      recordDuration(trainingStartupTimingNames.infrastructureReady, startedAt);
    },
    observe(events) {
      for (const event of events) {
        if (event.type !== "source_snapshot") continue;
        if (observedSources.has(event.source)) continue;

        observedSources.add(event.source);
        recordDuration(trainingStartupTimingNames.source(event.source), startedAt);
      }

      if (
        !readableRecorded &&
        trainingInitialRenderSources.every((source) =>
          observedSources.has(source),
        )
      ) {
        readableRecorded = true;
        recordDuration(trainingStartupTimingNames.readable, startedAt);
      }

      if (
        !completeRecorded &&
        trainingSnapshotSources.every((source) => observedSources.has(source))
      ) {
        completeRecorded = true;
        recordDuration(trainingStartupTimingNames.complete, startedAt);
      }
    },
  };
}
