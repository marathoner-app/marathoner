import { INTERNAL_ELIGIBLE_PLAN_REHEARSAL_PROFILE_VERSION } from "./internalEligiblePlanRehearsalProfile";

export const INTERNAL_PLAN_REHEARSAL_SESSION_STORAGE_KEY =
  "marathoner:internal-plan-rehearsal:frozen-activation:v1";

const storageVersion = 1;

type RehearsalSessionStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

export interface InternalPlanRehearsalSessionIntent {
  readonly version: typeof storageVersion;
  readonly profileSource: "frozen_eligible_profile";
  readonly fixtureVersion: string;
  readonly rulesetVersion: string;
  readonly generatorVersion: string;
  readonly planStartDate: string;
  readonly cohortConfirmed: true;
  readonly noSymptomsReported: true;
  readonly active: true;
}

interface ExpectedArtifactVersions {
  readonly rulesetVersion: string;
  readonly generatorVersion: string;
}

function browserSessionStorage(): RehearsalSessionStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isSessionIntent(
  value: unknown,
): value is InternalPlanRehearsalSessionIntent {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === storageVersion &&
    candidate.profileSource === "frozen_eligible_profile" &&
    typeof candidate.fixtureVersion === "string" &&
    typeof candidate.rulesetVersion === "string" &&
    typeof candidate.generatorVersion === "string" &&
    typeof candidate.planStartDate === "string" &&
    candidate.cohortConfirmed === true &&
    candidate.noSymptomsReported === true &&
    candidate.active === true
  );
}

export function clearInternalPlanRehearsalSession(
  storage: RehearsalSessionStorage | null = browserSessionStorage(),
): void {
  try {
    storage?.removeItem(INTERNAL_PLAN_REHEARSAL_SESSION_STORAGE_KEY);
  } catch {
    // Internal rehearsal storage must never affect the signed-in product path.
  }
}

export function readInternalPlanRehearsalSession(
  expected: ExpectedArtifactVersions,
  storage: RehearsalSessionStorage | null = browserSessionStorage(),
): InternalPlanRehearsalSessionIntent | null {
  let serialized: string | null = null;
  try {
    serialized =
      storage?.getItem(INTERNAL_PLAN_REHEARSAL_SESSION_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }

  if (serialized === null) return null;

  try {
    const value: unknown = JSON.parse(serialized);
    if (
      !isSessionIntent(value) ||
      value.fixtureVersion !==
        INTERNAL_ELIGIBLE_PLAN_REHEARSAL_PROFILE_VERSION ||
      value.rulesetVersion !== expected.rulesetVersion ||
      value.generatorVersion !== expected.generatorVersion
    ) {
      clearInternalPlanRehearsalSession(storage);
      return null;
    }
    return value;
  } catch {
    clearInternalPlanRehearsalSession(storage);
    return null;
  }
}

export function writeInternalPlanRehearsalSession(
  intent: Omit<
    InternalPlanRehearsalSessionIntent,
    "active" | "cohortConfirmed" | "fixtureVersion" | "noSymptomsReported" | "profileSource" | "version"
  >,
  storage: RehearsalSessionStorage | null = browserSessionStorage(),
): void {
  const value: InternalPlanRehearsalSessionIntent = {
    version: storageVersion,
    profileSource: "frozen_eligible_profile",
    fixtureVersion: INTERNAL_ELIGIBLE_PLAN_REHEARSAL_PROFILE_VERSION,
    rulesetVersion: intent.rulesetVersion,
    generatorVersion: intent.generatorVersion,
    planStartDate: intent.planStartDate,
    cohortConfirmed: true,
    noSymptomsReported: true,
    active: true,
  };

  try {
    storage?.setItem(
      INTERNAL_PLAN_REHEARSAL_SESSION_STORAGE_KEY,
      JSON.stringify(value),
    );
  } catch {
    // The rehearsal remains usable even when browser storage is unavailable.
  }
}
