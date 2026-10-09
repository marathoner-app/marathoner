import { useMemo, useState } from "react";
import {
  calculateShoeDistance,
  COMPLETED_RUN_NOTES_MAX_LENGTH,
  createPlannedWorkoutId,
  createShoeId,
  createTrainingPlanId,
  createDurationSeconds,
  createIanaTimeZone,
  createUtcDateTime,
  getRunLocalDate,
  metersToMiles,
  milesToMeters,
  type CompletedRun,
  type CompletedRunId,
  type DistanceMeters,
  type PerceivedEffort,
  type PlannedWorkout,
  type Shoe,
} from "../domain/training";
import type {
  CreateCompletedRunInput,
  CreateShoeInput,
  UpdateCompletedRunInput,
} from "../persistence/trainingRepositories";

type ShoeTrackerProps = {
  readonly runs: readonly CompletedRun[];
  readonly shoes: readonly Shoe[];
  readonly plannedWorkouts: readonly PlannedWorkout[];
  readonly onCreateShoe: (input: CreateShoeInput) => Promise<Shoe>;
  readonly onCreateRun: (input: CreateCompletedRunInput) => Promise<CompletedRun>;
  readonly onUpdateRun: (
    id: CompletedRunId,
    changes: UpdateCompletedRunInput,
  ) => Promise<CompletedRun>;
  readonly onDeleteRun: (id: CompletedRunId) => Promise<void>;
};

const perceivedEffortOptions = [
  { value: "much_easier_than_expected", label: "Much easier than expected" },
  { value: "easier_than_expected", label: "Easier than expected" },
  { value: "about_right", label: "About as expected" },
  { value: "harder_than_expected", label: "Harder than expected" },
  { value: "much_harder_than_expected", label: "Much harder than expected" },
] as const satisfies readonly {
  readonly value: PerceivedEffort;
  readonly label: string;
}[];

function parsePerceivedEffort(value: FormDataEntryValue | null) {
  if (value === null || value === "") return undefined;

  const option = perceivedEffortOptions.find(
    (candidate) => candidate.value === value,
  );
  if (option === undefined) {
    throw new Error("Choose a valid perceived effort, or leave it blank.");
  }

  return option.value;
}

function formatPerceivedEffort(value: PerceivedEffort | undefined) {
  if (value === undefined) return "Not recorded";
  return perceivedEffortOptions.find((option) => option.value === value)?.label;
}

function parseRunNotes(value: FormDataEntryValue | null) {
  const notes = typeof value === "string" ? value.trim() : "";
  if (notes.length === 0) return undefined;
  if (notes.length > COMPLETED_RUN_NOTES_MAX_LENGTH) {
    throw new Error(
      `Keep run notes to ${COMPLETED_RUN_NOTES_MAX_LENGTH} characters or fewer.`,
    );
  }
  return notes;
}

function today(): string {
  const value = new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentTimeZone() {
  const value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return createIanaTimeZone(value);
}

function dateToUtc(date: string) {
  return createUtcDateTime(new Date(`${date}T12:00:00`).toISOString());
}

function parseDuration(value: string) {
  const parts = value.split(":").map(Number);
  const isValidPart = parts.every((part) => Number.isInteger(part) && part >= 0);

  if (!isValidPart || (parts.length !== 2 && parts.length !== 3)) {
    throw new Error("Use MM:SS or H:MM:SS for elapsed time.");
  }

  const [hours, minutes, seconds] =
    parts.length === 3 ? parts : [0, parts[0], parts[1]];

  if (seconds >= 60 || (parts.length === 3 && minutes >= 60)) {
    throw new Error("Seconds, and minutes after an hour, must be less than 60.");
  }

  return createDurationSeconds(hours * 3600 + minutes * 60 + seconds);
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

function formatMiles(meters: DistanceMeters): string {
  return Number(metersToMiles(meters).toFixed(2)).toString();
}

function workoutName(workout: PlannedWorkout): string {
  if (workout.kind === "walk_run") return "Walk/run";
  if (workout.kind === "rest") return "Rest";
  return `${workout.purpose[0].toUpperCase()}${workout.purpose.slice(1)} run`;
}

export default function ShoeTracker({
  runs,
  shoes,
  plannedWorkouts,
  onCreateShoe,
  onCreateRun,
  onUpdateRun,
  onDeleteRun,
}: ShoeTrackerProps) {
  const [newShoe, setNewShoe] = useState("");
  const [runDate, setRunDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingRunId, setEditingRunId] = useState<CompletedRunId | null>(null);
  const activeShoes = shoes.filter((shoe) => shoe.status === "active");
  const availableWorkouts = plannedWorkouts.filter(
    (workout) => workout.kind !== "rest" && workout.status === "planned",
  );
  const shoeMileage = useMemo(
    () =>
      new Map(
        shoes.map((shoe) => [shoe.id, calculateShoeDistance(shoe, runs)]),
      ),
    [runs, shoes],
  );

  const handleAddShoe = async () => {
    const name = newShoe.trim();
    if (name.length === 0) return;

    setError(null);
    setPending(true);
    try {
      await onCreateShoe({ name });
      setNewShoe("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The shoe could not be saved.");
    } finally {
      setPending(false);
    }
  };

  const handleRunSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setError(null);
    setPending(true);
    try {
      const association = String(formData.get("workout") ?? "");
      const [plannedWorkoutPlanId, plannedWorkoutId] = association
        ? association.split("/")
        : [];
      await onCreateRun({
        plannedWorkoutPlanId: plannedWorkoutPlanId
          ? createTrainingPlanId(plannedWorkoutPlanId)
          : undefined,
        plannedWorkoutId: plannedWorkoutId
          ? createPlannedWorkoutId(plannedWorkoutId)
          : undefined,
        shoeId: createShoeId(String(formData.get("shoe"))),
        startedAt: dateToUtc(runDate),
        timeZone: currentTimeZone(),
        distance: milesToMeters(Number(formData.get("miles"))),
        duration: parseDuration(String(formData.get("time"))),
        perceivedEffort: parsePerceivedEffort(formData.get("perceivedEffort")),
        notes: parseRunNotes(formData.get("notes")),
      });
      form.reset();
      setRunDate(today());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The run could not be saved.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="tracker">
      {error && <p role="alert" className="training-error">{error}</p>}
      <div className="entry">
        <h2>Run</h2>
        {activeShoes.length === 0 && (
          <p className="training-empty-state">
            Add your current running shoes before logging a run.
          </p>
        )}
        <form onSubmit={handleRunSubmit} className="space-y-3">
          <input
            aria-label="Run date"
            name="date"
            type="date"
            value={runDate}
            onChange={(event) => setRunDate(event.target.value)}
            required
          />
          <input name="miles" type="number" min="0.01" step="0.01" placeholder="Miles" required />
          <input name="time" type="text" placeholder="Time (e.g. 45:30)" required />
          <select name="shoe" aria-label="Running shoes" required>
            <option value="">Select Shoes</option>
            {activeShoes.map((shoe) => (
              <option key={shoe.id} value={shoe.id}>
                {shoe.name} ({formatMiles(shoeMileage.get(shoe.id) ?? shoe.startingDistance)} mi)
              </option>
            ))}
          </select>
          <select name="workout" aria-label="Planned workout">
            <option value="">Unplanned run</option>
            {availableWorkouts.map((workout) => (
              <option
                key={workout.id}
                value={`${workout.planId}/${workout.id}`}
              >
                {workout.scheduledDate}: {workoutName(workout)}
              </option>
            ))}
          </select>
          <select name="perceivedEffort" aria-label="Perceived effort">
            <option value="">How did it feel? (optional)</option>
            {perceivedEffortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <textarea
            aria-label="Run notes"
            aria-describedby="run-notes-help"
            name="notes"
            maxLength={COMPLETED_RUN_NOTES_MAX_LENGTH}
            placeholder="Notes (optional)"
            rows={3}
          />
          <p id="run-notes-help" className="training-field-hint">
            Optional context such as weather, fueling, discomfort, or the route. Up to{" "}
            {COMPLETED_RUN_NOTES_MAX_LENGTH} characters.
          </p>
          <button type="submit" disabled={pending || activeShoes.length === 0}>
            Log Run
          </button>
        </form>

        <div className="mt-4">
          <h3 className="text-lg font-medium">Logged Runs</h3>
          {runs.length === 0 ? (
            <p className="training-empty-state">No runs logged yet.</p>
          ) : (
            <ul>
              {runs.map((run) => {
                const shoe = shoes.find((candidate) => candidate.id === run.shoeId);
                const isEditing = editingRunId === run.id;

                return (
                  <li key={run.id}>
                    {isEditing ? (
                      <form
                        aria-label={`Edit run from ${getRunLocalDate(run)}`}
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          setError(null);
                          setPending(true);
                          try {
                            await onUpdateRun(run.id, {
                              distance: milesToMeters(Number(data.get("miles"))),
                              duration: parseDuration(String(data.get("time"))),
                              shoeId: createShoeId(String(data.get("shoe"))),
                              perceivedEffort:
                                parsePerceivedEffort(data.get("perceivedEffort")) ?? null,
                              notes: parseRunNotes(data.get("notes")) ?? null,
                            });
                            setEditingRunId(null);
                          } catch (caught) {
                            setError(caught instanceof Error ? caught.message : "The run could not be updated.");
                          } finally {
                            setPending(false);
                          }
                        }}
                      >
                        <input
                          aria-label="Edit miles"
                          name="miles"
                          type="number"
                          min="0.01"
                          step="0.01"
                          defaultValue={formatMiles(run.distance)}
                          required
                        />
                        <input
                          aria-label="Edit elapsed time"
                          name="time"
                          defaultValue={formatDuration(run.duration)}
                          required
                        />
                        <select
                          aria-label="Edit running shoes"
                          name="shoe"
                          defaultValue={run.shoeId}
                          required
                        >
                          {shoes
                            .filter(
                              (candidate) =>
                                candidate.status === "active" ||
                                candidate.id === run.shoeId,
                            )
                            .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name}
                            </option>
                            ))}
                        </select>
                        <select
                          aria-label="Edit perceived effort"
                          name="perceivedEffort"
                          defaultValue={run.perceivedEffort ?? ""}
                        >
                          <option value="">Not recorded</option>
                          {perceivedEffortOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <textarea
                          aria-label="Edit run notes"
                          aria-describedby={`edit-run-notes-help-${run.id}`}
                          name="notes"
                          defaultValue={run.notes ?? ""}
                          maxLength={COMPLETED_RUN_NOTES_MAX_LENGTH}
                          placeholder="Notes (optional)"
                          rows={3}
                        />
                        <p
                          id={`edit-run-notes-help-${run.id}`}
                          className="training-field-hint"
                        >
                          Optional context, up to {COMPLETED_RUN_NOTES_MAX_LENGTH} characters.
                        </p>
                        <button type="submit" disabled={pending}>Save</button>
                        <button type="button" onClick={() => setEditingRunId(null)}>
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <span>
                          {getRunLocalDate(run)}: {formatMiles(run.distance)} mi in{" "}
                          {formatDuration(run.duration)} wearing {shoe?.name ?? "No shoe"}. Effort:{" "}
                          {formatPerceivedEffort(run.perceivedEffort)}
                        </span>
                        {run.notes !== undefined && (
                          <p className="run-notes"><strong>Notes:</strong> {run.notes}</p>
                        )}
                        <button type="button" onClick={() => setEditingRunId(run.id)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={async () => {
                            setError(null);
                            setPending(true);
                            try {
                              await onDeleteRun(run.id);
                            } catch (caught) {
                              setError(caught instanceof Error ? caught.message : "The run could not be deleted.");
                            } finally {
                              setPending(false);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="shoe-tracking">
        <h3 className="text-lg font-medium">Add New Shoes</h3>
        <div className="flex space-x-2 mt-2">
          <input
            type="text"
            value={newShoe}
            onChange={(event) => setNewShoe(event.target.value)}
            placeholder="Shoe Name"
          />
          <button type="button" onClick={handleAddShoe} disabled={pending}>
            Add
          </button>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-medium">Shoe Mileage</h3>
          {shoes.length === 0 ? (
            <p className="training-empty-state">No shoes added yet.</p>
          ) : (
            <ul>
              {shoes.map((shoe) => (
                <li key={shoe.id}>
                  {shoe.name}: {formatMiles(shoeMileage.get(shoe.id) ?? shoe.startingDistance)} mi
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
