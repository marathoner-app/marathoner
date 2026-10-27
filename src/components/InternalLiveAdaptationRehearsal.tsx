import { useRef, useState, type FormEvent } from "react";
import {
  evaluateAdaptation,
  type AdaptationEvaluationResultV1,
  type AdaptationHistoryEvidenceV1,
  type AdaptationOutcomeRuleV1,
  type AdaptationRescheduleCandidateV1,
  type AdaptationWeekKind,
  type RunPurpose,
} from "../domain/training";
import InternalAdaptationDecisionRehearsal from "./InternalAdaptationDecisionRehearsal";
import type {
  DraftAdaptationOutcomeDetail,
  InternalAdaptationScenarioPacket,
} from "./internalAdaptationScenarioPacket";
import { inputForInternalLiveAdaptation } from "./internalLiveAdaptationEvaluation";

interface InternalLiveAdaptationRehearsalProps {
  readonly evidence: AdaptationHistoryEvidenceV1;
  readonly packet: InternalAdaptationScenarioPacket;
}

type BooleanChoice = "" | "yes" | "no";
type CandidateChoice = "" | "none" | "present";

type LiveEvaluationOutcome =
  | { readonly kind: "not_run" }
  | {
      readonly kind: "evaluated";
      readonly result: AdaptationEvaluationResultV1;
      readonly outcomeRule: AdaptationOutcomeRuleV1 | null;
      readonly outcomeDetail: DraftAdaptationOutcomeDetail | null;
      readonly evaluationId: number;
    };

const weekKinds: readonly AdaptationWeekKind[] = [
  "load",
  "cutback",
  "peak",
  "taper",
  "race",
];

function readableIdentifier(value: string): string {
  const words = value.replace(/[-_]/gu, " ");
  return `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}`;
}

function booleanFromChoice(value: Exclude<BooleanChoice, "">): boolean {
  return value === "yes";
}

export default function InternalLiveAdaptationRehearsal({
  evidence,
  packet,
}: InternalLiveAdaptationRehearsalProps) {
  const [currentCoreWeek, setCurrentCoreWeek] = useState("");
  const [currentWeekKind, setCurrentWeekKind] = useState<
    AdaptationWeekKind | ""
  >("");
  const [nextWeekKind, setNextWeekKind] = useState<AdaptationWeekKind | "">(
    "",
  );
  const [nextWeekIntroducesProgression, setNextWeekIntroducesProgression] =
    useState<BooleanChoice>("");
  const [candidateChoice, setCandidateChoice] =
    useState<CandidateChoice>("");
  const [candidatePurpose, setCandidatePurpose] = useState<RunPurpose | "">(
    "",
  );
  const [candidateDelayDays, setCandidateDelayDays] = useState("");
  const [candidateSamePlanWeek, setCandidateSamePlanWeek] =
    useState<BooleanChoice>("");
  const [candidateRunnerAvailable, setCandidateRunnerAvailable] =
    useState<BooleanChoice>("");
  const [candidateTargetDateEmpty, setCandidateTargetDateEmpty] =
    useState<BooleanChoice>("");
  const [candidateConsecutiveRuns, setCandidateConsecutiveRuns] = useState("");
  const [completenessConfirmed, setCompletenessConfirmed] = useState(false);
  const [outcome, setOutcome] = useState<LiveEvaluationOutcome>({
    kind: "not_run",
  });
  const evaluationSequence = useRef(0);

  const clearOutcome = () => setOutcome({ kind: "not_run" });
  const candidateIsComplete =
    candidateChoice === "none" ||
    (candidateChoice === "present" &&
      candidatePurpose !== "" &&
      candidateDelayDays !== "" &&
      candidateSamePlanWeek !== "" &&
      candidateRunnerAvailable !== "" &&
      candidateTargetDateEmpty !== "" &&
      candidateConsecutiveRuns !== "");
  const formIsComplete =
    currentCoreWeek !== "" &&
    currentWeekKind !== "" &&
    nextWeekKind !== "" &&
    nextWeekIntroducesProgression !== "" &&
    candidateChoice !== "" &&
    candidateIsComplete &&
    completenessConfirmed;

  const candidateForEvaluation = (): AdaptationRescheduleCandidateV1 => {
    if (candidateChoice !== "present") {
      return {
        present: false,
        workoutPurpose: null,
        delayCalendarDays: null,
        samePlanWeek: false,
        runnerConfirmedAvailable: false,
        targetDateEmpty: false,
        consecutiveRunDatesAfterMove: 0,
      };
    }

    return {
      present: true,
      workoutPurpose: candidatePurpose as RunPurpose,
      delayCalendarDays: Number(candidateDelayDays),
      samePlanWeek: booleanFromChoice(
        candidateSamePlanWeek as Exclude<BooleanChoice, "">,
      ),
      runnerConfirmedAvailable: booleanFromChoice(
        candidateRunnerAvailable as Exclude<BooleanChoice, "">,
      ),
      targetDateEmpty: booleanFromChoice(
        candidateTargetDateEmpty as Exclude<BooleanChoice, "">,
      ),
      consecutiveRunDatesAfterMove: Number(candidateConsecutiveRuns),
    };
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formIsComplete) return;

    const input = inputForInternalLiveAdaptation(evidence, packet, {
      currentCoreWeek: Number(currentCoreWeek),
      currentWeekKind,
      nextWeekKind,
      nextWeekIntroducesProgression: booleanFromChoice(
        nextWeekIntroducesProgression,
      ),
      rescheduleCandidate: candidateForEvaluation(),
      inputCompletenessConfirmed: completenessConfirmed,
    });
    const result = evaluateAdaptation({
      input,
      evaluatorVersion: packet.evaluatorVersion,
      rules: packet.rules,
    });
    const outcomeRule =
      result.kind === "invalid_input"
        ? null
        : (packet.rules.outcomes.find(
            ({ reasonCode }) => reasonCode === result.reasonCode,
          ) ?? null);
    const outcomeDetail =
      result.kind === "invalid_input"
        ? null
        : (packet.outcomeDetails.find(
            ({ reasonCode }) => reasonCode === result.reasonCode,
          ) ?? null);
    evaluationSequence.current += 1;
    setOutcome({
      kind: "evaluated",
      result,
      outcomeRule,
      outcomeDetail,
      evaluationId: evaluationSequence.current,
    });
  };

  return (
    <section
      className="internal-live-adaptation-evaluation"
      aria-labelledby="internal-live-adaptation-evaluation-title"
    >
      <header>
        <p className="internal-adaptation-history-eyebrow">
          Unapproved owner-only rehearsal
        </p>
        <h3 id="internal-live-adaptation-evaluation-title">
          Evaluate live draft evidence
        </h3>
        <p>
          Add the facts that saved history cannot determine, then deliberately
          run the exact pinned draft evaluator. This cannot save a
          recommendation or change a real plan.
        </p>
      </header>

      <dl className="internal-live-adaptation-artifacts">
        <div>
          <dt>Base-plan artifact</dt>
          <dd>{packet.rules.basePlanArtifactVersion}</dd>
        </div>
        <div>
          <dt>Adaptation artifact</dt>
          <dd>{packet.rules.adaptationArtifactVersion}</dd>
        </div>
      </dl>

      <form onSubmit={handleSubmit}>
        <label htmlFor="live-adaptation-core-week">Current core week</label>
        <input
          id="live-adaptation-core-week"
          type="number"
          min="1"
          step="1"
          required
          value={currentCoreWeek}
          onChange={(event) => {
            setCurrentCoreWeek(event.target.value);
            clearOutcome();
          }}
        />

        <label htmlFor="live-adaptation-current-week-kind">
          Current week kind
        </label>
        <select
          id="live-adaptation-current-week-kind"
          required
          value={currentWeekKind}
          onChange={(event) => {
            setCurrentWeekKind(event.target.value as AdaptationWeekKind | "");
            clearOutcome();
          }}
        >
          <option value="">Choose the current week kind</option>
          {weekKinds.map((kind) => (
            <option key={kind} value={kind}>
              {readableIdentifier(kind)}
            </option>
          ))}
        </select>

        <label htmlFor="live-adaptation-next-week-kind">Next week kind</label>
        <select
          id="live-adaptation-next-week-kind"
          required
          value={nextWeekKind}
          onChange={(event) => {
            setNextWeekKind(event.target.value as AdaptationWeekKind | "");
            clearOutcome();
          }}
        >
          <option value="">Choose the next week kind</option>
          {weekKinds.map((kind) => (
            <option key={kind} value={kind}>
              {readableIdentifier(kind)}
            </option>
          ))}
        </select>

        <label htmlFor="live-adaptation-progression">
          Does the next week introduce progression?
        </label>
        <select
          id="live-adaptation-progression"
          required
          value={nextWeekIntroducesProgression}
          onChange={(event) => {
            setNextWeekIntroducesProgression(
              event.target.value as BooleanChoice,
            );
            clearOutcome();
          }}
        >
          <option value="">Choose yes or no</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>

        <fieldset>
          <legend>Prevalidated reschedule candidate</legend>
          <label htmlFor="live-adaptation-candidate-choice">
            Candidate state
          </label>
          <select
            id="live-adaptation-candidate-choice"
            required
            value={candidateChoice}
            onChange={(event) => {
              setCandidateChoice(event.target.value as CandidateChoice);
              clearOutcome();
            }}
          >
            <option value="">Choose a candidate state</option>
            <option value="none">No candidate is available</option>
            <option value="present">A candidate has been prevalidated</option>
          </select>

          {candidateChoice === "present" && (
            <div className="internal-live-adaptation-candidate">
              <label htmlFor="live-adaptation-candidate-purpose">
                Workout purpose
              </label>
              <select
                id="live-adaptation-candidate-purpose"
                required
                value={candidatePurpose}
                onChange={(event) => {
                  setCandidatePurpose(event.target.value as RunPurpose | "");
                  clearOutcome();
                }}
              >
                <option value="">Choose a purpose</option>
                {packet.rules.allowedReschedulePurposes.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {readableIdentifier(purpose)}
                  </option>
                ))}
              </select>

              <label htmlFor="live-adaptation-candidate-delay">
                Delay in calendar days
              </label>
              <input
                id="live-adaptation-candidate-delay"
                type="number"
                min="0"
                step="1"
                required
                value={candidateDelayDays}
                onChange={(event) => {
                  setCandidateDelayDays(event.target.value);
                  clearOutcome();
                }}
              />

              <BooleanSelect
                id="live-adaptation-candidate-same-week"
                label="Candidate remains in the same plan week"
                value={candidateSamePlanWeek}
                onChange={(value) => {
                  setCandidateSamePlanWeek(value);
                  clearOutcome();
                }}
              />
              <BooleanSelect
                id="live-adaptation-candidate-available"
                label="Runner confirmed the candidate date is available"
                value={candidateRunnerAvailable}
                onChange={(value) => {
                  setCandidateRunnerAvailable(value);
                  clearOutcome();
                }}
              />
              <BooleanSelect
                id="live-adaptation-candidate-empty"
                label="Candidate date has no other workout"
                value={candidateTargetDateEmpty}
                onChange={(value) => {
                  setCandidateTargetDateEmpty(value);
                  clearOutcome();
                }}
              />

              <label htmlFor="live-adaptation-candidate-consecutive">
                Consecutive run dates after the move
              </label>
              <input
                id="live-adaptation-candidate-consecutive"
                type="number"
                min="0"
                step="1"
                required
                value={candidateConsecutiveRuns}
                onChange={(event) => {
                  setCandidateConsecutiveRuns(event.target.value);
                  clearOutcome();
                }}
              />
            </div>
          )}
        </fieldset>

        <label className="internal-live-adaptation-confirmation">
          <input
            type="checkbox"
            checked={completenessConfirmed}
            onChange={(event) => {
              setCompletenessConfirmed(event.target.checked);
              clearOutcome();
            }}
          />
          I inspected the live history above and confirm that these supplied
          facts are complete for this internal draft evaluation.
        </label>

        <button type="submit" disabled={!formIsComplete}>
          Evaluate live draft evidence
        </button>
      </form>

      {outcome.kind === "evaluated" && (
        <div className="internal-live-adaptation-result">
          {outcome.result.kind === "invalid_input" ? (
            <div role="alert">
              <h4>Draft evaluator rejected this assembled input</h4>
              <ul>
                {outcome.result.issues.map((issue) => (
                  <li key={`${issue.field}-${issue.code}`}>
                    {issue.field}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <h4>Internal draft result</h4>
              <dl>
                <div>
                  <dt>Decision</dt>
                  <dd>
                    {outcome.outcomeRule === null
                      ? "Missing outcome rule"
                      : readableIdentifier(outcome.outcomeRule.decision)}
                  </dd>
                </div>
                <div>
                  <dt>Result kind</dt>
                  <dd>{readableIdentifier(outcome.result.kind)}</dd>
                </div>
                <div>
                  <dt>Action</dt>
                  <dd>
                    {outcome.result.action === null
                      ? "None"
                      : readableIdentifier(outcome.result.action)}
                  </dd>
                </div>
                <div>
                  <dt>Reason code</dt>
                  <dd>{outcome.result.reasonCode}</dd>
                </div>
                <div>
                  <dt>Explanation key</dt>
                  <dd>{outcome.result.explanationKey}</dd>
                </div>
                <div>
                  <dt>Runner approval required</dt>
                  <dd>
                    {outcome.result.runnerApprovalRequired ? "Yes" : "No"}
                  </dd>
                </div>
                <div>
                  <dt>Evaluator</dt>
                  <dd>{outcome.result.provenance.evaluatorVersion}</dd>
                </div>
                <div>
                  <dt>Base-plan artifact</dt>
                  <dd>{outcome.result.provenance.basePlanArtifactVersion}</dd>
                </div>
                <div>
                  <dt>Adaptation artifact</dt>
                  <dd>{outcome.result.provenance.adaptationArtifactVersion}</dd>
                </div>
              </dl>
            </>
          )}

          <p className="internal-adaptation-history-boundary">
            Unapproved session-only result. No recommendation was saved and no
            real plan changed.
          </p>

          {outcome.result.kind === "recommendation" &&
            outcome.result.runnerApprovalRequired &&
            outcome.outcomeDetail !== null && (
              <InternalAdaptationDecisionRehearsal
                key={outcome.evaluationId}
                result={outcome.result}
                outcomeDetail={outcome.outcomeDetail}
                sourceDescription={`The synchronized owner evidence matched ${outcome.result.reasonCode} in the draft evaluator.`}
              />
            )}
        </div>
      )}
    </section>
  );
}

interface BooleanSelectProps {
  readonly id: string;
  readonly label: string;
  readonly value: BooleanChoice;
  readonly onChange: (value: BooleanChoice) => void;
}

function BooleanSelect({ id, label, value, onChange }: BooleanSelectProps) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        required
        value={value}
        onChange={(event) => onChange(event.target.value as BooleanChoice)}
      >
        <option value="">Choose yes or no</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </>
  );
}
