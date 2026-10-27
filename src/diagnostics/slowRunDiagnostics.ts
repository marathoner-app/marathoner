import {
  runCreationTimingNames,
  type OperationMeasurement,
} from "../persistence/operationTiming";

const STORAGE_KEY = "marathoner:slow-run-diagnostics:v1";
const SCHEMA_VERSION = 1;
const SLOW_OPERATION_THRESHOLD_MILLISECONDS = 5_000;
const RETENTION_MILLISECONDS = 14 * 24 * 60 * 60 * 1_000;
const MAX_RECORDS = 3;

type Runtime = "web" | "ios-app";
type Platform = "ios" | "android" | "macos" | "windows" | "other";
type Browser = "safari" | "chrome" | "firefox" | "edge" | "other";

export interface SlowRunDiagnostic {
  readonly schemaVersion: 1;
  readonly capturedAt: string;
  readonly bundle: string;
  readonly runtime: Runtime;
  readonly platform: Platform;
  readonly browser: Browser;
  readonly online: boolean;
  readonly visibility: DocumentVisibilityState | "unavailable";
  readonly plannedWorkout: boolean;
  readonly outcome: OperationMeasurement["outcome"];
  readonly milliseconds: {
    readonly submissionTotal: number;
    readonly repositoryTotal: number | null;
    readonly associations: number | null;
    readonly writeAcknowledgement: number | null;
    readonly plannedWorkoutAcknowledgement: number | null;
  };
}

interface RecordSlowRunDiagnosticInput {
  readonly submission: OperationMeasurement;
  readonly plannedWorkout: boolean;
}

function latestDuration(name: string, startedAtMilliseconds: number): number | null {
  const entries = globalThis.performance?.getEntriesByName(name, "measure") ?? [];
  const duration = entries
    .filter((entry) => entry.startTime >= startedAtMilliseconds)
    .at(-1)?.duration;

  return typeof duration === "number" && Number.isFinite(duration)
    ? Math.round(duration)
    : null;
}

function detectRuntime(): Runtime {
  return globalThis.location?.protocol === "capacitor:" ? "ios-app" : "web";
}

function detectPlatform(userAgent: string): Platform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macos";
  if (/Windows/i.test(userAgent)) return "windows";
  return "other";
}

function detectBrowser(userAgent: string): Browser {
  if (/Edg\//i.test(userAgent)) return "edge";
  if (/CriOS|Chrome\//i.test(userAgent)) return "chrome";
  if (/FxiOS|Firefox\//i.test(userAgent)) return "firefox";
  if (/Safari\//i.test(userAgent)) return "safari";
  return "other";
}

function currentBundle(): string {
  if (typeof document === "undefined") return "unavailable";

  const moduleScript = Array.from(document.scripts).find(
    (script) => script.type === "module" && script.src.length > 0,
  );

  if (!moduleScript) return "unavailable";

  try {
    return new URL(moduleScript.src).pathname.split("/").at(-1) ?? "unavailable";
  } catch {
    return "unavailable";
  }
}

function isSlowRunDiagnostic(value: unknown): value is SlowRunDiagnostic {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<SlowRunDiagnostic>;

  return (
    candidate.schemaVersion === SCHEMA_VERSION &&
    typeof candidate.capturedAt === "string" &&
    typeof candidate.bundle === "string" &&
    (candidate.runtime === "web" || candidate.runtime === "ios-app") &&
    typeof candidate.platform === "string" &&
    typeof candidate.browser === "string" &&
    typeof candidate.online === "boolean" &&
    typeof candidate.visibility === "string" &&
    typeof candidate.plannedWorkout === "boolean" &&
    (candidate.outcome === "succeeded" || candidate.outcome === "failed") &&
    typeof candidate.milliseconds === "object" &&
    candidate.milliseconds !== null &&
    typeof candidate.milliseconds.submissionTotal === "number"
  );
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readSlowRunDiagnostics(now = Date.now()): SlowRunDiagnostic[] {
  const localStorage = storage();
  if (!localStorage) return [];

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(stored)) return [];

    const retained = stored
      .filter(isSlowRunDiagnostic)
      .filter((record) => {
        const capturedAt = Date.parse(record.capturedAt);
        return (
          Number.isFinite(capturedAt) && now - capturedAt <= RETENTION_MILLISECONDS
        );
      })
      .slice(-MAX_RECORDS);

    if (retained.length !== stored.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(retained));
    }

    return retained;
  } catch {
    return [];
  }
}

export function recordSlowRunDiagnostic({
  submission,
  plannedWorkout,
}: RecordSlowRunDiagnosticInput): void {
  if (
    !Number.isFinite(submission.durationMilliseconds) ||
    submission.durationMilliseconds < SLOW_OPERATION_THRESHOLD_MILLISECONDS
  ) {
    return;
  }

  const localStorage = storage();
  if (!localStorage) return;

  try {
    const userAgent = globalThis.navigator?.userAgent ?? "";
    const record: SlowRunDiagnostic = {
      schemaVersion: SCHEMA_VERSION,
      capturedAt: new Date().toISOString(),
      bundle: currentBundle(),
      runtime: detectRuntime(),
      platform: detectPlatform(userAgent),
      browser: detectBrowser(userAgent),
      online: globalThis.navigator?.onLine ?? false,
      visibility: globalThis.document?.visibilityState ?? "unavailable",
      plannedWorkout,
      outcome: submission.outcome,
      milliseconds: {
        submissionTotal: Math.round(submission.durationMilliseconds),
        repositoryTotal: latestDuration(
          runCreationTimingNames.total,
          submission.startedAtMilliseconds,
        ),
        associations: latestDuration(
          runCreationTimingNames.associations,
          submission.startedAtMilliseconds,
        ),
        writeAcknowledgement: latestDuration(
          runCreationTimingNames.writeAcknowledgement,
          submission.startedAtMilliseconds,
        ),
        plannedWorkoutAcknowledgement: latestDuration(
          runCreationTimingNames.plannedWorkoutAcknowledgement,
          submission.startedAtMilliseconds,
        ),
      },
    };
    const records = [...readSlowRunDiagnostics(), record].slice(-MAX_RECORDS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Diagnostics must never change whether a run save succeeds or fails.
  }
}

export function formatSlowRunDiagnostics(
  diagnostics: readonly SlowRunDiagnostic[],
): string {
  return JSON.stringify(
    {
      description: "Marathoner privacy-safe slow run diagnostics",
      records: diagnostics,
    },
    null,
    2,
  );
}
