import { describe, expect, it, vi } from "vitest";

import {
  ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
  ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
  createAdaptationArtifactVersion,
  createAdaptationExplanationKey,
  createAdaptationReasonCode,
} from "../../domain/training/adaptationEvaluation";
import { createUtcDateTime } from "../../domain/training/dates";
import {
  createTrainingPlanId,
  createUserId,
} from "../../domain/training/identifiers";
import {
  RECOMMENDATION_EVIDENCE_SCHEMA_VERSION,
  createRecommendationId,
  type RecommendationDecision,
  type RecommendationEvidenceV2,
} from "../../domain/recommendations/recommendationEvidence";
import {
  createFirestoreRecommendationEvidenceLiveReadSourceWithBackend,
  type FirestoreRecommendationEvidenceListenerBackend,
  type RecommendationEvidenceCollectionSnapshot,
  type RecommendationEvidenceLiveReadEvent,
} from "./firestoreRecommendationEvidenceLiveReadSource";
import { recommendationEvidenceCollectionPath } from "./paths";

interface CollectionRegistration {
  readonly path: string;
  readonly onSnapshot: (
    snapshot: RecommendationEvidenceCollectionSnapshot,
  ) => void;
  readonly onError: (error: unknown) => void;
  readonly unsubscribe: ReturnType<typeof vi.fn>;
}

class FakeListenerBackend
  implements FirestoreRecommendationEvidenceListenerBackend
{
  readonly collections: CollectionRegistration[] = [];

  subscribeCollection(
    path: string,
    onSnapshot: (
      snapshot: RecommendationEvidenceCollectionSnapshot,
    ) => void,
    onError: (error: unknown) => void,
  ) {
    const registration = {
      path,
      onSnapshot,
      onError,
      unsubscribe: vi.fn(),
    };
    this.collections.push(registration);
    return registration.unsubscribe;
  }
}

const ownerId = createUserId("owner-1");
const serverMetadata = { fromCache: false, hasPendingWrites: false };

function recommendationEvidence(
  recommendationId: string,
  recommendedAt: string,
  decision: RecommendationDecision = "pending",
): RecommendationEvidenceV2 {
  const decided = decision !== "pending";

  return {
    schemaVersion: RECOMMENDATION_EVIDENCE_SCHEMA_VERSION,
    recommendationId: createRecommendationId(recommendationId),
    evaluatedPlanId: createTrainingPlanId("plan-0001"),
    evaluationInput: {
      schemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
      basePlanArtifactVersion: "beta-rules@0.2.0-draft",
      adaptationArtifactVersion: "beta-adaptation@0.2.0-draft",
      activePlanStatus: "active",
      activePlanRevision: 3,
      evaluatedPlanRevision: 3,
      safetyGateState: "none_reported",
      inputCompletenessConfirmed: true,
      triggerKind: "planned_run_completed",
      currentCoreWeek: 4,
      currentWeekKind: "load",
      nextWeekKind: "load",
      nextWeekIntroducesProgression: true,
      daysUntilRace: 100,
      currentWeek: {
        plannedRunCount: 4,
        completedRunCount: 4,
        skippedRunCount: 0,
        pendingRunCount: 0,
      },
      daysSinceLastCompletedPlannedRun: 1,
      recentEfforts: [
        "harder_than_expected",
        "harder_than_expected",
        "about_right",
      ],
      rescheduleCandidate: {
        present: false,
        workoutPurpose: null,
        delayCalendarDays: null,
        samePlanWeek: false,
        runnerConfirmedAvailable: false,
        targetDateEmpty: false,
        consecutiveRunDatesAfterMove: 0,
      },
    },
    evaluationResult: {
      schemaVersion: ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
      kind: "recommendation",
      action: "hold_progression",
      reasonCode: createAdaptationReasonCode(
        "ADAPT-HOLD-REPEATED-HARD-EFFORT",
      ),
      explanationKey: createAdaptationExplanationKey(
        "adaptation.hold.repeated_hard_effort",
      ),
      runnerApprovalRequired: true,
      provenance: {
        inputSchemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
        evaluatorVersion: createAdaptationArtifactVersion(
          "adaptation-evaluator@0.1.0-draft",
        ),
        basePlanArtifactVersion: createAdaptationArtifactVersion(
          "beta-rules@0.2.0-draft",
        ),
        adaptationArtifactVersion: createAdaptationArtifactVersion(
          "beta-adaptation@0.2.0-draft",
        ),
      },
    },
    planAdjustment: {
      action: "hold_progression",
      sourceWeekNumber: 4,
      targetWeekNumber: 5,
    },
    decision,
    recommendedAt: createUtcDateTime(recommendedAt),
    decidedAt: decided
      ? createUtcDateTime("2026-10-27T18:05:00.000Z")
      : null,
    resultingPlanRevision: decision === "accepted" ? 4 : null,
  };
}

function evidenceDocument(evidence: RecommendationEvidenceV2) {
  return {
    id: evidence.recommendationId,
    data: evidence as unknown as Record<string, unknown>,
  };
}

function createHarness() {
  const backend = new FakeListenerBackend();
  const events: RecommendationEvidenceLiveReadEvent[] = [];
  const source = createFirestoreRecommendationEvidenceLiveReadSourceWithBackend({
    backend,
    ownerId,
  });
  const unsubscribe = source.subscribe((event) => events.push(event));
  const registration = backend.collections[0];

  if (registration === undefined) {
    throw new Error("The evidence listener was not registered.");
  }

  return { backend, events, registration, unsubscribe };
}

describe("Firestore recommendation evidence live-read source", () => {
  it("subscribes only to the owner collection and publishes newest-first evidence", () => {
    const { backend, events, registration } = createHarness();
    const older = recommendationEvidence(
      "recommendation-older",
      "2026-10-26T18:00:00.000Z",
      "declined",
    );
    const newerAccepted = recommendationEvidence(
      "recommendation-newer-b",
      "2026-10-27T18:00:00.000Z",
      "accepted",
    );
    const newerPending = recommendationEvidence(
      "recommendation-newer-a",
      "2026-10-27T18:00:00.000Z",
    );

    expect(backend.collections.map(({ path }) => path)).toEqual([
      recommendationEvidenceCollectionPath(ownerId),
    ]);

    registration.onSnapshot({
      documents: [
        evidenceDocument(older),
        evidenceDocument(newerAccepted),
        evidenceDocument(newerPending),
      ],
      metadata: serverMetadata,
    });

    expect(events).toEqual([
      {
        type: "snapshot",
        ownerId,
        evidence: [newerPending, newerAccepted, older],
        origin: "server",
        hasPendingWrites: false,
      },
    ]);
  });

  it("preserves cache and pending-write metadata", () => {
    const { events, registration } = createHarness();

    registration.onSnapshot({
      documents: [],
      metadata: { fromCache: true, hasPendingWrites: true },
    });

    expect(events).toEqual([
      expect.objectContaining({
        type: "snapshot",
        evidence: [],
        origin: "cache",
        hasPendingWrites: true,
      }),
    ]);
  });

  it.each([
    {
      name: "path and payload IDs do not match",
      document: {
        ...evidenceDocument(
          recommendationEvidence(
            "recommendation-valid",
            "2026-10-27T18:00:00.000Z",
          ),
        ),
        id: "recommendation-other",
      },
    },
    {
      name: "the schema contains an unknown field",
      document: {
        ...evidenceDocument(
          recommendationEvidence(
            "recommendation-valid",
            "2026-10-27T18:00:00.000Z",
          ),
        ),
        data: {
          ...recommendationEvidence(
            "recommendation-valid",
            "2026-10-27T18:00:00.000Z",
          ),
          unexpected: true,
        },
      },
    },
  ])("fails the complete snapshot closed when $name", ({ document }) => {
    const { events, registration } = createHarness();
    const valid = recommendationEvidence(
      "recommendation-another",
      "2026-10-26T18:00:00.000Z",
    );

    registration.onSnapshot({
      documents: [evidenceDocument(valid), document],
      metadata: serverMetadata,
    });

    expect(events).toEqual([
      {
        type: "error",
        ownerId,
        message: "Recommendation history could not be synchronized.",
        recoverable: true,
      },
    ]);
  });

  it("converts listener failures to a generic recoverable error", () => {
    const { events, registration } = createHarness();

    registration.onError(
      new Error("raw failure containing recommendation details"),
    );

    expect(events).toEqual([
      {
        type: "error",
        ownerId,
        message: "Recommendation history could not be synchronized.",
        recoverable: true,
      },
    ]);
  });

  it("unsubscribes once and ignores later snapshots and errors", () => {
    const { events, registration, unsubscribe } = createHarness();

    unsubscribe();
    unsubscribe();
    registration.onSnapshot({ documents: [], metadata: serverMetadata });
    registration.onError(new Error("late failure"));

    expect(registration.unsubscribe).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);
  });
});
