import { describe, expect, it } from "vitest";
import {
  createCompletedRunId,
  createDistanceMeters,
  createSharedRecordProof,
  metersToMiles,
  milesToMeters,
  parseSharedRecordProof,
  sharedRecordProofDocumentPath,
} from "@marathoner/training-contract";

describe("portable training contract", () => {
  it("validates completed-run identity at the shared boundary", () => {
    expect(createCompletedRunId("run-shared-1")).toBe("run-shared-1");
    expect(() => createCompletedRunId("runs/run-shared-1")).toThrow(
      /cannot contain slashes/,
    );
  });

  it("retains whole-meter storage and mile conversion", () => {
    const fiveMiles = milesToMeters(5);

    expect(fiveMiles).toBe(8047);
    expect(metersToMiles(fiveMiles)).toBeCloseTo(5, 3);
    expect(() => createDistanceMeters(1.5)).toThrow(/whole number/);
  });

  it("creates and validates the isolated cross-client record", () => {
    const record = createSharedRecordProof("runner-1", "capacitor");

    expect(record).toEqual({
      schemaVersion: 1,
      recordType: "shared_training_record_proof",
      userId: "runner-1",
      sampleRunId: "issue-87-sample-run",
      distanceMeters: 5000,
      sourceClient: "capacitor",
    });
    expect(parseSharedRecordProof(record)).toEqual(record);
    expect(sharedRecordProofDocumentPath("runner-1")).toBe(
      "users/runner-1/mobileSpikeProofs/issue-87-shared-record",
    );
  });

  it("rejects malformed, cross-shape, and unsupported proof records", () => {
    expect(() =>
      parseSharedRecordProof({
        ...createSharedRecordProof("runner-1", "web"),
        distanceMeters: -1,
      }),
    ).toThrow(/unsupported values/);
    expect(() =>
      parseSharedRecordProof({
        ...createSharedRecordProof("runner-1", "web"),
        unexpected: true,
      }),
    ).toThrow(/invalid shape/);
    expect(() =>
      createSharedRecordProof(
        "runner-1",
        "android" as never,
      ),
    ).toThrow(/unsupported/);
    expect(() => sharedRecordProofDocumentPath("users/runner-1")).toThrow(
      /cannot contain slashes/,
    );
  });
});
