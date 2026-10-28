import {
  SAFETY_ESCALATION_INPUT_SCHEMA_VERSION,
  createSafetyArtifactVersion,
  type BlockedTrainingCapability,
  type SafetyEmergencySignal,
  type SafetyEscalationAction,
  type SafetyEscalationInputV1,
  type SafetyEscalationOutcomeV1,
  type SafetyEscalationResultKind,
  type SafetyEscalationRulesV1,
  type SafetyReportState,
} from "../domain/safety/safetyEscalation";

const expectedInputFields = [
  "schemaVersion",
  "artifactVersion",
  "reportState",
  "emergencySignals",
  "otherConcerningOrPersistentSymptoms",
] as const;

interface DraftSafetyPacket {
  readonly artifactVersion: string;
  readonly status: string;
  readonly runtimeUseAllowed: boolean;
  readonly inputContract: {
    readonly allowedFields: readonly string[];
    readonly freeTextAllowed: boolean;
    readonly persistenceAllowed: boolean;
  };
  readonly outcomes: readonly {
    readonly kind: SafetyEscalationResultKind;
    readonly action: SafetyEscalationAction;
    readonly reasonCode: string;
    readonly message: string;
    readonly limitations: readonly string[];
    readonly blockedTrainingCapabilities: readonly BlockedTrainingCapability[];
    readonly preservedCapabilities: readonly ["view_training_history"];
  }[];
}

export interface DraftSafetyFixture {
  readonly id: string;
  readonly description: string;
  readonly scenarioContext: string;
  readonly input: {
    readonly schemaVersion: typeof SAFETY_ESCALATION_INPUT_SCHEMA_VERSION;
    readonly artifactVersion: string;
    readonly reportState: SafetyReportState;
    readonly emergencySignals: readonly SafetyEmergencySignal[];
    readonly otherConcerningOrPersistentSymptoms: boolean;
  };
  readonly expected: {
    readonly kind: SafetyEscalationResultKind;
    readonly action: SafetyEscalationAction;
    readonly reasonCode: string;
  };
}

interface DraftSafetyFixturesPacket {
  readonly artifactVersion: string;
  readonly status: string;
  readonly cases: readonly DraftSafetyFixture[];
}

export interface InternalSafetyEscalationPacket {
  readonly artifactVersion: string;
  readonly artifactStatus: "draft_not_approved";
  readonly rules: SafetyEscalationRulesV1;
  readonly cases: readonly DraftSafetyFixture[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyExpectedInputFields(input: object): boolean {
  const actualFields = Object.keys(input).sort();
  const allowedFields = [...expectedInputFields].sort();
  return (
    actualFields.length === allowedFields.length &&
    actualFields.every((field, index) => field === allowedFields[index])
  );
}

function parseRules(rawRules: string): DraftSafetyPacket {
  const parsed: unknown = JSON.parse(rawRules);
  if (
    !isRecord(parsed) ||
    parsed.status !== "draft_not_approved" ||
    parsed.runtimeUseAllowed !== false
  ) {
    throw new Error(
      "The internal safety rehearsal accepts only a runtime-ineligible draft packet.",
    );
  }

  const packet = parsed as unknown as DraftSafetyPacket;
  if (
    packet.inputContract.freeTextAllowed ||
    packet.inputContract.persistenceAllowed ||
    [...packet.inputContract.allowedFields].sort().join("|") !==
      [...expectedInputFields].sort().join("|")
  ) {
    throw new Error(
      "The internal safety packet must preserve the enumerated, non-persistent input boundary.",
    );
  }
  return packet;
}

function parseFixtures(rawFixtures: string): DraftSafetyFixturesPacket {
  const parsed: unknown = JSON.parse(rawFixtures);
  if (!isRecord(parsed) || parsed.status !== "draft_not_approved") {
    throw new Error(
      "The internal safety rehearsal accepts only draft fixtures.",
    );
  }

  const packet = parsed as unknown as DraftSafetyFixturesPacket;
  if (packet.cases.some(({ input }) => !hasOnlyExpectedInputFields(input))) {
    throw new Error(
      "Safety fixtures may contain only the five enumerated input fields.",
    );
  }
  return packet;
}

export function createInternalSafetyEscalationPacket(
  rawRules: string,
  rawFixtures: string,
): InternalSafetyEscalationPacket {
  const packet = parseRules(rawRules);
  const fixtures = parseFixtures(rawFixtures);
  if (fixtures.artifactVersion !== packet.artifactVersion) {
    throw new Error(
      "The internal safety rules and fixtures must use the same artifact version.",
    );
  }

  const outcomes = Object.fromEntries(
    packet.outcomes.map((outcome) => [outcome.kind, outcome]),
  ) as Partial<
    Record<SafetyEscalationResultKind, SafetyEscalationOutcomeV1>
  >;
  const requiredKinds: readonly SafetyEscalationResultKind[] = [
    "no_escalation",
    "emergency",
    "qualified_help",
    "insufficient_information",
  ];
  if (requiredKinds.some((kind) => outcomes[kind] === undefined)) {
    throw new Error("The internal safety packet must define every outcome.");
  }

  return {
    artifactVersion: packet.artifactVersion,
    artifactStatus: "draft_not_approved",
    rules: {
      artifactVersion: createSafetyArtifactVersion(packet.artifactVersion),
      outcomes: outcomes as Record<
        SafetyEscalationResultKind,
        SafetyEscalationOutcomeV1
      >,
    },
    cases: fixtures.cases,
  };
}

export function createSafetyInputFromFixture(
  fixture: DraftSafetyFixture,
): SafetyEscalationInputV1 {
  return {
    ...fixture.input,
    artifactVersion: createSafetyArtifactVersion(
      fixture.input.artifactVersion,
    ),
  };
}
