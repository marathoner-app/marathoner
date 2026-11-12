import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ClosedBetaGuidanceClient } from "../services/closedBetaGuidanceClient";
import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import ClosedBetaGuidanceSurface from "./ClosedBetaGuidanceSurface";

function client(options: { readonly safety?: boolean } = {}): ClosedBetaGuidanceClient {
  return {
    get: vi.fn(async () => ({
      schemaVersion: "closed-beta-guidance-result@1",
      status: "available",
      presentation: {
        presentationId: "presentation-1",
        artifactVersion: options.safety
          ? "beta-safety@0.1.0-draft"
          : "beta-guidance@0.1.0-draft",
        kind: options.safety ? "safety" : "guidance",
        title: options.safety
          ? "Stop and seek qualified medical advice"
          : "Keep easy running conversational",
        message: "Pinned participant guidance.",
        limitations: ["This provisional guidance has a bounded purpose."],
        contextLabel: "Before an easy workout",
        dismissible: !options.safety,
      },
    }) as const),
    dismiss: vi.fn(async (request) => ({
      schemaVersion: "closed-beta-guidance-result@1",
      status: "dismissed",
      presentationId: request.presentationId,
    }) as const),
  };
}

describe("ClosedBetaGuidanceSurface", () => {
  it("loads normalized guidance and persists dismissal through the client", async () => {
    const user = userEvent.setup();
    const guidanceClient = client();
    render(
      <ClosedBetaGuidanceSurface
        ownerId="beta-runner"
        activeTriggerCodes={["EASY-WORKOUT-UPCOMING"]}
        safetyState="none_reported"
        client={guidanceClient}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Keep easy running conversational",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss guidance" }));
    await waitFor(() => expect(screen.queryByText("Pinned participant guidance.")).not.toBeInTheDocument());
    expect(guidanceClient.dismiss).toHaveBeenCalledWith({
      presentationId: "presentation-1",
      artifactVersion: "beta-guidance@0.1.0-draft",
    });
  });

  it("keeps safety escalation visible and non-dismissible", async () => {
    render(
      <ClosedBetaGuidanceSurface
        ownerId="beta-runner"
        activeTriggerCodes={["EASY-WORKOUT-UPCOMING"]}
        safetyState="reported"
        otherConcerningOrPersistentSymptoms
        client={client({ safety: true })}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Stop and seek qualified medical advice",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss guidance/i })).not.toBeInTheDocument();
    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });

  it("stays quiet when no guidance is available", async () => {
    const emptyClient: ClosedBetaGuidanceClient = {
      get: vi.fn(async () => ({
        schemaVersion: "closed-beta-guidance-result@1",
        status: "none",
        reason: "suppressed",
      }) as const),
      dismiss: vi.fn(),
    };
    render(
      <ClosedBetaGuidanceSurface
        ownerId="beta-runner"
        activeTriggerCodes={[]}
        safetyState="none_reported"
        client={emptyClient}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByText("Checking runner guidance…")).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
