import draftRulesText from "../docs/methodology/artifacts/beta-rules/0.2.0-draft/beta-rules.json?raw";
import { describe, expect, it } from "vitest";
import { createInternalPlanProposalRehearsalRuleSet } from "../src/components/internalPlanProposalRehearsalRules";

describe("internal plan proposal rehearsal rules", () => {
  it("maps the exact pinned packet into the deterministic generator contract", () => {
    const ruleSet =
      createInternalPlanProposalRehearsalRuleSet(draftRulesText);

    expect(ruleSet).toMatchObject({
      artifactStatus: "draft_not_approved",
      generatorVersion: "deterministic-plan-generator@1.0.0",
      rules: {
        rulesetVersion: "beta-rules@0.2.0-draft",
        planName: "Founding beta completion plan",
        requiredSafetySignal: "none_reported",
      },
    });
    expect(ruleSet.rules.coreWeeks).toHaveLength(18);
  });

  it("rejects packets that claim runtime approval", () => {
    const packet = JSON.parse(draftRulesText) as Record<string, unknown>;
    packet.runtimeUseAllowed = true;

    expect(() =>
      createInternalPlanProposalRehearsalRuleSet(JSON.stringify(packet)),
    ).toThrow(/accepts only the pinned, unapproved draft packet/u);
  });
});
