import {
  provisionalMethodologyStatusLabel,
} from "../domain/methodology/closedBetaMethodologyConsent";
import type {
  ClosedBetaProvisionalArtifactKind,
  ClosedBetaProvisionalMethodologyManifest,
} from "../domain/methodology/closedBetaProvisionalMethodology";

import "./ProvisionalMethodologyStatus.css";

export interface ProvisionalMethodologyStatusProps {
  readonly manifest: ClosedBetaProvisionalMethodologyManifest;
  readonly kind: ClosedBetaProvisionalArtifactKind;
  readonly prominence?: "decision" | "context";
}

export default function ProvisionalMethodologyStatus({
  manifest,
  kind,
  prominence = "decision",
}: ProvisionalMethodologyStatusProps) {
  return (
    <p
      className={`provisional-methodology-status ${prominence}`}
      role="note"
    >
      {provisionalMethodologyStatusLabel(manifest, kind)}
    </p>
  );
}
