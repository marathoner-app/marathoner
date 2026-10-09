import { describe, expect, it } from "vitest";
import { createUtcDateTime } from "../training/dates";
import { foundingBetaGuidanceManifest } from "./foundingBetaGuidanceManifest";
import {
  GUIDANCE_ITEM_SCHEMA_VERSION,
  GUIDANCE_TOPICS,
  createGuidanceArtifactVersion,
  createGuidanceItemId,
  createGuidanceTriggerCode,
  evaluateGuidancePresentation,
  validateGuidanceItem,
  type GuidanceItemV1,
  type GuidancePresentationContextV1,
} from "./guidance";

const guidanceId = createGuidanceItemId("fixture.easy-effort");
const contentVersion = createGuidanceArtifactVersion("fixture-guidance@1.0.0");
const triggerCode = createGuidanceTriggerCode("FIXTURE-EASY-WORKOUT");

function createApprovedGuidance(
  overrides: Partial<GuidanceItemV1> = {},
): GuidanceItemV1 {
  return {
    schemaVersion: GUIDANCE_ITEM_SCHEMA_VERSION,
    id: guidanceId,
    contentVersion,
    topic: "easy_effort",
    title: "Synthetic easy-effort fixture",
    body: "Synthetic contract text used only to verify selection behavior.",
    limitations: ["This fixture is not participant-facing training guidance."],
    contentOwner: "Fixture owner",
    correctionOwner: "Fixture correction owner",
    correctionChannel: "Fixture correction channel",
    requiredReviewerRoles: ["endurance_methodology"],
    reviewState: "approved",
    reviewEvidence: {
      reviewedVersion: contentVersion,
      decidedAt: createUtcDateTime("2026-10-01T12:00:00Z"),
      recordId: "fixture-review-record",
      reviewerRoles: ["endurance_methodology"],
    },
    publicationState: "published",
    triggers: [{ code: triggerCode, event: "workout_upcoming" }],
    suppression: {
      cooldownHours: 24,
      maxPresentationsPerVersion: 2,
      dismissesVersion: true,
    },
    ...overrides,
  };
}

function createContext(
  overrides: Partial<GuidancePresentationContextV1> = {},
): GuidancePresentationContextV1 {
  return {
    now: createUtcDateTime("2026-10-08T12:00:00Z"),
    activeTriggerCodes: [triggerCode],
    presentationHistory: [],
    remoteDisableRules: [],
    ...overrides,
  };
}

describe("versioned guidance contract", () => {
  it("owns one disabled draft manifest entry for every founding-beta topic", () => {
    expect(foundingBetaGuidanceManifest.map((item) => item.topic).sort()).toEqual(
      [...GUIDANCE_TOPICS].sort(),
    );

    for (const item of foundingBetaGuidanceManifest) {
      expect(validateGuidanceItem(item)).toEqual([]);
      expect(item.reviewState).toBe("draft");
      expect(item.publicationState).toBe("disabled");
      expect(item.contentVersion).toContain("-draft");
      expect(item.contentOwner).not.toBe("");
      expect(item.correctionOwner).not.toBe("");
    }
  });

  it("requires exact approval evidence before publication", () => {
    const draft = foundingBetaGuidanceManifest[0];
    const unsafePublication: GuidanceItemV1 = {
      ...draft,
      publicationState: "published",
    };

    expect(validateGuidanceItem(unsafePublication)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "publicationState" }),
        expect.objectContaining({ field: "contentVersion" }),
      ]),
    );
  });

  it("requires every declared reviewer role in an approval record", () => {
    const item = createApprovedGuidance({
      requiredReviewerRoles: ["endurance_methodology", "clinical_safety"],
    });

    expect(validateGuidanceItem(item)).toContainEqual(
      expect.objectContaining({
        code: "inconsistent",
        field: "reviewEvidence.reviewerRoles",
      }),
    );
  });

  it("accepts a structurally valid approved synthetic fixture", () => {
    expect(validateGuidanceItem(createApprovedGuidance())).toEqual([]);
  });
});

describe("guidance presentation decisions", () => {
  it("presents only a published approved version with an active trigger", () => {
    expect(
      evaluateGuidancePresentation(createApprovedGuidance(), createContext()),
    ).toEqual({ eligible: true });

    expect(
      evaluateGuidancePresentation(
        createApprovedGuidance(),
        createContext({ activeTriggerCodes: [] }),
      ),
    ).toEqual({ eligible: false, reason: "trigger_not_active" });
  });

  it("fails closed for draft, retired, and remotely disabled content", () => {
    const draft = foundingBetaGuidanceManifest[0];
    expect(evaluateGuidancePresentation(draft, createContext())).toEqual({
      eligible: false,
      reason: "review_not_approved",
    });

    const retired = createApprovedGuidance({
      reviewState: "retired",
      publicationState: "disabled",
    });
    expect(evaluateGuidancePresentation(retired, createContext())).toEqual({
      eligible: false,
      reason: "retired",
    });

    expect(
      evaluateGuidancePresentation(
        createApprovedGuidance(),
        createContext({ remoteDisableRules: [{ guidanceId }] }),
      ),
    ).toEqual({ eligible: false, reason: "remotely_disabled" });
  });

  it("applies cooldown and the per-version presentation limit deterministically", () => {
    const recentPresentation = {
      guidanceId,
      contentVersion,
      presentedAt: createUtcDateTime("2026-10-08T00:00:00Z"),
    };

    expect(
      evaluateGuidancePresentation(
        createApprovedGuidance(),
        createContext({ presentationHistory: [recentPresentation] }),
      ),
    ).toEqual({ eligible: false, reason: "cooldown_active" });

    const atCooldownBoundary = createContext({
      now: createUtcDateTime("2026-10-09T00:00:00Z"),
      presentationHistory: [recentPresentation],
    });
    expect(
      evaluateGuidancePresentation(
        createApprovedGuidance(),
        atCooldownBoundary,
      ),
    ).toEqual({ eligible: true });

    expect(
      evaluateGuidancePresentation(
        createApprovedGuidance(),
        createContext({
          now: createUtcDateTime("2026-10-10T12:00:00Z"),
          presentationHistory: [
            recentPresentation,
            {
              ...recentPresentation,
              presentedAt: createUtcDateTime("2026-10-09T12:00:00Z"),
            },
          ],
        }),
      ),
    ).toEqual({ eligible: false, reason: "presentation_limit_reached" });
  });

  it("keeps a dismissed version suppressed but lets a replacement version start fresh", () => {
    const dismissedPresentation = {
      guidanceId,
      contentVersion,
      presentedAt: createUtcDateTime("2026-10-01T12:00:00Z"),
      dismissedAt: createUtcDateTime("2026-10-01T12:01:00Z"),
    };
    expect(
      evaluateGuidancePresentation(
        createApprovedGuidance(),
        createContext({ presentationHistory: [dismissedPresentation] }),
      ),
    ).toEqual({ eligible: false, reason: "dismissed_for_version" });

    const replacementVersion = createGuidanceArtifactVersion(
      "fixture-guidance@1.1.0",
    );
    const replacement = createApprovedGuidance({
      contentVersion: replacementVersion,
      reviewEvidence: {
        reviewedVersion: replacementVersion,
        decidedAt: createUtcDateTime("2026-10-07T12:00:00Z"),
        recordId: "fixture-review-record-2",
        reviewerRoles: ["endurance_methodology"],
      },
      replaces: { guidanceId, contentVersion },
    });

    expect(
      evaluateGuidancePresentation(
        replacement,
        createContext({ presentationHistory: [dismissedPresentation] }),
      ),
    ).toEqual({ eligible: true });
  });

  it("expires content at the exact configured timestamp", () => {
    const item = createApprovedGuidance({
      suppression: {
        cooldownHours: 24,
        maxPresentationsPerVersion: 2,
        dismissesVersion: true,
        expiresAt: createUtcDateTime("2026-10-08T12:00:00Z"),
      },
    });

    expect(evaluateGuidancePresentation(item, createContext())).toEqual({
      eligible: false,
      reason: "expired",
    });
  });
});
