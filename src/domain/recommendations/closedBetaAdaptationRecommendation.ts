import { isDateOnly, type DateOnly } from "../training/dates.js";
import {
  createPlannedWorkoutId,
  type PlannedWorkoutId,
} from "../training/identifiers.js";
import {
  createRecommendationId,
  type RecommendationId,
} from "./recommendationEvidence.js";

export const CLOSED_BETA_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION = 1 as const;

const commandIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,95}$/;

export interface ClosedBetaAdaptationRecommendationCommand {
  readonly schemaVersion: typeof CLOSED_BETA_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION;
  readonly commandId: string;
  readonly manifestVersion: string;
  readonly adaptationArtifactVersion: string;
  readonly triggerWorkoutId: PlannedWorkoutId;
  readonly evaluationDate: DateOnly;
  readonly confirmedRescheduleTargetDate: DateOnly | null;
}

export type ClosedBetaAdaptationRecommendationResult =
  | Readonly<{
      status: "pending_recommendation_created";
      commandId: string;
      recommendationId: RecommendationId;
    }>
  | Readonly<{
      status: "no_change";
      commandId: string;
      reasonCode: string;
      explanationKey: string;
    }>
  | Readonly<{
      status: "refused";
      commandId: string | null;
      code: string;
      message: string;
    }>
  | Readonly<{
      status: "authorization_error";
      commandId: string | null;
      code:
        | "authentication-required"
        | "app-check-required"
        | "approved-beta-membership-required"
        | "methodology-consent-required";
      message: string;
    }>
  | Readonly<{
      status: "disabled" | "stale_version" | "unavailable";
      commandId: string | null;
      code: string;
      message: string;
    }>
  | Readonly<{
      status: "validation_error" | "conflict" | "retryable_error";
      commandId: string | null;
      code: string;
      message: string;
    }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

export function closedBetaAdaptationCommandIdFrom(
  value: unknown,
): string | null {
  if (!isRecord(value)) return null;
  return typeof value.commandId === "string" &&
    commandIdPattern.test(value.commandId)
    ? value.commandId
    : null;
}

export function parseClosedBetaAdaptationRecommendationCommand(
  value: unknown,
): ClosedBetaAdaptationRecommendationCommand | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schemaVersion",
      "commandId",
      "manifestVersion",
      "adaptationArtifactVersion",
      "triggerWorkoutId",
      "evaluationDate",
      "confirmedRescheduleTargetDate",
    ]) ||
    value.schemaVersion !==
      CLOSED_BETA_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION ||
    typeof value.commandId !== "string" ||
    !commandIdPattern.test(value.commandId) ||
    typeof value.manifestVersion !== "string" ||
    value.manifestVersion.length === 0 ||
    typeof value.adaptationArtifactVersion !== "string" ||
    value.adaptationArtifactVersion.length === 0 ||
    typeof value.triggerWorkoutId !== "string" ||
    typeof value.evaluationDate !== "string" ||
    !isDateOnly(value.evaluationDate) ||
    (value.confirmedRescheduleTargetDate !== null &&
      (typeof value.confirmedRescheduleTargetDate !== "string" ||
        !isDateOnly(value.confirmedRescheduleTargetDate)))
  ) {
    return null;
  }
  try {
    return {
      schemaVersion: CLOSED_BETA_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
      commandId: value.commandId,
      manifestVersion: value.manifestVersion,
      adaptationArtifactVersion: value.adaptationArtifactVersion,
      triggerWorkoutId: createPlannedWorkoutId(value.triggerWorkoutId),
      evaluationDate: value.evaluationDate as DateOnly,
      confirmedRescheduleTargetDate:
        value.confirmedRescheduleTargetDate as DateOnly | null,
    };
  } catch {
    return null;
  }
}

export function isClosedBetaAdaptationRecommendationResult(
  value: unknown,
): value is ClosedBetaAdaptationRecommendationResult {
  if (!isRecord(value) || typeof value.status !== "string") return false;
  const commandId = value.commandId;
  if (
    commandId !== null &&
    (typeof commandId !== "string" || !commandIdPattern.test(commandId))
  ) {
    return false;
  }
  if (value.status === "pending_recommendation_created") {
    if (
      !hasExactKeys(value, ["status", "commandId", "recommendationId"]) ||
      typeof commandId !== "string" ||
      typeof value.recommendationId !== "string"
    ) {
      return false;
    }
    try {
      createRecommendationId(value.recommendationId);
      return true;
    } catch {
      return false;
    }
  }
  if (value.status === "no_change") {
    return (
      hasExactKeys(value, [
        "status",
        "commandId",
        "reasonCode",
        "explanationKey",
      ]) &&
      typeof commandId === "string" &&
      typeof value.reasonCode === "string" &&
      value.reasonCode.length > 0 &&
      typeof value.explanationKey === "string" &&
      value.explanationKey.length > 0
    );
  }
  if (
    ![
      "refused",
      "authorization_error",
      "disabled",
      "stale_version",
      "unavailable",
      "validation_error",
      "conflict",
      "retryable_error",
    ].includes(value.status) ||
    !hasExactKeys(value, ["status", "commandId", "code", "message"]) ||
    typeof value.code !== "string" ||
    value.code.length === 0 ||
    typeof value.message !== "string" ||
    value.message.length === 0
  ) {
    return false;
  }
  return true;
}
