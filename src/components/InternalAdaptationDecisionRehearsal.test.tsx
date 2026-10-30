import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
  ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
  createAdaptationArtifactVersion,
  createAdaptationExplanationKey,
  createAdaptationReasonCode,
  type AdaptationAction,
  type DecidedAdaptationEvaluationResultV1,
} from "../domain/training";
import { createDraftRecommendationDecisionContent } from "../recommendations/recommendationDecisionReviewContent";
import InternalAdaptationDecisionRehearsal from "./InternalAdaptationDecisionRehearsal";

const contentRegistry = createDraftRecommendationDecisionContent({
  basePlanArtifactVersion: "beta-rules@0.2.0-draft",
  adaptationArtifactVersion: "beta-adaptation@0.2.0-draft",
});

const cases = [
  {
    action: "repeat_period",
    reasonCode: "ADAPT-REPEAT-MISSED-WEEK",
    explanationKey: "adaptation.repeat.missed_week",
    title: "Repeat this training week before progressing",
  },
  {
    action: "hold_progression",
    reasonCode: "ADAPT-HOLD-REPEATED-HARD-EFFORT",
    explanationKey: "adaptation.hold.repeated_hard_effort",
    title: "Give next week another steady pass",
  },
  {
    action: "reschedule",
    reasonCode: "ADAPT-RESCHEDULE-SINGLE-MISS",
    explanationKey: "adaptation.reschedule.single_miss",
    title: "Move the missed run within this week",
  },
] as const;

function resultFor({
  action,
  reasonCode,
  explanationKey,
}: (typeof cases)[number]): DecidedAdaptationEvaluationResultV1 {
  return {
    schemaVersion: ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
    kind: "recommendation",
    action: action as AdaptationAction,
    reasonCode: createAdaptationReasonCode(reasonCode),
    explanationKey: createAdaptationExplanationKey(explanationKey),
    runnerApprovalRequired: true,
    provenance: {
      inputSchemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
      evaluatorVersion: createAdaptationArtifactVersion(
        "deterministic-adaptation-evaluator@1.0.0",
      ),
      basePlanArtifactVersion: createAdaptationArtifactVersion(
        "beta-rules@0.2.0-draft",
      ),
      adaptationArtifactVersion: createAdaptationArtifactVersion(
        "beta-adaptation@0.2.0-draft",
      ),
    },
  };
}

describe("InternalAdaptationDecisionRehearsal", () => {
  it.each(cases)(
    "renders exact draft copy for $reasonCode",
    (testCase) => {
      render(
        <InternalAdaptationDecisionRehearsal
          result={resultFor(testCase)}
          contentRegistry={contentRegistry}
        />,
      );

      expect(
        screen.getByRole("heading", { name: testCase.title }),
      ).toBeVisible();
      expect(
        screen.getByText(/not approved training guidance/i),
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Keep in rehearsal" }),
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Apply in rehearsal" }),
      ).toBeEnabled();
    },
  );

  it("records only a session choice", async () => {
    const user = userEvent.setup();
    const onSessionDecisionChange = vi.fn();

    render(
      <InternalAdaptationDecisionRehearsal
        result={resultFor(cases[1])}
        contentRegistry={contentRegistry}
        onSessionDecisionChange={onSessionDecisionChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Apply in rehearsal" }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Session choice recorded: Apply draft change",
      }),
    ).toBeVisible();
    expect(onSessionDecisionChange).toHaveBeenLastCalledWith("apply");
  });

  it("does not retain a prior decision when the exact result changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <InternalAdaptationDecisionRehearsal
        result={resultFor(cases[1])}
        contentRegistry={contentRegistry}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Apply in rehearsal" }),
    );
    rerender(
      <InternalAdaptationDecisionRehearsal
        result={resultFor(cases[2])}
        contentRegistry={contentRegistry}
      />,
    );

    expect(
      screen.getByRole("heading", { name: cases[2].title }),
    ).toBeVisible();
    expect(
      screen.queryByText(/Session choice recorded:/i),
    ).not.toBeInTheDocument();
  });

  it("withholds controls when exact draft copy is unavailable", () => {
    const mismatched = resultFor(cases[1]);

    render(
      <InternalAdaptationDecisionRehearsal
        contentRegistry={contentRegistry}
        result={{
          ...mismatched,
          provenance: {
            ...mismatched.provenance,
            adaptationArtifactVersion: createAdaptationArtifactVersion(
              "beta-adaptation@0.1.0-draft",
            ),
          },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "This recommendation cannot be rehearsed",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /rehearsal/i }),
    ).not.toBeInTheDocument();
  });
});
