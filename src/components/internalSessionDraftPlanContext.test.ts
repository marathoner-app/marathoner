import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import {
  createDateOnly,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type TrainingPlan,
} from "../domain/training";
import { createInternalAdaptationScenarioPacket } from "./internalAdaptationScenarioPacket";
import { createInternalPlanProposalRehearsalRuleSet } from "./internalPlanProposalRehearsalRules";
import { deriveInternalSessionDraftPlanContext } from "./internalSessionDraftPlanContext";

const timestamp = createUtcDateTime("2030-01-01T00:00:00.000Z");
const planArtifactDirectory = path.join(
  process.cwd(),
  "docs/methodology/artifacts/beta-rules/0.1.0-draft",
);
const adaptationArtifactDirectory = path.join(
  process.cwd(),
  "docs/methodology/artifacts/beta-adaptation/0.1.0-draft",
);
const basePlanRules = createInternalPlanProposalRehearsalRuleSet(
  readFileSync(`${planArtifactDirectory}/beta-rules.json`, "utf8"),
);
const adaptationPacket = createInternalAdaptationScenarioPacket(
  readFileSync(
    `${adaptationArtifactDirectory}/beta-adaptation.json`,
    "utf8",
  ),
  readFileSync(`${adaptationArtifactDirectory}/fixtures.json`, "utf8"),
);

function createPlan(targetRaceDate = "2030-05-12"): TrainingPlan {
  return {
    id: createTrainingPlanId("session-plan"),
    userId: createUserId("owner-1"),
    name: "Session plan",
    startDate: createDateOnly("2030-01-07"),
    targetRaceDate: createDateOnly(targetRaceDate),
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function derive(evaluationDate: string, targetRaceDate?: string) {
  return deriveInternalSessionDraftPlanContext({
    plan: createPlan(targetRaceDate),
    evaluationDate: createDateOnly(evaluationDate),
    basePlanRules,
    adaptationRules: adaptationPacket.rules,
  });
}

describe("deriveInternalSessionDraftPlanContext", () => {
  it("derives a load week and a new next-week progression", () => {
    expect(derive("2030-02-12")).toEqual({
      kind: "ready",
      context: {
        currentCoreWeek: 6,
        currentWeekKind: "load",
        nextWeekKind: "load",
        nextWeekIntroducesProgression: true,
      },
    });
  });

  it("recognizes cutback protection and a return to an existing high", () => {
    expect(derive("2030-01-22")).toEqual({
      kind: "ready",
      context: {
        currentCoreWeek: 3,
        currentWeekKind: "load",
        nextWeekKind: "cutback",
        nextWeekIntroducesProgression: false,
      },
    });
    expect(derive("2030-01-29")).toEqual({
      kind: "ready",
      context: {
        currentCoreWeek: 4,
        currentWeekKind: "cutback",
        nextWeekKind: "load",
        nextWeekIntroducesProgression: false,
      },
    });
  });

  it("refuses lead-in, race-week, and recovery triggers outside the supported core", () => {
    expect(derive("2030-01-08", "2030-05-26")).toEqual(
      expect.objectContaining({
        kind: "not_ready",
        code: "session_plan_week_unsupported",
      }),
    );
    expect(derive("2030-05-07")).toEqual(
      expect.objectContaining({
        kind: "not_ready",
        code: "session_plan_week_unsupported",
      }),
    );
    expect(derive("2030-05-13")).toEqual(
      expect.objectContaining({
        kind: "not_ready",
        code: "session_plan_week_unsupported",
      }),
    );
  });
});
