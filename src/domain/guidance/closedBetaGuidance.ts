export const CLOSED_BETA_GUIDANCE_RESULT_SCHEMA_VERSION =
  "closed-beta-guidance-result@1" as const;

export const CLOSED_BETA_GUIDANCE_SAFETY_STATES = [
  "none_reported",
  "reported",
  "unanswered",
] as const;

export type ClosedBetaGuidanceSafetyState =
  (typeof CLOSED_BETA_GUIDANCE_SAFETY_STATES)[number];

export interface GetClosedBetaGuidanceRequest {
  readonly activeTriggerCodes: readonly string[];
  readonly safetyState: ClosedBetaGuidanceSafetyState;
  readonly emergencySignals: readonly string[];
  readonly otherConcerningOrPersistentSymptoms: boolean;
}

export interface DismissClosedBetaGuidanceRequest {
  readonly presentationId: string;
  readonly artifactVersion: string;
}

export interface ClosedBetaGuidancePresentation {
  readonly presentationId: string;
  readonly artifactVersion: string;
  readonly kind: "guidance" | "safety";
  readonly title: string;
  readonly message: string;
  readonly limitations: readonly string[];
  readonly contextLabel: string;
  readonly dismissible: boolean;
}

export type ClosedBetaGuidanceResult =
  | {
      readonly schemaVersion: typeof CLOSED_BETA_GUIDANCE_RESULT_SCHEMA_VERSION;
      readonly status: "available";
      readonly presentation: ClosedBetaGuidancePresentation;
    }
  | {
      readonly schemaVersion: typeof CLOSED_BETA_GUIDANCE_RESULT_SCHEMA_VERSION;
      readonly status: "none";
      readonly reason:
        | "no_matching_guidance"
        | "suppressed"
        | "guidance_disabled";
    }
  | {
      readonly schemaVersion: typeof CLOSED_BETA_GUIDANCE_RESULT_SCHEMA_VERSION;
      readonly status: "dismissed";
      readonly presentationId: string;
    }
  | {
      readonly schemaVersion: typeof CLOSED_BETA_GUIDANCE_RESULT_SCHEMA_VERSION;
      readonly status: "authorization_error";
      readonly code:
        | "sign-in-required"
        | "app-check-required"
        | "approved-beta-membership-required"
        | "methodology-consent-required";
    }
  | {
      readonly schemaVersion: typeof CLOSED_BETA_GUIDANCE_RESULT_SCHEMA_VERSION;
      readonly status: "stale_version" | "unavailable" | "validation_error";
      readonly code: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isPresentation(value: unknown): value is ClosedBetaGuidancePresentation {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = [
    "artifactVersion",
    "contextLabel",
    "dismissible",
    "kind",
    "limitations",
    "message",
    "presentationId",
    "title",
  ].sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === expected[index]) &&
    typeof value.presentationId === "string" &&
    typeof value.artifactVersion === "string" &&
    (value.kind === "guidance" || value.kind === "safety") &&
    typeof value.title === "string" &&
    typeof value.message === "string" &&
    isStringArray(value.limitations) &&
    typeof value.contextLabel === "string" &&
    typeof value.dismissible === "boolean"
  );
}

export function parseClosedBetaGuidanceResult(
  value: unknown,
): ClosedBetaGuidanceResult {
  if (
    !isRecord(value) ||
    value.schemaVersion !== CLOSED_BETA_GUIDANCE_RESULT_SCHEMA_VERSION ||
    typeof value.status !== "string"
  ) {
    throw new Error("Marathoner received an invalid beta guidance response.");
  }
  if (value.status === "available" && isPresentation(value.presentation)) {
    return value as unknown as ClosedBetaGuidanceResult;
  }
  if (
    value.status === "none" &&
    ["no_matching_guidance", "suppressed", "guidance_disabled"].includes(
      String(value.reason),
    )
  ) {
    return value as unknown as ClosedBetaGuidanceResult;
  }
  if (
    value.status === "dismissed" &&
    typeof value.presentationId === "string"
  ) {
    return value as unknown as ClosedBetaGuidanceResult;
  }
  if (
    value.status === "authorization_error" &&
    typeof value.code === "string"
  ) {
    return value as unknown as ClosedBetaGuidanceResult;
  }
  if (
    ["stale_version", "unavailable", "validation_error"].includes(
      value.status,
    ) &&
    typeof value.code === "string"
  ) {
    return value as unknown as ClosedBetaGuidanceResult;
  }
  throw new Error("Marathoner received an invalid beta guidance response.");
}
