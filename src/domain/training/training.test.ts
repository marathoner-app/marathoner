import { describe, expect, it } from "vitest";
import {
  calculatePace,
  calculateShoeDistance,
  calculateTrainingAnalytics,
  calculateTotalDistance,
  createCompletedRunId,
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createPlannedWorkoutId,
  createShoeId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  kilometersToMeters,
  metersToKilometers,
  metersToMiles,
  milesToMeters,
  validateCompletedRun,
  validatePlannedWorkout,
  validateShoe,
  validateTrainingPlan,
  validateUserProfile,
  validateWorkoutForPlan,
  type CompletedRun,
  type PlannedWorkout,
  type Shoe,
  type TrainingPlan,
  type UserProfile,
} from ".";

const userId = createUserId("user-1");
const planId = createTrainingPlanId("plan-1");
const workoutId = createPlannedWorkoutId("workout-1");
const shoeId = createShoeId("shoe-1");
const createdAt = createUtcDateTime("2026-07-28T12:00:00Z");
const updatedAt = createUtcDateTime("2026-07-28T13:00:00Z");

const profile: UserProfile = {
  id: userId,
  displayName: "First-time Marathoner",
  preferredDistanceUnit: "mile",
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  createdAt,
  updatedAt,
};

const plan: TrainingPlan = {
  id: planId,
  userId,
  name: "First Marathon Journey",
  startDate: createDateOnly("2026-08-03"),
  targetRaceDate: createDateOnly("2027-05-02"),
  status: "active",
  createdAt,
  updatedAt,
};

const workout: PlannedWorkout = {
  id: workoutId,
  userId,
  planId,
  scheduledDate: createDateOnly("2026-08-03"),
  phase: "base_building",
  status: "planned",
  kind: "run",
  purpose: "easy",
  targetDistance: milesToMeters(3),
  createdAt,
  updatedAt,
};

const shoe: Shoe = {
  id: shoeId,
  userId,
  name: "Daily Trainer",
  startingDistance: milesToMeters(12),
  status: "active",
  createdAt,
  updatedAt,
};

const run: CompletedRun = {
  id: createCompletedRunId("run-1"),
  userId,
  plannedWorkoutPlanId: planId,
  plannedWorkoutId: workoutId,
  shoeId,
  startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  distance: milesToMeters(3),
  duration: createDurationSeconds(30 * 60),
  perceivedEffort: "about_right",
  unusualPain: false,
  createdAt,
  updatedAt,
};

describe("training domain primitives", () => {
  it("creates distinct identifiers and rejects unsafe document identifiers", () => {
    expect(createUserId("firebase-user-id")).toBe("firebase-user-id");
    expect(() => createTrainingPlanId(" ")).toThrow(/non-empty/);
    expect(() => createShoeId("users/shoe-1")).toThrow(/slashes/);
  });

  it("accepts real calendar dates and rejects impossible ones", () => {
    expect(createDateOnly("2028-02-29")).toBe("2028-02-29");
    expect(() => createDateOnly("2027-02-29")).toThrow(/real calendar day/);
    expect(() => createDateOnly("02/28/2027")).toThrow(/YYYY-MM-DD/);
  });

  it("accepts IANA time zones and normalizes UTC timestamps", () => {
    expect(createIanaTimeZone("America/New_York")).toBe("America/New_York");
    expect(createUtcDateTime("2026-07-28T12:00:00Z")).toBe("2026-07-28T12:00:00.000Z");
    expect(() => createIanaTimeZone("Eastern Time")).toThrow(/IANA/);
    expect(() => createUtcDateTime("2026-07-28T12:00:00-04:00")).toThrow(/UTC/);
    expect(() => createUtcDateTime("2027-02-29T12:00:00Z")).toThrow(/UTC/);
    expect(() => createUtcDateTime("2026-07-28Z")).toThrow(/UTC/);
  });

  it("converts display units to whole meters", () => {
    expect(milesToMeters(1)).toBe(1609);
    expect(kilometersToMeters(5)).toBe(5000);
    expect(metersToMiles(milesToMeters(5))).toBeCloseTo(5, 3);
    expect(metersToKilometers(kilometersToMeters(5))).toBe(5);
  });

  it("derives pace from distance and duration", () => {
    const pace = calculatePace(milesToMeters(5), createDurationSeconds(40 * 60), "mile");

    expect(pace?.secondsPerUnit).toBeCloseTo(480, 0);
    expect(pace?.unit).toBe("mile");
    expect(calculatePace(createDistanceMeters(0), createDurationSeconds(60), "mile")).toBeNull();
  });
});

describe("training domain validation", () => {
  it("accepts a representative connected training record", () => {
    expect(validateUserProfile(profile)).toEqual([]);
    expect(validateTrainingPlan(plan)).toEqual([]);
    expect(validatePlannedWorkout(workout)).toEqual([]);
    expect(validateWorkoutForPlan(workout, plan)).toEqual([]);
    expect(validateCompletedRun(run)).toEqual([]);
    expect(validateShoe(shoe)).toEqual([]);
  });

  it("rejects a plan whose race precedes its start", () => {
    const invalidPlan: TrainingPlan = {
      ...plan,
      startDate: createDateOnly("2027-05-03"),
    };

    expect(validateTrainingPlan(invalidPlan)).toContainEqual({
      field: "targetRaceDate",
      message: "Target race date cannot precede plan start date.",
    });
  });

  it("validates profile scheduling and recent-running inputs without methodology thresholds", () => {
    const invalidProfile: UserProfile = {
      ...profile,
      targetRace: {
        kind: "window",
        startDate: createDateOnly("2027-06-01"),
        endDate: createDateOnly("2027-05-01"),
      },
      currentRunningFrequencyDaysPerWeek: 8,
      recentPerformance: {
        completedOn: createDateOnly("2026-09-27"),
        distance: createDistanceMeters(0),
        duration: createDurationSeconds(0),
      },
      availableTrainingDays: ["tuesday", "tuesday"],
      preferredLongRunDay: "sunday",
    };

    expect(validateUserProfile(invalidProfile)).toEqual([
      {
        field: "targetRace.endDate",
        message: "Target race window cannot end before it starts.",
      },
      {
        field: "currentRunningFrequencyDaysPerWeek",
        message: "Current running frequency must be a whole number from 0 through 7.",
      },
      {
        field: "recentPerformance.distance",
        message: "Recent performance distance must be positive.",
      },
      {
        field: "recentPerformance.duration",
        message: "Recent performance duration must be positive.",
      },
      {
        field: "availableTrainingDays",
        message: "Available training days cannot contain duplicates.",
      },
      {
        field: "preferredLongRunDay",
        message: "Preferred long-run day must be one of the available training days.",
      },
    ]);
  });

  it("requires a run workout to have a positive distance or duration target", () => {
    const invalidWorkout: PlannedWorkout = {
      ...workout,
      targetDistance: createDistanceMeters(0),
    };

    expect(validatePlannedWorkout(invalidWorkout)).toContainEqual({
      field: "targetDistance",
      message: "A run or walk-run workout needs a positive target distance or duration.",
    });
  });

  it("rejects a workout outside its plan or owned by another user", () => {
    const invalidWorkout: PlannedWorkout = {
      ...workout,
      userId: createUserId("user-2"),
      scheduledDate: createDateOnly("2027-05-03"),
    };

    expect(validateWorkoutForPlan(invalidWorkout, plan)).toEqual([
      { field: "userId", message: "Workout and plan must belong to the same user." },
      {
        field: "scheduledDate",
        message: "Workout date must fall within the training plan date range.",
      },
    ]);
  });

  it("requires a completed run to have positive distance and duration", () => {
    const invalidRun: CompletedRun = {
      ...run,
      distance: createDistanceMeters(0),
      duration: createDurationSeconds(0),
    };

    expect(validateCompletedRun(invalidRun)).toEqual([
      { field: "distance", message: "Completed run distance must be positive." },
      { field: "duration", message: "Completed run duration must be positive." },
    ]);
  });

  it("requires retired shoes to include a retirement date", () => {
    const invalidShoe: Shoe = { ...shoe, status: "retired" };

    expect(validateShoe(invalidShoe)).toContainEqual({
      field: "retiredOn",
      message: "A retired shoe needs a retirement date.",
    });
  });
});

describe("training domain calculations", () => {
  it("totals completed run distance", () => {
    expect(calculateTotalDistance([run, { ...run, id: createCompletedRunId("run-2") }])).toBe(
      milesToMeters(6),
    );
  });

  it("derives shoe mileage from starting distance and matching runs", () => {
    const differentShoeRun: CompletedRun = {
      ...run,
      id: createCompletedRunId("run-2"),
      shoeId: createShoeId("shoe-2"),
      distance: milesToMeters(8),
    };
    const differentUserRun: CompletedRun = {
      ...run,
      id: createCompletedRunId("run-3"),
      userId: createUserId("user-2"),
      distance: milesToMeters(10),
    };

    expect(calculateShoeDistance(shoe, [run, differentShoeRun, differentUserRun])).toBe(
      milesToMeters(15),
    );
  });

  it("derives weekly and lifetime analytics from completed runs", () => {
    const nextWeekRun: CompletedRun = {
      ...run,
      id: createCompletedRunId("run-2"),
      plannedWorkoutPlanId: undefined,
      plannedWorkoutId: undefined,
      startedAt: createUtcDateTime("2026-08-10T14:00:00Z"),
      distance: milesToMeters(2),
      duration: createDurationSeconds(20 * 60),
    };

    const analytics = calculateTrainingAnalytics(
      [run, nextWeekRun],
      createDateOnly("2026-08-03"),
      "mile",
    );

    expect(analytics.totalDistance).toBe(milesToMeters(5));
    expect(analytics.weeklyDistance).toBe(milesToMeters(3));
    expect(analytics.totalRuns).toBe(2);
    expect(analytics.runsThisWeek).toBe(1);
    expect(analytics.averagePace?.secondsPerUnit).toBeCloseTo(600, 0);
  });
});
