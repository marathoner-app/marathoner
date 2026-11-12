import { createRoot } from "react-dom/client";

import ClosedBetaMethodologyConsentGate from "../../src/components/ClosedBetaMethodologyConsentGate";
import { CLOSED_BETA_METHODOLOGY_CONSENT_VERSION } from "../../src/domain/methodology/closedBetaMethodologyConsent";
import type { ClosedBetaMethodologyConsentClient } from "../../src/services/closedBetaMethodologyConsentClient";
import { closedBetaMethodologyManifestFixture as manifest } from "../../src/test/closedBetaMethodologyManifest";
import "../../src/index.css";

const client: ClosedBetaMethodologyConsentClient = {
  async getStatus() {
    return {
      status: "consent_required",
      consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
      manifestVersion: manifest.manifestVersion,
      reason: "version_changed",
    };
  },
  async accept() {
    return {
      status: "consent_required",
      consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
      manifestVersion: manifest.manifestVersion,
      reason: "version_changed",
    };
  },
};

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Methodology consent viewport fixture root was not found.");
}

createRoot(root).render(
  <ClosedBetaMethodologyConsentGate
    ownerId="viewport-beta-runner"
    client={client}
    manifest={manifest}
  >
    <p>Training app</p>
  </ClosedBetaMethodologyConsentGate>,
);
