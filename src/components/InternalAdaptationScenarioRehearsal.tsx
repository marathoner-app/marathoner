import { useState, type FormEvent } from "react";
import {
  evaluateAdaptation,
  type AdaptationEvaluationInputV1,
  type AdaptationEvaluationResultV1,
  type AdaptationOutcomeRuleV1,
} from "../domain/training";
import {
  inputForInternalAdaptationScenario,
  valuesForInternalAdaptationScenario,
  type DraftAdaptationFixture,
  type InternalAdaptationScenarioPacket,
} from "./internalAdaptationScenarioPacket";
import "./InternalAdaptationScenarioRehearsal.css";

interface InternalAdaptationScenarioRehearsalProps {
  readonly packet: InternalAdaptationScenarioPacket;
}

type RehearsalOutcome =
  | { readonly kind: "not_run" }
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "evaluated";
      readonly fixture: DraftAdaptationFixture;
      readonly input: AdaptationEvaluationInputV1;
      readonly result: AdaptationEvaluationResultV1;
      readonly outcomeRule: AdaptationOutcomeRuleV1 | null;
      readonly matchesExpected: boolean;
    };

function readableIdentifier(value: string): string {
  const words = value.replace(/[-_]/gu, " ");
  return `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}`;
}

function resultMatchesExpected(
  result: AdaptationEvaluationResultV1,
  fixture: DraftAdaptationFixture,
): boolean {
  if (result.kind === "invalid_input") return false;
  return (
    result.kind === fixture.expected.kind &&
    result.action === fixture.expected.action &&
    result.reasonCode === fixture.expected.reasonCode &&
    result.runnerApprovalRequired === fixture.expected.runnerApprovalRequired
  );
}

export default function InternalAdaptationScenarioRehearsal({
  packet,
}: InternalAdaptationScenarioRehearsalProps) {
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [outcome, setOutcome] = useState<RehearsalOutcome>({
    kind: "not_run",
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fixture = packet.cases.find(
      (candidate) => candidate.id === selectedFixtureId,
    );
    if (fixture === undefined) {
      setOutcome({
        kind: "error",
        message: "Choose one frozen scenario before evaluating it.",
      });
      return;
    }

    const input = inputForInternalAdaptationScenario(
      valuesForInternalAdaptationScenario(packet, fixture),
    );
    const result = evaluateAdaptation({
      input,
      evaluatorVersion: packet.evaluatorVersion,
      rules: packet.rules,
    });
    const outcomeRule =
      result.kind === "invalid_input"
        ? null
        : (packet.rules.outcomes.find(
            (candidate) => candidate.reasonCode === result.reasonCode,
          ) ?? null);

    setOutcome({
      kind: "evaluated",
      fixture,
      input,
      result,
      outcomeRule,
      matchesExpected: resultMatchesExpected(result, fixture),
    });
  };

  return (
    <section
      className="internal-adaptation-rehearsal"
      aria-labelledby="internal-adaptation-rehearsal-title"
    >
      <header>
        <p className="internal-adaptation-rehearsal-eyebrow">
          Owner-only local tool
        </p>
        <h2 id="internal-adaptation-rehearsal-title">
          Internal draft adaptation rehearsal
        </h2>
        <p>
          Inspect synthetic, frozen scenarios against the production evaluator.
          This is not training guidance, does not read live runs, and cannot
          change a plan.
        </p>
      </header>

      <form onSubmit={handleSubmit}>
        <label htmlFor="internal-adaptation-scenario">
          Frozen draft scenario
        </label>
        <select
          id="internal-adaptation-scenario"
          value={selectedFixtureId}
          onChange={(event) => {
            setSelectedFixtureId(event.target.value);
            setOutcome({ kind: "not_run" });
          }}
        >
          <option value="">Choose a scenario</option>
          {packet.cases.map((fixture) => (
            <option key={fixture.id} value={fixture.id}>
              {readableIdentifier(fixture.id)}
            </option>
          ))}
        </select>
        <button type="submit" disabled={selectedFixtureId === ""}>
          Evaluate read-only scenario
        </button>
      </form>

      {outcome.kind === "error" && (
        <p className="internal-adaptation-rehearsal-error" role="alert">
          {outcome.message}
        </p>
      )}

      {outcome.kind === "evaluated" && (
        <div className="internal-adaptation-rehearsal-result">
          <p
            className={
              outcome.matchesExpected
                ? "internal-adaptation-rehearsal-match"
                : "internal-adaptation-rehearsal-mismatch"
            }
            role={outcome.matchesExpected ? "status" : "alert"}
          >
            {outcome.matchesExpected
              ? "Evaluator result matches the frozen expected outcome."
              : "Evaluator result does not match the frozen expected outcome. Stop and investigate before using this draft."}
          </p>

          {outcome.result.kind === "invalid_input" ? (
            <div role="alert">
              <h3>Evaluator rejected the normalized evidence</h3>
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
              <h3>{readableIdentifier(outcome.fixture.id)}</h3>
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
                  <dt>Base plan artifact</dt>
                  <dd>{outcome.result.provenance.basePlanArtifactVersion}</dd>
                </div>
                <div>
                  <dt>Adaptation artifact</dt>
                  <dd>{outcome.result.provenance.adaptationArtifactVersion}</dd>
                </div>
              </dl>
            </>
          )}

          <details>
            <summary>Inspect normalized synthetic evidence</summary>
            <pre>{JSON.stringify(outcome.input, null, 2)}</pre>
          </details>
          <p className="internal-adaptation-rehearsal-boundary">
            Read-only internal result. No recommendation record or plan change
            was created.
          </p>
        </div>
      )}
    </section>
  );
}
