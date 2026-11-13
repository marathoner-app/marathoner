import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION,
  CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
} from "../domain/methodology/closedBetaMethodologyConsent";
import type { ClosedBetaMethodologyConsentClient } from "../services/closedBetaMethodologyConsentClient";
import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import { closedBetaMethodologyManifestFixture as manifest } from "../test/closedBetaMethodologyManifest";
import ClosedBetaMethodologyConsentGate from "./ClosedBetaMethodologyConsentGate";

const ownerId = "closed-beta-runner";
const acceptance = {
  schemaVersion: CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION,
  userId: ownerId,
  consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
  manifestVersion: manifest.manifestVersion,
  acceptedAt: "2026-11-11T22:00:00.000Z",
} as const;

function client(
  status: Awaited<ReturnType<ClosedBetaMethodologyConsentClient["getStatus"]>> = {
    status: "consent_required",
    consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
    manifestVersion: manifest.manifestVersion,
    reason: "missing",
  },
): ClosedBetaMethodologyConsentClient {
  return {
    getStatus: vi.fn().mockResolvedValue(status),
    accept: vi.fn().mockResolvedValue({ status: "accepted", acceptance }),
  };
}

describe("ClosedBetaMethodologyConsentGate", () => {
  it("leaves non-beta builds unchanged", () => {
    const consentClient = client();
    render(
      <ClosedBetaMethodologyConsentGate
        ownerId={ownerId}
        client={consentClient}
        manifest={null}
      >
        <p>Training app</p>
      </ClosedBetaMethodologyConsentGate>,
    );
    expect(screen.getByText("Training app")).toBeInTheDocument();
    expect(consentClient.getStatus).not.toHaveBeenCalled();
  });

  it("requires an explicit checked agreement before saving exact versions", async () => {
    const user = userEvent.setup();
    const consentClient = client();
    render(
      <ClosedBetaMethodologyConsentGate
        ownerId={ownerId}
        client={consentClient}
        manifest={manifest}
      >
        <p>Training app</p>
      </ClosedBetaMethodologyConsentGate>,
    );

    const agreement = await screen.findByRole("checkbox");
    const accept = screen.getByRole("button", { name: "Accept and continue" });
    expect(screen.queryByText("Training app")).not.toBeInTheDocument();
    expect(accept).toBeDisabled();
    expect(screen.getByText(/closed-beta-provisional-methodology@0.2.0/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Before you use beta training features" })).toHaveFocus();

    await user.click(agreement);
    await user.click(accept);

    await waitFor(() => expect(screen.getByText("Training app")).toBeInTheDocument());
    expect(consentClient.accept).toHaveBeenCalledWith({
      accepted: true,
      consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
      manifestVersion: manifest.manifestVersion,
    });
  });

  it("prompts again when the accepted version changed", async () => {
    render(
      <ClosedBetaMethodologyConsentGate
        ownerId={ownerId}
        client={client({
          status: "consent_required",
          consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
          manifestVersion: manifest.manifestVersion,
          reason: "version_changed",
        })}
        manifest={manifest}
      >
        <p>Training app</p>
      </ClosedBetaMethodologyConsentGate>,
    );
    expect(await screen.findByText(/methodology version changed/)).toHaveTextContent(
      "methodology version changed",
    );
  });

  it("has no beta-blocking accessibility violations", async () => {
    render(
      <ClosedBetaMethodologyConsentGate
        ownerId={ownerId}
        client={client()}
        manifest={manifest}
      >
        <p>Training app</p>
      </ClosedBetaMethodologyConsentGate>,
    );
    await screen.findByRole("checkbox");
    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });
});
