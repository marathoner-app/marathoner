import { describe, expect, it } from "vitest";
import {
  INTERNAL_PLAN_PROPOSAL_REHEARSAL_MODE,
  isInternalPlanProposalRehearsalMode,
} from "./internalPlanProposalRehearsalMode";

describe("internal plan proposal rehearsal mode", () => {
  it("allows only the explicit local rehearsal mode", () => {
    expect(
      isInternalPlanProposalRehearsalMode(
        INTERNAL_PLAN_PROPOSAL_REHEARSAL_MODE,
      ),
    ).toBe(true);
    expect(isInternalPlanProposalRehearsalMode("development")).toBe(false);
    expect(isInternalPlanProposalRehearsalMode("production")).toBe(false);
    expect(isInternalPlanProposalRehearsalMode("ios-development")).toBe(false);
    expect(isInternalPlanProposalRehearsalMode("ios-beta")).toBe(false);
    expect(isInternalPlanProposalRehearsalMode("test")).toBe(false);
  });
});
