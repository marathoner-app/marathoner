import type { ClosedBetaProvisionalMethodologyManifest } from "../domain/methodology/closedBetaProvisionalMethodology";

export const closedBetaMethodologyManifestFixture: ClosedBetaProvisionalMethodologyManifest = {
  schemaVersion: 1,
  manifestVersion: "closed-beta-provisional-methodology@0.2.0",
  reviewState: "provisional_unreviewed",
  publicationState: "closed_beta_only",
  firebaseEnvironment: "beta",
  eligibleCohort: {
    kind: "founding_closed_beta",
    minimumParticipants: 5,
    maximumParticipants: 8,
  },
  artifacts: [
    { kind: "plan", version: ["beta-rules", "@0.3.0-draft"].join(""), sourcePath: "docs/methodology/plan", sha256: "a".repeat(64), status: "active" },
    { kind: "adaptation", version: ["beta-adaptation", "@0.3.0-draft"].join(""), sourcePath: "docs/methodology/adaptation", sha256: "b".repeat(64), status: "active" },
    { kind: "guidance", version: "beta-guidance@0.1.0-draft", sourcePath: "src/domain/guidance/file", sha256: "c".repeat(64), status: "active" },
    { kind: "safety", version: "beta-safety@0.1.0-draft", sourcePath: "docs/methodology/safety", sha256: "d".repeat(64), status: "active" },
  ],
};
