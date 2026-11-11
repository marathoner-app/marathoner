export const CLOSED_BETA_PROVISIONAL_METHODOLOGY_SCHEMA_VERSION = 1 as const;

export const closedBetaProvisionalArtifactKinds = [
  "plan",
  "adaptation",
  "guidance",
  "safety",
] as const;

export type ClosedBetaProvisionalArtifactKind =
  (typeof closedBetaProvisionalArtifactKinds)[number];

export interface ClosedBetaProvisionalArtifactReference {
  readonly kind: ClosedBetaProvisionalArtifactKind;
  readonly version: string;
  readonly sourcePath: string;
  readonly sha256: string;
  readonly status: "active";
}

export interface ClosedBetaProvisionalMethodologyManifest {
  readonly schemaVersion: typeof CLOSED_BETA_PROVISIONAL_METHODOLOGY_SCHEMA_VERSION;
  readonly manifestVersion: string;
  readonly reviewState: "provisional_unreviewed";
  readonly publicationState: "closed_beta_only";
  readonly firebaseEnvironment: "beta";
  readonly eligibleCohort: {
    readonly kind: "founding_closed_beta";
    readonly minimumParticipants: 5;
    readonly maximumParticipants: 8;
  };
  readonly artifacts: readonly ClosedBetaProvisionalArtifactReference[];
}

const artifactVersionPrefixes: Record<
  ClosedBetaProvisionalArtifactKind,
  string
> = {
  plan: "beta-rules@",
  adaptation: "beta-adaptation@",
  guidance: "beta-guidance@",
  safety: "beta-safety@",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  context: string,
): void {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new Error(`${context} contains an unknown or missing field.`);
  }
}

function parseArtifactReference(
  value: unknown,
): ClosedBetaProvisionalArtifactReference {
  if (!isRecord(value)) {
    throw new Error("Each provisional methodology artifact must be an object.");
  }
  assertExactKeys(
    value,
    ["kind", "version", "sourcePath", "sha256", "status"],
    "A provisional methodology artifact",
  );

  if (
    typeof value.kind !== "string" ||
    !closedBetaProvisionalArtifactKinds.some((kind) => kind === value.kind)
  ) {
    throw new Error("The provisional methodology manifest has an unknown artifact kind.");
  }
  const kind = value.kind as ClosedBetaProvisionalArtifactKind;
  if (
    typeof value.version !== "string" ||
    !value.version.startsWith(artifactVersionPrefixes[kind]) ||
    !value.version.endsWith("-draft")
  ) {
    throw new Error(
      `The ${kind} artifact version must be the pinned provisional draft for its artifact family.`,
    );
  }
  if (
    typeof value.sourcePath !== "string" ||
    value.sourcePath.startsWith("/") ||
    value.sourcePath.includes("..") ||
    (!value.sourcePath.startsWith("docs/methodology/") &&
      !value.sourcePath.startsWith("src/domain/guidance/"))
  ) {
    throw new Error(
      `The ${kind} artifact must use a repository-relative methodology source path.`,
    );
  }
  if (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)) {
    throw new Error(`The ${kind} artifact must pin a lowercase SHA-256 digest.`);
  }
  if (value.status !== "active") {
    throw new Error(`The ${kind} artifact is missing, unknown, or retired.`);
  }

  return {
    kind,
    version: value.version,
    sourcePath: value.sourcePath,
    sha256: value.sha256,
    status: value.status,
  };
}

export function parseClosedBetaProvisionalMethodologyManifest(
  input: string | unknown,
): ClosedBetaProvisionalMethodologyManifest {
  let value: unknown = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      throw new Error("The provisional methodology manifest is not valid JSON.");
    }
  }
  if (!isRecord(value)) {
    throw new Error("The provisional methodology manifest must be an object.");
  }
  assertExactKeys(
    value,
    [
      "schemaVersion",
      "manifestVersion",
      "reviewState",
      "publicationState",
      "firebaseEnvironment",
      "eligibleCohort",
      "artifacts",
    ],
    "The provisional methodology manifest",
  );

  if (value.schemaVersion !== CLOSED_BETA_PROVISIONAL_METHODOLOGY_SCHEMA_VERSION) {
    throw new Error("The provisional methodology manifest schema version is unsupported.");
  }
  if (
    typeof value.manifestVersion !== "string" ||
    !/^closed-beta-provisional-methodology@\d+\.\d+\.\d+$/.test(
      value.manifestVersion,
    )
  ) {
    throw new Error("The provisional methodology manifest version is invalid.");
  }
  if (value.reviewState !== "provisional_unreviewed") {
    throw new Error("The closed-beta methodology must remain explicitly unreviewed.");
  }
  if (value.publicationState !== "closed_beta_only") {
    throw new Error("The provisional methodology manifest is not closed-beta-only.");
  }
  if (value.firebaseEnvironment !== "beta") {
    throw new Error("The provisional methodology manifest must target the beta environment.");
  }
  if (!isRecord(value.eligibleCohort)) {
    throw new Error("The provisional methodology manifest is missing its cohort boundary.");
  }
  assertExactKeys(
    value.eligibleCohort,
    ["kind", "minimumParticipants", "maximumParticipants"],
    "The provisional methodology cohort",
  );
  if (
    value.eligibleCohort.kind !== "founding_closed_beta" ||
    value.eligibleCohort.minimumParticipants !== 5 ||
    value.eligibleCohort.maximumParticipants !== 8
  ) {
    throw new Error("The provisional methodology cohort must stay bounded to five to eight participants.");
  }
  if (!Array.isArray(value.artifacts)) {
    throw new Error("The provisional methodology manifest must contain artifacts.");
  }

  const artifacts = value.artifacts.map(parseArtifactReference);
  for (const kind of closedBetaProvisionalArtifactKinds) {
    if (artifacts.filter((artifact) => artifact.kind === kind).length !== 1) {
      throw new Error(
        `The provisional methodology manifest must pin exactly one ${kind} artifact.`,
      );
    }
  }
  if (artifacts.length !== closedBetaProvisionalArtifactKinds.length) {
    throw new Error("The provisional methodology manifest contains an unknown artifact.");
  }

  return {
    schemaVersion: value.schemaVersion,
    manifestVersion: value.manifestVersion,
    reviewState: value.reviewState,
    publicationState: value.publicationState,
    firebaseEnvironment: value.firebaseEnvironment,
    eligibleCohort: {
      kind: value.eligibleCohort.kind,
      minimumParticipants: value.eligibleCohort.minimumParticipants,
      maximumParticipants: value.eligibleCohort.maximumParticipants,
    },
    artifacts,
  };
}
