import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  createCompletedRunId,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createShoeId,
  createUserId,
  createUtcDateTime,
  type CompletedRun,
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
}: {
  initialShoes?: Shoe[];
  initialRuns?: CompletedRun[];
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
      distance: changes.distance ?? existing.distance,
      duration: changes.duration ?? existing.duration,
      shoeId:
        changes.shoeId === null ? undefined : changes.shoeId ?? existing.shoeId,
      perceivedEffort:
        changes.perceivedEffort === null
          ? undefined
          : changes.perceivedEffort ?? existing.perceivedEffort,
    };
    setRuns((current) =>
      current.map((run) => (run.id === updated.id ? updated : run)),
    );
    return updated;
  };

  const deleteRun = async (id: CompletedRun["id"]) => {
    setRuns((current) => current.filter((run) => run.id !== id));
  };

  return (
    <ShoeTracker
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
  await user.click(screen.getByRole("button", { name: "Add" }));
  return user;
}

describe("ShoeTracker", () => {
  it("adds a persisted shoe with zero starting mileage", async () => {
    render(<Harness />);

    await addShoe("Daily Trainer");

    expect(await screen.findByText("Daily Trainer: 0 mi")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Shoe Name")).toHaveValue("");
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
    expect(screen.getByText("Daily Trainer: 5 mi")).toBeInTheDocument();
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

  it("edits and deletes a run without allowing shoe mileage to drift", async () => {
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
    const user = userEvent.setup();
    render(<Harness initialShoes={[shoe]} initialRuns={[run]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByRole("spinbutton", { name: "Edit miles" }));
    await user.type(screen.getByRole("spinbutton", { name: "Edit miles" }), "3");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Daily Trainer: 3 mi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("No runs logged yet.")).toBeInTheDocument();
    expect(screen.getByText("Daily Trainer: 0 mi")).toBeInTheDocument();
  });
});
