import { describe, expect, it } from "vitest";

import {
  createGuidanceArtifactVersion,
  type GuidanceReviewState,
} from "../domain/guidance";
import type { RecommendationEvidenceV2 } from "../domain/recommendations";
import { createUtcDateTime } from "../domain/training";
import {
  createDraftRecommendationDecisionContent,
  productionRecommendationDecisionContent,
  resolveInternalRecommendationDecisionReviewModel,
  resolveRecommendationDecisionReviewModel,
  type RecommendationDecisionContentKey,
  type VersionedRecommendationDecisionContent,
} from "./recommendationDecisionReviewContent";

const contentVersion = createGuidanceArtifactVersion(
  "beta-guidance@1.0.0",
);
const basePlanArtifactVersion = "beta-rules@1.0.0";
const adaptationArtifactVersion = "beta-adaptation@1.0.0";
const draftRecommendationDecisionContent =
  createDraftRecommendationDecisionContent({
    basePlanArtifactVersion: "beta-rules@0.1.0-draft",
    adaptationArtifactVersion: "beta-adaptation@0.1.0-draft",
  });

const evidence = {
  evaluationInput: {
    basePlanArtifactVersion,
    adaptationArtifactVersion,
  },
  evaluationResult: {
    action: "hold_progression",
    reasonCode: "ADAPT-HOLD-REPEATED-HARD-EFFORT",
    explanationKey: "adaptation.hold.repeated_hard_effort",
    provenance: {
      basePlanArtifactVersion,
      adaptationArtifactVersion,
    },
  },
} as unknown as RecommendationEvidenceV2;

function content(
  overrides: Partial<VersionedRecommendationDecisionContent> = {},
): VersionedRecommendationDecisionContent {
  return {
    contentVersion,
    reviewState: "approved",
    requiredReviewerRoles: ["endurance_methodology"],
    reviewEvidence: {
      reviewedVersion: contentVersion,
      decidedAt: createUtcDateTime("2026-10-28T18:00:00.000Z"),
      recordId: "recommendation-copy-review-0001",
      reviewerRoles: ["endurance_methodology"],
    },
    key: {
      action: "hold_progression",
      reasonCode: "ADAPT-HOLD-REPEATED-HARD-EFFORT",
      explanationKey: "adaptation.hold.repeated_hard_effort",
      basePlanArtifactVersion,
      adaptationArtifactVersion,
    },
    model: {
      title: "Give next week another steady pass",
      observation: "Several planned runs felt harder than expected.",
      meaning: "The next progression deserves another review.",
      recommendation: "Hold the current targets before progressing.",
      impact: "The remainder of the plan keeps its current schedule.",
    },
    ...overrides,
  };
}

const draftHoldContent = draftRecommendationDecisionContent.find(
  ({ key }) => key.action === "hold_progression",
)!;
const draftKey: RecommendationDecisionContentKey = draftHoldContent.key;

function internalDraftContent(
  overrides: Partial<VersionedRecommendationDecisionContent> = {},
): VersionedRecommendationDecisionContent {
  return {
    ...draftHoldContent,
    ...overrides,
  };
}

describe("resolveRecommendationDecisionReviewModel", () => {
  it("returns reviewed copy only for one exact approved content entry", () => {
    expect(
      resolveRecommendationDecisionReviewModel(evidence, [content()]),
    ).toEqual({
      ...content().model,
      contentState: "reviewed",
    });
  });

  it("keeps the production registry empty until reviewed content is added", () => {
    expect(productionRecommendationDecisionContent).toEqual([]);
    expect(resolveRecommendationDecisionReviewModel(evidence)).toBeNull();
    expect(
      resolveRecommendationDecisionReviewModel(
        evidence,
        draftRecommendationDecisionContent,
      ),
    ).toBeNull();
  });

  it.each([
    ["draft review state", { reviewState: "draft" as GuidanceReviewState }],
    [
      "a review for another version",
      {
        reviewEvidence: {
          ...content().reviewEvidence!,
          reviewedVersion: createGuidanceArtifactVersion(
            "beta-guidance@0.9.0",
          ),
        },
      },
    ],
    [
      "a prerelease content version",
      {
        contentVersion: createGuidanceArtifactVersion(
          "beta-guidance@1.0.0-conditional",
        ),
        reviewEvidence: {
          ...content().reviewEvidence!,
          reviewedVersion: createGuidanceArtifactVersion(
            "beta-guidance@1.0.0-conditional",
          ),
        },
      },
    ],
    [
      "an invalid review record identifier",
      {
        reviewEvidence: {
          ...content().reviewEvidence!,
          recordId: "review/record",
        },
      },
    ],
    [
      "a missing required reviewer",
      {
        requiredReviewerRoles: [
          "endurance_methodology" as const,
          "clinical_safety" as const,
        ],
      },
    ],
    [
      "a different reason code",
      {
        key: {
          ...content().key,
          reasonCode: "ADAPT-REPEAT-MISSED-WEEK",
        },
      },
    ],
    [
      "a different explanation key",
      {
        key: {
          ...content().key,
          explanationKey: "adaptation.repeat.missed_week",
        },
      },
    ],
    [
      "a different action",
      {
        key: { ...content().key, action: "repeat_period" as const },
      },
    ],
    [
      "a different rules artifact",
      {
        key: {
          ...content().key,
          basePlanArtifactVersion: "beta-rules@2.0.0",
        },
      },
    ],
    [
      "a different adaptation artifact",
      {
        key: {
          ...content().key,
          adaptationArtifactVersion: "beta-adaptation@2.0.0",
        },
      },
    ],
    [
      "incomplete copy",
      { model: { ...content().model, impact: "" } },
    ],
  ])("fails closed for %s", (_name, overrides) => {
    expect(
      resolveRecommendationDecisionReviewModel(evidence, [content(overrides)]),
    ).toBeNull();
  });

  it("fails closed when duplicate entries match the same evidence", () => {
    expect(
      resolveRecommendationDecisionReviewModel(evidence, [
        content(),
        content({
          contentVersion: createGuidanceArtifactVersion(
            "beta-guidance@1.0.1",
          ),
          reviewEvidence: {
            ...content().reviewEvidence!,
            reviewedVersion: createGuidanceArtifactVersion(
              "beta-guidance@1.0.1",
            ),
          },
        }),
      ]),
    ).toBeNull();
  });
});

describe("resolveInternalRecommendationDecisionReviewModel", () => {
  it("covers every bounded material recommendation in the draft artifact", () => {
    expect(
      draftRecommendationDecisionContent.map(({ key }) => ({
        action: key.action,
        reasonCode: key.reasonCode,
        explanationKey: key.explanationKey,
      })),
    ).toEqual([
      {
        action: "repeat_period",
        reasonCode: "ADAPT-REPEAT-MISSED-WEEK",
        explanationKey: "adaptation.repeat.missed_week",
      },
      {
        action: "hold_progression",
        reasonCode: "ADAPT-HOLD-REPEATED-HARD-EFFORT",
        explanationKey: "adaptation.hold.repeated_hard_effort",
      },
      {
        action: "reschedule",
        reasonCode: "ADAPT-RESCHEDULE-SINGLE-MISS",
        explanationKey: "adaptation.reschedule.single_miss",
      },
    ]);
  });

  it.each(draftRecommendationDecisionContent)(
    "resolves exact draft copy for $key.reasonCode",
    (entry) => {
      expect(
        resolveInternalRecommendationDecisionReviewModel(
          entry.key,
          draftRecommendationDecisionContent,
        ),
      ).toEqual({
        ...entry.model,
        contentState: "internal_preview",
      });
    },
  );

  it.each([
    [
      "a non-draft review state",
      { reviewState: "ready_for_review" as GuidanceReviewState },
    ],
    [
      "a stable content version",
      {
        contentVersion: createGuidanceArtifactVersion(
          "beta-guidance@0.1.0",
        ),
      },
    ],
    [
      "attached review evidence",
      {
        reviewEvidence: {
          reviewedVersion: draftHoldContent.contentVersion,
          decidedAt: createUtcDateTime("2026-10-28T18:00:00.000Z"),
          recordId: "draft-copy-review-0001",
          reviewerRoles: ["endurance_methodology" as const],
        },
      },
    ],
    [
      "incomplete copy",
      { model: { ...draftHoldContent.model, meaning: "" } },
    ],
    [
      "a mismatched reason",
      {
        key: {
          ...draftHoldContent.key,
          reasonCode: "ADAPT-REPEAT-MISSED-WEEK",
        },
      },
    ],
  ])("fails closed for %s", (_name, overrides) => {
    expect(
      resolveInternalRecommendationDecisionReviewModel(draftKey, [
        internalDraftContent(overrides),
      ]),
    ).toBeNull();
  });

  it("fails closed when duplicate draft entries match", () => {
    expect(
      resolveInternalRecommendationDecisionReviewModel(draftKey, [
        internalDraftContent(),
        internalDraftContent(),
      ]),
    ).toBeNull();
  });

  it("does not bind draft explanations to stable artifact versions", () => {
    expect(
      createDraftRecommendationDecisionContent({
        basePlanArtifactVersion,
        adaptationArtifactVersion,
      }),
    ).toEqual([]);
  });
});
