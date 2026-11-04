import { createIanaTimeZone, createUtcDateTime } from "../training/dates.js";
import { createUserId } from "../training/identifiers.js";
import {
  createDistanceMeters,
  createDurationSeconds,
} from "../training/units.js";
import {
  COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION,
  createProviderActivityId,
  type CompletedActivityDeletionV1,
  type CompletedActivityUpsertV1,
} from "./contract.js";

const ownerId = createUserId("fixture-runner");

export const acceptedAppleHealthActivityFixture: CompletedActivityUpsertV1 = {
  schemaVersion: COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION,
  operation: "upsert",
  ownerId,
  provider: "apple_health",
  providerActivityId: createProviderActivityId(
    "HKWorkout/opaque:activity/2026-11-01",
  ),
  observedAt: createUtcDateTime("2026-11-01T16:10:00.000Z"),
  providerUpdatedAt: null,
  activityType: "running",
  startedAt: createUtcDateTime("2026-11-01T15:00:00.000Z"),
  endedAt: createUtcDateTime("2026-11-01T16:00:00.000Z"),
  durationSeconds: null,
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  distanceMeters: createDistanceMeters(10_000),
  reportedOrigin: "garmin",
};

export const duplicateAppleHealthActivityFixture: CompletedActivityUpsertV1 = {
  ...acceptedAppleHealthActivityFixture,
  observedAt: createUtcDateTime("2026-11-01T16:11:00.000Z"),
};

export const ambiguousGarminActivityFixture: CompletedActivityUpsertV1 = {
  ...acceptedAppleHealthActivityFixture,
  provider: "garmin_connect",
  providerActivityId: createProviderActivityId("garmin-opaque-activity-1001"),
  observedAt: createUtcDateTime("2026-11-01T16:12:00.000Z"),
  providerUpdatedAt: createUtcDateTime("2026-11-01T16:05:00.000Z"),
  startedAt: createUtcDateTime("2026-11-01T15:00:20.000Z"),
  endedAt: null,
  durationSeconds: createDurationSeconds(3_590),
  distanceMeters: createDistanceMeters(10_025),
  reportedOrigin: "unknown",
};

export const exactGarminDuplicateFixture: CompletedActivityUpsertV1 = {
  ...acceptedAppleHealthActivityFixture,
  provider: "garmin_connect",
  providerActivityId: createProviderActivityId("garmin-opaque-activity-1001"),
  observedAt: createUtcDateTime("2026-11-01T16:12:00.000Z"),
  providerUpdatedAt: createUtcDateTime("2026-11-01T16:05:00.000Z"),
  endedAt: null,
  durationSeconds: createDurationSeconds(3_600),
  reportedOrigin: "garmin",
};

export const updatedAppleHealthActivityFixture: CompletedActivityUpsertV1 = {
  ...acceptedAppleHealthActivityFixture,
  observedAt: createUtcDateTime("2026-11-01T16:15:00.000Z"),
  distanceMeters: createDistanceMeters(10_010),
};

export const deletedAppleHealthActivityFixture: CompletedActivityDeletionV1 = {
  schemaVersion: COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION,
  operation: "delete",
  ownerId,
  provider: "apple_health",
  providerActivityId: acceptedAppleHealthActivityFixture.providerActivityId,
  observedAt: createUtcDateTime("2026-11-01T16:20:00.000Z"),
  providerUpdatedAt: null,
};

export const completedActivityImportCanonicalFixtures = {
  accepted: acceptedAppleHealthActivityFixture,
  duplicate: duplicateAppleHealthActivityFixture,
  ambiguous: ambiguousGarminActivityFixture,
  crossProviderDuplicate: exactGarminDuplicateFixture,
  updated: updatedAppleHealthActivityFixture,
  deleted: deletedAppleHealthActivityFixture,
} as const;
