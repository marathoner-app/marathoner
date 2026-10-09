import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  createCompletedRunId,
  COMPLETED_RUN_NOTES_MAX_LENGTH,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createShoeId,
  createUserId,
  createUtcDateTime,
  type CompletedRun,
  type DistanceUnit,
  type Shoe,
} from "../domain/training";
import type {
  CreateCompletedRunInput,
  CreateShoeInput,
  UpdateCompletedRunInput,
} from "../persistence/trainingRepositories";
import ShoeTracker from "./ShoeTracker";

const userId = createUserId("runner-1");
const timestamp = createUtcDateTime("2026-08-05T14:00:00Z");

function Harness({
  initialShoes = [],
  initialRuns = [],
  distanceUnit = "mile",
  onDeleteRunCall = () => undefined,
}: {
  initialShoes?: Shoe[];
  initialRuns?: CompletedRun[];
  distanceUnit?: DistanceUnit;
  onDeleteRunCall?: (id: CompletedRun["id"]) => void;
}) {
  const [shoes, setShoes] = useState(initialShoes);
  const [runs, setRuns] = useState(initialRuns);

  const createShoe = async (input: CreateShoeInput) => {
    const shoe: Shoe = {
      id: createShoeId(`shoe-${shoes.length + 1}`),
      userId,
      name: input.name,
      startingDistance: input.startingDistance ?? createDistanceMeters(0),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setShoes((current) => [...current, shoe]);
    return shoe;
  };

  const createRun = async (input: CreateCompletedRunInput) => {
    const run: CompletedRun = {
      ...input,
      id: createCompletedRunId(`run-${runs.length + 1}`),
      userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setRuns((current) => [run, ...current]);
    return run;
  };

  const updateRun = async (
    id: CompletedRun["id"],
    changes: UpdateCompletedRunInput,
  ) => {
    const existing = runs.find((run) => run.id === id);
    if (existing === undefined) throw new Error("Run not found");
    const updated = {
      ...existing,
      startedAt: changes.startedAt ?? existing.startedAt,
      timeZone: changes.timeZone ?? existing.timeZone,
      distance: changes.distance ?? existing.distance,
      duration: changes.duration ?? existing.duration,
      shoeId:
        changes.shoeId === null ? undefined : changes.shoeId ?? existing.shoeId,
      perceivedEffort:
        changes.perceivedEffort === null
          ? undefined
          : changes.perceivedEffort ?? existing.perceivedEffort,
      notes:
        changes.notes === null ? undefined : changes.notes ?? existing.notes,
    };
    setRuns((current) =>
      current.map((run) => (run.id === updated.id ? updated : run)),
    );
    return updated;
  };

  const deleteRun = async (id: CompletedRun["id"]) => {
    onDeleteRunCall(id);
    setRuns((current) => current.filter((run) => run.id !== id));
  };

  return (
    <ShoeTracker
      distanceUnit={distanceUnit}
      runs={runs}
      shoes={shoes}
      plannedWorkouts={[]}
      onCreateShoe={createShoe}
      onCreateRun={createRun}
      onUpdateRun={updateRun}
      onDeleteRun={deleteRun}
    />
  );
}

async function addShoe(name: string) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Shoe Name"), name);
  await user.click(screen.getByRole("button", { name: "Add shoe" }));
  return user;
}

describe("ShoeTracker", () => {
  it("adds a persisted shoe with zero starting mileage", async () => {
    render(<Harness />);

    await addShoe("Daily Trainer");

    expect(await screen.findByText("Total: 0 mi")).toBeInTheDocument();
    expect(screen.getByText(/Starting: 0 mi/)).toBeInTheDocument();
    expect(screen.getByText(/Recorded by Marathoner: 0 mi/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Shoe Name")).toHaveValue("");
    expect(
      screen.getByRole("spinbutton", {
        name: "Distance already on this shoe (miles)",
      }),
    ).toHaveValue(0);
  });

  it("adds nonzero starting distance in the runner's preferred unit", async () => {
    render(<Harness distanceUnit="kilometer" />);
    const user = userEvent.setup();
    const startingDistance = screen.getByRole("spinbutton", {
      name: "Distance already on this shoe (kilometers)",
    });

    await user.type(screen.getByPlaceholderText("Shoe Name"), "Daily Trainer");
    await user.clear(startingDistance);
    await user.type(startingDistance, "12.5");
    await user.click(screen.getByRole("button", { name: "Add shoe" }));

    expect(await screen.findByText("Total: 12.5 km")).toBeInTheDocument();
    expect(screen.getByText(/Starting: 12.5 km/)).toBeInTheDocument();
    expect(screen.getByText(/Recorded by Marathoner: 0 km/)).toBeInTheDocument();
  });

  it("calmly rejects negative starting distance without clearing the form", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const startingDistance = screen.getByRole("spinbutton", {
      name: "Distance already on this shoe (miles)",
    });

    await user.type(screen.getByPlaceholderText("Shoe Name"), "Daily Trainer");
    await user.clear(startingDistance);
    await user.type(startingDistance, "-1");
    await user.click(screen.getByRole("button", { name: "Add shoe" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a starting distance of zero or greater.",
    );
    expect(screen.getByPlaceholderText("Shoe Name")).toHaveValue("Daily Trainer");
    expect(startingDistance).toHaveValue(-1);
    expect(screen.getByText("No shoes added yet.")).toBeInTheDocument();
  });

  it("logs a run and derives mileage for the selected shoe", async () => {
    render(<Harness />);
    const user = await addShoe("Daily Trainer");

    await user.type(screen.getByPlaceholderText("Miles"), "5");
    await user.type(screen.getByPlaceholderText("Time (e.g. 45:30)"), "45:30");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Running shoes" }),
      "shoe-1",
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));

    expect(await screen.findByText(/5 mi in 45:30 wearing Daily Trainer/)).toBeInTheDocument();
    expect(screen.getByText(/Effort: Not recorded/)).toBeInTheDocument();
    expect(screen.queryByText(/^Notes:/)).not.toBeInTheDocument();
    expect(screen.getByText("Total: 5 mi")).toBeInTheDocument();
    expect(screen.getByText(/Starting: 0 mi/)).toBeInTheDocument();
    expect(screen.getByText(/Recorded by Marathoner: 5 mi/)).toBeInTheDocument();
  });

  it("records and displays optional run notes", async () => {
    render(<Harness />);
    const user = await addShoe("Daily Trainer");

    await user.type(screen.getByPlaceholderText("Miles"), "5");
    await user.type(screen.getByPlaceholderText("Time (e.g. 45:30)"), "45:30");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Running shoes" }),
      "shoe-1",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Run notes" }),
      "  Warm afternoon; carried water.  ",
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));

    expect(
      await screen.findByText("Warm afternoon; carried water."),
    ).toBeInTheDocument();
  });

  it("accepts notes at the maximum length", async () => {
    render(<Harness />);
    const user = await addShoe("Daily Trainer");
    const maximumNotes = "n".repeat(COMPLETED_RUN_NOTES_MAX_LENGTH);
    const notes = screen.getByRole("textbox", { name: "Run notes" });

    expect(notes).toHaveAttribute(
      "maxlength",
      String(COMPLETED_RUN_NOTES_MAX_LENGTH),
    );
    await user.type(screen.getByPlaceholderText("Miles"), "5");
    await user.type(screen.getByPlaceholderText("Time (e.g. 45:30)"), "45:30");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Running shoes" }),
      "shoe-1",
    );
    await user.type(notes, maximumNotes);
    await user.click(screen.getByRole("button", { name: "Log Run" }));

    expect(
      await screen.findByText(maximumNotes),
    ).toBeInTheDocument();
  });

  it("adds, changes, and clears run notes while editing", async () => {
    const shoe: Shoe = {
      id: createShoeId("shoe-1"),
      userId,
      name: "Daily Trainer",
      startingDistance: createDistanceMeters(0),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const run: CompletedRun = {
      id: createCompletedRunId("run-1"),
      userId,
      shoeId: shoe.id,
      startedAt: timestamp,
      timeZone: createIanaTimeZone("America/Los_Angeles"),
      distance: createDistanceMeters(5_000),
      duration: createDurationSeconds(1_800),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const user = userEvent.setup();
    render(<Harness initialShoes={[shoe]} initialRuns={[run]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(
      screen.getByRole("textbox", { name: "Edit run notes" }),
      "Light rain.",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Light rain.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const editNotes = screen.getByRole("textbox", { name: "Edit run notes" });
    await user.clear(editNotes);
    await user.type(editNotes, "Tried a new route.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Tried a new route.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByRole("textbox", { name: "Edit run notes" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.queryByText(/^Notes:/)).not.toBeInTheDocument();
  });

  it("moves a run across a week boundary and cancel leaves the date unchanged", async () => {
    const shoe: Shoe = {
      id: createShoeId("shoe-1"),
      userId,
      name: "Daily Trainer",
      startingDistance: createDistanceMeters(0),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const run: CompletedRun = {
      id: createCompletedRunId("run-1"),
      userId,
      shoeId: shoe.id,
      startedAt: createUtcDateTime("2026-08-09T14:00:00Z"),
      timeZone: createIanaTimeZone("America/Los_Angeles"),
      distance: createDistanceMeters(5_000),
      duration: createDurationSeconds(1_800),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const user = userEvent.setup();
    render(<Harness initialShoes={[shoe]} initialRuns={[run]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const editDate = screen.getByLabelText("Edit run date");
    expect(editDate).toHaveValue("2026-08-09");
    await user.clear(editDate);
    await user.type(editDate, "2026-08-10");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/^2026-08-10:/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const changedDate = screen.getByLabelText("Edit run date");
    await user.clear(changedDate);
    await user.type(changedDate, "2026-08-11");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(/^2026-08-10:/)).toBeInTheDocument();
  });

  it("rejects a future completed-run date", async () => {
    const shoe: Shoe = {
      id: createShoeId("shoe-1"),
      userId,
      name: "Daily Trainer",
      startingDistance: createDistanceMeters(0),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const run: CompletedRun = {
      id: createCompletedRunId("run-1"),
      userId,
      shoeId: shoe.id,
      startedAt: timestamp,
      timeZone: createIanaTimeZone("America/Los_Angeles"),
      distance: createDistanceMeters(5_000),
      duration: createDurationSeconds(1_800),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const user = userEvent.setup();
    render(<Harness initialShoes={[shoe]} initialRuns={[run]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const editDate = screen.getByLabelText("Edit run date");
    await user.clear(editDate);
    await user.type(editDate, "2999-01-01");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A completed run date cannot be in the future.",
    );
    expect(editDate).toHaveValue("2999-01-01");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/^2026-08-05:/)).toBeInTheDocument();
  });

  it("records and displays optional perceived effort", async () => {
    render(<Harness />);
    const user = await addShoe("Daily Trainer");

    await user.type(screen.getByPlaceholderText("Miles"), "5");
    await user.type(screen.getByPlaceholderText("Time (e.g. 45:30)"), "45:30");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Running shoes" }),
      "shoe-1",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Perceived effort" }),
      "harder_than_expected",
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));

    expect(await screen.findByText(/Effort: Harder than expected/)).toBeInTheDocument();
  });

  it("adds, changes, and clears perceived effort while editing a run", async () => {
    const shoe: Shoe = {
      id: createShoeId("shoe-1"),
      userId,
      name: "Daily Trainer",
      startingDistance: createDistanceMeters(0),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const run: CompletedRun = {
      id: createCompletedRunId("run-1"),
      userId,
      shoeId: shoe.id,
      startedAt: timestamp,
      timeZone: createIanaTimeZone("America/Los_Angeles"),
      distance: createDistanceMeters(5_000),
      duration: createDurationSeconds(1_800),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const user = userEvent.setup();
    render(<Harness initialShoes={[shoe]} initialRuns={[run]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Edit perceived effort" }),
      "about_right",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Effort: About as expected/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Edit perceived effort" }),
      "much_easier_than_expected",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Effort: Much easier than expected/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Edit perceived effort" }),
      "",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Effort: Not recorded/)).toBeInTheDocument();
  });

  it("rejects an unsupported perceived-effort value", async () => {
    render(<Harness />);
    const user = await addShoe("Daily Trainer");
    const effort = screen.getByRole("combobox", { name: "Perceived effort" });
    const invalidOption = document.createElement("option");
    invalidOption.value = "impossibly_easy";
    invalidOption.text = "Invalid effort";
    effort.append(invalidOption);

    await user.type(screen.getByPlaceholderText("Miles"), "5");
    await user.type(screen.getByPlaceholderText("Time (e.g. 45:30)"), "45:30");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Running shoes" }),
      "shoe-1",
    );
    await user.selectOptions(effort, "impossibly_easy");
    await user.click(screen.getByRole("button", { name: "Log Run" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a valid perceived effort, or leave it blank.",
    );
    expect(screen.getByText("No runs logged yet.")).toBeInTheDocument();
  });

  it("cancels deletion without changing the run and restores trigger focus", async () => {
    const shoe: Shoe = {
      id: createShoeId("shoe-1"),
      userId,
      name: "Daily Trainer",
      startingDistance: createDistanceMeters(0),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const run: CompletedRun = {
      id: createCompletedRunId("run-1"),
      userId,
      shoeId: shoe.id,
      startedAt: timestamp,
      timeZone: createIanaTimeZone("America/Los_Angeles"),
      distance: createDistanceMeters(8_047),
      duration: createDurationSeconds(2_400),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const onDeleteRunCall = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness
        initialShoes={[shoe]}
        initialRuns={[run]}
        onDeleteRunCall={onDeleteRunCall}
      />,
    );

    const deleteButton = screen.getByRole("button", {
      name: "Delete run from 2026-08-05",
    });
    deleteButton.focus();
    await user.keyboard("{Enter}");

    expect(
      screen.getByRole("dialog", { name: "Delete this completed run?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2026-08-05 · 5 mi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(screen.getByText("Total: 5 mi")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onDeleteRunCall).not.toHaveBeenCalled();
    expect(screen.getByText("Total: 5 mi")).toBeInTheDocument();
    expect(deleteButton).toHaveFocus();
  });

  it("edits and confirms deletion once without allowing shoe mileage to drift", async () => {
    const shoe: Shoe = {
      id: createShoeId("shoe-1"),
      userId,
      name: "Daily Trainer",
      startingDistance: createDistanceMeters(0),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const run: CompletedRun = {
      id: createCompletedRunId("run-1"),
      userId,
      shoeId: shoe.id,
      startedAt: timestamp,
      timeZone: createIanaTimeZone("America/Los_Angeles"),
      distance: createDistanceMeters(8_047),
      duration: createDurationSeconds(2_400),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const onDeleteRunCall = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness
        initialShoes={[shoe]}
        initialRuns={[run]}
        onDeleteRunCall={onDeleteRunCall}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByRole("spinbutton", { name: "Edit miles" }));
    await user.type(screen.getByRole("spinbutton", { name: "Edit miles" }), "3");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Total: 3 mi")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Delete run from 2026-08-05" }),
    );
    expect(screen.getByText("Total: 3 mi")).toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole("button", { name: "Delete run" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(await screen.findByText("No runs logged yet.")).toBeInTheDocument();
    expect(onDeleteRunCall).toHaveBeenCalledTimes(1);
    expect(onDeleteRunCall).toHaveBeenCalledWith(run.id);
    expect(screen.getByText("Total: 0 mi")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Logged Runs" })).toHaveFocus();
  });
});
