import draftRulesText from "../../docs/methodology/artifacts/beta-rules/0.1.0-draft/beta-rules.json?raw";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import PlanProposalBuilder from "../../src/components/PlanProposalBuilder";
import { createInternalPlanProposalRehearsalRuleSet } from "../../src/components/internalPlanProposalRehearsalRules";
import {
  createDateOnly,
  createDistanceMeters,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
  type UserProfile,
} from "../../src/domain/training";
import type { PlanApprovalClient } from "../../src/services/planApprovalClient";

const timestamp = createUtcDateTime("2029-12-01T12:00:00Z");
const profile: UserProfile = {
  id: createUserId("viewport-dogfood-runner"),
  preferredDistanceUnit: "mile",
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  experienceLevel: "consistent",
  consistentRunningWeeks: 12,
  targetRace: { kind: "date", date: createDateOnly("2030-05-12") },
  currentWeeklyDistance: createDistanceMeters(42_000),
  currentRunningFrequencyDaysPerWeek: 4,
  longestRecentRunDistance: createDistanceMeters(16_000),
  availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
  preferredLongRunDay: "sunday",
  completionGoal: "complete_first_marathon",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const rules = createInternalPlanProposalRehearsalRuleSet(draftRulesText);
const approvalClient: PlanApprovalClient = {
  async submit() {
    return {
      status: "retryable_error",
      commandId: "viewport-plan-command",
      code: "temporarily-unavailable",
      message: "Viewport fixture does not submit plans.",
    };
  },
  async resolve() {
    return {
      status: "retryable_error",
      commandId: "viewport-plan-command",
      code: "temporarily-unavailable",
      message: "Viewport fixture does not submit plans.",
    };
  },
};

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Plan proposal viewport fixture root was not found.");
}

createRoot(root).render(
  <section className="section-panel">
    <div className="section-panel-content">
      <h1 className="section-heading">Plan</h1>
      <PlanProposalBuilder
        profile={profile}
        generatorVersion={rules.generatorVersion}
        rules={rules.rules}
        onEditProfile={() => undefined}
        approval={{
          client: approvalClient,
          expectedActivePlanRevision: null,
          reloadTrainingData: async () => undefined,
          onApproved: () => undefined,
        }}
        today={createDateOnly("2029-12-01")}
      />
    </div>
  </section>,
);
