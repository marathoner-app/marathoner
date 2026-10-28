import draftFixturesText from "../docs/methodology/artifacts/beta-adaptation/0.1.0-draft/fixtures.json?raw";
import draftRulesText from "../docs/methodology/artifacts/beta-adaptation/0.1.0-draft/beta-adaptation.json?raw";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import InternalAdaptationScenarioRehearsal from "../src/components/InternalAdaptationScenarioRehearsal";
import { createInternalAdaptationScenarioPacket } from "../src/components/internalAdaptationScenarioPacket";

const packet = createInternalAdaptationScenarioPacket(
  draftRulesText,
  draftFixturesText,
);

describe("InternalAdaptationScenarioRehearsal", () => {
  it("waits for an explicit scenario and renders a matching read-only result", async () => {
    const user = userEvent.setup();
    render(<InternalAdaptationScenarioRehearsal packet={packet} />);

    expect(
      screen.getByRole("button", { name: "Evaluate read-only scenario" }),
    ).toBeDisabled();
    expect(
      screen.queryByText(/matches the frozen expected outcome/iu),
    ).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Frozen draft scenario"),
      "hold-at-two-hard-effort-boundary",
    );
    await user.click(
      screen.getByRole("button", { name: "Evaluate read-only scenario" }),
    );

    expect(
      screen.getByText("Evaluator result matches the frozen expected outcome."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Hold progression")).toHaveLength(2);
    expect(screen.getByText("Recommendation")).toBeInTheDocument();
    expect(
      screen.getByText("ADAPT-HOLD-REPEATED-HARD-EFFORT"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("adaptation.hold.repeated_hard_effort"),
    ).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Give next week another steady pass",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "not approved training guidance",
    );
    expect(
      screen.getByRole("button", { name: "Keep in rehearsal" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Apply in rehearsal" }),
    ).toBeEnabled();
    expect(
      screen.getByText(/no recommendation record or plan change was created/iu),
    ).toBeInTheDocument();
  });

  it("records and resets only an in-memory recommendation choice", async () => {
    const user = userEvent.setup();
    render(<InternalAdaptationScenarioRehearsal packet={packet} />);

    await user.selectOptions(
      screen.getByLabelText("Frozen draft scenario"),
      "hold-at-two-hard-effort-boundary",
    );
    await user.click(
      screen.getByRole("button", { name: "Evaluate read-only scenario" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Apply in rehearsal" }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Session choice recorded: Apply draft change",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no real plan changed/iu),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Apply in rehearsal" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Evaluate read-only scenario" }),
    );

    expect(
      screen.queryByRole("heading", {
        name: "Session choice recorded: Apply draft change",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply in rehearsal" }),
    ).toBeEnabled();

    await user.selectOptions(
      screen.getByLabelText("Frozen draft scenario"),
      "no-change-on-track",
    );

    expect(
      screen.queryByRole("button", { name: "Apply in rehearsal" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer decisions for matching no-change outcomes", async () => {
    const user = userEvent.setup();
    render(<InternalAdaptationScenarioRehearsal packet={packet} />);

    await user.selectOptions(
      screen.getByLabelText("Frozen draft scenario"),
      "no-change-on-track",
    );
    await user.click(
      screen.getByRole("button", { name: "Evaluate read-only scenario" }),
    );

    expect(screen.getAllByText("No change")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Keep in rehearsal" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Apply in rehearsal" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer decisions for matching refused outcomes", async () => {
    const user = userEvent.setup();
    render(<InternalAdaptationScenarioRehearsal packet={packet} />);

    await user.selectOptions(
      screen.getByLabelText("Frozen draft scenario"),
      "refuse-three-missed-runs",
    );
    await user.click(
      screen.getByRole("button", { name: "Evaluate read-only scenario" }),
    );

    expect(screen.getByText("Refused")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Keep in rehearsal" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Apply in rehearsal" }),
    ).not.toBeInTheDocument();
  });

  it("raises an obvious error when evaluation diverges from the fixture", async () => {
    const user = userEvent.setup();
    const firstFixture = packet.cases[0];
    if (firstFixture === undefined) throw new Error("Missing adaptation fixture.");
    const mismatchedPacket = {
      ...packet,
      cases: [
        {
          ...firstFixture,
          expected: {
            ...firstFixture.expected,
            reasonCode: "ADAPT-INTENTIONAL-TEST-MISMATCH",
          },
        },
      ],
    };
    render(<InternalAdaptationScenarioRehearsal packet={mismatchedPacket} />);

    await user.selectOptions(
      screen.getByLabelText("Frozen draft scenario"),
      firstFixture.id,
    );
    await user.click(
      screen.getByRole("button", { name: "Evaluate read-only scenario" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "does not match the frozen expected outcome",
    );
    expect(
      screen.queryByRole("button", { name: "Keep in rehearsal" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Apply in rehearsal" }),
    ).not.toBeInTheDocument();
  });
});
