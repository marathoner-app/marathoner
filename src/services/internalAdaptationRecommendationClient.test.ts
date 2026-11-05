import { describe, expect, it, vi } from "vitest";

import {
  INTERNAL_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
  type InternalAdaptationRecommendationCommand,
} from "../domain/recommendations/internalAdaptationRecommendation";
import { createDateOnly } from "../domain/training/dates";
import { createPlannedWorkoutId } from "../domain/training/identifiers";
import { createInternalAdaptationRecommendationClient } from "./internalAdaptationRecommendationClient";

const command: InternalAdaptationRecommendationCommand = {
  schemaVersion: INTERNAL_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
  commandId: "internal-adaptation-client-0001",
  triggerWorkoutId: createPlannedWorkoutId("workout-1"),
  evaluationDate: createDateOnly("2026-11-02"),
  confirmedRescheduleTargetDate: null,
};

describe("internal adaptation recommendation client", () => {
  it("returns an exact typed command result", async () => {
    const generate = vi.fn(async () => ({
      status: "no_change",
      commandId: command.commandId,
      reasonCode: "ADAPT-NO-CHANGE",
      explanationKey: "adaptation.no_change",
    }));
    const client = createInternalAdaptationRecommendationClient({ generate });

    await expect(client.generate(command)).resolves.toMatchObject({
      status: "no_change",
      commandId: command.commandId,
    });
    expect(generate).toHaveBeenCalledWith(command);
  });

  it("fails closed for a malformed callable response", async () => {
    const client = createInternalAdaptationRecommendationClient({
      generate: vi.fn(async () => ({ status: "made_up" })),
    });

    await expect(client.generate(command)).rejects.toThrow(
      "response is invalid",
    );
  });

  it("rejects unexpected fields on an otherwise valid result", async () => {
    const client = createInternalAdaptationRecommendationClient({
      generate: vi.fn(async () => ({
        status: "no_change",
        commandId: command.commandId,
        reasonCode: "ADAPT-NO-CHANGE",
        explanationKey: "adaptation.no_change",
        ownerId: "caller-must-not-receive-owner-data",
      })),
    });

    await expect(client.generate(command)).rejects.toThrow(
      "response is invalid",
    );
  });
});
