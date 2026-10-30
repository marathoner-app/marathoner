import draftFixturesText from "../docs/methodology/artifacts/beta-adaptation/0.2.0-draft/fixtures.json?raw";
import draftRulesText from "../docs/methodology/artifacts/beta-adaptation/0.2.0-draft/beta-adaptation.json?raw";
import {
  createInternalAdaptationScenarioPacket,
  inputForInternalAdaptationScenario,
  valuesForInternalAdaptationScenario,
  type DraftAdaptationFixture,
  type DraftAdaptationFixtureValues,
} from "../src/components/internalAdaptationScenarioPacket";

const packet = createInternalAdaptationScenarioPacket(
  draftRulesText,
  draftFixturesText,
);

export const adaptationRules = packet.rules;
export const draftAdaptationFixtures = {
  artifactVersion: packet.artifactVersion,
  defaults: packet.defaults,
  cases: packet.cases,
};

export function fixtureValues(
  fixture: DraftAdaptationFixture,
): DraftAdaptationFixtureValues {
  return valuesForInternalAdaptationScenario(packet, fixture);
}

export const adaptationInput = inputForInternalAdaptationScenario;
