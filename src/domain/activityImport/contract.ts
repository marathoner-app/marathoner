import {
  createIanaTimeZone,
  createUtcDateTime,
  isIanaTimeZone,
  isUtcDateTime,
  type IanaTimeZone,
  type UtcDateTime,
} from "../training/dates.js";
import {
  createUserId,
  isIdentifierValue,
  type UserId,
} from "../training/identifiers.js";
import {
  createDistanceMeters,
  createDurationSeconds,
  type DistanceMeters,
  type DurationSeconds,
} from "../training/units.js";

export const COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION =
  "completed-activity-import@1" as const;
export const CROSS_PROVIDER_DUPLICATE_FINGERPRINT_SCHEMA_VERSION =
  "cross-provider-duplicate-fingerprint@1" as const;

export const ACTIVITY_IMPORT_PROVIDERS = [
  "apple_health",
  "garmin_connect",
] as const;
export const REPORTED_ACTIVITY_ORIGINS = [
  "apple",
  "garmin",
  "other",
  "unknown",
] as const;

export type ActivityImportProvider =
  (typeof ACTIVITY_IMPORT_PROVIDERS)[number];
export type ReportedActivityOrigin =
  (typeof REPORTED_ACTIVITY_ORIGINS)[number];

declare const providerActivityIdBrand: unique symbol;
declare const providerActivityIdentityKeyBrand: unique symbol;
declare const crossProviderFingerprintBrand: unique symbol;
declare const crossProviderCandidateKeyBrand: unique symbol;

/**
 * The value is deliberately opaque. Provider adapters may validate their own
 * SDK values, but portable Marathoner code only treats this as an identity.
 */
export type ProviderActivityId = string & {
  readonly [providerActivityIdBrand]: "ProviderActivityId";
};

export type ProviderActivityIdentityKey = string & {
  readonly [providerActivityIdentityKeyBrand]: "ProviderActivityIdentityKey";
};

export type CrossProviderDuplicateFingerprint = string & {
  readonly [crossProviderFingerprintBrand]: "CrossProviderDuplicateFingerprint";
};

export type CrossProviderCandidateKey = string & {
  readonly [crossProviderCandidateKeyBrand]: "CrossProviderCandidateKey";
};

interface CompletedActivityImportEventBaseV1 {
  readonly schemaVersion: typeof COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION;
  readonly ownerId: UserId;
  readonly provider: ActivityImportProvider;
  readonly providerActivityId: ProviderActivityId;
  /** Time Marathoner's adapter observed this provider event. */
  readonly observedAt: UtcDateTime;
  /** Provider update time when the provider exposes one; otherwise null. */
  readonly providerUpdatedAt: UtcDateTime | null;
}

export interface CompletedActivityUpsertV1
  extends CompletedActivityImportEventBaseV1 {
  readonly operation: "upsert";
  readonly activityType: "running";
  readonly startedAt: UtcDateTime;
  readonly endedAt: UtcDateTime | null;
  readonly durationSeconds: DurationSeconds | null;
  readonly timeZone: IanaTimeZone;
  readonly distanceMeters: DistanceMeters;
  /**
   * A provider adapter may report the producing ecosystem when it knows it.
   * For example, a Garmin workout read through Apple Health reports "garmin".
   * Unknown is valid and never guessed inside this portable contract.
   */
  readonly reportedOrigin: ReportedActivityOrigin;
}

export interface CompletedActivityDeletionV1
  extends CompletedActivityImportEventBaseV1 {
  readonly operation: "delete";
}

export type CompletedActivityImportEventV1 =
  | CompletedActivityUpsertV1
  | CompletedActivityDeletionV1;

export type ActivityImportValidationCode =
  | "required"
  | "invalid_schema_version"
  | "invalid_value"
  | "unexpected_field"
  | "inconsistent";

export interface ActivityImportValidationIssue {
  readonly code: ActivityImportValidationCode;
  readonly field: string;
  readonly message: string;
}

export type CompletedActivityImportParseResult =
  | {
      readonly ok: true;
      readonly value: CompletedActivityImportEventV1;
    }
  | {
      readonly ok: false;
      readonly issues: readonly ActivityImportValidationIssue[];
    };

export type ProviderEventResolutionKind =
  | "accepted"
  | "duplicate"
  | "ambiguous"
  | "updated"
  | "deleted"
  | "stale"
  | "unrelated";

export interface ProviderEventResolution {
  readonly kind: ProviderEventResolutionKind;
  readonly reviewRequired: boolean;
}

export type CrossProviderDuplicateAssessment =
  | {
      readonly kind: "not_candidate";
      readonly automaticMergeAllowed: false;
    }
  | {
      readonly kind: "duplicate_candidate";
      readonly automaticMergeAllowed: false;
      readonly reviewRequired: true;
      readonly candidateKey: CrossProviderCandidateKey;
      readonly fingerprint: CrossProviderDuplicateFingerprint;
    }
  | {
      readonly kind: "ambiguous_candidate";
      readonly automaticMergeAllowed: false;
      readonly reviewRequired: true;
      readonly candidateKey: CrossProviderCandidateKey;
      readonly differences: readonly (
        | "start_time"
        | "duration"
        | "distance"
        | "reported_origin"
      )[];
    };

type UnknownRecord = Readonly<Record<string, unknown>>;

const UPSERT_KEYS = [
  "schemaVersion",
  "operation",
  "ownerId",
  "provider",
  "providerActivityId",
  "observedAt",
  "providerUpdatedAt",
  "activityType",
  "startedAt",
  "endedAt",
  "durationSeconds",
  "timeZone",
  "distanceMeters",
  "reportedOrigin",
] as const;

const DELETION_KEYS = [
  "schemaVersion",
  "operation",
  "ownerId",
  "provider",
  "providerActivityId",
  "observedAt",
  "providerUpdatedAt",
] as const;

const MAX_PROVIDER_ACTIVITY_ID_LENGTH = 512;
const START_TIME_TOLERANCE_MILLISECONDS = 60_000;
const DURATION_TOLERANCE_SECONDS = 30;
const MINIMUM_DISTANCE_TOLERANCE_METERS = 50;
const DISTANCE_TOLERANCE_RATIO = 0.01;

function issue(
  code: ActivityImportValidationCode,
  field: string,
  message: string,
): ActivityImportValidationIssue {
  return { code, field, message };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unexpectedKeys(
  value: UnknownRecord,
  expectedKeys: readonly string[],
): ActivityImportValidationIssue[] {
  const expected = new Set(expectedKeys);
  return Object.keys(value)
    .filter((key) => !expected.has(key))
    .sort()
    .map((key) =>
      issue(
        "unexpected_field",
        key,
        "Remove fields that are not part of this contract version.",
      ),
    );
}

function includesValue<const Value extends string>(
  values: readonly Value[],
  value: unknown,
): value is Value {
  return typeof value === "string" && values.includes(value as Value);
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

export function isProviderActivityId(
  value: unknown,
): value is ProviderActivityId {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_PROVIDER_ACTIVITY_ID_LENGTH &&
    value.trim() === value &&
    !containsControlCharacter(value)
  );
}

export function createProviderActivityId(value: string): ProviderActivityId {
  if (!isProviderActivityId(value)) {
    throw new Error(
      "Provider activity ID must be a non-empty opaque value without surrounding whitespace or control characters.",
    );
  }

  return value;
}

function validateBaseFields(value: UnknownRecord): ActivityImportValidationIssue[] {
  const issues: ActivityImportValidationIssue[] = [];

  if (value.schemaVersion !== COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        "schemaVersion",
        `Use ${COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION}.`,
      ),
    );
  }

  if (!isIdentifierValue(value.ownerId)) {
    issues.push(
      issue(
        "invalid_value",
        "ownerId",
        "Owner ID must be a non-empty owner-scoped identifier.",
      ),
    );
  }

  if (!includesValue(ACTIVITY_IMPORT_PROVIDERS, value.provider)) {
    issues.push(
      issue(
        "invalid_value",
        "provider",
        "Provider must be apple_health or garmin_connect.",
      ),
    );
  }

  if (!isProviderActivityId(value.providerActivityId)) {
    issues.push(
      issue(
        "invalid_value",
        "providerActivityId",
        "Provider activity ID must remain a valid opaque value.",
      ),
    );
  }

  if (!isUtcDateTime(value.observedAt)) {
    issues.push(
      issue(
        "invalid_value",
        "observedAt",
        "Adapter observation time must be a valid UTC timestamp.",
      ),
    );
  }

  if (
    value.providerUpdatedAt !== null &&
    !isUtcDateTime(value.providerUpdatedAt)
  ) {
    issues.push(
      issue(
        "invalid_value",
        "providerUpdatedAt",
        "Provider update time must be null or a valid UTC timestamp.",
      ),
    );
  }

  return issues;
}

function validateUpsertFields(
  value: UnknownRecord,
): ActivityImportValidationIssue[] {
  const issues: ActivityImportValidationIssue[] = [];

  if (value.activityType !== "running") {
    issues.push(
      issue(
        "invalid_value",
        "activityType",
        "Only completed running activities are supported by this contract.",
      ),
    );
  }

  if (!isUtcDateTime(value.startedAt)) {
    issues.push(
      issue(
        "invalid_value",
        "startedAt",
        "Start time must be a valid UTC timestamp.",
      ),
    );
  }

  if (value.endedAt !== null && !isUtcDateTime(value.endedAt)) {
    issues.push(
      issue(
        "invalid_value",
        "endedAt",
        "End time must be null or a valid UTC timestamp.",
      ),
    );
  }

  if (
    value.durationSeconds !== null &&
    (!Number.isSafeInteger(value.durationSeconds) ||
      Number(value.durationSeconds) <= 0)
  ) {
    issues.push(
      issue(
        "invalid_value",
        "durationSeconds",
        "Duration must be null or a positive whole number of seconds.",
      ),
    );
  }

  if (value.endedAt === null && value.durationSeconds === null) {
    issues.push(
      issue(
        "required",
        "durationSeconds",
        "Provide either an end time or a duration.",
      ),
    );
  }

  if (!isIanaTimeZone(value.timeZone)) {
    issues.push(
      issue(
        "invalid_value",
        "timeZone",
        "Time zone must be a valid IANA time zone name.",
      ),
    );
  }

  if (
    !Number.isSafeInteger(value.distanceMeters) ||
    Number(value.distanceMeters) <= 0
  ) {
    issues.push(
      issue(
        "invalid_value",
        "distanceMeters",
        "Distance must be a positive whole number of meters.",
      ),
    );
  }

  if (!includesValue(REPORTED_ACTIVITY_ORIGINS, value.reportedOrigin)) {
    issues.push(
      issue(
        "invalid_value",
        "reportedOrigin",
        "Reported origin must be apple, garmin, other, or unknown.",
      ),
    );
  }

  if (isUtcDateTime(value.startedAt) && isUtcDateTime(value.endedAt)) {
    const elapsedMilliseconds =
      Date.parse(value.endedAt) - Date.parse(value.startedAt);
    if (elapsedMilliseconds <= 0) {
      issues.push(
        issue(
          "inconsistent",
          "endedAt",
          "End time must be later than start time.",
        ),
      );
    } else if (
      Number.isSafeInteger(value.durationSeconds) &&
      Math.abs(elapsedMilliseconds / 1000 - Number(value.durationSeconds)) > 1
    ) {
      issues.push(
        issue(
          "inconsistent",
          "durationSeconds",
          "Duration must agree with the supplied start and end times.",
        ),
      );
    }
  }

  return issues;
}

export function validateCompletedActivityImportEvent(
  value: unknown,
): readonly ActivityImportValidationIssue[] {
  if (!isRecord(value)) {
    return [
      issue(
        "required",
        "",
        "Completed activity import event must be an object.",
      ),
    ];
  }

  if (value.operation !== "upsert" && value.operation !== "delete") {
    return [
      ...unexpectedKeys(value, [...UPSERT_KEYS, ...DELETION_KEYS]),
      issue(
        "invalid_value",
        "operation",
        "Operation must be upsert or delete.",
      ),
      ...validateBaseFields(value),
    ];
  }

  const expectedKeys = value.operation === "upsert" ? UPSERT_KEYS : DELETION_KEYS;
  return [
    ...unexpectedKeys(value, expectedKeys),
    ...validateBaseFields(value),
    ...(value.operation === "upsert" ? validateUpsertFields(value) : []),
  ];
}

export function parseCompletedActivityImportEvent(
  value: unknown,
): CompletedActivityImportParseResult {
  const issues = validateCompletedActivityImportEvent(value);
  if (issues.length > 0 || !isRecord(value)) {
    return { ok: false, issues };
  }

  const base = {
    schemaVersion: COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION,
    ownerId: createUserId(String(value.ownerId)),
    provider: value.provider as ActivityImportProvider,
    providerActivityId: createProviderActivityId(
      String(value.providerActivityId),
    ),
    observedAt: createUtcDateTime(String(value.observedAt)),
    providerUpdatedAt:
      value.providerUpdatedAt === null
        ? null
        : createUtcDateTime(String(value.providerUpdatedAt)),
  };

  if (value.operation === "delete") {
    return {
      ok: true,
      value: { ...base, operation: "delete" },
    };
  }

  return {
    ok: true,
    value: {
      ...base,
      operation: "upsert",
      activityType: "running",
      startedAt: createUtcDateTime(String(value.startedAt)),
      endedAt:
        value.endedAt === null
          ? null
          : createUtcDateTime(String(value.endedAt)),
      durationSeconds:
        value.durationSeconds === null
          ? null
          : createDurationSeconds(Number(value.durationSeconds)),
      timeZone: createIanaTimeZone(String(value.timeZone)),
      distanceMeters: createDistanceMeters(Number(value.distanceMeters)),
      reportedOrigin: value.reportedOrigin as ReportedActivityOrigin,
    },
  };
}

export function createProviderActivityIdentityKey(
  event: Pick<
    CompletedActivityImportEventV1,
    "ownerId" | "provider" | "providerActivityId"
  >,
): ProviderActivityIdentityKey {
  return [
    encodeURIComponent(event.ownerId),
    event.provider,
    encodeURIComponent(event.providerActivityId),
  ].join("|") as ProviderActivityIdentityKey;
}

function eventsAreEquivalent(
  left: CompletedActivityImportEventV1,
  right: CompletedActivityImportEventV1,
): boolean {
  if (
    left.schemaVersion !== right.schemaVersion ||
    left.operation !== right.operation ||
    left.ownerId !== right.ownerId ||
    left.provider !== right.provider ||
    left.providerActivityId !== right.providerActivityId
  ) {
    return false;
  }

  if (left.operation === "delete" || right.operation === "delete") {
    return left.operation === right.operation;
  }

  return (
    left.activityType === right.activityType &&
    left.startedAt === right.startedAt &&
    left.endedAt === right.endedAt &&
    left.durationSeconds === right.durationSeconds &&
    left.timeZone === right.timeZone &&
    left.distanceMeters === right.distanceMeters &&
    left.reportedOrigin === right.reportedOrigin
  );
}

/**
 * Resolves only one provider-owned identity. Cross-provider comparisons use
 * assessCrossProviderDuplicate instead and never silently merge records.
 */
export function resolveProviderActivityEvent(
  existing: CompletedActivityImportEventV1 | null,
  incoming: CompletedActivityImportEventV1,
): ProviderEventResolution {
  if (existing === null) {
    return {
      kind: incoming.operation === "delete" ? "deleted" : "accepted",
      reviewRequired: false,
    };
  }

  if (
    createProviderActivityIdentityKey(existing) !==
    createProviderActivityIdentityKey(incoming)
  ) {
    return { kind: "unrelated", reviewRequired: false };
  }

  if (eventsAreEquivalent(existing, incoming)) {
    return { kind: "duplicate", reviewRequired: false };
  }

  let existingOrderTime = existing.observedAt;
  let incomingOrderTime = incoming.observedAt;
  if (
    existing.providerUpdatedAt !== null &&
    incoming.providerUpdatedAt !== null
  ) {
    existingOrderTime = existing.providerUpdatedAt;
    incomingOrderTime = incoming.providerUpdatedAt;
  }
  const timestampComparison =
    Date.parse(incomingOrderTime) - Date.parse(existingOrderTime);
  if (timestampComparison < 0) {
    return { kind: "stale", reviewRequired: false };
  }

  if (timestampComparison === 0) {
    return { kind: "ambiguous", reviewRequired: true };
  }

  return incoming.operation === "delete"
    ? { kind: "deleted", reviewRequired: false }
    : { kind: "updated", reviewRequired: false };
}

export function resolveActivityDurationSeconds(
  activity: CompletedActivityUpsertV1,
): number {
  if (activity.durationSeconds !== null) {
    return activity.durationSeconds;
  }

  if (activity.endedAt === null) {
    throw new Error("Validated activities always include an end time or duration.");
  }

  return Math.round(
    (Date.parse(activity.endedAt) - Date.parse(activity.startedAt)) / 1000,
  );
}

export function createCrossProviderDuplicateFingerprint(
  activity: CompletedActivityUpsertV1,
): CrossProviderDuplicateFingerprint {
  return [
    CROSS_PROVIDER_DUPLICATE_FINGERPRINT_SCHEMA_VERSION,
    encodeURIComponent(activity.ownerId),
    activity.activityType,
    activity.startedAt,
    resolveActivityDurationSeconds(activity),
    activity.distanceMeters,
    encodeURIComponent(activity.timeZone),
  ].join("|") as CrossProviderDuplicateFingerprint;
}

function createCrossProviderCandidateKey(
  left: CompletedActivityUpsertV1,
  right: CompletedActivityUpsertV1,
): CrossProviderCandidateKey {
  return [
    createProviderActivityIdentityKey(left),
    createProviderActivityIdentityKey(right),
  ]
    .sort()
    .join("<>") as CrossProviderCandidateKey;
}

/**
 * Cross-provider matches are deliberately candidates, not merge commands.
 * Exact normalized facts create a duplicate candidate. Small provider-summary
 * differences create an ambiguous candidate that requires human review.
 */
export function assessCrossProviderDuplicate(
  left: CompletedActivityUpsertV1,
  right: CompletedActivityUpsertV1,
): CrossProviderDuplicateAssessment {
  if (left.ownerId !== right.ownerId || left.provider === right.provider) {
    return { kind: "not_candidate", automaticMergeAllowed: false };
  }

  const knownOriginsConflict =
    left.reportedOrigin !== "unknown" &&
    right.reportedOrigin !== "unknown" &&
    left.reportedOrigin !== right.reportedOrigin;
  if (knownOriginsConflict) {
    return { kind: "not_candidate", automaticMergeAllowed: false };
  }

  const leftFingerprint = createCrossProviderDuplicateFingerprint(left);
  const rightFingerprint = createCrossProviderDuplicateFingerprint(right);
  const candidateKey = createCrossProviderCandidateKey(left, right);
  if (leftFingerprint === rightFingerprint) {
    return {
      kind: "duplicate_candidate",
      automaticMergeAllowed: false,
      reviewRequired: true,
      candidateKey,
      fingerprint: leftFingerprint,
    };
  }

  const startDifference = Math.abs(
    Date.parse(left.startedAt) - Date.parse(right.startedAt),
  );
  const durationDifference = Math.abs(
    resolveActivityDurationSeconds(left) -
      resolveActivityDurationSeconds(right),
  );
  const distanceDifference = Math.abs(
    left.distanceMeters - right.distanceMeters,
  );
  const distanceTolerance = Math.max(
    MINIMUM_DISTANCE_TOLERANCE_METERS,
    Math.round(
      Math.max(left.distanceMeters, right.distanceMeters) *
        DISTANCE_TOLERANCE_RATIO,
    ),
  );

  if (
    left.timeZone !== right.timeZone ||
    startDifference > START_TIME_TOLERANCE_MILLISECONDS ||
    durationDifference > DURATION_TOLERANCE_SECONDS ||
    distanceDifference > distanceTolerance
  ) {
    return { kind: "not_candidate", automaticMergeAllowed: false };
  }

  const differences: (
    | "start_time"
    | "duration"
    | "distance"
    | "reported_origin"
  )[] = [];
  if (left.startedAt !== right.startedAt) differences.push("start_time");
  if (
    resolveActivityDurationSeconds(left) !==
    resolveActivityDurationSeconds(right)
  ) {
    differences.push("duration");
  }
  if (left.distanceMeters !== right.distanceMeters) differences.push("distance");
  if (left.reportedOrigin !== right.reportedOrigin) {
    differences.push("reported_origin");
  }

  return {
    kind: "ambiguous_candidate",
    automaticMergeAllowed: false,
    reviewRequired: true,
    candidateKey,
    differences,
  };
}
