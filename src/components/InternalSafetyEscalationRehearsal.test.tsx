import { readFileSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { evaluateSafetyEscalation } from "../domain/safety/safetyEscalation";
import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import InternalSafetyEscalationRehearsal from "./InternalSafetyEscalationRehearsal";
import {
  createInternalSafetyEscalationPacket,
  createSafetyInputFromFixture,
} from "./internalSafetyEscalationPacket";

const artifactDirectory = path.join(
  process.cwd(),
  "docs/methodology/artifacts/beta-safety/0.1.0-draft",
);
const packet = createInternalSafetyEscalationPacket(
  readFileSync(`${artifactDirectory}/beta-safety.json`, "utf8"),
  readFileSync(`${artifactDirectory}/fixtures.json`, "utf8"),
);

describe("InternalSafetyEscalationRehearsal", () => {
  it("matches every frozen fixture with no identifying or free-text input", () => {
    for (const fixture of packet.cases) {
      expect(Object.keys(fixture.input).sort()).toEqual(
        [
          "schemaVersion",
          "artifactVersion",
          "reportState",
          "emergencySignals",
          "otherConcerningOrPersistentSymptoms",
        ].sort(),
      );
      const result = evaluateSafetyEscalation(
        createSafetyInputFromFixture(fixture),
        packet.rules,
      );
      expect({
        kind: result.kind,
        action: result.action,
        reasonCode: result.reasonCode,
      }).toEqual(fixture.expected);
    }
  });

  it("shows exact outcomes, capability blocks, and draft status", async () => {
    const user = userEvent.setup();
    render(<InternalSafetyEscalationRehearsal packet={packet} />);

    expect(
      screen.getByText(/internal unreviewed draft/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/stores nothing/i)).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Safety fixture" }),
      "chest-pressure-is-emergency",
    );

    expect(
      screen.getByRole("heading", {
        name: "Stop and call emergency services",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(packet.rules.outcomes.emergency.message),
    ).toBeInTheDocument();
    expect(screen.getByText("Generate a new training plan")).toBeInTheDocument();
    expect(screen.getByText("View existing training history.")).toBeInTheDocument();
    expect(screen.getByText("Matches frozen expectation")).toBeInTheDocument();
  });

  it("keeps race pressure and progression from weakening an escalation", async () => {
    const user = userEvent.setup();
    render(<InternalSafetyEscalationRehearsal packet={packet} />);
    const fixtureSelect = screen.getByRole("combobox", {
      name: "Safety fixture",
    });

    await user.selectOptions(
      fixtureSelect,
      "race-date-pressure-cannot-weaken-emergency",
    );
    expect(
      screen.getByRole("heading", {
        name: "Stop and call emergency services",
      }),
    ).toBeInTheDocument();

    await user.selectOptions(
      fixtureSelect,
      "unsafe-progression-cannot-weaken-stop",
    );
    expect(
      screen.getByRole("heading", { name: "Stop and seek qualified help" }),
    ).toBeInTheDocument();
  });

  it("has no beta-blocking accessibility violations", async () => {
    render(<InternalSafetyEscalationRehearsal packet={packet} />);

    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });
});
