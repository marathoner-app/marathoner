import type {
  ClosedBetaProvisionalArtifactKind,
  ClosedBetaProvisionalMethodologyManifest,
} from "./closedBetaProvisionalMethodology.js";

export const CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION = 1 as const;
export const CLOSED_BETA_METHODOLOGY_CONSENT_VERSION =
  "closed-beta-methodology-consent@1.0.0" as const;

export interface ClosedBetaMethodologyConsentAcceptance {
  readonly schemaVersion: typeof CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION;
  readonly userId: string;
  readonly consentVersion: typeof CLOSED_BETA_METHODOLOGY_CONSENT_VERSION;
  readonly manifestVersion: string;
  readonly acceptedAt: string;
}

export type ClosedBetaMethodologyConsentResult =
  | {
      readonly status: "accepted";
      readonly acceptance: ClosedBetaMethodologyConsentAcceptance;
    }
  | {
      readonly status: "consent_required";
      readonly consentVersion: typeof CLOSED_BETA_METHODOLOGY_CONSENT_VERSION;
      readonly manifestVersion: string;
      readonly reason: "missing" | "version_changed";
    }
  | {
      readonly status: "authentication_error";
      readonly code: "sign-in-required";
    }
  | {
      readonly status: "authorization_error";
      readonly code: "app-check-required" | "approved-beta-membership-required";
    }
  | {
      readonly status: "unavailable";
      readonly code: "closed-beta-methodology-unavailable";
    }
  | {
      readonly status: "validation_error";
      readonly code: "consent-version-mismatch" | "explicit-consent-required";
    };

export interface AcceptClosedBetaMethodologyConsentCommand {
  readonly accepted: true;
  readonly consentVersion: typeof CLOSED_BETA_METHODOLOGY_CONSENT_VERSION;
  readonly manifestVersion: string;
}

export const closedBetaMethodologyConsentCopy = Object.freeze({
  eyebrow: "Founding beta",
  title: "Before you use beta training features",
  introduction:
    "Marathoner’s training plans, adjustments, and guidance use provisional methodology that has not been independently reviewed by a running coach or medical professional.",
  testingContext:
    "This closed beta is for testing how the product works and feels. The training methodology may change during the beta.",
  safetyContext:
    "Use your own judgment, stop running if you have pain or unusual symptoms, and seek qualified help when appropriate.",
  agreement:
    "I understand this beta uses provisional, independently unreviewed training methodology, and I want to continue.",
  action: "Accept and continue",
});

export function artifactVersion(
  manifest: ClosedBetaProvisionalMethodologyManifest,
  kind: ClosedBetaProvisionalArtifactKind,
): string {
  const artifact = manifest.artifacts.find((candidate) => candidate.kind === kind);
  if (artifact === undefined) {
    throw new Error(`The closed-beta manifest is missing its ${kind} artifact.`);
  }
  return artifact.version;
}

export function provisionalMethodologyStatusLabel(
  manifest: ClosedBetaProvisionalMethodologyManifest,
  kind: ClosedBetaProvisionalArtifactKind,
): string {
  const labels: Record<ClosedBetaProvisionalArtifactKind, string> = {
    plan: "Plan rules",
    adaptation: "Adaptation rules",
    guidance: "Guidance",
    safety: "Safety rules",
  };
  return `Provisional beta methodology · ${labels[kind]} ${artifactVersion(manifest, kind)} · independently unreviewed`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isUtcDateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

export function parseClosedBetaMethodologyConsentResult(
  value: unknown,
): ClosedBetaMethodologyConsentResult {
  if (!isRecord(value) || typeof value.status !== "string") {
    throw new Error("The methodology consent response is invalid.");
  }

  if (value.status === "accepted") {
    const acceptance = value.acceptance;
    if (
      !hasExactKeys(value, ["status", "acceptance"]) ||
      !isRecord(acceptance) ||
      !hasExactKeys(acceptance, [
        "schemaVersion",
        "userId",
        "consentVersion",
        "manifestVersion",
        "acceptedAt",
      ]) ||
      acceptance.schemaVersion !== CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION ||
      typeof acceptance.userId !== "string" ||
      acceptance.userId.length === 0 ||
      acceptance.consentVersion !== CLOSED_BETA_METHODOLOGY_CONSENT_VERSION ||
      typeof acceptance.manifestVersion !== "string" ||
      acceptance.manifestVersion.length === 0 ||
      !isUtcDateTime(acceptance.acceptedAt)
    ) {
      throw new Error("The accepted methodology consent response is invalid.");
    }
    return value as unknown as ClosedBetaMethodologyConsentResult;
  }

  if (value.status === "consent_required") {
    if (
      !hasExactKeys(value, [
        "status",
        "consentVersion",
        "manifestVersion",
        "reason",
      ]) ||
      value.consentVersion !== CLOSED_BETA_METHODOLOGY_CONSENT_VERSION ||
      typeof value.manifestVersion !== "string" ||
      value.manifestVersion.length === 0 ||
      (value.reason !== "missing" && value.reason !== "version_changed")
    ) {
      throw new Error("The required methodology consent response is invalid.");
    }
    return value as unknown as ClosedBetaMethodologyConsentResult;
  }

  const allowedCodes: Record<string, readonly string[]> = {
    authentication_error: ["sign-in-required"],
    authorization_error: [
      "app-check-required",
      "approved-beta-membership-required",
    ],
    unavailable: ["closed-beta-methodology-unavailable"],
    validation_error: [
      "consent-version-mismatch",
      "explicit-consent-required",
    ],
  };
  if (
    !hasExactKeys(value, ["status", "code"]) ||
    !Object.prototype.hasOwnProperty.call(allowedCodes, value.status) ||
    typeof value.code !== "string" ||
    !allowedCodes[value.status]?.includes(value.code)
  ) {
    throw new Error("The methodology consent response is unsupported.");
  }
  return value as unknown as ClosedBetaMethodologyConsentResult;
}
