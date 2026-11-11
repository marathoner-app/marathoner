import manifestText from "virtual:closed-beta-provisional-methodology-manifest";
import {
  parseClosedBetaProvisionalMethodologyManifest,
  type ClosedBetaProvisionalMethodologyManifest,
} from "./closedBetaProvisionalMethodology";

let resolvedManifest: ClosedBetaProvisionalMethodologyManifest | null = null;

export function initializeClosedBetaProvisionalMethodologyBoundary(): void {
  resolvedManifest =
    manifestText === null
      ? null
      : parseClosedBetaProvisionalMethodologyManifest(manifestText);
}

export function getClosedBetaProvisionalMethodologyManifest(): ClosedBetaProvisionalMethodologyManifest | null {
  return resolvedManifest;
}
