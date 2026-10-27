import draftFixturesText from "../docs/methodology/artifacts/beta-adaptation/0.1.0-draft/fixtures.json?raw";
import draftRulesText from "../docs/methodology/artifacts/beta-adaptation/0.1.0-draft/beta-adaptation.json?raw";
import { describe, expect, it } from "vitest";
import {
  createInternalAdaptationScenarioPacket,
  inputForInternalAdaptationScenario,
  valuesForInternalAdaptationScenario,
} from "../src/components/internalAdaptationScenarioPacket";

describe("createInternalAdaptationScenarioPacket", () => {
  it("adapts the exact pinned draft and its frozen scenarios", () => {
    const packet = createInternalAdaptationScenarioPacket(
      draftRulesText,
      draftFixturesText,
    );

    expect(packet).toMatchObject({
      artifactStatus: "draft_not_approved",
      artifactVersion: "beta-adaptation@0.1.0-draft",
      evaluatorVersion: "deterministic-adaptation-evaluator@1.0.0",
    });
    expect(packet.cases).toHaveLength(19);
    expect(packet.rules.outcomes).toHaveLength(17);
    expect(packet.outcomeDetails).toHaveLength(17);
    expect(
      packet.outcomeDetails.find(
        (outcome) =>
          outcome.reasonCode === "ADAPT-HOLD-REPEATED-HARD-EFFORT",
      ),
    ).toMatchObject({
      runnerApprovalRequired: true,
      when: expect.stringContaining("four recent associated runs"),
      planMutation: expect.stringContaining("Keep the next week's dates"),
    });

    const holdFixture = packet.cases.find(
      (fixture) => fixture.id === "hold-at-two-hard-effort-boundary",
    );
    expect(holdFixture).toBeDefined();
    if (holdFixture === undefined) return;

    expect(
      inputForInternalAdaptationScenario(
        valuesForInternalAdaptationScenario(packet, holdFixture),
      ),
    ).toMatchObject({
      schemaVersion: "adaptation-evaluation-input@1",
      recentEfforts: [
        "harder_than_expected",
        "about_right",
        "much_harder_than_expected",
        "about_right",
      ],
    });
  });

  it("rejects a packet that is not runtime-ineligible and draft", () => {
    const rules = JSON.parse(draftRulesText) as Record<string, unknown>;
    rules.runtimeUseAllowed = true;

    expect(() =>
      createInternalAdaptationScenarioPacket(
        JSON.stringify(rules),
        draftFixturesText,
      ),
    ).toThrow(/runtime-ineligible draft packet/iu);
  });

  it("rejects rules and fixtures with different artifact versions", () => {
    const fixtures = JSON.parse(draftFixturesText) as Record<string, unknown>;
    fixtures.artifactVersion = "beta-adaptation@0.2.0-draft";

    expect(() =>
      createInternalAdaptationScenarioPacket(
        draftRulesText,
        JSON.stringify(fixtures),
      ),
    ).toThrow(/same artifact version/iu);
  });
});
