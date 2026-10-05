import { describe, expect, it } from "vitest";
import {
  createCompletedRunId,
  createDistanceMeters,
  metersToMiles,
  milesToMeters,
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
});
