import { describe, expect, it, vi } from "vitest";
import {
  clearInternalPlanRehearsalSession,
  INTERNAL_PLAN_REHEARSAL_SESSION_STORAGE_KEY,
  readInternalPlanRehearsalSession,
  writeInternalPlanRehearsalSession,
} from "./internalPlanRehearsalSession";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    values,
  };
}

const artifactVersions = {
  rulesetVersion: "beta-rules@0.1.0-draft",
  generatorVersion: "deterministic-plan-generator@0.1.0-draft",
};

describe("internal plan rehearsal session", () => {
  it("stores only frozen-fixture activation controls", () => {
    const storage = createStorage();

    writeInternalPlanRehearsalSession(
      {
        ...artifactVersions,
        planStartDate: "2030-01-07",
      },
      storage,
    );

    const serialized = storage.values.get(
      INTERNAL_PLAN_REHEARSAL_SESSION_STORAGE_KEY,
    );
    expect(serialized).toBeDefined();
    expect(JSON.parse(serialized ?? "{}")).toEqual({
      version: 1,
      profileSource: "frozen_eligible_profile",
      fixtureVersion: "internal-eligible-profile@1.0.0",
      ...artifactVersions,
      planStartDate: "2030-01-07",
      cohortConfirmed: true,
      noSymptomsReported: true,
      active: true,
    });
    expect(serialized).not.toMatch(
      /owner|userId|planId|workout|run|credential|token/iu,
    );
  });

  it("reads an exact artifact match and clears it explicitly", () => {
    const storage = createStorage();
    writeInternalPlanRehearsalSession(
      { ...artifactVersions, planStartDate: "2030-01-07" },
      storage,
    );

    expect(
      readInternalPlanRehearsalSession(artifactVersions, storage),
    ).toMatchObject({
      profileSource: "frozen_eligible_profile",
      planStartDate: "2030-01-07",
      active: true,
    });

    clearInternalPlanRehearsalSession(storage);
    expect(
      storage.values.has(INTERNAL_PLAN_REHEARSAL_SESSION_STORAGE_KEY),
    ).toBe(false);
  });

  it.each([
    ["invalid JSON", "{"],
    [
      "a fixture-version mismatch",
      JSON.stringify({
        version: 1,
        profileSource: "frozen_eligible_profile",
        fixtureVersion: "internal-eligible-profile@0.9.0",
        ...artifactVersions,
        planStartDate: "2030-01-07",
        cohortConfirmed: true,
        noSymptomsReported: true,
        active: true,
      }),
    ],
    [
      "a saved-profile payload",
      JSON.stringify({
        version: 1,
        profileSource: "saved_profile",
        fixtureVersion: "internal-eligible-profile@1.0.0",
        ...artifactVersions,
        planStartDate: "2030-01-07",
        cohortConfirmed: true,
        noSymptomsReported: true,
        active: true,
      }),
    ],
  ])("rejects and removes %s", (_name, serialized) => {
    const storage = createStorage();
    storage.values.set(INTERNAL_PLAN_REHEARSAL_SESSION_STORAGE_KEY, serialized);

    expect(
      readInternalPlanRehearsalSession(artifactVersions, storage),
    ).toBeNull();
    expect(
      storage.values.has(INTERNAL_PLAN_REHEARSAL_SESSION_STORAGE_KEY),
    ).toBe(false);
  });
});
