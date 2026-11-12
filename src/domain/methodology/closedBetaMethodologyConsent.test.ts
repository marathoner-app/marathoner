import { describe, expect, it } from "vitest";

import {
  CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION,
  CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
  parseClosedBetaMethodologyConsentResult,
  provisionalMethodologyStatusLabel,
} from "./closedBetaMethodologyConsent";
import type { ClosedBetaProvisionalMethodologyManifest } from "./closedBetaProvisionalMethodology";

const manifest: ClosedBetaProvisionalMethodologyManifest = {
  schemaVersion: 1,
  manifestVersion: "closed-beta-provisional-methodology@0.1.0",
  reviewState: "provisional_unreviewed",
  publicationState: "closed_beta_only",
  firebaseEnvironment: "beta",
  eligibleCohort: {
    kind: "founding_closed_beta",
    minimumParticipants: 5,
    maximumParticipants: 8,
  },
  artifacts: [
    { kind: "plan", version: "beta-rules@0.2.0-draft", sourcePath: "docs/methodology/plan", sha256: "a".repeat(64), status: "active" },
    { kind: "adaptation", version: "beta-adaptation@0.2.0-draft", sourcePath: "docs/methodology/adaptation", sha256: "b".repeat(64), status: "active" },
    { kind: "guidance", version: "beta-guidance@0.1.0-draft", sourcePath: "src/domain/guidance/file", sha256: "c".repeat(64), status: "active" },
    { kind: "safety", version: "beta-safety@0.1.0-draft", sourcePath: "docs/methodology/safety", sha256: "d".repeat(64), status: "active" },
  ],
};

describe("closed-beta methodology consent contract", () => {
  it("parses an exact accepted record", () => {
    expect(
      parseClosedBetaMethodologyConsentResult({
        status: "accepted",
        acceptance: {
          schemaVersion: CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION,
          userId: "runner-one",
          consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
          manifestVersion: manifest.manifestVersion,
          acceptedAt: "2026-11-11T22:00:00.000Z",
        },
      }),
    ).toMatchObject({ status: "accepted" });
  });

  it("rejects extra fields and malformed timestamps", () => {
    expect(() =>
      parseClosedBetaMethodologyConsentResult({
        status: "accepted",
        acceptance: {
          schemaVersion: 1,
          userId: "runner-one",
          consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
          manifestVersion: manifest.manifestVersion,
          acceptedAt: "today",
        },
      }),
    ).toThrow("invalid");
    expect(() =>
      parseClosedBetaMethodologyConsentResult({
        status: "consent_required",
        consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
        manifestVersion: manifest.manifestVersion,
        reason: "missing",
        extra: true,
      }),
    ).toThrow("invalid");
  });

  it("normalizes concise versioned status text", () => {
    expect(provisionalMethodologyStatusLabel(manifest, "adaptation")).toBe(
      "Provisional beta methodology · Adaptation rules beta-adaptation@0.2.0-draft · independently unreviewed",
    );
  });
});
