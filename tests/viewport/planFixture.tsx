import { createRoot } from "react-dom/client";
import "../../src/index.css";
import Calendar from "../../src/components/Calendar";
import {
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type PlannedWorkout,
  type TrainingPlan,
} from "../../src/domain/training";

const userId = createUserId("viewport-runner");
const planId = createTrainingPlanId("viewport-plan");
const timestamp = createUtcDateTime("2026-10-26T12:00:00Z");
const plan: TrainingPlan = {
  id: planId,
  userId,
  name: "First Marathon Journey",
  startDate: createDateOnly("2026-10-26"),
  targetRaceDate: createDateOnly("2026-11-15"),
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const workouts: PlannedWorkout[] = [
  {
    id: createPlannedWorkoutId("viewport-easy"),
    userId,
    planId,
    scheduledDate: createDateOnly("2026-10-27"),
    phase: "base_building",
    status: "completed",
    kind: "run",
    purpose: "easy",
    targetDistance: createDistanceMeters(5_000),
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: createPlannedWorkoutId("viewport-tempo"),
    userId,
    planId,
    scheduledDate: createDateOnly("2026-10-29"),
    phase: "base_building",
    status: "planned",
    kind: "run",
    purpose: "tempo",
    targetDistance: createDistanceMeters(8_000),
    targetDuration: createDurationSeconds(2_700),
    notes:
      "Keep the opening miles controlled, then settle into a comfortably hard effort.",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: createPlannedWorkoutId("viewport-rest"),
    userId,
    planId,
    scheduledDate: createDateOnly("2026-10-30"),
    phase: "base_building",
    status: "planned",
    kind: "rest",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: createPlannedWorkoutId("viewport-long"),
    userId,
    planId,
    scheduledDate: createDateOnly("2026-11-08"),
    phase: "marathon_training",
    status: "planned",
    kind: "run",
    purpose: "long",
    targetDistance: createDistanceMeters(16_093),
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

const root = document.querySelector("#root");
if (root === null) throw new Error("Plan viewport fixture root was not found.");
createRoot(root).render(
  <Calendar plan={plan} workouts={workouts} distanceUnit="mile" />,
);
