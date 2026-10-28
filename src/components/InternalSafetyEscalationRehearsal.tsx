import { useState } from "react";

import { evaluateSafetyEscalation } from "../domain/safety/safetyEscalation";
import {
  createSafetyInputFromFixture,
  type InternalSafetyEscalationPacket,
} from "./internalSafetyEscalationPacket";
import "./InternalSafetyEscalationRehearsal.css";

const resultLabels = {
  no_escalation: "No escalation reported",
  emergency: "Stop and call emergency services",
  qualified_help: "Stop and seek qualified help",
  insufficient_information: "Training recommendation withheld",
} as const;

const capabilityLabels = {
  generate_plan: "Generate a new training plan",
  adapt_plan: "Recommend or apply a plan adaptation",
  present_training_guidance: "Present new training guidance",
} as const;

const signalLabels = {
  chest_pressure_or_pain: "Chest pressure or pain",
  severe_or_sudden_breathing_trouble:
    "Severe or sudden trouble breathing",
  fainting_or_loss_of_consciousness: "Fainting or loss of consciousness",
  new_confusion_or_slurred_speech: "New confusion or slurred speech",
  stroke_warning_sign: "Face drooping, arm weakness, or speech difficulty",
  heat_illness_emergency_sign: "Emergency heat-illness warning sign",
} as const;

interface InternalSafetyEscalationRehearsalProps {
  readonly packet: InternalSafetyEscalationPacket;
}

export default function InternalSafetyEscalationRehearsal({
  packet,
}: InternalSafetyEscalationRehearsalProps) {
  const [selectedFixtureId, setSelectedFixtureId] = useState(
    packet.cases[0]?.id ?? "",
  );
  const fixture =
    packet.cases.find(({ id }) => id === selectedFixtureId) ?? packet.cases[0];
  if (fixture === undefined) return null;

  const result = evaluateSafetyEscalation(
    createSafetyInputFromFixture(fixture),
    packet.rules,
  );
  const matchesFixture =
    result.kind === fixture.expected.kind &&
    result.action === fixture.expected.action &&
    result.reasonCode === fixture.expected.reasonCode;

  return (
    <section
      className="internal-safety-rehearsal"
      aria-labelledby="internal-safety-rehearsal-title"
    >
      <header>
        <p className="internal-safety-rehearsal-eyebrow">
          Owner-only rehearsal · internal unreviewed draft
        </p>
        <h2 id="internal-safety-rehearsal-title">
          Pain and unusual-symptom escalation
        </h2>
        <p>
          Exercise the exact {packet.artifactVersion} fixture outcomes. This
          draft is not medical advice, is not approved, stores nothing, and is
          unavailable to runners.
        </p>
      </header>

      <label htmlFor="internal-safety-fixture">Safety fixture</label>
      <select
        id="internal-safety-fixture"
        value={fixture.id}
        onChange={(event) => setSelectedFixtureId(event.currentTarget.value)}
      >
        {packet.cases.map(({ id, description }) => (
          <option key={id} value={id}>
            {description}
          </option>
        ))}
      </select>

      <article
        className={`internal-safety-result internal-safety-result--${result.kind}`}
        aria-labelledby="internal-safety-result-title"
      >
        <p className="internal-safety-result-status">
          Draft result · {packet.artifactStatus.replace(/_/g, " ")}
        </p>
        <h3 id="internal-safety-result-title">{resultLabels[result.kind]}</h3>
        <p className="internal-safety-result-message">{result.message}</p>

        <dl>
          <div>
            <dt>Reason code</dt>
            <dd>{result.reasonCode}</dd>
          </div>
          <div>
            <dt>Scenario context</dt>
            <dd>{fixture.scenarioContext.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt>Fixture check</dt>
            <dd>{matchesFixture ? "Matches frozen expectation" : "Mismatch"}</dd>
          </div>
        </dl>

        <h4>Selected emergency signals</h4>
        {fixture.input.emergencySignals.length === 0 ? (
          <p>None selected.</p>
        ) : (
          <ul>
            {fixture.input.emergencySignals.map((signal) => (
              <li key={signal}>{signalLabels[signal]}</li>
            ))}
          </ul>
        )}

        <h4>Blocked training capabilities</h4>
        {result.blockedTrainingCapabilities.length === 0 ? (
          <p>None added by this safety check.</p>
        ) : (
          <ul>
            {result.blockedTrainingCapabilities.map((capability) => (
              <li key={capability}>{capabilityLabels[capability]}</li>
            ))}
          </ul>
        )}
        <p>
          <strong>Still available:</strong> View existing training history.
        </p>

        <h4>Draft limitations</h4>
        <ul>
          {result.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
