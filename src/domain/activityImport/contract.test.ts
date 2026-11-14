import { describe, expect, it } from "vitest";

import { createUtcDateTime } from "../training/dates";
import { createUserId } from "../training/identifiers";
import {
  acceptedAppleHealthActivityFixture,
  ambiguousGarminActivityFixture,
  completedActivityImportCanonicalFixtures,
  deletedAppleHealthActivityFixture,
  duplicateAppleHealthActivityFixture,
  exactGarminDuplicateFixture,
  updatedAppleHealthActivityFixture,
} from "./canonicalFixtures";
import {
  COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION,
  assessCrossProviderDuplicate,
  createCrossProviderDuplicateFingerprint,
  createProviderActivityId,
  createProviderActivityIdentityKey,
  parseCompletedActivityImportEvent,
  resolveActivityDurationSeconds,
  resolveProviderActivityEvent,
  validateCompletedActivityImportEvent,
  type CompletedActivityUpsertV1,
} from "./contract";

function plainAppleHealthActivity(): Record<string, unknown> {
  return {
    schemaVersion: COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION,
    operation: "upsert",
    ownerId: "runner-001",
    provider: "apple_health",
    providerActivityId: "opaque/healthkit:workout:001",
    observedAt: "2026-11-01T16:10:00.000Z",
    providerUpdatedAt: null,
    activityType: "running",
    startedAt: "2026-11-01T15:00:00.000Z",
    endedAt: "2026-11-01T16:00:00.000Z",
    durationSeconds: null,
    timeZone: "America/Los_Angeles",
    distanceMeters: 10_000,
    reportedOrigin: "garmin",
  };
}

describe("completed activity import contract", () => {
  it("accepts the minimum normalized Apple Health and Garmin summaries", () => {
    const appleResult = parseCompletedActivityImportEvent(
      plainAppleHealthActivity(),
    );
    const garminResult = parseCompletedActivityImportEvent({
      ...plainAppleHealthActivity(),
      provider: "garmin_connect",
      providerActivityId: "garmin-activity-001",
      providerUpdatedAt: "2026-11-01T16:05:00.000Z",
      endedAt: null,
      durationSeconds: 3_600,
      reportedOrigin: "garmin",
    });

    expect(appleResult).toMatchObject({
      ok: true,
      value: {
        ownerId: "runner-001",
        provider: "apple_health",
        providerActivityId: "opaque/healthkit:workout:001",
        operation: "upsert",
        distanceMeters: 10_000,
        endedAt: "2026-11-01T16:00:00.000Z",
        durationSeconds: null,
      },
    });
    expect(garminResult.ok).toBe(true);
    if (garminResult.ok) {
      expect(garminResult.value).toMatchObject({
        provider: "garmin_connect",
        operation: "upsert",
        distanceMeters: 10_000,
        durationSeconds: 3_600,
      });
    }
  });

  it("accepts bounded workout heart-rate summaries and rejects malformed values", () => {
    const result = parseCompletedActivityImportEvent({
      ...plainAppleHealthActivity(),
      averageHeartRateBpm: 151,
      maximumHeartRateBpm: 176,
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        averageHeartRateBpm: 151,
        maximumHeartRateBpm: 176,
      },
    });
    expect(
      validateCompletedActivityImportEvent({
        ...plainAppleHealthActivity(),
        averageHeartRateBpm: 301,
        maximumHeartRateBpm: 140,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_value",
          field: "averageHeartRateBpm",
        }),
      ]),
    );
    expect(
      validateCompletedActivityImportEvent({
        ...plainAppleHealthActivity(),
        averageHeartRateBpm: 170,
        maximumHeartRateBpm: 160,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "inconsistent",
          field: "maximumHeartRateBpm",
        }),
      ]),
    );
  });

  it("keeps provider IDs opaque and scopes their identity to the owner", () => {
    const providerActivityId = createProviderActivityId(
      "opaque/value:with/provider-specific-format",
    );
    const firstIdentity = createProviderActivityIdentityKey({
      ownerId: createUserId("runner-a"),
      provider: "apple_health",
      providerActivityId,
    });
    const secondIdentity = createProviderActivityIdentityKey({
      ownerId: createUserId("runner-b"),
      provider: "apple_health",
      providerActivityId,
    });

    expect(firstIdentity).not.toBe(secondIdentity);
    expect(firstIdentity).toContain("opaque%2Fvalue%3Awith");
  });

  it("rejects provider SDK payloads and Marathoner-owned enrichment fields", () => {
    const value = {
      ...plainAppleHealthActivity(),
      perceivedEffort: "about_right",
      notes: "Provider payload should not own this.",
      shoeId: "shoe-001",
      gpsRoute: [{ latitude: 1, longitude: 2 }],
      fitPayload: "raw-provider-data",
      oauthToken: "secret",
      sourceSdkObject: { constructor: "HKWorkout" },
    };

    expect(validateCompletedActivityImportEvent(value)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unexpected_field",
          field: "perceivedEffort",
        }),
        expect.objectContaining({ code: "unexpected_field", field: "notes" }),
        expect.objectContaining({ code: "unexpected_field", field: "shoeId" }),
        expect.objectContaining({ code: "unexpected_field", field: "gpsRoute" }),
        expect.objectContaining({ code: "unexpected_field", field: "fitPayload" }),
        expect.objectContaining({ code: "unexpected_field", field: "oauthToken" }),
        expect.objectContaining({
          code: "unexpected_field",
          field: "sourceSdkObject",
        }),
      ]),
    );
  });

  it("requires a positive distance and an end time or duration", () => {
    const value = {
      ...plainAppleHealthActivity(),
      endedAt: null,
      durationSeconds: null,
      distanceMeters: 0,
    };

    expect(validateCompletedActivityImportEvent(value)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "required", field: "durationSeconds" }),
        expect.objectContaining({
          code: "invalid_value",
          field: "distanceMeters",
        }),
      ]),
    );
  });

  it("rejects an end time or duration that contradicts the summary", () => {
    const value = {
      ...plainAppleHealthActivity(),
      endedAt: "2026-11-01T14:59:00.000Z",
      durationSeconds: 50,
    };

    expect(validateCompletedActivityImportEvent(value)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "inconsistent", field: "endedAt" }),
      ]),
    );

    expect(
      validateCompletedActivityImportEvent({
        ...plainAppleHealthActivity(),
        durationSeconds: 3_500,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "inconsistent",
          field: "durationSeconds",
        }),
      ]),
    );
  });

  it("accepts a deletion tombstone without storing the provider payload", () => {
    expect(
      parseCompletedActivityImportEvent({
        schemaVersion: COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION,
        operation: "delete",
        ownerId: "fixture-runner",
        provider: "apple_health",
        providerActivityId: "HKWorkout/opaque:activity/2026-11-01",
        observedAt: "2026-11-01T16:20:00.000Z",
        providerUpdatedAt: null,
      }),
    ).toEqual({ ok: true, value: deletedAppleHealthActivityFixture });
  });

  it("rejects unsupported versions, providers, and activity types", () => {
    const issues = validateCompletedActivityImportEvent({
      ...plainAppleHealthActivity(),
      schemaVersion: "completed-activity-import@2",
      provider: "healthkit-sdk-object",
      activityType: "cycling",
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_schema_version",
          field: "schemaVersion",
        }),
        expect.objectContaining({ code: "invalid_value", field: "provider" }),
        expect.objectContaining({
          code: "invalid_value",
          field: "activityType",
        }),
      ]),
    );
  });
});

describe("provider activity lifecycle", () => {
  it("accepts a new normalized activity", () => {
    expect(
      resolveProviderActivityEvent(null, acceptedAppleHealthActivityFixture),
    ).toEqual({ kind: "accepted", reviewRequired: false });
  });

  it("makes a later observation of unchanged provider facts idempotent", () => {
    expect(
      resolveProviderActivityEvent(
        acceptedAppleHealthActivityFixture,
        duplicateAppleHealthActivityFixture,
      ),
    ).toEqual({ kind: "duplicate", reviewRequired: false });
  });

  it("distinguishes newer updates and deletion tombstones", () => {
    expect(
      resolveProviderActivityEvent(
        acceptedAppleHealthActivityFixture,
        updatedAppleHealthActivityFixture,
      ),
    ).toEqual({ kind: "updated", reviewRequired: false });
    expect(
      resolveProviderActivityEvent(
        updatedAppleHealthActivityFixture,
        deletedAppleHealthActivityFixture,
      ),
    ).toEqual({ kind: "deleted", reviewRequired: false });
  });

  it("requires review when one provider revision contains conflicting facts", () => {
    expect(
      resolveProviderActivityEvent(acceptedAppleHealthActivityFixture, {
        ...acceptedAppleHealthActivityFixture,
        distanceMeters: updatedAppleHealthActivityFixture.distanceMeters,
      }),
    ).toEqual({ kind: "ambiguous", reviewRequired: true });
  });

  it("does not let stale or unrelated events replace the current activity", () => {
    expect(
      resolveProviderActivityEvent(updatedAppleHealthActivityFixture, {
        ...acceptedAppleHealthActivityFixture,
      }),
    ).toEqual({ kind: "stale", reviewRequired: false });
    expect(
      resolveProviderActivityEvent(
        acceptedAppleHealthActivityFixture,
        exactGarminDuplicateFixture,
      ),
    ).toEqual({ kind: "unrelated", reviewRequired: false });
  });

  it("uses provider update time when both revisions expose one", () => {
    expect(
      resolveProviderActivityEvent(exactGarminDuplicateFixture, {
        ...exactGarminDuplicateFixture,
        observedAt: createUtcDateTime("2026-11-01T17:00:00.000Z"),
        providerUpdatedAt: createUtcDateTime("2026-11-01T16:04:00.000Z"),
        distanceMeters: updatedAppleHealthActivityFixture.distanceMeters,
      }),
    ).toEqual({ kind: "stale", reviewRequired: false });
  });
});

describe("cross-provider duplicate assessment", () => {
  it("creates one deterministic conservative fingerprint for exact facts", () => {
    expect(
      createCrossProviderDuplicateFingerprint(
        acceptedAppleHealthActivityFixture,
      ),
    ).toBe(
      createCrossProviderDuplicateFingerprint(exactGarminDuplicateFixture),
    );
    expect(
      assessCrossProviderDuplicate(
        acceptedAppleHealthActivityFixture,
        exactGarminDuplicateFixture,
      ),
    ).toMatchObject({
      kind: "duplicate_candidate",
      automaticMergeAllowed: false,
      reviewRequired: true,
    });
  });

  it("marks small provider-summary differences as ambiguous for review", () => {
    expect(
      assessCrossProviderDuplicate(
        acceptedAppleHealthActivityFixture,
        ambiguousGarminActivityFixture,
      ),
    ).toMatchObject({
      kind: "ambiguous_candidate",
      automaticMergeAllowed: false,
      reviewRequired: true,
      differences: [
        "start_time",
        "duration",
        "distance",
        "reported_origin",
      ],
    });
  });

  it("does not compare across owners, one provider, or conflicting origins", () => {
    const otherOwner = {
      ...exactGarminDuplicateFixture,
      ownerId: createUserId("another-runner"),
    };
    const sameProvider = {
      ...exactGarminDuplicateFixture,
      provider: "apple_health" as const,
    };
    const conflictingOrigin = {
      ...exactGarminDuplicateFixture,
      reportedOrigin: "apple" as const,
    };

    for (const candidate of [otherOwner, sameProvider, conflictingOrigin]) {
      expect(
        assessCrossProviderDuplicate(
          acceptedAppleHealthActivityFixture,
          candidate,
        ),
      ).toEqual({ kind: "not_candidate", automaticMergeAllowed: false });
    }
  });

  it("does not flag activities outside conservative tolerances", () => {
    const distantActivity: CompletedActivityUpsertV1 = {
      ...ambiguousGarminActivityFixture,
      startedAt: createUtcDateTime("2026-11-01T15:05:00.000Z"),
    };

    expect(
      assessCrossProviderDuplicate(
        acceptedAppleHealthActivityFixture,
        distantActivity,
      ),
    ).toEqual({ kind: "not_candidate", automaticMergeAllowed: false });
  });

  it("derives duration from an end time when a provider omits duration", () => {
    expect(
      resolveActivityDurationSeconds(acceptedAppleHealthActivityFixture),
    ).toBe(3_600);
    expect(resolveActivityDurationSeconds(ambiguousGarminActivityFixture)).toBe(
      3_590,
    );
  });
});

describe("canonical import fixtures", () => {
  it("keeps accepted, duplicate, ambiguous, updated, and deleted cases valid", () => {
    for (const fixture of Object.values(completedActivityImportCanonicalFixtures)) {
      expect(validateCompletedActivityImportEvent(fixture)).toEqual([]);
    }

    expect(
      resolveProviderActivityEvent(
        completedActivityImportCanonicalFixtures.accepted,
        completedActivityImportCanonicalFixtures.duplicate,
      ).kind,
    ).toBe("duplicate");
    expect(
      assessCrossProviderDuplicate(
        completedActivityImportCanonicalFixtures.accepted,
        completedActivityImportCanonicalFixtures.ambiguous,
      ).kind,
    ).toBe("ambiguous_candidate");
    expect(
      resolveProviderActivityEvent(
        completedActivityImportCanonicalFixtures.accepted,
        completedActivityImportCanonicalFixtures.updated,
      ).kind,
    ).toBe("updated");
    expect(
      resolveProviderActivityEvent(
        completedActivityImportCanonicalFixtures.updated,
        completedActivityImportCanonicalFixtures.deleted,
      ).kind,
    ).toBe("deleted");
  });
});
