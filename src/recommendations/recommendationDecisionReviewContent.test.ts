import { describe, expect, it } from "vitest";

import {
  createGuidanceArtifactVersion,
  type GuidanceReviewState,
} from "../domain/guidance";
import type { RecommendationEvidenceV2 } from "../domain/recommendations";
import { createUtcDateTime } from "../domain/training";
import {
  productionRecommendationDecisionContent,
  resolveRecommendationDecisionReviewModel,
  type VersionedRecommendationDecisionContent,
} from "./recommendationDecisionReviewContent";

const contentVersion = createGuidanceArtifactVersion(
  "beta-guidance@1.0.0",
);
const basePlanArtifactVersion = "beta-rules@1.0.0";
const adaptationArtifactVersion = "beta-adaptation@1.0.0";

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
