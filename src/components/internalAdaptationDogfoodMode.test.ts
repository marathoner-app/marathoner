import { describe, expect, it } from "vitest";

import { isInternalAdaptationDogfoodEnabled } from "./internalAdaptationDogfoodMode";

describe("internal adaptation dogfood build gate", () => {
  it("opens only for the explicit development dogfood build", () => {
    expect(
      isInternalAdaptationDogfoodEnabled({
        firebaseEnvironment: "development",
        provisionalPlanDogfood: "true",
      }),
    ).toBe(true);
  });

  it.each([
    ["development", "false"],
    ["development", undefined],
    ["beta", "true"],
    ["production", "true"],
  ])(
    "stays closed for firebase=%s dogfood=%s",
    (firebaseEnvironment, provisionalPlanDogfood) => {
      expect(
        isInternalAdaptationDogfoodEnabled({
          firebaseEnvironment,
          provisionalPlanDogfood,
        }),
      ).toBe(false);
    },
  );
});
