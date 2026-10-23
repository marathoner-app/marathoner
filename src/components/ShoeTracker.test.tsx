import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  type DateOnly,
  type DistanceUnit,
  type Shoe,
  type ShoeId,
} from "../domain/training";
import type {
  CreateCompletedRunInput,
  CreateShoeInput,
  UpdateCompletedRunInput,
} from "../persistence/trainingRepositories";
import ShoeTracker from "./ShoeTracker";

const userId = createUserId("runner-1");
const timestamp = createUtcDateTime("2026-08-05T14:00:00Z");

function deferredRequest() {
  let resolveRequest!: () => void;
  const request = new Promise<void>((resolve) => {
    resolveRequest = resolve;
  });
  return { request, resolve: resolveRequest };
}

function Harness({
  initialShoes = [],
  initialRuns = [],
  distanceUnit = "mile",
  onCreateShoeCall = () => undefined,
  onCreateRunCall = () => undefined,
  onUpdateRunCall = () => undefined,
  onDeleteRunCall = () => undefined,
  onRetireShoeCall = () => undefined,
}: {
  initialShoes?: Shoe[];
  initialRuns?: CompletedRun[];
  distanceUnit?: DistanceUnit;
  onCreateShoeCall?: (input: CreateShoeInput) => void | Promise<void>;
  onCreateRunCall?: (input: CreateCompletedRunInput) => void | Promise<void>;
  onUpdateRunCall?: (
    id: CompletedRun["id"],
    changes: UpdateCompletedRunInput,
  ) => void | Promise<void>;
  onDeleteRunCall?: (id: CompletedRun["id"]) => void;
  onRetireShoeCall?: (id: ShoeId, retiredOn: DateOnly) => void;
}) {
  const [shoes, setShoes] = useState(initialShoes);
  const [runs, setRuns] = useState(initialRuns);

  const createShoe = async (input: CreateShoeInput) => {
    await onCreateShoeCall(input);
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
    await onCreateRunCall(input);
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
    await onUpdateRunCall(id, changes);
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

  const retireShoe = async (id: ShoeId, retiredOn: DateOnly) => {
    const existing = shoes.find((shoe) => shoe.id === id);
    if (existing === undefined) throw new Error("Shoe not found");
    const retiredShoe: Shoe = {
      ...existing,
      status: "retired",
      retiredOn,
      updatedAt: timestamp,
    };
    onRetireShoeCall(id, retiredOn);
    setShoes((current) =>
      current.map((shoe) => (shoe.id === id ? retiredShoe : shoe)),
    );
    return retiredShoe;
  };

  return (
    <ShoeTracker
      distanceUnit={distanceUnit}
      runs={runs}
      shoes={shoes}
      plannedWorkouts={[]}
      onCreateShoe={createShoe}
      onRetireShoe={retireShoe}
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

async function enterElapsedDuration(
  user: ReturnType<typeof userEvent.setup>,
  {
    hours,
    minutes,
    seconds,
    legend = "Elapsed time",
  }: {
    hours?: number;
    minutes?: number;
    seconds?: number;
    legend?: string;
  },
) {
  const group = screen.getByRole("group", { name: legend });
  const entries = { hours, minutes, seconds };

  for (const [segment, value] of Object.entries(entries)) {
    if (value === undefined) continue;
    const input = within(group).getByRole("spinbutton", {
      name: `${legend} ${segment}`,
    });
    await user.clear(input);
    await user.type(input, String(value));
  }
}

describe("ShoeTracker", () => {
  it("gives every run-entry control a persistent visible label", () => {
    render(<Harness />);

    expect(screen.getByRole("form", { name: "Log a completed run" })).toBeInTheDocument();
    expect(screen.getByLabelText("Run date")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Distance (miles)" })).toBeInTheDocument();
    const elapsedTime = screen.getByRole("group", { name: "Elapsed time" });
    expect(elapsedTime).toBeInTheDocument();
    expect(
      within(elapsedTime).getByRole("spinbutton", {
        name: "Elapsed time hours",
      }),
    ).toBeInTheDocument();
    expect(
      within(elapsedTime).getByRole("spinbutton", {
        name: "Elapsed time minutes",
      }),
    ).toBeInTheDocument();
    expect(
      within(elapsedTime).getByRole("spinbutton", {
        name: "Elapsed time seconds",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Running shoes" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Planned workout" })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Perceived effort (optional)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Run notes (optional)" }),
    ).toBeInTheDocument();
  });

  it("gives every run-editor control a persistent visible label", async () => {
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

    await user.click(
      screen.getByRole("button", { name: "Edit run from 2026-08-05" }),
    );

    const editForm = screen.getByRole("form", {
      name: "Edit run from 2026-08-05",
    });
    const editDate = within(editForm).getByLabelText("Edit run date");
    await waitFor(() => expect(editDate).toHaveFocus());
    expect(
      within(editForm).getByRole("spinbutton", {
        name: "Edit distance (miles)",
      }),
    ).toBeInTheDocument();
    const elapsedTime = within(editForm).getByRole("group", {
      name: "Edit elapsed time",
    });
    expect(
      within(elapsedTime).getByRole("spinbutton", {
        name: "Edit elapsed time hours",
      }),
    ).toHaveValue(0);
    expect(
      within(elapsedTime).getByRole("spinbutton", {
        name: "Edit elapsed time minutes",
      }),
    ).toHaveValue(30);
    expect(
      within(elapsedTime).getByRole("spinbutton", {
        name: "Edit elapsed time seconds",
      }),
    ).toHaveValue(0);
    expect(
      within(editForm).getByRole("combobox", { name: "Edit running shoes" }),
    ).toBeInTheDocument();
    expect(
      within(editForm).getByRole("combobox", {
        name: "Edit perceived effort (optional)",
      }),
    ).toBeInTheDocument();
    expect(
      within(editForm).getByRole("textbox", {
        name: "Edit run notes (optional)",
      }),
    ).toBeInTheDocument();
  });

  it("exposes operation-specific pending states while Track forms save", async () => {
    const shoeRequest = deferredRequest();
    const runRequest = deferredRequest();
    const updateRequest = deferredRequest();
    const user = userEvent.setup();
    render(
      <Harness
        onCreateShoeCall={() => shoeRequest.request}
        onCreateRunCall={() => runRequest.request}
        onUpdateRunCall={() => updateRequest.request}
      />,
    );

    await user.type(screen.getByPlaceholderText("Shoe Name"), "Daily Trainer");
    await user.click(screen.getByRole("button", { name: "Add shoe" }));

    const addingShoe = screen.getByRole("button", { name: "Adding shoe…" });
    expect(addingShoe).toBeDisabled();
    expect(addingShoe.closest("form")).toHaveAttribute("aria-busy", "true");

    shoeRequest.resolve();
    expect(await screen.findByRole("button", { name: "Add shoe" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Daily Trainer added.");

    const runForm = screen.getByRole("form", { name: "Log a completed run" });
    await user.type(
      within(runForm).getByRole("spinbutton", { name: "Distance (miles)" }),
      "5",
    );
    await enterElapsedDuration(user, { minutes: 45, seconds: 30 });
    await user.selectOptions(
      within(runForm).getByRole("combobox", { name: "Running shoes" }),
      "shoe-1",
    );
    await user.click(within(runForm).getByRole("button", { name: "Log Run" }));

    expect(
      within(runForm).getByRole("button", { name: "Logging run…" }),
    ).toBeDisabled();
    expect(runForm).toHaveAttribute("aria-busy", "true");

    runRequest.resolve();
    expect(
      await screen.findByText(/5 mi in 45:30 wearing Daily Trainer/),
    ).toBeInTheDocument();
    expect(within(runForm).getByRole("button", { name: "Log Run" })).toBeEnabled();
    expect(runForm).toHaveAttribute("aria-busy", "false");

    await user.click(screen.getByRole("button", { name: /Edit run from/ }));
    const editForm = screen.getByRole("form", { name: /Edit run from/ });
    await user.click(within(editForm).getByRole("button", { name: "Save" }));

    expect(
      within(editForm).getByRole("button", { name: "Saving…" }),
    ).toBeDisabled();
    expect(editForm).toHaveAttribute("aria-busy", "true");

    updateRequest.resolve();
    expect(
      await screen.findByRole("button", { name: /Edit run from/ }),
    ).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(/updated\.$/);
  });

  it("adds a persisted shoe with zero starting mileage", async () => {
    render(<Harness />);

    await addShoe("Daily Trainer");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Daily Trainer added.",
    );
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

    await user.type(screen.getByRole("spinbutton", { name: "Distance (miles)" }), "5");
    await enterElapsedDuration(user, { minutes: 45, seconds: 30 });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Running shoes" }),
      "shoe-1",
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /^Run logged for \d{4}-\d{2}-\d{2}\.$/,
    );
    expect(await screen.findByText(/5 mi in 45:30 wearing Daily Trainer/)).toBeInTheDocument();
    expect(screen.getByText(/Effort: Not recorded/)).toBeInTheDocument();
    expect(screen.queryByText(/^Notes:/)).not.toBeInTheDocument();
    expect(screen.getByText("Total: 5 mi")).toBeInTheDocument();
    expect(screen.getByText(/Starting: 0 mi/)).toBeInTheDocument();
    expect(screen.getByText(/Recorded by Marathoner: 5 mi/)).toBeInTheDocument();
  });

  it("rejects an empty elapsed duration before creating a run", async () => {
    const onCreateRunCall = vi.fn();
    render(<Harness onCreateRunCall={onCreateRunCall} />);
    const user = await addShoe("Daily Trainer");

    await user.type(
      screen.getByRole("spinbutton", { name: "Distance (miles)" }),
      "5",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Running shoes" }),
      "shoe-1",
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Elapsed time must be greater than zero.",
    );
    expect(onCreateRunCall).not.toHaveBeenCalled();
    expect(screen.getByText("No runs logged yet.")).toBeInTheDocument();
  });

  it("uses kilometers throughout run entry, editing, history, and deletion", async () => {
    const onCreateRunCall = vi.fn();
    const onUpdateRunCall = vi.fn();
    render(
      <Harness
        distanceUnit="kilometer"
        onCreateRunCall={onCreateRunCall}
        onUpdateRunCall={onUpdateRunCall}
      />,
    );
    const user = await addShoe("Daily Trainer");

    await user.type(
      screen.getByRole("spinbutton", { name: "Distance (kilometers)" }),
      "5",
    );
    await enterElapsedDuration(user, { minutes: 30 });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Running shoes" }),
      "shoe-1",
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));

    expect(onCreateRunCall).toHaveBeenCalledWith(
      expect.objectContaining({
        distance: createDistanceMeters(5_000),
        duration: createDurationSeconds(1_800),
      }),
    );
    expect(
      await screen.findByText(/5 km in 30:00 wearing Daily Trainer/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Edit run from/ }));
    const editDistance = screen.getByRole("spinbutton", {
      name: "Edit distance (kilometers)",
    });
    expect(editDistance).toHaveValue(5);
    await user.clear(editDistance);
    await user.type(editDistance, "6.25");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onUpdateRunCall).toHaveBeenCalledWith(
      createCompletedRunId("run-1"),
      expect.objectContaining({ distance: createDistanceMeters(6_250) }),
    );
    expect(await screen.findByText(/6.25 km in 30:00/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /^Delete run from / }),
    );
    expect(screen.getByText(/· 6.25 km$/)).toBeInTheDocument();
  });

  it("retires a shoe after confirmation while preserving its history and total", async () => {
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
    const onRetireShoeCall = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness
        initialShoes={[shoe]}
        initialRuns={[run]}
        onRetireShoeCall={onRetireShoeCall}
      />,
    );

    expect(
      screen.getByRole("option", { name: "Daily Trainer (5 mi)" }),
    ).toBeInTheDocument();
    const retireButton = screen.getByRole("button", {
      name: "Retire Daily Trainer",
    });
    await user.click(retireButton);

    expect(
      screen.getByRole("dialog", { name: "Retire Daily Trainer?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Existing run history and mileage will stay intact/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onRetireShoeCall).not.toHaveBeenCalled();
    expect(retireButton).toHaveFocus();

    await user.click(retireButton);
    await user.tab();
    expect(screen.getByRole("button", { name: "Retire shoe" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByText(/^Retired \d{4}-\d{2}-\d{2}$/),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Daily Trainer retired.",
    );
    expect(onRetireShoeCall).toHaveBeenCalledTimes(1);
    expect(onRetireShoeCall).toHaveBeenCalledWith(
      shoe.id,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(screen.getByText("Total: 5 mi")).toBeInTheDocument();
    expect(
      screen.getByText(/5 mi in 40:00 wearing Daily Trainer/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Daily Trainer (5 mi)" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shoe Mileage" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /Edit run from/ }));
    expect(
      screen.getByRole("option", { name: "Daily Trainer" }),
    ).toBeInTheDocument();
  });

  it("records and displays optional run notes", async () => {
    render(<Harness />);
    const user = await addShoe("Daily Trainer");

    await user.type(screen.getByRole("spinbutton", { name: "Distance (miles)" }), "5");
    await enterElapsedDuration(user, { minutes: 45, seconds: 30 });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Running shoes" }),
      "shoe-1",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Run notes (optional)" }),
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
    const notes = screen.getByRole("textbox", { name: "Run notes (optional)" });

    expect(notes).toHaveAttribute(
      "maxlength",
      String(COMPLETED_RUN_NOTES_MAX_LENGTH),
    );
    await user.type(screen.getByRole("spinbutton", { name: "Distance (miles)" }), "5");
    await enterElapsedDuration(user, { minutes: 45, seconds: 30 });
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

    await user.click(screen.getByRole("button", { name: /Edit run from/ }));
    await user.type(
      screen.getByRole("textbox", { name: "Edit run notes (optional)" }),
      "Light rain.",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Light rain.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Edit run from/ }));
    const editNotes = screen.getByRole("textbox", {
      name: "Edit run notes (optional)",
    });
    await user.clear(editNotes);
    await user.type(editNotes, "Tried a new route.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Tried a new route.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Edit run from/ }));
    await user.clear(
      screen.getByRole("textbox", { name: "Edit run notes (optional)" }),
    );
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

    await user.click(screen.getByRole("button", { name: /Edit run from/ }));
    const editDate = screen.getByLabelText("Edit run date");
    expect(editDate).toHaveValue("2026-08-09");
    await user.clear(editDate);
    await user.type(editDate, "2026-08-10");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/^2026-08-10:/)).toBeInTheDocument();
    const restoredEditButton = screen.getByRole("button", {
      name: /Edit run from/,
    });
    expect(restoredEditButton).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Run from 2026-08-10 updated.",
    );

    await user.click(restoredEditButton);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    const changedDate = screen.getByLabelText("Edit run date");
    await user.clear(changedDate);
    await user.type(changedDate, "2026-08-11");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(/^2026-08-10:/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Edit run from/ }),
    ).toHaveFocus();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /Edit run from/ }));
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

    await user.type(screen.getByRole("spinbutton", { name: "Distance (miles)" }), "5");
    await enterElapsedDuration(user, { minutes: 45, seconds: 30 });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Running shoes" }),
      "shoe-1",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Perceived effort (optional)" }),
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

    await user.click(screen.getByRole("button", { name: /Edit run from/ }));
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Edit perceived effort (optional)",
      }),
      "about_right",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Effort: About as expected/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Edit run from/ }));
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Edit perceived effort (optional)",
      }),
      "much_easier_than_expected",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Effort: Much easier than expected/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Edit run from/ }));
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Edit perceived effort (optional)",
      }),
      "",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Effort: Not recorded/)).toBeInTheDocument();
  });

  it("rejects an unsupported perceived-effort value", async () => {
    render(<Harness />);
    const user = await addShoe("Daily Trainer");
    const effort = screen.getByRole("combobox", {
      name: "Perceived effort (optional)",
    });
    const invalidOption = document.createElement("option");
    invalidOption.value = "impossibly_easy";
    invalidOption.text = "Invalid effort";
    effort.append(invalidOption);

    await user.type(screen.getByRole("spinbutton", { name: "Distance (miles)" }), "5");
    await enterElapsedDuration(user, { minutes: 45, seconds: 30 });
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

    await user.click(screen.getByRole("button", { name: /Edit run from/ }));
    await user.clear(
      screen.getByRole("spinbutton", { name: "Edit distance (miles)" }),
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Edit distance (miles)" }),
      "3",
    );
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
    expect(screen.getByRole("status")).toHaveTextContent(
      "Run from 2026-08-05 deleted.",
    );
    expect(onDeleteRunCall).toHaveBeenCalledTimes(1);
    expect(onDeleteRunCall).toHaveBeenCalledWith(run.id);
    expect(screen.getByText("Total: 0 mi")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Logged Runs" })).toHaveFocus();
  });
});
