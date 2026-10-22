export const runCreationTimingNames = {
  total: "marathoner:run-create:total",
  associations: "marathoner:run-create:associations",
  writeAcknowledgement: "marathoner:run-create:write-acknowledgement",
} as const;

export async function measureOperation<T>(
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  const timeline = globalThis.performance;
  const startedAt = timeline?.now();

  try {
    return await operation();
  } finally {
    if (timeline !== undefined && startedAt !== undefined) {
      try {
        timeline.measure(name, {
          start: startedAt,
          end: timeline.now(),
        });
      } catch {
        // Diagnostics must never change whether a persistence operation succeeds.
      }
    }
  }
}
