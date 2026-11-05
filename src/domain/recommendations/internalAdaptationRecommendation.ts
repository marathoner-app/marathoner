import { isDateOnly, type DateOnly } from "../training/dates.js";
import {
  createPlannedWorkoutId,
  type PlannedWorkoutId,
} from "../training/identifiers.js";
import {
  createRecommendationId,
  type RecommendationId,
} from "./recommendationEvidence.js";

export const INTERNAL_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION = 1 as const;

const commandIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,95}$/;

export interface InternalAdaptationRecommendationCommand {
  readonly schemaVersion: typeof INTERNAL_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION;
  readonly commandId: string;
  readonly triggerWorkoutId: PlannedWorkoutId;
  readonly evaluationDate: DateOnly;
  readonly confirmedRescheduleTargetDate: DateOnly | null;
}

export type InternalAdaptationRecommendationResult =
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
        | "approved-beta-membership-required";
      message: string;
    }>
  | Readonly<{
      status: "disabled";
      commandId: string | null;
      code: "internal-adaptation-disabled";
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

export function internalAdaptationCommandIdFrom(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return typeof value.commandId === "string" &&
    commandIdPattern.test(value.commandId)
    ? value.commandId
    : null;
}

export function parseInternalAdaptationRecommendationCommand(
  value: unknown,
): InternalAdaptationRecommendationCommand | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    "commandId",
    "confirmedRescheduleTargetDate",
    "evaluationDate",
    "schemaVersion",
    "triggerWorkoutId",
  ].sort();
  if (
    keys.length !== expectedKeys.length ||
    !keys.every((key, index) => key === expectedKeys[index]) ||
    value.schemaVersion !== INTERNAL_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION ||
    typeof value.commandId !== "string" ||
    !commandIdPattern.test(value.commandId) ||
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
      schemaVersion: INTERNAL_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
      commandId: value.commandId,
      triggerWorkoutId: createPlannedWorkoutId(value.triggerWorkoutId),
      evaluationDate: value.evaluationDate as DateOnly,
      confirmedRescheduleTargetDate:
        value.confirmedRescheduleTargetDate as DateOnly | null,
    };
  } catch {
    return null;
  }
}

export function isInternalAdaptationRecommendationResult(
  value: unknown,
): value is InternalAdaptationRecommendationResult {
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
  if (value.status === "authorization_error") {
    return [
      "authentication-required",
      "app-check-required",
      "approved-beta-membership-required",
    ].includes(value.code);
  }
  if (value.status === "disabled") {
    return value.code === "internal-adaptation-disabled";
  }
  return true;
}
